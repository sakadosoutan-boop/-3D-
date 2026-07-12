# story/drafts — 未実装機能を含む脚本ドラフト置き場

ここは **`build-story` の対象外**（`story/chapters/` ではない）。まだエンジン未実装の
`gameMode` や `stage` フィールドを含む脚本を、実装前に本文・構造として先に確定しておくための場所。

## 現在のドラフト

| ファイル | 内容 | 設計書 |
|---|---|---|
| `meguri_ch1_pilot.json` | 第2ストーリーモード「巡り歌合」序章のパイロット脚本 | `docs/plans/SECOND_STORY_MODE_MEGURI.md` |

## chapters への昇格条件

ドラフトを `story/chapters/` の正式な章にするには:

1. 依存する新 `gameMode`（`utakai_meguri` / `kaimami_zure`）と `stage` 新フィールド
   （`loopIndex` / `seasonMismatch`）を `story_runtime.js` / `story_manager.js` に実装。
2. `chapter_manifest.json` に登録し、`chapterId` を正規の連番へ。
3. `npm run build:story` で本体HTMLへ同梱 → `npm run build:story:check`。
4. `npm run verify:story` / `npm run verify:routes` を通す。
5. `story/STYLE_RUBRIC.md` §3 で自己採点（全観点3以上）。

ドラフト段階では JSON として妥当であればよい（`python3 -c "import json;json.load(open(...))"`）。
