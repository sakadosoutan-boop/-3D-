"use strict";
/*
 * embed-sync.js — 本体HTMLの一部（CSS / ITEMS / WAKA_DATA / QUIZ_POOL …）を
 * src/app/ 以下の個別ソースへ分離し、ビルドで再注入する同期処理の共通ライブラリ。
 *
 * build-app-css.js / build-app-items.js が実装していた
 * 「マーカー2行挿入＋バイト同一往復＋--check」方式を一般化したもの。
 * committed HTML は常にビルド済み（＝そのまま GitHub Pages 配信可能）状態を保つ。
 *
 * 境界特定は2方式（manifest の kind で指定）:
 *   - "markers-exist": 既にマーカーが挿入済みのブロック（css/items 相当）。
 *                      マーカー間を src の内容で注入／チェックする。
 *   - "declaration":   初回抽出用。`const NAME=` から、対応する閉じ（] または }）＋
 *                      直後の `;` までを、文字列/テンプレート/コメント/エスケープを
 *                      追跡するステートマシンで特定する（build-app-items.js の
 *                      locateItemsBlock を [] / {} 両対応へ一般化）。
 *
 * バイト厳密方針: 抽出対象の中身は1バイトも変えない。I/O はすべて Buffer(utf8) で行い、
 * 改行コードを一切変換しない。Node 標準モジュールのみを使用する。
 */

const NL = 0x0a; // '\n'
const CR = 0x0d; // '\r'
const SP = 0x20; // ' '
const TAB = 0x09; // '\t'
const SQ = 0x27; // '
const DQ = 0x22; // "
const BT = 0x60; // `
const BS = 0x5c; // \
const SLASH = 0x2f; // /
const STAR = 0x2a; // *
const LBRACE = 0x7b; // {
const RBRACE = 0x7d; // }
const LBRACK = 0x5b; // [
const RBRACK = 0x5d; // ]
const DOLLAR = 0x24; // $
const SEMI = 0x3b; // ;

// マーカー同期に固有の失敗を表すエラー。呼び出し側で捕捉し、exit 1 の要約に使う。
class EmbedError extends Error {
  constructor(message) {
    super(message);
    this.name = "EmbedError";
  }
}

function bufOf(str) {
  return Buffer.from(str, "utf8");
}

// 本体HTML内のマーカー位置を検出する。重複・欠落・順序異常はここで観測可能にする。
function locateMarkers(html, begin, end) {
  const mbBuf = bufOf(begin);
  const meBuf = bufOf(end);
  const mb1 = html.indexOf(mbBuf);
  const me1 = html.indexOf(meBuf);
  const mb2 = mb1 < 0 ? -1 : html.indexOf(mbBuf, mb1 + mbBuf.length);
  const me2 = me1 < 0 ? -1 : html.indexOf(meBuf, me1 + meBuf.length);
  return { mb1, me1, mb2, me2, mbLen: mbBuf.length, meLen: meBuf.length };
}

// マーカーの有無を要約する（冪等な抽出判定用）。
//   "none"    … BEGIN/END とも無い（未抽出）
//   "both"    … BEGIN/END とも1個ずつ揃っている（抽出済み・正常）
//   "broken"  … 片方のみ／重複（破損）
function markerState(html, begin, end) {
  const m = locateMarkers(html, begin, end);
  const hasBegin = m.mb1 >= 0;
  const hasEnd = m.me1 >= 0;
  const dupBegin = m.mb2 >= 0;
  const dupEnd = m.me2 >= 0;
  if (!hasBegin && !hasEnd) return "none";
  if (hasBegin && hasEnd && !dupBegin && !dupEnd) return "both";
  return "broken";
}

// マーカーが「注入可能な正しい状態」であることを確認し、内容領域の境界を返す。
// 返り値: { contentStart, contentEnd } … 分離ソースの中身は html[contentStart, contentEnd)。
//   contentStart = BEGIN マーカー行の改行の次。contentEnd = END マーカーの直前。
function requireValidMarkers(html, begin, end, label) {
  const m = locateMarkers(html, begin, end);
  if (m.mb1 < 0 || m.me1 < 0) {
    throw new EmbedError(`${label}: マーカーが見つからない。初回は --extract を実行する。`);
  }
  if (m.mb2 >= 0 || m.me2 >= 0) {
    throw new EmbedError(`${label}: マーカーが重複している。本体HTMLを確認する。`);
  }
  const mbEnd = m.mb1 + m.mbLen; // BEGIN マーカー直後
  if (m.me1 <= mbEnd) {
    throw new EmbedError(`${label}: マーカーの順序が不正(END が BEGIN より前)。`);
  }
  if (html[mbEnd] !== NL) {
    throw new EmbedError(`${label}: BEGIN マーカー直後が改行でない。自動生成領域が壊れている。`);
  }
  return { contentStart: mbEnd + 1, contentEnd: m.me1 };
}

// マーカー間の内容（分離ソースに対応するバイト列）を切り出す。
function extractByMarkers(html, begin, end, label) {
  const { contentStart, contentEnd } = requireValidMarkers(html, begin, end, label);
  return html.subarray(contentStart, contentEnd);
}

// マーカー間へ content を注入した結果のHTML(Buffer)を組み立てる。
function injectByMarkers(html, begin, end, content, label) {
  const { contentStart, contentEnd } = requireValidMarkers(html, begin, end, label);
  const head = html.subarray(0, contentStart); // '...' + BEGIN + '\n'
  const tail = html.subarray(contentEnd); // END + '\n...'
  return Buffer.concat([head, content, tail]);
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

// マーカー間の内容が src バイト列と同期しているかを確認する。
// 返り値: { inSync:true } もしくは { inSync:false, diff:{offset,line} }。
function checkSync(html, begin, end, src, label) {
  const current = extractByMarkers(html, begin, end, label);
  if (Buffer.compare(current, src) === 0) return { inSync: true };
  return { inSync: false, diff: firstDiff(current, src) };
}

// `const NAME=` の宣言から、文字列/テンプレート/コメントを追跡しつつ
// 対応する閉じ括弧（] または }）を求め、その直後の `;`（空白許容）までをブロックとする。
// {}（オブジェクト）と []（配列）のどちらが最外でも扱えるよう一般化してある。
// 返り値: { blockStart, blockEnd } … ブロック本体は html[blockStart, blockEnd)。
//   blockStart = `const` の先頭。blockEnd = `;` の直後の改行の「次」(末尾改行を本体に含める)。
function locateDeclarationBlock(html, decl, label) {
  const tok = bufOf(decl);
  const first = html.indexOf(tok);
  if (first < 0) throw new EmbedError(`${label}: \`${decl}\` が見つからない。`);
  const second = html.indexOf(tok, first + tok.length);
  if (second >= 0) throw new EmbedError(`${label}: \`${decl}\` が複数存在する。1ブロック前提を満たさない。`);

  const blockStart = first; // 'const' の先頭
  if (blockStart > 0 && html[blockStart - 1] !== NL) {
    throw new EmbedError(`${label}: \`${decl}\` が単独行の先頭でない(直前が改行でない)。`);
  }

  const n = html.length;
  // `const NAME=` の直後、空白を許容して最初の開き括弧（{ または [）を探す。
  let p = first + tok.length;
  while (p < n && (html[p] === SP || html[p] === TAB || html[p] === CR || html[p] === NL)) p++;
  if (p >= n || (html[p] !== LBRACE && html[p] !== LBRACK)) {
    throw new EmbedError(`${label}: \`${decl}\` の直後に { または [ が見つからない。`);
  }
  const openIdx = p;

  // ステートマシン: UTF-8のマルチバイト継続バイトは常に 0x80 以上で ASCII 構造文字と
  // 衝突しないため、バイト単位の走査で安全に構造文字・改行を検出できる。
  let strQuote = 0; // 文字列中なら区切り文字(SQ/DQ)。0=非文字列。
  let lineComment = false; // // コメント中
  let blockComment = false; // /* */ コメント中
  const stack = []; // 'brace'({) / 'bracket'([) / 'template'(`) / 'interp'(${) のネスト
  const inTemplate = () => stack.length && stack[stack.length - 1] === "template";

  let closeIdx = -1;
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
      } // エスケープ: 次の1バイトを飛ばす
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
    if (c === LBRACK) {
      stack.push("bracket");
      continue;
    }
    if (c === RBRACE || c === RBRACK) {
      stack.pop(); // 'brace'/'bracket'/'interp' を閉じる
      if (stack.length === 0) {
        closeIdx = i; // 最外の開き括弧に対応する閉じ括弧
        break;
      }
      continue;
    }
  }
  if (closeIdx < 0) {
    throw new EmbedError(`${label}: 対応する閉じ括弧が見つからない(EOF到達/未閉のコメント・文字列・括弧)。`);
  }

  // 閉じ括弧の直後、空白を許容して `;` を探す。
  let j = closeIdx + 1;
  while (j < n && (html[j] === SP || html[j] === TAB || html[j] === NL || html[j] === CR)) j++;
  if (j >= n || html[j] !== SEMI) {
    throw new EmbedError(`${label}: ブロックの閉じ括弧の直後に \`;\` が無い。`);
  }
  const afterSemi = j + 1;
  // 末尾改行を本体に含める(css/items版と同じく、本体末尾がENDマーカー直前の改行になる)。
  if (afterSemi >= n || html[afterSemi] !== NL) {
    throw new EmbedError(`${label}: ブロックの \`;\` が単独行末でない(直後が改行でない)。`);
  }
  return { blockStart, blockEnd: afterSemi + 1 };
}

// declaration ブロックをマーカー付きへ書き換える。
// 返り値: { html:Buffer(書換後), body:Buffer(分離ソースの中身) }。
// 再結合の正当性(pre + body + post == 原本)を書き換え前に自己検証する。
function extractDeclaration(html, decl, begin, end, label) {
  const { blockStart, blockEnd } = locateDeclarationBlock(html, decl, label);
  const body = html.subarray(blockStart, blockEnd); // 'const NAME=...;\n'(末尾改行込み)
  const pre = html.subarray(0, blockStart);
  const post = html.subarray(blockEnd);

  const recomb = Buffer.concat([pre, body, post]);
  if (Buffer.compare(recomb, html) !== 0) {
    throw new EmbedError(`${label}: 抽出ブロックの再結合が原本と一致しない。境界特定が不正。`);
  }

  const out = Buffer.concat([
    pre, // '...\n'(const 直前の改行まで)
    bufOf(begin + "\n"), // BEGIN + '\n'
    body, // 同一バイト列('const NAME=...;\n')
    bufOf(end + "\n"), // END + '\n'
    post, // ';' の次の改行の後ろ
  ]);
  return { html: out, body };
}

module.exports = {
  EmbedError,
  NL,
  bufOf,
  locateMarkers,
  markerState,
  requireValidMarkers,
  extractByMarkers,
  injectByMarkers,
  checkSync,
  firstDiff,
  locateDeclarationBlock,
  extractDeclaration,
};
