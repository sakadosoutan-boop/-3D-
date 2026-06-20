# 引き継ぎ資料（最新） — 寝殿造り3D探訪

最終更新: 2026-06-20（第3セッション）。**これが最新の正本**。古い handoff ファイルは参考のみ。

## 0. 最重要
- 正本は GitHub **origin/main**。作業前と push 前に必ず `git fetch origin`。ローカルの古いHTMLを正本にしない。
- 現在の origin/main: **`77c81e5`**（公開済み・2026-06-20 第3セッション デプロイ完了）。
- 公開: main へ push すると GitHub Actions（`.github/workflows/pages.yml`）が自動デプロイ。
  - 公開URL: https://sakadosoutan-boop.github.io/-3D-/ （反映確認はキャッシュ回避 `?v=77c81e5`）
- 本体は単一HTML `寝殿造り3D探訪_統合版.html`（Three.js r128・四神WebP・選択的ブルーム用postprocessingを内蔵、オフライン動作）。

## 1. 並行開発ルール（重要）
- ClaudeとCodexが同じ巨大HTMLを同時に直接 main へ push しない。担当ごとにブランチ。
- 作業前・push前に origin/main を取り込み、衝突は両者の意図を確認して解決（片方を丸ごと捨てない）。
- 共有変更点に特に注意: `ITEMS` / `register()` / メインループ `animate` / CSSメディアクエリ / 音声初期化(`SFX`,`AmbientAudio`) / `TIMES`・`SOUNDSCAPE` / `QUALITY`・`BLOOM`・`GFX`。
- r128の旧カラーAPI（`outputEncoding`/`sRGBEncoding`/`texture.encoding`）を維持。新 `colorSpace` API は使わない。
- デスクトップ運用: フォルダをこのリポジトリの `git clone` にし、pull/push で同期（ユーザー方針）。

## 2. 検証
- JS構文: `node --check`（HTMLの3つ目 `<script>` を抽出して検査）。
  ```python
  import re
  html=open('寝殿造り3D探訪_統合版.html','r',encoding='utf-8').read()
  scripts=re.findall(r'<script>(.*?)</script>',html,re.DOTALL)
  open('/tmp/app_check.js','w').write(scripts[2])
  # → node --check /tmp/app_check.js
  ```
- 実機: PC＋スマホ相当で 移動/視点/タップ・全モード起動・音ON/OFF・季節/時間・画質プリセット。
- 公開HTMLが200で反映されているか（`?v=ハッシュ`）。

## 3. 実装済み全リスト（第3セッションまで）

### 基盤・配布
- メタ/OGP/インラインfavicon、PWA体裁、`README.md`、`index.html`（本体へリダイレクト）、Pages自動デプロイ、`.gitignore`。
- 設定永続化 `PREFS`（localStorage `shinden3d-prefs-v1`）= 季節/時刻/札/画質preset/bloom/ジョイ方式。
- WebGLコンテキスト喪失復帰、`prefers-reduced-motion`、safe-area（ノッチ/Dynamic Island対応）。
- **フレームレート上限** `APP_FPSCAP`（スマホ30fps/PC60fps）`PREFS`永続化。animate()先頭でドロップ。スマホ発熱・電池対策。
- **初回チュートリアル**: 散策モード初回起動時に操作ガイドを10秒表示（`localStorage "shinden3d-tutorial-done"` フラグ）。

### 描画・性能
- 適応的品質 `QUALITY`（ダイナミック解像度：pixelRatio/影を負荷で自動調整。`?adaptive=0`）。
- 選択的ブルーム `BLOOM`（r128 EffectComposer/UnrealBloomPass 内蔵。夜のみ自動・控えめ、`?bloom=0`）。
- 異方性フィルタ、`powerPreference:high-performance`、毎フレームの `THREE.Color` 再利用（GC軽減）。
- 画質設定UI `GFX`（上部バー「⚙ 画質」）: プリセット オート/高/中/低、ブルーム 自動/入/切、ジョイ 固定/どこでも。
- **影キャスター最適化**: サイズ0.6world単位未満の小物は `castShadow=false`（`noAutoShadow` userData フラグで除外可）。

### 操作
- タッチ: 移動と視点の**同時操作**、ジョイ**倒し切りダッシュ**、**どこでも押せるジョイ**（`joy.dynamic`）。
- ヘッドボブ（`bobPhase`/`bobAmp`、reduced-motionで無効）＋床材連動の足音（合成 `footstep`）。

### 天気・空・環境
- **朝→昼→夕→夜**の4時間帯（`TIMES`/`ENV_PAL`/`makeSkyEnv`）。
- 朝靄フォグ: dawn時 density=0.020、fog色白みがかり。
- **雨エフェクト `rainFall`**: 夏・秋にランダム間欠降雨（秋:高確率/長め、夏:低確率/短め、春冬:なし）。
  - `rainFall.userData = {rainSeason, rainOn, rainTimer}` で状態管理。`applySeason()` で季節変更時リセット。
  - 雨中は `#cloudOverlay`（灰色グラデーション div）がフェードイン。
  - 雨中は `moonMesh` / `moonHalo` / `moonRefl` を非表示。`fog.density=0.022`。
- **池面の月映り `moonRefl`**: CircleGeometry y=0.09、夜のみ揺らめくopacity（雨中は非表示）。
- **桜吹雪 `sakuraGust`**: 間欠的な突風で花びらが濃くなる2周波演出。

### ワールド/コンテンツ
- 四神 `addImageShishin`/`SHISHIN`: 築地の外に `depthTest:false` で出現。
- 火桶/炭櫃 `gimmicks.braziers`: タップ点火/消火＋焚火音。
- 北の対: 衣桁 `iko`・鏡台 `kyoudai`（`ITEMS`/図鑑/`QUIZ_POOL` 登録）。
- 鬼 `creatures.oni`: 2周波広域巡回。童 `makeWarawa`・雀は昼のみ。安倍晴明 `makeSeimei`: LatheGeometry体型改良。
- 草木: 不規則葉叢 `LEAF_CLUMP_GEOS`。桜吹雪は間欠突風。
- **ミニマップ `drawMinimap`**: 左上・絵巻風・「邸内/邸外」表示。烏帽子アイコン（向き付き）。
  - **NPC表示**: 散策/クエスト/垣間見中に姫君（ピンク●）・安倍晴明（金●）をマップ上に表示。
- **図鑑 `renderCodex`**: 未解放項目にカテゴリ別ヒント＋難易度★。和歌フォントは YuKyokasho 優先。
- **図鑑コンプリート称号**: 全図鑑（非和歌）解放時に「平安博士」トースト通知（`window._codexCompleteFired` フラグ）。
- **百人一首100首 `WAKA_DATA`**: 春夏秋冬各25首（計100首）。`wakaRevAuth`で詠み人表示済み。
- **ローカル順位 `LB`**（localStorage `shinden3d-lb-v1`）: クイズ/タイムアタックの結果に順位＋上位5。
- **クイズ難易度選択 `QUIZ_DIFF_CFG`**: 初級(8問)/中級(10問)/上級(12問)。ヒント1/2の出現タイミングも差別化。
- せせらぎ `SFX.updateSpatial`: 池から離れると減衰。
- **垣間見 `kaimamiUpdate`**: 危険度MAXで画面赤化 `#dangerVignette`。4スポット（几帳越し/東格子/北壁代/妻戸先）。
  - 几帳越しは南側・北向き方向チェック追加。成功時「再挑戦/散策」選択。
  - 巡回警備員: 定期停止+周囲スキャン（`kaimamiPlaceWatcher`）。逃走後の警戒モード（9秒）。
- 退治モード `taiji`: 3種の霊（`normal`/`strong`/`wander`）で色・サイズ・HP・動きが異なる結界（`makeTaijiKekkai`）。
- 貴族の一日: 男女選択モーダル `#questRolePicker`、会話は `#dialogueBubble`（女性篇4.5秒/台詞）。
- **可動調度品**: 屏風 `byoubuGroups`（折りたたみ）、厨子 `zushiGroups`（観音開き）、几帳 `kichouGroups`（カーテン）、唐櫃 `gimmicks.karabitsu`（別配列）。
  - 屏風の絵 `TEX.byoubu`: Canva制作の金地秋景大和絵「Autumn Yamato-e Byōbu」(design `DAHNGjt96Zo`) を1024x576のJPEG data URIで埋め込み。読込失敗時は従来の手続き生成画にフォールバック。4扇のパネルは元絵の横1/4ずつをUV分割（`u: i/4〜(i+1)/4`）して連続パノラマとして展開。差し替えは Canva を再エクスポート→base64化して同`<img>`の `src` を置換。

### Canva素材の組み込み（画像はすべてbase64 data URIで内蔵・オフライン動作）
- 各テクスチャ/画像は「Canva画像を読み込み、失敗時は手続き生成にフォールバック」する `new Image()` パターンで実装。差し替えは Canva 再エクスポート→base64化→該当 `src` 置換。
- **タイトル背景** `#title::before`: 金地大和絵の寝殿景 (design `DAHNG7TQ2vY`, 1920x1080)。暗ヴィネット＋微金グリッドを重ねて可読性確保。
- **白砂** `TEX.sand`: Canva砂質感をPILでシームレス化＋枯山水の掻き紋(平行溝)を合成したタイル。`repeat(20,20)`。タイル系は継ぎ目回避のためシームレス必須。
- **几帳** `TEX.kichou`: 有職文様の絹地 (design `DAHNHL4XnKM`)。1パネル1回マッピングで継ぎ目なし。壁代等で伸びる `tobari` は据え置き。
- **図鑑カテゴリ挿絵** `CODEX_CAT_IMG`（renderCodex直前で定義）: b建築/g建具/c調度品/p人物/x怪異/a生き物/s霊獣 の7枚を640px JPEGで内蔵。項目詳細(`#codexDetail`)に `.codex-illust` として表示。人物画は文字帯をPILでクロップ除去済み。
- 注意: 画像内蔵でHTMLは約3.3MBに増加。さらなる挿絵追加時はモバイル読み込みとのトレードオフに留意。
- **灯籠流し `tourouGroup`**: 夏の夜に池面を8基の和紙灯籠（PointLight付き）が漂う。
  - 小島(-20,34,r=4.6)(-4,40,r=3.4)との衝突を事前計算で回避した安全座標（南側開水面）に固定配置。

### URLフラグ
`?fps=1`（または `~`キー）計測オーバーレイ / `?adaptive=0` 適応品質OFF / `?bloom=0` ブルームOFF / `?shadowall=1` 全影キャスト。

## 4. 保留タスク（未実装・優先度順）

**大（設計・大改修が必要）**
1. **垣間見の経路整理（部分実装済み）**:
   - ❌ 4進入経路→3観察地点へ整理（`KAIMAMI_SECRETS` 配列の見直し: 几帳越し/東格子/北壁代/妻戸先の4つから3つへ）
   - ❌ 母屋正面を封鎖し妻戸経路のみに（`startKaimami()` で `skipSouth=true` を渡す `buildCollisionMesh()` は準備済み）
   - ❌ 2無音2有音スポット（女房なし2・女房ガード2）
2. ❌ 絵巻断片収集（コンテンツ設計未定）
3. ❌ 灯籠流し演出強化（現在は単純周回。波紋・流れる方向演出など）

**中**
4. オンライン全国順位: 静的Pagesではバックエンド必須（Supabase/Firebase/Cloudflare）。ローカル順位は実装済み。
5. 雅楽風BGM、AO/ライトマップベイク、絵巻物風ミニマップ本格化。
6. 貴族の体験(女性篇)パフォーマンス改善（重さの原因を特定して対処）。

**小**
7. `BENCHMARKS.md` に最新の `?fps=1` 数値を記録（要実機）。`sounds/CREDITS.md` の個別URL確定は未完。

## 5. 重要な実装メモ（次セッションで必要になりそうな知識）

### 主要オブジェクト・変数
```
rainFall          - 雨パーティクル Group。userData: {rainSeason, rainOn, rainTimer, noAutoShadow}
rainMat           - 雨の MeshBasicMaterial（opacity を animate で季節別に書き換え）
tourouGroup       - 灯籠流しグループ。userData.lanterns = [{lg, light, flame}×8]
moonRefl          - 池面の月映り CircleGeometry (y=0.09, x=-8, z=39)
pondCircles       - 池の境界円リスト [x, z, r] × 7（線2つは buildAfter に追加）
KAIMAMI_SECRETS   - 垣間見スポット定義 [{id,name,x,z,r,color,guarded}×4]
people[0]         - 姫君 NPC（ミニマップでピンク表示）
creatures.seimei  - 安倍晴明 NPC（ミニマップで金表示）
window._codexCompleteFired - 図鑑コンプリート称号通知の重複防止フラグ
localStorage "shinden3d-tutorial-done" - チュートリアル表示済みフラグ
```

### 池の小島座標（灯籠・NPC 配置時の干渉チェック用）
```
島1: cx=-20, cz=34, r=4.6
島2: cx=-4,  cz=40, r=3.4
```

### 雨の状態機械（animate()内）
```
rs.rainTimer -= dt;
if(rs.rainTimer <= 0) {
  if(rs.rainOn) { rainOn=false; timer=秋?30-100:80-220s }
  else          { rainOn=(random < 秋?0.72:0.38); timer=...  }
}
```

### CSS/HTML の重要ID
```
#cloudOverlay   - 雨/曇り空グレーオーバーレイ (z-index:5)
#dangerVignette - 垣間見の赤ビネット (z-index:37)
#tutorial       - 初回チュートリアルオーバーレイ (z-index:200)
#tutClose       - チュートリアルの「庭に出る」ボタン
```

## 6. 次セッションへ貼る短縮指示

```text
HANDOFF_LATEST.md を最初に全文読む。正本は GitHub origin/main（現在 77c81e5）。
最初に git fetch origin して最新pushを確認し、最新版から専用ブランチで作業。
単一HTMLなので共有変更点(ITEMS/register/animate/CSS/音声/TIMES/SOUNDSCAPE/QUALITY/BLOOM/GFX)に注意。
r128旧API維持(outputEncoding/sRGBEncoding/texture.encoding — colorSpaceは使わない)。
実装後は node --check（3つ目<script>ブロック抽出→node --check）、commit/push、Pages反映確認まで。
ローカルの古い差分を正本にしない・巻き戻さない。
```
