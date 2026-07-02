# Claude(fable) ストーリーモード精査レビュー

日付: 2026-07-02 ／ 対象: `codex/saigen-fix` のストーリーパッケージ一式
依頼書: `CLAUDE_STORY_MODE_REVIEW_REQUEST.md` の4観点(物語品質/分岐設計/実装リスク/UI・UX)に従う。

## 総評

**設計水準は非常に高い。** 小萩/栞の二重存在・3パラメータの物語的意味づけ・「言葉で名づけ直す」クライマックスは、学習ゲームの必然として全モードを束ねることに成功している。シナリオバイブルはこのまま作品の正典にできる。
一方で、**数値設計に「最良プレイがBad End Bに落ちる」構造欠陥**と、**True Endが現状のフラグ配布では到達不能**という2つの重大問題があった(いずれも本レビューで修正済み・検証済み)。

## 1. 物語品質

### 良い点
- 導入の速度が適切。第1話冒頭3イベントで「転移・叱責・選択」まで到達する。
- 選択肢が一貫して「価値観の選択」になっている(正解/不正解の皮を被った人格テスト)。
- ED4「常世の婿」の"美しいが恐ろしい"設計は、この作品で最も文学的な発明。教科書余白の平安装束の少年、は決めゴマとして強い。
- 判者の台詞(「歌は答えにあらず。問いを美しく置くものなり」)は作品の思想文になっている。

### 問題と対応

| # | 重大度 | 指摘 | 対応 |
|---|---|---|---|
| S-1 | 高 | **第1話JSONに「せりざわくん」の章末フックが無い**。ビートシート(seq_108)とバイブル(アニメ第1話の引き)の最重要伏線がJSON化で脱落していた | **修正済**: `seq_006_voice`(御簾の向こうの声)+`seq_007_kohagi_deny`(小萩が聞こえなかったふり、表情sad)を追加。flag `heardRealName` |
| S-2 | 高 | **第1話に秀頼の台詞がゼロ**。バイブルで人物の声(軽口→真剣)が定義されているのに、主人公が一言も喋らないまま章が終わる | **修正済**: `seq_002b`「なんであんた、俺の名前を知ってるんだ」を追加。小萩が名を知っている違和感をプレイヤーに明示的に握らせる(flag `kohagiKnewName`) |
| S-3 | 中 | 第1話でクイズ失敗→「もう十分だと言い張る」→そのまま章クリアは、クリア条件(クイズ5問)と矛盾 | **部分対応**: flag `skippedLessons` を追加。後章で小萩の台詞・侵食演出の分岐に使える。完全な再受講強制は「価値観の選択を尊重する」設計意図を汲み、あえて残した(危険な近道として成立) |
| S-4 | 中 | 第2話の中核「用語カードを正しい場所へ戻す」がJSON未実装(収集→即・左大臣テストに飛ぶ)。学習的に最も優れたビート | **提案**: `spawn_collectibles` の positions に `placeTarget:{x,z,r}` を持たせ、`StoryObjects.createTermCardObject` の `setPlacedTarget/tryPlace/resolve` で受ける(ファクトリ側は実装済み)。JSONの追加は第2話の本文化と同時が良い |
| S-5 | 低 | 白短冊の裏の栞の筆跡(バイブル伏線)がJSONに無い | **修正済**: seq_211 payload に `backText:"ここまで来て"` / `backHandwriting:"shiori"` を追加。ファクトリの白短冊は裏面がノート面の二面構造 |

## 2. 分岐設計

### 検証方法
StoryManagerをNodeで実走行させ、最良プレイ(観察型→正答→高評価クリア)の全章通しを自動化した(結果は下記)。

### 問題と対応

| # | 重大度 | 指摘 | 対応 |
|---|---|---|---|
| B-1 | **最重大** | **最良プレイがED4(Bad End B)に落ちる**。「良い選択」の報酬が fantasySynchro に偏っており(最良ルート実測: RE65 / FS117)、FS≧RE+25 のED4判定を必ず踏む。理想のプレイヤーほど婿入りする | **修正済**: `determineEnding` に「最終問で『あなた』と呼べた者(calledYou)はED4に落ちない」ガードを追加。ED4は「小萩を理想像として扱い続けた者」の結末という物語定義とも一致する |
| B-2 | 高 | **True Endが構造的に到達不能**。ED1は `utakaiPerfect`/`oniPerfect` を要求するが、現JSONは `utakaiWon`/`oniWon` しか配らない(QAメモ通り将来のミニゲーム評価待ち) | **修正済**: `requirements.requirePerfect:false` オプションを追加(勝利フラグで代用可)。**正式統合時はミニゲームブリッジが高評価時に `result.flags={utakaiPerfect:true}` を返すこと**。それまでchapter5の ending_check に requirePerfect:false を入れるかはCodex判断に委ねる(現状JSONは未変更) |
| B-3 | 中 | brainErosion 80到達時の「明確な警告」(バイブル要求)がManagerに無い | **修正済**: `onErosionWarning` フックを追加(80を跨いだ瞬間に一度だけ発火)。演出は `StoryObjects.createBrainErosionOverlay` の lv80 と対で使う |
| B-4 | 低 | ch4の `utakaiPrepScore`/`utakaiPrepScore2` はフラグ上書きであり加算されない(applyEffectsの仕様)。集計はブリッジ側で行う必要がある | 文書化のみ。キー名を `utakaiPrep1/2/3` に揃えるとなお良い |

### 検証結果(修正後・自動走行)
```
最良プレイ:        params {realityEgo:65, fantasySynchro:117, brainErosion:0}
  Perfect付与あり   → ED1_TRUE ✅
  Perfect無+calledYou → ED2_NORMAL ✅ (修正前はED4)
理想化ルート(FS90/RE30, calledYou無) → ED4_SYNC ✅ (ED4は生きている)
requirePerfect:false + 勝利のみ      → ED1_TRUE ✅
```

### True End条件の難度評価
RE60はやや遠い(最良ルートで65。寄り道の正答収入を含む)。**「現実寄り選択にもう少し配点を」**が次の調整方向。具体案: ch2右近会話(+2→+4)、ch3河童勝利(+8→+10)、ch5鬼勝利(+12→+14)。erosion≦20は「大きなミス1回まで」で妥当。

## 3. 実装リスク

| # | 指摘 | 対応 |
|---|---|---|
| R-1 | `file://` でfetch不可(README注意書き通り) | **修正済**: `window.STORY_EMBED` があればfetchせず同梱データを使うフォールバックをManagerに実装。単一HTML主義と両立(ビルド時にJSONを`<script>`に流し込む)。HTTP配信時は従来通り |
| R-2 | `loadChapter` がファイル名固定(QA改善候補2) | **修正済**: manifest優先でファイル名解決、失敗時は旧命名にフォールバック |
| R-3 | `season:"tokoyo"` は本体に存在しない季節 | **未対応(設計提示)**: ブリッジで `applySeason("winter")+setTime("night")` に落とし、見た目は `createTokoyoGlitchProps` + 空色の上書きで作るのを推奨。applySeason自体へのtokoyo追加は本体改修になるため統合フェーズで |
| R-4 | `cameraAngleId` の実座標が未定義 | **実装済**: `story_object_factories_draft.js` の `STORY_CAMERA_ANGLES` に16アングルを寝殿実寸で定義(章別カメラ思想に準拠: 1話=低目線/3話=遮蔽越し/5話=広角俯瞰)。`applySaigenCam` 互換の `{pos,look}` 形式 |
| R-5 | trigger_minigame のブリッジ仕様 | 依頼書提案の `resumeFromMiniGame({success,score,rank,flags,effects})` で十分。**注意**: 既存モードは終了時に `showResultPanel` を出すため、ストーリー起動時は結果パネルを抑制するフラグ(例 `APP.storyMiniGame=true`)が必要 |
| R-6 | セーブ復帰 | Manager現状で `chapterId/currentSequenceId` は保存済み。復帰導線は「load()→loadChapter(state.chapterId)→runCurrent()」の3行で成立する設計になっている(問題なし)。ただし**ミニゲーム中断中のセーブは lastMiniGame から再突入させる**処理が統合時に必要 |

## 4. UI/UX

- 会話ボックス高さ35%上限・選択肢44px以上のビートシート指針は、既存 `#modeBrief`/`#result` の実装と整合。**再現モードのHUD(sg-panel)を土台に流用するのが最短**(縦書き本文枠は不要なので簡略版)。
- ED結果画面は既存 `showResultPanel` の拡張で成立する(resTitle/resRank/resDetail+resActionsに「章選択/再挑戦」)。全モード共通仕様にできる。
- 隠しパラメータは通常非表示で正しい。ただし**brainErosionだけは20/40/60/80の段階演出で「見せない告知」をする**(オーバーレイ実装済み)。`?storyDebug=1` でレーダー表示の方針も妥当。
- スマホ縦: 選択肢が3つを超えないこと(現JSONは全て2〜3で適合)。

## 制作したオブジェクト(依頼書A〜D全16種+α)

`story/story_object_factories_draft.js`(本体未接続・単体で `node --check` 済)

| 分類 | ファクトリ | 依頼書要求への対応 |
|---|---|---|
| A-1 | createStoryKohagiObject | 薄紫紐(袖・風揺れ)/表情5種(目・眉・口・扇)/栞の制服半透明シルエット重畳 setShioriGhost(0..1) |
| A-2 | createStoryHidetoraObject | 冠3状態(tilted/straight/**deep**=ED4用)/袖口の腕時計/白い靴下風の沓 |
| A-3 | createStoryUkonObject | 立位/弓・矢筒(矢羽3本)・簡易太刀/構え2種 |
| A-4 | createMinisterObject | 威厳(1.18倍・笏・髭)/背後の影メッシュ setShadowReach(0..1)で**角の輪郭が伸びる**/憑依時の赤目 |
| A-5 | createUtakaiJudgeObject | 扇で顔半分/setFanText("題 雪"/"勝"/"負")のCanvas差替/setFanOpenで判定の瞬間だけ顔出し |
| B-1 | createWhiteTanzakuObject | 表=料紙・裏=ノート面(青罫+薄紫マージン線)の二面構造/ひらひら落下 updateFall |
| B-2 | createTermCardObject(label) | 縦書き発光札/setPlacedTarget+tryPlace→**正置で光輪+溶けて消える** |
| B-3 | createWakaTanzakuObject(word) | 縦書き一字/風に舞う揺れ |
| B-4 | createPurpleCordMotif | 蝶結び+二垂れ+房。attachToで袖/ノート/短冊に使い回し |
| C-1 | createMisuBoundaryEffect | 半透明御簾+風の無い揺れ/setMood("veil"/"connect")で裾が光る |
| C-2 | createTokoyoGlitchProps | 反転御簾(宙吊り)/浮遊札8枚の環/壊れた格子片/低負荷霧リング2枚 |
| C-3 | createBrainErosionOverlay | DOM/CSSのみ。lv20旧仮名揺らぎ/40ノイズ/60ビネット/80脈動+選択肢黒塗り用class/100全面侵食。reduced-motion尊重 |
| C-4 | createUtakaiStageProps | 判者席(畳台+茵)/火桶×2(熾火emissive)/高灯台×4(炎揺らぎ)/題札setTopic/静的雪 |
| D-1 | createGreatOniStoryObject | 既存鬼と差別化: 非対称角・裂いた御簾を纏う・**胸に琥珀の封印窓(小萩の短冊影+薄紫の結び)**/フェーズ3段(2=逆さ文字札の周回、3=封印発光) |
| D-2 | createNameSealEffect(label) | 名を呼ぶと点灯→浮上→光輪→消える(邸再構築の映画的クライマックス用) |
| D-3 | createFinalQuizThreeSeals | 三枚札 setLabels/resolve(idx,"correct"=光って昇る/"crack"=縦に割れる/"burn"=焦げて縮む) |
| +α | STORY_CAMERA_ANGLES | 16アングル(実寸座標・fov付き) |
| +α | disposeGroup/makePool/textTexture | リーク防止・プール・縦書きCanvas共通化 |

## 新フィールド(スキーマ登録済み・全6章に適用済み)

`fade`/`fx`/`se` は本体に**実装済みの波L演出キット(saigenFade/saigenLightning/saigenSe)と同名互換**。ブリッジは受け取った値をそのまま同関数へ渡せばよい。

- `fade:"black"|"white"` — 各章の幕開け/ED転換に配置済み
- `fx:"lightning"` — 大鬼出現(ch5)・水底の声(ch3)
- `se:"gong"|"bell"|"koto"|"thunder"|"wind"` — 歌合開幕の銅鑼、小萩登場の鈴 等
- `emotes:{actorKey:emote}` — 表情(neutral/smile/stern/sad/surprise)+所作(weep/nod/point/shy 他)
- `shioriGhost:0..1` — 小萩→栞の透け(ch5)
- `stage:{...}` — 題札・扇文字・大臣の影・冠状態・侵食レベル等の舞台指定

## 統合時チェックリスト(次フェーズ用)

1. ミニゲームブリッジ: `APP.storyMiniGame` で結果パネル抑制+`resumeFromMiniGame` へ評価返却(Perfectフラグ配布)
2. tokoyo季節のフォールバック(R-3)
3. ch2「正しい場所へ戻す」ビートのJSON化(S-4、ファクトリは受け入れ済み)
4. RE配点の微増(True End難度調整、B-4末尾の具体案)
5. ED5復帰時の「あなたの席は、まだ空いています」トースト(タイトル帰還フックに1行)
