#!/usr/bin/env node
/*
 * build-story.js — 物語モードの単一HTMLへの自動同梱ビルド。
 *
 * story/ の分割ソース(章JSON・StoryManager・StoryObjectsファクトリ・ランタイム)を、
 * 本体 寝殿造り3D探訪_統合版.html の同梱マーカー間へ機械的に埋め込む。
 * これまで手動で行っていた STORY_EMBED 生成＋3ファイル連結を1コマンドに集約し、
 * 「片方だけ直して同期し忘れる」事故を根絶する。
 *
 *   使い方: node scripts/build-story.js        (書き込み)
 *           node scripts/build-story.js --check (差分があれば非0で失敗。CI用)
 *
 * マーカー(本体HTML内、変更不可):
 *   /* ================== 波M: ストーリーモード同梱ここから ================== *\/
 *   ... (ここが毎回まるごと再生成される) ...
 *   /* ================== 波M: ストーリーモード同梱ここまで ================== *\/
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const HTML = path.join(ROOT, "寝殿造り3D探訪_統合版.html");
const MANIFEST = path.join(ROOT, "story/chapters/chapter_manifest.json");
const CHAPTER_FILES = [1, 2, 3, 4, 5, 6].map((i) => path.join(ROOT, `story/chapters/chapter${i}.json`));
const SOURCE_FILES = [
  path.join(ROOT, "story/story_manager.js"),
  path.join(ROOT, "story/story_object_factories_draft.js"),
  path.join(ROOT, "story/story_runtime.js"),
];
const MARK_START = "波M: ストーリーモード同梱ここから";
const MARK_END = "波M: ストーリーモード同梱ここまで";

function fail(msg) {
  console.error("build-story: " + msg);
  process.exit(1);
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    fail(`invalid JSON: ${path.relative(ROOT, p)} — ${e.message}`);
  }
}

function bodyOf(p) {
  const t = fs.readFileSync(p, "utf8");
  return t.endsWith("\n") ? t.slice(0, -1) : t; // 末尾改行だけ落として連結時の空行増殖を防ぐ
}

function buildEmbedLine() {
  const manifest = readJson(MANIFEST);
  const chapters = {};
  CHAPTER_FILES.forEach((p, i) => {
    chapters[String(i + 1)] = readJson(p);
  });
  return "window.STORY_EMBED=" + JSON.stringify({ manifest, chapters }) + ";";
}

function buildSection(startLine, endLine) {
  const lines = [startLine, buildEmbedLine()];
  SOURCE_FILES.forEach((p) => {
    bodyOf(p).split("\n").forEach((l) => lines.push(l));
  });
  lines.push(endLine);
  return lines;
}

function main() {
  const check = process.argv.includes("--check");
  if (!fs.existsSync(HTML)) fail(`missing ${path.relative(ROOT, HTML)}`);
  const lines = fs.readFileSync(HTML, "utf8").split("\n");
  const startIdx = lines.findIndex((l) => l.includes(MARK_START));
  const endIdx = lines.findIndex((l) => l.includes(MARK_END));
  if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) {
    fail("embed markers not found (or out of order) in the integrated HTML");
  }
  const section = buildSection(lines[startIdx], lines[endIdx]);
  const next = lines.slice(0, startIdx).concat(section, lines.slice(endIdx + 1));
  const out = next.join("\n");
  const prev = lines.join("\n");

  // 生成した同梱JSが構文的に妥当か軽くチェック(壊れたHTMLを吐かない)
  SOURCE_FILES.forEach((p) => {
    try {
      new Function(fs.readFileSync(p, "utf8"));
    } catch (e) {
      fail(`syntax error in ${path.relative(ROOT, p)} — ${e.message}`);
    }
  });

  if (check) {
    if (out !== prev) {
      fail("integrated HTML is OUT OF SYNC with story/ sources. Run: npm run build:story");
    }
    console.log(JSON.stringify({ status: "ok", inSync: true, sectionLines: section.length }));
    return;
  }
  if (out === prev) {
    console.log(JSON.stringify({ status: "ok", changed: false, sectionLines: section.length }));
    return;
  }
  fs.writeFileSync(HTML, out);
  console.log(JSON.stringify({ status: "ok", changed: true, sectionLines: section.length, htmlBytes: Buffer.byteLength(out) }));
}

main();
