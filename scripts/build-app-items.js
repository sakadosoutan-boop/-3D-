#!/usr/bin/env node
/*
 * build-app-items.js — 本体HTMLの図鑑データ `const ITEMS = {...};` ブロックを
 * src/app/items.js へ分離し、ビルドで再注入する同期ツール（ITEMSはちょうど1ブロックのみを対象）。
 *
 * build-app-css.js と同じ「マーカー間を機械的に再生成する」方式をITEMSへ適用したもの。
 * committed HTML は常にビルド済み（＝そのまま GitHub Pages 配信可能）状態を保つ。
 *
 *   使い方:
 *     node scripts/build-app-items.js            (注入: src/app/items.js → 本体HTML)
 *     node scripts/build-app-items.js --check    (同期確認。差分があれば非0で失敗。CI用)
 *     node scripts/build-app-items.js --extract  (初回移行: ITEMSブロックをitems.jsへ切り出しマーカー挿入。冪等)
 *
 * マーカー(本体HTML内、変更不可。この2行の JS コメントの間が自動生成領域):
 *   /* APP_ITEMS_EMBED_BEGIN (src/app/items.js から自動生成。ここを直接編集しない) *\/
 *   /* APP_ITEMS_EMBED_END *\/
 *
 * 境界特定: <style>のような閉じタグが無いため、開き `{` から文字列/テンプレート/コメントを
 * 追跡するステートマシンで深さを数え、深さ0に戻る `}` の直後の `;`（空白許容）までをブロックとする。
 *
 * バイト厳密方針: ITEMSの中身は1バイトも変えない。ファイルI/Oは Buffer で行い、
 * 改行コードを一切変換しない。
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const HTML = path.join(ROOT, "寝殿造り3D探訪_統合版.html");
const ITEMS = path.join(ROOT, "src", "app", "items.js");

// マーカー(1行まるごとの JS コメント)。前後に改行を付けて「独立した行」として扱う。
const MB = "/* APP_ITEMS_EMBED_BEGIN (src/app/items.js から自動生成。ここを直接編集しない) */";
const ME = "/* APP_ITEMS_EMBED_END */";
const NL = 0x0a; // '\n'

// ITEMSブロックの開始トークン。ちょうど1箇所だけ存在する前提(事前 grep で確認済み)。
const START_TOKEN = "const ITEMS = {";

// ステートマシン用のバイト定数。
const SQ = 0x27; // '
const DQ = 0x22; // "
const BT = 0x60; // `
const BS = 0x5c; // \
const SLASH = 0x2f; // /
const STAR = 0x2a; // *
const LBRACE = 0x7b; // {
const RBRACE = 0x7d; // }
const DOLLAR = 0x24; // $
const SEMI = 0x3b; // ;
const SP = 0x20;
const TAB = 0x09;
const CR = 0x0d;

function fail(msg) {
  console.error("build-app-items: " + msg);
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
// 返り値: { itemsStart, itemsEnd } … ITEMS本体は html[itemsStart, itemsEnd) に入る。
function requireValidMarkers(html) {
  const m = locateMarkers(html);
  if (m.mb1 < 0 || m.me1 < 0) {
    fail("APP_ITEMS_EMBED マーカーが見つからない。初回は --extract を実行する。");
  }
  if (m.mb2 >= 0 || m.me2 >= 0) {
    fail("APP_ITEMS_EMBED マーカーが重複している。本体HTMLを確認する。");
  }
  const mbEnd = m.mb1 + m.mbLen; // BEGIN マーカー直後
  if (m.me1 <= mbEnd) {
    fail("APP_ITEMS_EMBED マーカーの順序が不正(END が BEGIN より前)。");
  }
  if (html[mbEnd] !== NL) {
    fail("BEGIN マーカー直後が改行でない。自動生成領域が壊れている。");
  }
  // ITEMS本体は「BEGINマーカー行の改行の次」から「ENDマーカーの直前」まで。
  return { itemsStart: mbEnd + 1, itemsEnd: m.me1 };
}

// items.js を注入した結果のHTML(Buffer)を組み立てる。
function buildInjected(html) {
  const { itemsStart, itemsEnd } = requireValidMarkers(html);
  if (!fs.existsSync(ITEMS)) fail("missing " + path.relative(ROOT, ITEMS));
  const itemsBuf = fs.readFileSync(ITEMS); // raw bytes(改行変換しない)
  const head = html.subarray(0, itemsStart); // '...\n' + BEGIN + '\n'
  const tail = html.subarray(itemsEnd); // END + '\n...'
  return Buffer.concat([head, itemsBuf, tail]);
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

// `const ITEMS = {` の開き波括弧から、文字列/テンプレート/コメントを追跡しつつ
// 対応する閉じ波括弧を求め、その直後の `;`（空白許容）までをブロックとして返す。
// 返り値: { blockStart, blockEnd } … ブロック本体は html[blockStart, blockEnd)。
//   blockStart = 'const' の先頭。blockEnd = ';' の直後の改行の「次」(末尾改行を本体に含める)。
function locateItemsBlock(html) {
  const tok = Buffer.from(START_TOKEN, "utf8");
  const first = html.indexOf(tok);
  if (first < 0) fail("`" + START_TOKEN + "` が見つからない。");
  const second = html.indexOf(tok, first + tok.length);
  if (second >= 0) fail("`" + START_TOKEN + "` が複数存在する。ITEMS 1ブロック前提を満たさない。");

  const blockStart = first; // 'const' の先頭
  if (blockStart > 0 && html[blockStart - 1] !== NL) {
    fail("`const ITEMS` が単独行の先頭でない(直前が改行でない)。");
  }
  const openIdx = first + tok.length - 1; // '{' の位置

  // ステートマシン: UTF-8のマルチバイト継続バイトは常に 0x80 以上で ASCII 構造文字と衝突しないため、
  // バイト単位の走査で安全に '{' '}' '"' "'" '`' '/' '\\' 改行 を検出できる。
  const n = html.length;
  let strQuote = 0; // 文字列中なら区切り文字(SQ/DQ)。0=非文字列。
  let lineComment = false; // // コメント中
  let blockComment = false; // /* */ コメント中
  const stack = []; // 'brace'(素の{) / 'interp'(${) / 'template'(`) のネストスタック
  const inTemplate = () => stack.length && stack[stack.length - 1] === "template";

  let closeBrace = -1;
  for (let i = openIdx; i < n; i++) {
    const c = html[i];
    const d = i + 1 < n ? html[i + 1] : 0;
    if (lineComment) {
      if (c === NL) lineComment = false;
      continue;
    }
    if (blockComment) {
      if (c === STAR && d === SLASH) {
        blockComment = false;
        i++;
      }
      continue;
    }
    if (strQuote) {
      if (c === BS) {
        i++;
        continue;
      } // エスケープ次の1バイトを飛ばす
      if (c === strQuote) strQuote = 0;
      continue;
    }
    if (inTemplate()) {
      // テンプレートリテラルのテキスト部
      if (c === BS) {
        i++;
        continue;
      }
      if (c === BT) {
        stack.pop();
        continue;
      } // テンプレート終了
      if (c === DOLLAR && d === LBRACE) {
        stack.push("interp");
        i++;
        continue;
      } // ${ で式(コード)へ
      continue;
    }
    // コードモード
    if (c === SLASH && d === SLASH) {
      lineComment = true;
      i++;
      continue;
    }
    if (c === SLASH && d === STAR) {
      blockComment = true;
      i++;
      continue;
    }
    if (c === SQ || c === DQ) {
      strQuote = c;
      continue;
    }
    if (c === BT) {
      stack.push("template");
      continue;
    }
    if (c === LBRACE) {
      stack.push("brace");
      continue;
    }
    if (c === RBRACE) {
      stack.pop(); // 'brace' か 'interp' を閉じる
      if (stack.length === 0) {
        closeBrace = i; // 最外の '{' に対応する '}'
        break;
      }
      continue;
    }
  }
  if (closeBrace < 0) {
    fail("ITEMSブロックの対応する閉じ波括弧が見つからない(EOF到達/未閉のコメント・文字列・波括弧)。");
  }

  // 閉じ波括弧の直後、空白を許容して `;` を探す。
  let j = closeBrace + 1;
  while (j < n && (html[j] === SP || html[j] === TAB || html[j] === NL || html[j] === CR)) j++;
  if (j >= n || html[j] !== SEMI) {
    fail("ITEMSブロックの閉じ波括弧の直後に `;` が無い。");
  }
  const semiIdx = j;
  const afterSemi = semiIdx + 1;
  // 末尾改行を本体に含める(CSS版と同じく、本体末尾がENDマーカー直前の改行になる)。
  if (afterSemi >= n || html[afterSemi] !== NL) {
    fail("ITEMSブロックの `;` が単独行末でない(直後が改行でない)。");
  }
  return { blockStart, blockEnd: afterSemi + 1 };
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

  // ITEMSブロックの境界をステートマシンで特定。
  const { blockStart, blockEnd } = locateItemsBlock(html);
  const body = html.subarray(blockStart, blockEnd); // 'const ITEMS = {...};\n'(末尾改行込み)

  // 再結合の正当性(先頭部 + 本体 + 末尾部 == 原本)を書き換え前に自己検証する。
  const pre = html.subarray(0, blockStart);
  const post = html.subarray(blockEnd);
  const recomb = Buffer.concat([pre, body, post]);
  if (Buffer.compare(recomb, html) !== 0) {
    fail("抽出ブロックの再結合が原本と一致しない。境界特定が不正。");
  }

  // items.js へ書き出し(同一バイト列)。
  fs.mkdirSync(path.dirname(ITEMS), { recursive: true });
  fs.writeFileSync(ITEMS, body);

  // 本体HTMLをマーカー付きへ書き換え。挿入は BEGIN 行・END 行の2行のみ。
  const out = Buffer.concat([
    pre, // '...\n'(const 直前の改行まで)
    Buffer.from(MB + "\n", "utf8"), // BEGIN + '\n'
    body, // 同一バイト列('const ITEMS = {...};\n')
    Buffer.from(ME + "\n", "utf8"), // END + '\n'
    post, // ';' の次の改行の後ろ
  ]);
  fs.writeFileSync(HTML, out);
  console.log(
    JSON.stringify({
      status: "ok",
      extracted: true,
      itemsBytes: body.length,
      htmlBytes: out.length,
    })
  );
}

function doCheck() {
  const html = fs.readFileSync(HTML);
  const out = buildInjected(html);
  if (Buffer.compare(out, html) === 0) {
    console.log(JSON.stringify({ status: "ok", inSync: true, itemsBytes: fs.readFileSync(ITEMS).length }));
    return;
  }
  const d = firstDiff(html, out);
  fail(
    "本体HTMLが src/app/items.js と同期していない。`npm run build:app:items` を実行する。" +
      ` 最初の相違: 行 ${d.line} / バイト ${d.offset} (HTML長 ${html.length} / 注入後 ${out.length})`
  );
}

function doInject() {
  const html = fs.readFileSync(HTML);
  const out = buildInjected(html);
  if (Buffer.compare(out, html) === 0) {
    console.log(JSON.stringify({ status: "ok", changed: false, itemsBytes: fs.readFileSync(ITEMS).length }));
    return;
  }
  fs.writeFileSync(HTML, out);
  console.log(JSON.stringify({ status: "ok", changed: true, htmlBytes: out.length, itemsBytes: fs.readFileSync(ITEMS).length }));
}

function main() {
  if (!fs.existsSync(HTML)) fail("missing " + path.relative(ROOT, HTML));
  if (process.argv.includes("--extract")) return doExtract();
  if (process.argv.includes("--check")) return doCheck();
  return doInject();
}

main();
