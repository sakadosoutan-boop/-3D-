# 引継ぎ（次チャットへ） — 寝殿造り3D探訪

最終更新: 2026-06-22 / 作成: Claude Code セッション

## 0. まず最初に読む
- 正本は **GitHub `origin/main`**。最新 HEAD は push 後の値（直近セッションの公開コミットは下記「進捗」末尾）。
- 公開URL: https://sakadosoutan-boop.github.io/-3D-/ （反映確認はキャッシュ回避 `?v=<コミットハッシュ>`）
- メインファイルは1枚物 **`寝殿造り3D探訪_統合版.html`**（Three.js インライン、3つ目の `<script>` が本体）。
- 検証: `node scripts/verify-html.js`（構文・重複ID・音源参照・ITEMS/WAKA整合・QUIZ_POOL整合）。**編集後は必ず実行**（exit 0 が必須）。

## 1. 開発・公開ワークフロー（重要・厳守）
- 開発ブランチはセッションごとに指定される（例: 過去 `claude/gifted-brahmagupta-mqbn1w` /
  直近セッション `claude/busy-sagan-bg2t95`）。**そのセッションで指定された feature ブランチで作業**する。
- 公開（GitHub Pages）は **`main` へ push** が必要。ユーザーが「公開」と言ったら main へ push してよい。
- コミット手順（過去に `git reset --hard` で未コミット変更を消した事故あり → 厳守）:
  1. `node scripts/verify-html.js` で確認（exit 0 必須）
  2. `git add -A && git commit -m "..."`
  3. `git fetch origin main && git rebase origin/main`（Codex 並行編集のため）→ 再 verify
  4. push（`git push origin HEAD:main` と feature ブランチ両方）。**未コミットのまま checkout/reset --hard 禁止**。
- push は `git push origin <branch>`、ネットワーク失敗時のみ指数バックオフ(2/4/8/16s)で最大4回。
- **Codex が並行で main を編集**している。push が non-fast-forward で弾かれたら `git fetch origin main` →
  `git rebase origin/main` →（verify）→ push。これまでコンフリクトは無し（領域を分けているため）。

## 2. 制約（ユーザー指示）
- **トークンを極力節約**（タスクごとにモデルを使い分け、無駄な再読込・長文を避ける）。
- **Codex の作業領域は回避**: 樹木/植物の軽量化、物の怪退治(taiji)モードの詳細化はCodex担当。
  これらの大規模改修には手を出さない（小さな孤立改善なら可、ただし衝突注意）。
  - 注: 本セッションで **ユーザー明示指示により雪女(makeYukiOnna/配置)を改修**した。妖怪は taiji にも
    絡む領域なので、Codex と編集が重なったら push 前 rebase で要確認（今回は衝突なし）。
- docx は2つあり、**docx1=Codexが実装中 / docx2=こちらが「未実装のものを順に」実装**する方針。
  docx本文はチャット添付のみでリポジトリには無い。項目は下記「進捗」を参照。

## 3. このセッションで実装・公開済み（docx2）
| 区分 | 項目 | コミット |
|---|---|---|
| 性能 | #11 ラベルSpriteテクスチャ完全キャッシュ | ede8b19 |
| 性能 | #16 降下/雨/蛍パーティクルのジオメトリ共有プール | 314a163 |
| 見た目 | #19 柱脚に疑似AO接地影（放射グラデ円盤） | 071044b |
| 見た目 | #20 畳表テクスチャ512化＋織り質感 | 5977c3e |
| 見た目 | #27 夜は薄霧で遠景を青黒に（灯火の暖色を引立） | b874a43 |
| 見た目 | #24 池の月映りにさざ波の伸縮揺らぎ | 8b5b27c |
| 学習 | クイズ正解時に古文の窓の豆知識を提示 | ae9bf5a |
| 学習 | クイズ復習モード（間違えた札だけ再出題ボタン） | 8810757 |
| UI | #60 トップバー折りたたみトグル（localStorage保持） | 7dbbf43 |
| UI | #65 文字サイズ設定 標準/大/特大（解説・図鑑を zoom 拡大） | a8a14ec |
| UI | #62 図鑑に検索ボックス（名前/よみ/説明で絞り込み） | 50ebc91 |
| UI | #58 ヘルプを背景タップ・Escでも閉じられる | 4bb1ae2 |
| UI | #59 スマホ横持ちで解説/地図と下部操作を再配置 | 15624cb |
| 学習 | 解説段階化（説明→「もっと詳しく」で古文の窓展開、展開中は自動クローズ停止） | 73f6fb6 |
| 体験 | #40 撮影モード（UI全隠し、Pキー/設定/解除ボタン） | 9064f3f |
| 学習 | 用語カード（図鑑の第3タブ。古文重要語32枚＝重要語/敬語/文法、検索＋カテゴリ絞り込み） | 5721957 |
| 学習 | 用語カードに暗記モード（意味を隠してタップで答え合わせ＝フラッシュカード） | f9f12ee |
| 不具合/見た目 | 雪女が北の対にめり込んで不可視だったのを修正（建物外 z=-49 へ）＋ローポリで姿を一新 | (本セッション) |
| 退治モード | ボスラッシュ追加（雑魚なし・春→夏→秋→冬の四ボス連戦、季節ピッカーに⚔ボタン） | (本セッション最新) |
| 学習/保存 | 図鑑に収集データの引き継ぎ（書き出し/読み込みコード `SHINDEN1:`）を追加 | (本セッション) |
| 退治/操作 | ローリング回避(無敵時間)・ガード(メーター制)・スマホ親指パッド(攻撃/回避/ガード)・ジョイのデッドゾーン・クロスヘア強調 | e65bccb |
| 退治/配置 | ボス戦アリーナを東の開地(`TAIJI_BOSS_ARENA={x:30,z:-48,r:18,gateZ:-30}`)へ移設＋ボス戦中の鬼乱入を停止 | 5833c6a |
| 退治/ボス | 夏ボスを河童の主と提灯お化けに分離（`K.bosses`配列化・別HPバー#bossBar2・別の動き/攻撃） | 09253b7 |
| 退治/UI | 戦闘UIをエルデンリング風コーナー配置（HP左上/武器左下/攻撃・ガード右下）＋フリック回避＋ジャストガード=パリィ。全画面/横/PC共通 | 8b1bf0f |

## 4. 判断して「見送った」項目（理由つき。再開時は要再検討）
- **#17 レイキャスト空間分割**: pick はタップ駆動で実利益が微小。母屋/廂の大型建具は原点が遠く、
  半径カリングで誤除外＝一人称ピック破壊のリスク。安全のため見送り（ブロードフェーズ実装→撤回済み）。
- **#21 役割別装束柄**: makeHeianFigure（何度も作り込んだ人物コード）への高リスク・高トークン改修。
- **#66 キー再割り当て**: 移動キーが直書き（`keys.w||keys.arrowup` 等、html内 line ~8274）。
  全置換が必要で改修規模が大きい。やるなら bindings オブジェクト＋設定UI＋localStorage。

## 5. 残りの docx2 候補（未着手・優先順の目安）
- ~~用語カード~~ → **実装済み**（§3、図鑑の第3タブ）。`GLOSSARY` 配列に追記すれば語を増やせる。
- **音系 #51-57**（環境音の追加・調整など）= **ユーザー指示で保留中**。環境音/SE/BGM は全て
  mp3 ファイル方式（`AmbientAudio.pools`/`beds`/`se`/`bossBgm` ＋ `SOUNDSCAPE` スケジュール）で合成音ではない。
  戦闘SE・ボスBGMはライセンス未確認（§7）。再開条件: ①既存音源のバランス/スケジュール調整のみ
  ②docx の #51-57 仕様共有 ③ライセンス確定、のいずれか。
- 必要なら #66（キー再割り当て）も。
- 細かな見た目/学習の追い込み。

## 6. 主要コードの場所（html内、行は目安・Codex編集でズレ得る）
- `makeLabel` / ラベルテクスチャキャッシュ `_labelTexCache`/`_buildLabelTex`: line ~5226
- パーティクル `makeFalling`(共有geo) / `makeRain` / 蛍 `buildFireflies`(共有geo): line ~4500/4524/4443
- 柱脚AO `bakeShadow`（`MAT._aoDisc`/`MAT._aoGeo`）: 廂柱の直後 line ~3296
- フォグ/夜霧密度: line ~7710 / 月映り `moonRefl` 揺らぎ: line ~8120付近
- 畳テクスチャ `TEX.tatami`: line ~2034
- クイズ `startQuiz`(reviewIds対応) / `quizAnswer`(missed記録) / `endQuiz`(復習ボタン): line ~6652/6731/6776
- 図鑑 `renderCodex`(検索 `codexSearchTerm` / `matchSearch`): line ~6204、検索DOM `#codexSearch`
- 解説段階化: `#info .info-body.expanded` ＋ `#infoMore`、showInfo/`$("infoMore").onclick`: line ~6286
- トップバー折りたたみ: `#topbar.collapsed` CSS ＋ `applyTopbarCollapsed`/`#tbCollapse`: line ~6555
- 文字サイズ: `body.font-l/.font-xl` CSS（zoom）＋ `setFontScale`（PREFS保存）: line ~6472付近
- 撮影モード: `body.photo-mode` CSS ＋ `setPhotoMode`/`#gfxPhoto`/`#photoExit`/Pキー: line ~7766付近
- 用語カード: データ `const GLOSSARY`（重要語w/敬語k/文法g）＋ `renderGlossPage`/`setCodexTab("gloss")`、
  DOM `#codexTabGloss`/`#glossPage`/`#glossSearch`/`#glossHide`/`#glossFilterBar`/`#glossGrid`、
  暗記モード CSS `.gloss-grid.study`: glossary 定義は codex 関数群の直前（`let codexCatFilter` の上）。
- 雪女: `makeYukiOnna()`（白の十二単・垂髪・氷簪のローポリ）＋ 配置 `YOKAI_DEFS` の yukionna
  （`x:-7,y:0,z:-49` 北の対の北・建物外。ボス出現点 (0,0,-50) を避けて西へずらしてある）。
  毎フレーム更新は line ~8229（小さな上下揺れのみ）。
- ボスラッシュ: `APP.taijiBossRush` フラグ。季節ピッカー `#ssBossRush`（`showTaijiSeasonPicker`）→
  `startTaiji` で雑魚なし・`rushQueue=[春夏秋冬]`/`rushIndex`/`rushCleared` を持たせ最初のボスを `spawnBoss`。
  ボス撃破時の分岐は `updateBoss` 内 `b.hp<=0`（次の季節へ `K.season=...;spawnBoss(K)` か `endTaiji`）。
  結果画面は `endTaiji` 冒頭の `if(k.bossRush)` 分岐。秋ボスの第2形態(大鬼)もそのまま動く。
- 収集データ引き継ぎ: `_codexExportCode`/`_codexImportCode`（`SHINDEN1:`+base64）、DOM `#codexBackup`/
  `#codexBackupText`/`#codexExport`/`#codexImport`。localStorage `CODEX_KEY="shinden3d-codex-v1"` は
  本来オリジン単位で永続。リセットの主因は URL/オリジン差・ローカルファイル閲覧と推測（コード側にクリア処理は無い）。
- 退治の操作系(エルデンリング風): HUDは `#taijiHud`(inset:0 layer)＋ `#erStats`(左上HP/ガード/残り)・`#erItems`(左下武器スロット #twBow/#twSeal)・`#erActions`(右下 #tjGuardBtn/#tjFire)。
  回避=`taijiDodge()`(右下の回避↻ボタン #tjDodgeBtn / PCはSpace。移動入力方向へローリング、rollUntilで移動・dodgeUntilで無敵)。※フリック操作は誤爆のため廃止済み。
  ロックオン=Codex実装の #tjLockBtn / Lキー（`taijiSetLockOn`/`k.lockOn`/`k.lockTarget`）。#erActions は ロック/回避/ガード/攻撃 の4ボタン。
  ガード=`taijiSetGuard`/`k.guarding`/`k.guardMeter`。押した瞬間 `k.parryUntil`(230ms)が開き被弾で `taijiParry()`=無効＋反撃。長押し/キーリピートは `wasGuarding` で連続パリィ抑止。
  戦闘中はジョイを `joy.dynamic=true` に強制(左下を空ける)、退治終了で `APP._prevJoyDyn` に復元。`#tjDodgeBtn`/#tjCool は隠し(DOM参照維持)。退治中 `#interactBtn` は隠す。
- **【Codex要注意】退治ボスは複数体対応に変更**: `APP.taiji.bosses=[...]`（単体でも長さ1配列）＋ `APP.taiji.boss=bosses[0]`(後方互換)。
  各 boss は `{g,cfg,hp,maxHp,nextAtk,dead,movePhase,barId,wrapId,role}`。夏のみ河童(role:"kappa")＋提灯(role:"chochin")の2体。
  当たり判定/AOE/掃討/`updateBoss`/`updateBossMotion`/`bossAttack` は配列前提。共通操作は `taijiBossList(k)` を使う。
- アリーナ: `TAIJI_BOSS_ARENA={x:30,z:-48,r:18,gateZ:-30}`(東の開地)。霧門メッシュ/出現/誘導は arena 座標基準。
  ボス戦中(`bossSpawned`/`bossGate.triggered`/`bossRush`)は鬼を非表示にして乱入停止(描画ループの `_bossOn`)。

## 7. 音源ライセンス状況（`sounds/CREDITS.md`）
- 戦闘SE（効果音ラボ想定）・ボス戦BGM（ユーザー提供）はいずれも **ライセンス要確認**。
  公開前に出典・利用範囲を確定（再配布NGなら CC0 / 規約適合フリー素材へ差し替え）。

## 8. QA/CI
- `.github/workflows/verify.yml`: `verify`（node scripts/verify-html.js）＋ `smoke`（Playwright chromium で
  起動/全モード/音ON-OFF/季節時刻切替）。`smoke` は別ジョブで Pages デプロイをブロックしない。
- ローカル検証は `node scripts/verify-html.js` を最優先（軽量・確実）。
