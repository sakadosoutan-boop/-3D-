# 引き継ぎ資料（最新） — 寝殿造り3D探訪

最終更新: 2026-06-21（第5セッション / Codex検証基盤）。**これが最新の正本**。古い handoff ファイルは参考のみ。

## 0. 最重要
- 正本は GitHub **origin/main**。作業前と push 前に必ず `git fetch origin`。ローカルの古いHTMLを正本にしない。
- 現在の origin/main: **`bd71625`**（Claudeの生き物/門/畳テクスチャ調整まで反映済み）。
- 公開: main へ push すると GitHub Actions（`.github/workflows/pages.yml`）が自動デプロイ。
  - 公開URL: https://sakadosoutan-boop.github.io/-3D-/ （反映確認はキャッシュ回避 `?v=bd71625`）
- 本体は単一HTML `寝殿造り3D探訪_統合版.html`（Three.js r128・四神WebP・選択的ブルーム用postprocessingを内蔵、オフライン動作）。
- 直近の炎上: `77c81e5` で追加した初回チュートリアルが起動操作を塞いだため、`c67883e` でチュートリアル関連CSS/HTML/JSを完全削除して復旧済み。今後チュートリアルを戻す場合は全画面ロック型にしない。

## 1. 並行開発ルール（重要）
- ClaudeとCodexが同じ巨大HTMLを同時に直接 main へ push しない。担当ごとにブランチ。
- 作業前・push前に origin/main を取り込み、衝突は両者の意図を確認して解決（片方を丸ごと捨てない）。
- 共有変更点に特に注意: `ITEMS` / `register()` / メインループ `animate` / CSSメディアクエリ / 音声初期化(`SFX`,`AmbientAudio`) / `TIMES`・`SOUNDSCAPE` / `QUALITY`・`BLOOM`・`GFX`。
- r128の旧カラーAPI（`outputEncoding`/`sRGBEncoding`/`texture.encoding`）を維持。新 `colorSpace` API は使わない。
- デスクトップ運用: フォルダをこのリポジトリの `git clone` にし、pull/push で同期（ユーザー方針）。

## 2. 検証
- 基本静的検査: `node scripts/verify-html.js`
  - 3つ目のメイン `<script>` の構文
  - DOM ID重複と `$()` / `document.getElementById()` の参照欠落
  - `ITEMS` 必須項目、`WAKA_DATA` 100首・重複ID・季節値
  - HTML/JSが参照するmp3 23件の存在と `sounds/CREDITS.md` 記載
  - Three.js r128非対応の `SRGBColorSpace` / `.colorSpace` 混入
- 公開URL検査: `node scripts/verify-public-url.js https://sakadosoutan-boop.github.io/-3D-/ <hash>`
  - `index.html` と本体HTMLがHTTP 200で、タイトル文字列を含むことを確認。Pages deploy後にも自動実行。
- ブラウザスモーク（Playwright任意）: `node scripts/smoke-playwright.js`
  - canvas初期化、散策開始、図鑑、画質設定パネルの最低限を確認。
- ベンチ採取（Playwright任意）: `node scripts/collect-benchmark.js`
  - `renderer.info` からdraw calls / triangles / geometries / textures等をJSON出力。
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
- **初回チュートリアルは削除済み**: 起動不能を招いたため `c67883e` で撤去。散策ボタンは直接 `enterMode("walk")` へ接続。
- **HTML静的検証**: `scripts/verify-html.js` を追加。`.github/workflows/verify.yml` と Pages deploy 前に、メインJS構文、DOM ID重複、`ITEMS`/`WAKA_DATA`/音源CREDITS整合、r128非対応API混入を検査する。
- **公開後検証**: Pages deploy後に `scripts/verify-public-url.js` を実行し、公開URLのHTTP 200と最低限のHTML内容を確認する。
- **ローカル用ブラウザ検証**: `scripts/smoke-playwright.js` と `scripts/collect-benchmark.js` を追加。Playwrightが利用できる環境で起動スモークと描画統計を採取する。

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

### 調度品テクスチャ（手続き生成・ファイルサイズ増なし）
- **TEX.urushi（漆・梨地）**: 漆黒地＋金粉の梨地。`MAT.black`(color白に変更しmapを正しく表示)へ適用 → 二階厨子・帳台・楽器の台座・脇息など漆塗りの調度がまとめて高級感UP。
- **TEX.nishiki（有職錦・七宝つなぎ）**: 蘇芳地に金の七宝文。茵(shitone)・枕(makura)・円座の敷物に適用（従来の無地TEX.tobariから差し替え。壁代等のMAT.tobariは据え置き）。

### 門の開口・鯉の明滅/水紋・蝶の進行方向（2026-06）
- **北・西の築地に門用の開口**: これまで北・西壁は1枚の連続壁で門が壁に隠れていた。各壁を門位置(北x=0/西z=0)で2分割し幅~5mの開口を確保(東壁と同様)。閉扉が開口を塞ぐので穴は見えない。
- **四脚門(東門)の向き**: 突き出す門屋(π/2)が「縦」に見えるとの指摘で、築地と平行(rotation 0)に変更。これで東の棟門(0)・四脚門(0)とも壁と一直線。
- **鯉の明滅を修正**: 水面はy=0.06。鯉がy=0.05で水面の下にあり、半透明の水のソートで明滅・消失していた。鯉をy=0.12へ上げ、素材を不透明カットアウト(`transparent:false,alphaTest:.5`)化し透明ソートから除外。
- **水紋エフェクト**: 各鯉に同心円テクスチャの`ripple`平面を持たせ、広がって消えるループ(scale/opacity)で水紋を表現。
- **蝶の後ろ向き飛行を修正**: 頭の向きが固定回転(`a*1.5`)で軌道と無関係だった。速度ベクトル(位置の微分)から`atan2(vx,vz)`で進行方向へ頭を向けるよう変更。

### 鯉を上面視カットアウト化・蝶の胴縮小（2026-06）
- **鯉**: 3D球体ボディを廃し、Canva制作の上面視カットアウト(`KOI2_TEX` 紅白/三色/黄金/浅黄/緋写の5種、三色を実生成し他はPILで再配色)を水面に水平に寝かせた平面に変更(`koi.rotation.x=π/2`で頭=+z)。落ち影(半透明楕円)付き。泳ぎは進行方向(`rotation.y=-a`)＋ゆらぎ、水面でゆるく上下。「平たい錦鯉が浮かぶ」表現(参考画像準拠)。
- **蝶**: 胴が長く不自然だったため、胴を`.34→.2`、頭`.022→.018`に縮小。
- 旧`CRT_TEX.koi*`(球体用スキン)は未使用(残置)。
- **築地の棟門の向き修正**: 棟門は既定で「Z方向に広がりX方向に薄い」形状。東西壁(Z方向)には回転0、北壁(X方向)には回転π/2で揃うべきところ、逆になっていて全棟門が壁と直交していた(閉扉と相まって縦の壁に見えた)。西0/北π/2/東0に修正し築地と平行(flush)に。四脚門(東z=12)は突き出す門屋として意図的にπ/2のまま。

### 畳をCanvaテクスチャ化（2026-06）
- `CT2_TEX.tatami`(Canva制作のいぐさ織り)を`MAT.tatami.map`へ再代入(MAT定義直後の即時関数)。畳1枚=1マッピングで継ぎ目なし。縁(へり)は別メッシュ(ungen)が描くため、織り目のみのテクスチャが正解。
- **水面はCanva化を見送り**: 生成画像がパース付きでタイル化に失敗するため。既存の反射あり手続き水面(`TEX.water`+MeshPhysical)を維持。改善するならアニメ法線マップ等が要。

### 鯉の泳ぎ・蝶の羽ばたき・蛍札の修正（2026-06）
- **鯉**: 進行方向に頭(+z)を向ける(`rotation.y=-a`、旧`+π/2`で横泳ぎ＝尾が前だった)。体のくねり(`rotation.y/z`にsin)と尾びれグループ(`userData.tail`)の振りを追加。頭部を作り直し=小さな側面の目(白目+黒目)・下向きの口リング・前へ垂れる髭。
- **蝶**: 左右の翅を体中央で蝶番(`hinge`グループ)にし、z軸まわりに上下へ大きく羽ばたき(常にやや立てる`ang=0.22+flap*1.05`)。胴・頭も追加し「平らな紙が飛ぶ」印象を解消。
- **蛍の札バグ**: `fireflyOn`を`APP.time==="night"`で厳密化(旧`cur.moon>0.04`のみだと昼夜遷移中に月明かりが残り、蛍が極薄表示のまま名札だけ出た)。
- **季節の草花を増量**: 杜若5→13株、撫子4→12株。

### 鯉・蝶をCanva素材化／河童強化／動植物追加（2026-06）
- **鯉**: Canva制作の錦鯉の肌テクスチャ4種(`CRT_TEX.koiKohaku/koiOgon/koiSanshoku/koiAsagi`、紅白は実生成・黄金/三色/浅黄はその鱗から再配色)を体に貼り、5匹に巡回割当。ひれは体色に合わせた半透明、目・ひげ追加。
- **蝶**: Canva制作の蝶切り抜き(白背景を透過処理した`CRT_TEX.bflyYellow/bflyBlue`=揚羽/青)を左右に分割(`repeat.x=.5`/`offset.x`)して貼り、中央で羽ばたかせる。旧手続き翅(`TEX.bflyWing`)は不使用。
- **河童**: 亀の甲羅＋甲板の縁・腹(淡色)・皿のまわりの毛・黄のくちばし・白目＋夜光の瞳・水かきの手足を追加。
- **追加動植物**: 杜若(`kakitsubata`,池南の汀・春夏)・亀(`kame`,汀の石で甲羅干し・冬以外)を図鑑項目として追加(ITEMS/SEASONAL/descShort/register)。catは"a"。
- Canva画像は計~190KBをbase64で内蔵(`__CRT_TEX__`を置換)。HTMLは約3.57MB。差し替えは`CRT_TEX`の該当data URIを再生成。

### 生き物ディテール強化・河童移動・スマホ操作改善（2026-06）
- **鴛鴦**: 胸(紫栗)・白眉・橙の頬羽・目・扇状の銀杏羽・尾を追加。頭/首は緑の光沢(metalness)。
- **鯉**: 尾を二枚扇に、背びれ・胸びれ・2色まだら(2箇所)・目を追加。
- **蝶**: 翅を`TEX.bflyWing`(前翅+後翅をalphaで切抜き、material colorで着色)のPlaneに刷新。頭・触角を追加。羽ばたきは従来の`userData.wS`を流用。
- **藤棚**: 花房を8〜12段の先細り＆下ほど淡いグラデに(各段3輪)。房を10本に増やし、葉を羽状複葉(小葉5枚)に。
- **河童**: 反り橋(中島A→B, -15.8,35→-7,39)の真下で隠れていたため、開始地点から見える池南の汀 `(-8,0,26)` へ移動。
- **スマホのタップ取りこぼし**: 左半分の「動かさない素早いタップ」をジョイ操作ではなくアイテム選択として`pick()`へ流すよう判定追加(`joy._used`/`joy._t0`)。和歌短冊は小さく押しにくいので、各短冊に大きめ(0.5×0.74)の透明当たりを子meshとして追加し、`updateWakaVisibility`/収集時に表示連動。
- **葉群テクスチャ**: `TEX.leaves`(中立グレースケール)を`MAT.leaf/leaf2/pine/pineDark/momijiGreen/momijiRed`へ。colorで着色するため季節の色替え(冬の雪白化など)は維持。
- 注: 障子/襖・石灯籠はこのシーンに存在しないため対象外(灯籠は池の灯籠流しのみ)。牛車は指示により今回見送り。

### タイトルBGMの自動再生対策＋テクスチャ追加（2026-06）
- **自動再生**: ブラウザはユーザー操作前の発音を禁止するため真の自動再生は不可。対策として①`load`時に`SFX.playTheme()`をベストエフォートで試行(許可環境では即再生)、②`pointerdown/touchstart/keydown/click`のいずれの初回操作でも`tryStartTheme()`で確実に開始、③`#titleAudioHint`「画面をタップすると音楽が流れます」を鳴り出すまで表示(再生成功/enterModeで`hideTitleAudioHint`)。`SFX.playTheme`はAudioContext生成前でも鳴らせるよう単体Audioを遅延生成し、play()のPromiseを返す。
- **追加テクスチャ(手続き生成)**: `TEX.bark`(樹皮)→`MAT.trunk`、`TEX.hide`(牛の毛皮)→`MAT.ox`、`TEX.snowSurf`(積雪面)→`MAT.snowMat`。いずれも基色を従来色に合わせ、平面色だった箇所を質感化。
- **未着手のテクスチャ候補**: 植栽の葉群(ビルボード/UV調整が要るため保留)、障子・襖の紙、灯籠の石、牛車の各部。

### 几帳の柄バリエーション＋朱漆テクスチャ（2026-06 追加）
- **几帳4柄**: `KICHOU_MATS=[MAT.kichou(Canva絹), kichou2 立涌, kichou3 花菱格子, kichou4 亀甲]`。`kichou()`生成時に `_kichouPatN++` で順番に割り当て、邸内の複数の几帳が別柄になる。新柄は手続き生成(`TEX.kichou2/3/4`)でファイルサイズ増なし。
- **朱漆 `TEX.shu`**: 朱の漆塗り（下地の木目＋漆のムラ・ハイライト）。`MAT.shu`/`MAT.shuDark`(やや暗く着色)へ適用 → 高欄・反り橋・朱の梁など朱の構造材がまとめて質感UP。

### タイトルBGM＋タイトル環境音バグ（2026-06）
- **メインテーマ**: `sounds/悠久の伎楽.mp3`(64kbps 約9分)。`SFX.theme`に登録、`SFX.playTheme(0.25)`で小音量ループ。タイトルで初回タップ時に再生(autoplay制約のため)、`enterMode()`で`stopTheme()`。`setMuted`/`setBackgroundPaused`にも追従。※ルート直下にあった重複コピーは削除し、`sounds/`配下に一本化。
- **タイトルで環境音が鳴るバグを修正**: 原因は`AmbientAudio.init()`が合成せせらぎ/風と鳴き声タイマーをモード無関係に開始していたこと。対策=①合成gainの初期値を0にし`syncSynthLevels()`がタイトル中は常に0、②`startTimers`のtickでタイトル中は`SFX.schedule`を呼ばない、③`updateBed`は既にタイトルでbed停止済。→ タイトルはテーマのみ、ゲーム開始で環境音へ切替。

### SE・BGM 構成（2026-06 整理）
- **2系統**: ①`SFX`=実録mp3サンプル（`beds`環境ループ / `pools`鳴き声 / `loops.takibi`火音）、②`AmbientAudio`=Web Audio合成音（mp3欠損時の**フォールバック専用**）。
- **合成音の二重再生を解消**: `AmbientAudio.syncSynthLevels()` が、対応するmp3環境ループが読込済みなら合成のせせらぎ/風を無音化。`resume()`とタイマーtickで同期。→「池の音が重い・とぎれる」原因の一つ（mp3＋合成の重なり）を除去。
- **火音ループを1本に統合**: 旧 `_takibiMedia`(夜の篝火近接) と `_brazierMedia`(火桶点火＝**全域で鳴り続ける不具合**) を `_fireMedia` に統一。`updateSpatial`が「燃えている火源（夜の篝火KAGARIBI＋点火中のbraziers実ワールド座標）」の最近傍距離で音量を決め、離れれば自然に消える。→「焚火が鳴り続ける」を修正。`setBrazier()`は即時再計算トリガのみに簡素化。
- **クローン残留対策**: `playCall`は同時発音6本までに制限し、終了/失敗時に要素のsrcを解放（長時間プレイの肥大化＝処理落ち防止）。
- 注: mp3ループの継ぎ目「プツッ」は素材依存。完全gapless化はWeb Audio decode移行が必要（未実施）。

### Canva素材の組み込み（画像はすべてbase64 data URIで内蔵・オフライン動作）
- 各テクスチャ/画像は「Canva画像を読み込み、失敗時は手続き生成にフォールバック」する `new Image()` パターンで実装。差し替えは Canva 再エクスポート→base64化→該当 `src` 置換。
- **タイトル背景** `#title::before`: 金地大和絵の寝殿景 (design `DAHNG7TQ2vY`, 1920x1080)。暗ヴィネット＋微金グリッドを重ねて可読性確保。
- **白砂** `TEX.sand`: Canva砂質感をPILでシームレス化＋枯山水の掻き紋(平行溝)を合成したタイル。`repeat(20,20)`。タイル系は継ぎ目回避のためシームレス必須。
- **几帳** `TEX.kichou`: 有職文様の絹地 (design `DAHNHL4XnKM`)。1パネル1回マッピングで継ぎ目なし。壁代等で伸びる `tobari` は据え置き。
- **図鑑カテゴリ挿絵** `CODEX_CAT_IMG`（renderCodex直前で定義）: b建築/g建具/c調度品/p人物/x怪異/a生き物/s霊獣 の7枚を640px JPEGで内蔵。項目詳細(`#codexDetail`)に `.codex-illust` として表示。人物画は文字帯をPILでクロップ除去済み。
- 注意: 画像内蔵でHTMLは約3.3MBに増加。さらなる挿絵追加時はモバイル読み込みとのトレードオフに留意。
- **灯籠流し `tourouGroup`**: 夏の夜に池面を8基の和紙灯籠（PointLight付き）が漂う。
  - 小島(-20,34,r=4.6)(-4,40,r=3.4)との衝突を事前計算で回避した安全座標（南側開水面）に固定配置。
- **`08d16b4` 追加分**: 唐櫃を塗籠西壁寄りへ移動、冬の篝火BGMを篝火近接限定に変更、短冊14枚を池外へ再配置、和歌の季節分類を修正、俯瞰モード長押しワープを追加、鯉・蝶・蜻蛉・烏・竹・藤・撫子・松を追加、北の対の女房の向きを反転、伏籠・文箱・薫物を `ITEMS`/図鑑/クイズヒントへ追加。
- **`bd71625` 追加分**: 生き物ディテール強化、鯉/蝶のCanva素材化、河童/杜若/亀追加、畳いぐさ織りテクスチャ、北西築地の門開口、四脚門の向き補正、鯉の明滅/水紋、蝶の進行方向修正。
- **`codexFilterBar` 補修**: `renderCodex()` が動的生成していた図鑑フィルターバーのDOMをHTML側にも追加。静的検査で欠落を検出したため、将来のUI崩れを避ける目的。

### URLフラグ
`?fps=1`（または `~`キー）計測オーバーレイ / `?adaptive=0` 適応品質OFF / `?bloom=0` ブルームOFF / `?shadowall=1` 全影キャスト。

## 4. 保留タスク（未実装・優先度順）

**大（設計・大改修が必要）**
1. **垣間見の経路整理（部分実装済み）**:
   - ✅ 4進入経路→3観察地点へ整理（`KAIMAMI_SECRETS` は東格子/北壁代/妻戸先の3つ。UI文言とPlaywrightスモークも更新済み）
   - ✅ 母屋正面を封鎖し妻戸経路のみに（移動判定で `inBuildingEntrance(cx,cz,true)` を使い、南正面からの床上侵入を拒否済み）
   - ❌ 有音/無音スポットのゲーム性強化（現状は妻戸開閉音で警戒が上がるのみ。次は観察地点ごとの音リスク/女房ガード差を明確化）
2. △ 絵巻断片収集（邸内6か所に小さな絵巻断片を配置し、図鑑解放/保存/進捗通知まで実装済み。次は専用の完成絵巻ビューや断片並べ替え演出）
3. △ 灯籠流し演出強化（夏夜の灯籠に水紋・緩い流れ方向・進行回転を追加済み。次は岸辺/風向きに応じた経路制御や灯籠同士のばらつき強化）

**中**
4. オンライン全国順位: 静的Pagesではバックエンド必須（Supabase/Firebase/Cloudflare）。ローカル順位は実装済み。
5. 雅楽風BGM、AO/ライトマップベイク、絵巻物風ミニマップ本格化。
6. 貴族の体験(女性篇)パフォーマンス改善（重さの原因を特定して対処）。

**小**
7. 実機別の `?fps=1` 数値を `BENCHMARKS.md` に追加（Codex同梱Playwrightの基準値は記録済み）。`sounds/CREDITS.md` の個別URL確定は未完。
8. Playwrightスモーク検査をCIへ常時追加するか判断する。スクリプト自体は追加済みだが、CI常時実行は依存インストール時間と安定性を見てから。

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
scripts/verify-html.js - 単一HTML静的検証。main push時のPages deploy前にも実行。
scripts/verify-public-url.js - Pages deploy後のHTTP 200/最低限内容検査。
scripts/smoke-playwright.js - Playwright任意の起動スモーク検査。
scripts/collect-benchmark.js - Playwright任意のrenderer.info採取。
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
#tutorial       - 削除済み。再追加する場合は全画面ロック事故に注意。
#tutClose       - チュートリアルの「庭に出る」ボタン
```

## 6. 次セッションへ貼る短縮指示

```text
HANDOFF_LATEST.md を最初に全文読む。正本は GitHub origin/main（現在 bd71625）。
最初に git fetch origin して最新pushを確認し、最新版から専用ブランチで作業。
単一HTMLなので共有変更点(ITEMS/register/animate/CSS/音声/TIMES/SOUNDSCAPE/QUALITY/BLOOM/GFX)に注意。
r128旧API維持(outputEncoding/sRGBEncoding/texture.encoding — colorSpaceは使わない)。
実装後は `node scripts/verify-html.js`、必要に応じて `node scripts/smoke-playwright.js` / `node scripts/collect-benchmark.js`、commit/push、Pages反映確認まで。
ローカルの古い差分を正本にしない・巻き戻さない。
```
