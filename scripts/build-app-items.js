#!/usr/bin/env node
"use strict";
/*
 * build-app-items.js — 後方互換ラッパ。実処理は scripts/build-app.js + scripts/lib/embed-sync.js。
 * 本体HTMLの図鑑データ `const ITEMS = {...};`(src/app/items.js)のみを対象に、従来と同じ外部挙動を提供する:
 *   node scripts/build-app-items.js          (注入: src/app/items.js → 本体HTML)
 *   node scripts/build-app-items.js --check  (同期確認。差分があれば非0で失敗。CI用)
 *   node scripts/build-app-items.js --extract(抽出済みなら冪等に何もしない)
 * マーカー(APP_ITEMS_EMBED_BEGIN/END)と挙動は build-app.js / app-manifest.json 側で一元管理する。
 */
require("./build-app.js").runSingleCli("items");
