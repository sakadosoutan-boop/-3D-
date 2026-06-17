# 引き継ぎ資料（最新） — 寝殿造り3D探訪

最終更新: 2026-06-17。**これが最新の正本**。`NEXT_CHAT_GITHUB_HANDOFF.md` / `CLAUDE_HANDOFF.md` / `PROJECT_MAP.md` は過去経緯の参考に留める（記載のHEADやブランチ指示は古い）。

## 0. 最重要
- 正本は GitHub **origin/main**。作業前と push 前に必ず `git fetch origin` し、Claude/Codex 双方の最新を取り込む。ローカルの古いHTMLを正本にしない。
- 現在の origin/main: **`157e314`**（公開済み・2026-06-17 13:35 UTC デプロイ完了）。
- 公開: main へ push すると GitHub Actions（`.github/workflows/pages.yml`）が自動デプロイ。
  - 公開URL: https://sakadosoutan-boop.github.io/-3D-/ （反映確認はキャッシュ回避 `?v=157e314`）
- 本体は単一HTML `寝殿造り3D探訪_統合版.html`（Three.js r128・四神WebP・選択的ブルーム用postprocessingを内蔵、オフライン動作）。

## 1. 並行開発ルール（重要）
- ClaudeとCodexが同じ巨大HTMLを同時に直接 main へ push しない。担当ごとにブランチ。
- 作業前・push前に origin/main を取り込み、衝突は両者の意図を確認して解決（片方を丸ごと捨てない）。
- 共有変更点に特に注意: `ITEMS` / `register()` / メインループ `animate` / CSSメディアクエリ / 音声初期化(`SFX`,`AmbientAudio`) / `TIMES`・`SOUNDSCAPE` / `QUALITY`・`BLOOM`・`GFX`。
- r128の旧カラーAPI（`outputEncoding`/`sRGBEncoding`/`texture.encoding`）を維持。新 `colorSpace` API は使わない。
- デスクトップ運用: フォルダをこのリポジトリの `git clone` にし、pull/push で同期（ユーザー方針）。

## 2. 検証
- JS構文: `node --check`（HTMLの該当 `<script>` を抽出して検査）。3つ目の `<script>` がアプリ本体。
- 実機: PC＋スマホ相当で 移動/視点/タップ・全モード起動・音ON/OFF・季節/時間・画質プリセット。
- 公開HTMLが200で反映されているか（`?v=ハッシュ`）。

## 3. 実装済み（このセッションまで）

### 基盤・配布
- メタ/OGP/インラインfavicon、PWA体裁、`README.md`、`index.html`（本体へリダイレクト）、Pages自動デプロイ、`.gitignore`。
- 設定永続化 `PREFS`（localStorage `shinden3d-prefs-v1`）= 季節/時刻/札/画質preset/bloom/ジョイ方式。
- WebGLコンテキスト喪失復帰、`prefers-reduced-motion`、safe-area（ノッチ/Dynamic Island対応：上部バー・HUD・ミニマップに `env(safe-area-inset-*)`）。

### 描画・性能
- 適応的品質 `QUALITY`（ダイナミック解像度：pixelRatio/影を負荷で自動調整。L0=現状。降格 46fps/0.8s。`?adaptive=0`）。
- 選択的ブルーム `BLOOM`（r128 EffectComposer/UnrealBloomPass 内蔵。**夜のみ自動・控えめ**、月は減光し滲ませない、`?bloom=0`）。
- 異方性フィルタ（`canv`）、`powerPreference:high-performance`、毎フレームの `THREE.Color` 割当を再利用（`_scSky`等、GC由来のかくつき軽減）。
- 画質設定UI `GFX`（上部バー「⚙ 画質」）: プリセット オート/高/中/低、ブルーム 自動/入/切、ジョイ 固定/どこでも。

### 操作
- タッチ: 移動と視点の**同時操作**、ジョイ**倒し切りダッシュ**、**どこでも押せるジョイ**（`joy.dynamic`、`joySpawn`/`joyRelease`、左半分タップで出現）。
- ヘッドボブ（控えめ・`bobPhase`/`bobAmp`、reduced-motionで無効）＋床材連動の足音（合成 `footstep`）。

### ワールド/コンテンツ
- **朝→昼→夕→夜**の4時間帯（`TIMES`/`ENV_PAL`/`makeSkyEnv`。`SOUNDSCAPE` は未定義時間を昼にフォールバック）。
- 四神 `addImageShishin`/`SHISHIN`: 築地の外に `depthTest:false` で出現（壁に遮られない）、南=朱雀は池の島から見える（R拡大）。
- 火桶/炭櫃 `gimmicks.braziers`: タップ点火/消火＋焚火音（`SFX.setBrazier`）。
- 北の対: 衣桁 `iko`・鏡台 `kyoudai` を追加（`ITEMS`/図鑑/`QUIZ_POOL` 登録）。
- 鬼 `creatures.oni`: 2周波の広域巡回。童 `makeWarawa`・雀は昼のみ。安倍晴明 `makeSeimei`: 身頃を `LatheGeometry` で再造形（寸胴改善・腰紐・肩幅）。
- 草木: 共有の不規則葉叢 `LEAF_CLUMP_GEOS`（球体感解消・軽量）。桜吹雪は間欠突風 `sakuraGust`。
- ミニマップ `drawMinimap`: 左上・透明・「邸内/邸外」表示（自由散策/クイズのみ）。開始位置ボタン `tbHome`（Codex）。
- 図鑑 `renderCodex`: 未解放項目にカテゴリ別の発見ヒント＋難易度★。
- ローカル順位 `LB`（localStorage `shinden3d-lb-v1`）: クイズ/タイムアタックの結果に順位＋上位5。
- せせらぎ `SFX.updateSpatial`: 池から離れると減衰（floor 0.04 / range 20、spring/dayの水bed時）。
- 垣間見 `kaimamiUpdate`: 危険度MAXで画面赤化 `#dangerVignette`、発見ゲージを下中央。常時ビネット `#vignette`。
- 貴族の一日: 男女選択モーダル `#questRolePicker`（Codex）、会話は `#dialogueBubble`。

### URLフラグ
`?fps=1`（または `~`キー）計測オーバーレイ / `?adaptive=0` 適応品質OFF / `?bloom=0` ブルームOFF。

## 4. 保留タスク（未実装・優先度順）

**大（独立ブランチ・設計から）**
1. **垣間見の本改修（部分実装済み）**:
   - ✅ モード中だけ建物衝突（`157e314`で実装済み）
   - ✅ 几帳の操作（`5ce5540`で実装済み）
   - ❌ 4進入経路→3観察地点へ整理（現在4スポット: 几帳越し/東格子/北壁代/妻戸先）
   - ❌ 母屋正面を封鎖し妻戸経路のみに
   - ❌ 2無音2有音（2スポットは女房なし、2スポットは女房ガード）
   - ❌ クリア後に未達成地点へ挑戦する継続モード
2. ✅ 和歌短冊40枚の収集ループ（`8298122`で実装済み）。絵巻断片は未実装。

**中**
3. オンライン全国順位: 静的Pagesではバックエンド必須（Supabase/Firebase/Cloudflare）。匿名ID・スコア検証・不正対策・通信失敗時動作を決める。※ローカル順位は実装済み。
4. ✅ 垣間見モード中の当たり判定（`157e314`で実装済み）。通常モードでは無効（意図的）。
5. 雅楽風BGM、AO/ライトマップベイク、絵巻物風ミニマップ本格化。

**小**
6. `BENCHMARKS.md` に最新の `?fps=1` 数値を記録（要実機）。`sounds/CREDITS.md` はプレースホルダー更新済み・**個別URL確定は未完**。

## 5. 次セッションへ貼る短縮指示

```text
HANDOFF_LATEST.md を最初に全文読む。正本は GitHub origin/main（現在 ac51313）。
最初に git fetch origin して Claude/Codex の最新pushを確認し、最新版から専用ブランチで作業。
単一HTMLなので共有変更点(ITEMS/register/animate/CSS/音声/TIMES/SOUNDSCAPE/QUALITY/BLOOM/GFX)に注意。
r128旧API維持。実装後は node --check、実機(PC/スマホ)確認、commit/push、Pages反映確認まで。
ローカルの古い差分を正本にしない・巻き戻さない。
```
