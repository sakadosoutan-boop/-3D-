#!/usr/bin/env node
"use strict";
/*
 * build-app.js — manifest(scripts/app-manifest.json)駆動の汎用ビルドドライバ。
 * 本体HTMLの各データブロック（css / items / waka / quiz …）を src/app/ 以下の
 * 個別ソースと同期する。実処理は scripts/lib/embed-sync.js に集約している。
 *
 *   使い方:
 *     node scripts/build-app.js                 (注入: 全ブロックを src → 本体HTML)
 *     node scripts/build-app.js --check         (同期確認: 全ブロックをバイト比較。ズレたら exit 1)
 *     node scripts/build-app.js --extract=a,b   (初回抽出: 指定ブロックを declaration から切り出し)
 *
 * マーカー方式・バイト厳密方針は embed-sync.js のとおり。
 * committed HTML は常にビルド済み（そのまま GitHub Pages 配信可能）状態を保つ。
 */
const fs = require("fs");
const path = require("path");
const es = require("./lib/embed-sync.js");

const ROOT = path.resolve(__dirname, "..");
const HTML = path.join(ROOT, "寝殿造り3D探訪_統合版.html");
const MANIFEST = path.join(ROOT, "scripts", "app-manifest.json");

function loadManifest() {
  const raw = fs.readFileSync(MANIFEST, "utf8");
  const blocks = JSON.parse(raw);
  if (!Array.isArray(blocks) || blocks.length === 0) {
    throw new es.EmbedError("app-manifest.json が空、または配列でない。");
  }
  for (const b of blocks) {
    if (!b.name || !b.src || !b.begin || !b.end) {
      throw new es.EmbedError(`manifest エントリに name/src/begin/end が不足: ${JSON.stringify(b)}`);
    }
    b.absSrc = path.join(ROOT, b.src);
  }
  return blocks;
}

function findBlock(blocks, name) {
  const b = blocks.find((x) => x.name === name);
  if (!b) throw new es.EmbedError(`manifest に "${name}" ブロックが無い。`);
  return b;
}

function readHtml() {
  if (!fs.existsSync(HTML)) throw new es.EmbedError("missing " + path.relative(ROOT, HTML));
  return fs.readFileSync(HTML);
}

// 1ブロックの同期を確認し結果を返す（I/Oは読み取りのみ）。
function checkBlock(html, block) {
  if (!fs.existsSync(block.absSrc)) throw new es.EmbedError(`${block.name}: missing ${block.src}`);
  const src = fs.readFileSync(block.absSrc);
  const r = es.checkSync(html, block.begin, block.end, src, block.name);
  return { name: block.name, inSync: r.inSync, diff: r.diff, srcBytes: src.length };
}

// 1ブロックを src から html(Buffer) へ注入し、注入後のHTMLを返す（ファイルは書かない）。
function injectBlock(html, block) {
  if (!fs.existsSync(block.absSrc)) throw new es.EmbedError(`${block.name}: missing ${block.src}`);
  const src = fs.readFileSync(block.absSrc);
  return es.injectByMarkers(html, block.begin, block.end, src, block.name);
}

// 1ブロックを declaration から初回抽出する。html(Buffer)を受け取り、
// { html:書換後Buffer, extracted:bool, reason?, bytes? } を返す（ファイルは書かない）。
function extractBlock(html, block) {
  // 既にマーカーがあれば冪等に何もしない。
  const state = es.markerState(html, block.begin, block.end);
  if (state === "both") {
    return { name: block.name, html, extracted: false, reason: "already-extracted" };
  }
  if (state === "broken") {
    throw new es.EmbedError(`${block.name}: マーカーが片方だけ／重複の破損状態。手動で確認する。`);
  }
  if (block.kind !== "declaration" || !block.decl) {
    throw new es.EmbedError(`${block.name}: 初回抽出には kind:"declaration" と decl が必要。`);
  }
  const { html: out, body } = es.extractDeclaration(html, block.decl, block.begin, block.end, block.name);
  fs.mkdirSync(path.dirname(block.absSrc), { recursive: true });
  fs.writeFileSync(block.absSrc, body);
  return { name: block.name, html: out, extracted: true, bytes: body.length };
}

// --- CLI モード ---

function doCheck(blocks) {
  const html = readHtml();
  const results = blocks.map((b) => checkBlock(html, b));
  const bad = results.filter((r) => !r.inSync);
  if (bad.length) {
    console.error("build-app: 本体HTMLと分離ソースが同期していない。`npm run build:app` を実行する。");
    for (const r of bad) {
      console.error(`  - ${r.name}: 最初の相違 行 ${r.diff.line} / バイト ${r.diff.offset}`);
    }
    process.exit(1);
  }
  console.log(
    JSON.stringify({
      status: "ok",
      inSync: true,
      blocks: results.map((r) => ({ name: r.name, srcBytes: r.srcBytes })),
    })
  );
}

function doInject(blocks) {
  const original = readHtml();
  let html = original;
  for (const b of blocks) html = injectBlock(html, b);
  const changed = Buffer.compare(html, original) !== 0;
  if (changed) fs.writeFileSync(HTML, html);
  console.log(
    JSON.stringify({
      status: "ok",
      changed,
      htmlBytes: html.length,
      blocks: blocks.map((b) => b.name),
    })
  );
}

function doExtract(blocks, names) {
  let html = readHtml();
  const summary = [];
  for (const name of names) {
    const block = findBlock(blocks, name);
    const r = extractBlock(html, block);
    html = r.html;
    summary.push({ name: r.name, extracted: r.extracted, reason: r.reason, bytes: r.bytes });
  }
  fs.writeFileSync(HTML, html);
  console.log(JSON.stringify({ status: "ok", htmlBytes: html.length, extracted: summary }));
}

function parseExtractNames(argv) {
  const arg = argv.find((a) => a === "--extract" || a.startsWith("--extract="));
  if (!arg) return null;
  if (arg === "--extract") {
    throw new es.EmbedError("--extract=<name,...> の形式でブロック名を指定する。");
  }
  return arg
    .slice("--extract=".length)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function main() {
  try {
    const blocks = loadManifest();
    const argv = process.argv.slice(2);
    const extractNames = parseExtractNames(argv);
    if (extractNames) return doExtract(blocks, extractNames);
    if (argv.includes("--check")) return doCheck(blocks);
    return doInject(blocks);
  } catch (err) {
    if (err instanceof es.EmbedError) {
      console.error("build-app: " + err.message);
      process.exit(1);
    }
    throw err;
  }
}

// 後方互換ラッパ(build-app-css.js / build-app-items.js)用: 1ブロックだけを
// 従来スクリプトと同じ外部挙動（--check / 既定注入 / --extract 冪等）で処理する。
function runSingleCli(blockName) {
  const tag = "build-app-" + blockName;
  try {
    const block = findBlock(loadManifest(), blockName);
    const argv = process.argv.slice(2);
    if (argv.includes("--extract")) {
      const r = extractBlock(readHtml(), block);
      if (r.extracted) fs.writeFileSync(HTML, r.html);
      console.log(JSON.stringify({ status: "ok", extracted: r.extracted, reason: r.reason, bytes: r.bytes }));
      return;
    }
    if (argv.includes("--check")) {
      const r = checkBlock(readHtml(), block);
      if (!r.inSync) {
        console.error(`${tag}: 本体HTMLが ${block.src} と同期していない。\`node scripts/build-app.js\` を実行する。 最初の相違: 行 ${r.diff.line} / バイト ${r.diff.offset}`);
        process.exit(1);
      }
      console.log(JSON.stringify({ status: "ok", inSync: true, srcBytes: r.srcBytes }));
      return;
    }
    const original = readHtml();
    const out = injectBlock(original, block);
    const changed = Buffer.compare(out, original) !== 0;
    if (changed) fs.writeFileSync(HTML, out);
    console.log(JSON.stringify({ status: "ok", changed, srcBytes: fs.readFileSync(block.absSrc).length }));
  } catch (err) {
    if (err instanceof es.EmbedError) {
      console.error(`${tag}: ` + err.message);
      process.exit(1);
    }
    throw err;
  }
}

// ラッパ(build-app-css.js / build-app-items.js)から1ブロックだけ処理するための公開API。
module.exports = { loadManifest, findBlock, readHtml, checkBlock, injectBlock, extractBlock, runSingleCli, HTML };

if (require.main === module) main();
