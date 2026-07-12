#!/usr/bin/env node
/*
 * build-app-css.js — 本体HTMLの <style> ブロックを src/app/app.css へ分離し、
 * ビルドで再注入する同期ツール（CSSはちょうど1ブロックのみを対象）。
 *
 * build-story.js と同じ「マーカー間を機械的に再生成する」方式をCSSへ適用したもの。
 * committed HTML は常にビルド済み（＝そのまま GitHub Pages 配信可能）状態を保つ。
 *
 *   使い方:
 *     node scripts/build-app-css.js            (注入: src/app/app.css → 本体HTML)
 *     node scripts/build-app-css.js --check    (同期確認。差分があれば非0で失敗。CI用)
 *     node scripts/build-app-css.js --extract  (初回移行: <style>内容をapp.cssへ切り出しマーカー挿入。冪等)
 *
 * マーカー(本体HTML内、変更不可。この2行の CSS コメントの間が自動生成領域):
 *   /* APP_CSS_EMBED_BEGIN (src/app/app.css から自動生成。ここを直接編集しない) *\/
 *   /* APP_CSS_EMBED_END *\/
 *
 * バイト厳密方針: CSSの中身は1バイトも変えない。ファイルI/Oは Buffer で行い、
 * 改行コードを一切変換しない。
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const HTML = path.join(ROOT, "寝殿造り3D探訪_統合版.html");
const CSS = path.join(ROOT, "src", "app", "app.css");

// マーカー(1行まるごとの CSS コメント)。前後に改行を付けて「独立した行」として扱う。
const MB = "/* APP_CSS_EMBED_BEGIN (src/app/app.css から自動生成。ここを直接編集しない) */";
const ME = "/* APP_CSS_EMBED_END */";
const NL = 0x0a; // '\n'

// <style> はちょうど1組だけ存在する前提(事前 grep で確認済み)。属性なしの素の形。
const STYLE_OPEN = "<style>";
const STYLE_CLOSE = "</style>";

function fail(msg) {
  console.error("build-app-css: " + msg);
  process.exit(1);
}

// Buffer 中から文字列(utf8バイト列)を検索する小道具。
function idxOf(buf, str, from) {
  return buf.indexOf(Buffer.from(str, "utf8"), from || 0);
}

// 本体HTML内のマーカー位置を厳密に検出する。重複・欠落・順序異常はここで検出。
function locateMarkers(html) {
  const mbBuf = Buffer.from(MB, "utf8");
  const meBuf = Buffer.from(ME, "utf8");
  const mb1 = html.indexOf(mbBuf);
  const me1 = html.indexOf(meBuf);
  const mb2 = mb1 < 0 ? -1 : html.indexOf(mbBuf, mb1 + mbBuf.length);
  const me2 = me1 < 0 ? -1 : html.indexOf(meBuf, me1 + meBuf.length);
  return { mb1, me1, mb2, me2, mbLen: mbBuf.length, meLen: meBuf.length };
}

// マーカーが「注入可能な正しい状態」であることを確認し、境界オフセットを返す。
// 返り値: { cssStart, cssEnd } … CSS本体は html[cssStart, cssEnd) に入る。
function requireValidMarkers(html) {
  const m = locateMarkers(html);
  if (m.mb1 < 0 || m.me1 < 0) {
    fail("APP_CSS_EMBED マーカーが見つからない。初回は --extract を実行する。");
  }
  if (m.mb2 >= 0 || m.me2 >= 0) {
    fail("APP_CSS_EMBED マーカーが重複している。本体HTMLを確認する。");
  }
  const mbEnd = m.mb1 + m.mbLen; // BEGIN マーカー直後
  if (m.me1 <= mbEnd) {
    fail("APP_CSS_EMBED マーカーの順序が不正(END が BEGIN より前)。");
  }
  if (html[mbEnd] !== NL) {
    fail("BEGIN マーカー直後が改行でない。自動生成領域が壊れている。");
  }
  // CSS本体は「BEGINマーカー行の改行の次」から「ENDマーカーの直前」まで。
  return { cssStart: mbEnd + 1, cssEnd: m.me1 };
}

// app.css を注入した結果のHTML(Buffer)を組み立てる。
function buildInjected(html) {
  const { cssStart, cssEnd } = requireValidMarkers(html);
  if (!fs.existsSync(CSS)) fail("missing " + path.relative(ROOT, CSS));
  const cssBuf = fs.readFileSync(CSS); // raw bytes(改行変換しない)
  const head = html.subarray(0, cssStart); // '...<style>\n' + BEGIN + '\n'
  const tail = html.subarray(cssEnd); // END + '\n</style>...'
  return Buffer.concat([head, cssBuf, tail]);
}

// 最初に相違するバイト位置と行番号を求める(--check の差分要約用)。
function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  let line = 1;
  for (let j = 0; j < i; j++) if (a[j] === NL) line++;
  return { offset: i, line };
}

function doExtract() {
  const html = fs.readFileSync(HTML);
  // 既にマーカーがあれば冪等に何もしない。
  const m = locateMarkers(html);
  if (m.mb1 >= 0 && m.me1 >= 0) {
    if (m.mb2 >= 0 || m.me2 >= 0) fail("マーカーが重複している。手動で確認する。");
    console.log(JSON.stringify({ status: "ok", extracted: false, reason: "already-extracted" }));
    return;
  }
  if (m.mb1 >= 0 || m.me1 >= 0) {
    fail("マーカーが片方だけ存在する破損状態。手動で確認する。");
  }

  // <style> / </style> がちょうど1組であることを確認。
  const so = html.indexOf(Buffer.from(STYLE_OPEN, "utf8"));
  const sc = html.indexOf(Buffer.from(STYLE_CLOSE, "utf8"));
  if (so < 0 || sc < 0) fail("<style> または </style> が見つからない。");
  if (html.indexOf(Buffer.from(STYLE_OPEN, "utf8"), so + STYLE_OPEN.length) >= 0) {
    fail("<style> が複数存在する。CSS 1ブロック前提を満たさない。");
  }
  if (html.indexOf(Buffer.from(STYLE_CLOSE, "utf8"), sc + STYLE_CLOSE.length) >= 0) {
    fail("</style> が複数存在する。CSS 1ブロック前提を満たさない。");
  }
  if (sc <= so) fail("</style> が <style> より前にある。");

  const soEnd = so + STYLE_OPEN.length; // '<style>' 直後
  if (html[soEnd] !== NL) fail("<style> が単独行でない(直後が改行でない)。");
  if (html[sc - 1] !== NL) fail("</style> が単独行でない(直前が改行でない)。");

  // CSS本体 = '<style>' の次の改行の後 〜 '</style>' の直前(末尾改行を含む)。
  const cssBody = html.subarray(soEnd + 1, sc); // 例: ':root{...\n.tjf3-hint{...}\n'

  // app.css へ書き出し(同一バイト列)。
  fs.mkdirSync(path.dirname(CSS), { recursive: true });
  fs.writeFileSync(CSS, cssBody);

  // 本体HTMLをマーカー付きへ書き換え。挿入は BEGIN 行・END 行の2行のみ。
  const out = Buffer.concat([
    html.subarray(0, soEnd), // '...<style>'
    Buffer.from("\n" + MB + "\n", "utf8"), // '\n' + BEGIN + '\n'
    cssBody, // 同一バイト列
    Buffer.from(ME + "\n", "utf8"), // END + '\n'
    html.subarray(sc), // '</style>...'
  ]);
  fs.writeFileSync(HTML, out);
  console.log(
    JSON.stringify({
      status: "ok",
      extracted: true,
      cssBytes: cssBody.length,
      htmlBytes: out.length,
    })
  );
}

function doCheck() {
  const html = fs.readFileSync(HTML);
  const out = buildInjected(html);
  if (Buffer.compare(out, html) === 0) {
    console.log(JSON.stringify({ status: "ok", inSync: true, cssBytes: fs.readFileSync(CSS).length }));
    return;
  }
  const d = firstDiff(html, out);
  fail(
    "本体HTMLが src/app/app.css と同期していない。`npm run build:app:css` を実行する。" +
      ` 最初の相違: 行 ${d.line} / バイト ${d.offset} (HTML長 ${html.length} / 注入後 ${out.length})`
  );
}

function doInject() {
  const html = fs.readFileSync(HTML);
  const out = buildInjected(html);
  if (Buffer.compare(out, html) === 0) {
    console.log(JSON.stringify({ status: "ok", changed: false, cssBytes: fs.readFileSync(CSS).length }));
    return;
  }
  fs.writeFileSync(HTML, out);
  console.log(JSON.stringify({ status: "ok", changed: true, htmlBytes: out.length, cssBytes: fs.readFileSync(CSS).length }));
}

function main() {
  if (!fs.existsSync(HTML)) fail("missing " + path.relative(ROOT, HTML));
  if (process.argv.includes("--extract")) return doExtract();
  if (process.argv.includes("--check")) return doCheck();
  return doInject();
}

main();
