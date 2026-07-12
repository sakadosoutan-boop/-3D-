#!/usr/bin/env node
"use strict";
/*
 * verify-waka-notes.js — 和歌注釈データ(src/app/waka-notes.js)の整合検証。
 *
 * 教材データの正しさを機械的に守る（story/STYLE_RUBRIC.md §2）。
 *  - 各注釈の id が src/app/waka.js の歌 id に実在するか
 *  - 必須フィールド(kigo/goshaku/gihō/haikei/kanshō/shutten)が揃うか
 *  - id 重複がないか / goshaku・gihō が空配列でないか
 *  - hyakunin 番号が 1..100 の範囲か（付いている場合）
 * 差分があれば exit 1（CIに組み込み可能）。
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const NOTES = path.join(ROOT, "src/app/waka-notes.js");
const WAKA = path.join(ROOT, "src/app/waka.js");

function fail(msg) { console.error("verify-waka-notes: " + msg); process.exit(1); }

let notes;
try { notes = require(NOTES); } catch (e) { fail("waka-notes.js を読み込めません: " + e.message); }
if (!Array.isArray(notes) || notes.length === 0) fail("WAKA_NOTES が配列でない/空。");

const wakaText = fs.readFileSync(WAKA, "utf8");
const wakaIds = new Set([...wakaText.matchAll(/id:"([^"]+)"/g)].map((m) => m[1]));

const problems = [];
const seen = new Set();
const REQUIRED = ["kigo", "goshaku", "gihō", "haikei", "kanshō", "shutten"];

for (const n of notes) {
  if (!n.id) { problems.push("id 欠落のエントリがある"); continue; }
  if (seen.has(n.id)) problems.push(`id 重複: ${n.id}`);
  seen.add(n.id);
  if (!wakaIds.has(n.id)) problems.push(`waka.js に存在しない id: ${n.id}`);
  for (const k of REQUIRED) {
    if (n[k] == null || (typeof n[k] === "string" && !n[k].trim())) problems.push(`${n.id}: 必須フィールド欠落 ${k}`);
  }
  if (Array.isArray(n.goshaku) && n.goshaku.length === 0) problems.push(`${n.id}: goshaku が空`);
  if (Array.isArray(n.gihō) && n.gihō.length === 0) problems.push(`${n.id}: gihō が空`);
  if (n.hyakunin != null && !(Number.isInteger(n.hyakunin) && n.hyakunin >= 1 && n.hyakunin <= 100)) {
    problems.push(`${n.id}: hyakunin が範囲外 (${n.hyakunin})`);
  }
}

if (problems.length) {
  console.error("verify-waka-notes: 問題あり");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(JSON.stringify({
  status: "ok",
  notes: notes.length,
  hyakunin: notes.filter((n) => n.hyakunin).length,
  wakaIds: wakaIds.size
}));
