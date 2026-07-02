# ストーリーモード 実装用ビートシート

このファイルは `STORY_SCENARIO_BIBLE.md` を、実際の `chapterN.json` へ変換しやすい粒度に分解したものです。
各ビートは「場面の目的」「演出」「ゲーム処理」「分岐効果」をセットで管理します。

## 共通イベント命名

- `open`: 章冒頭の状況提示。
- `guide`: 小萩/右近などによる自然な説明。
- `learn`: 用語や作法の体験。
- `choice`: 価値観が出る選択。
- `minigame`: 既存モードへの接続。
- `reveal`: 謎や伏線の提示。
- `complete`: 章クリア。

## 第1話 春・朝「異邦の若君、御簾を叩く」

### 目的
プレイヤーに「ここはただの学習空間ではなく、作法を知らないと危ない世界」と体感させる。

### ビート

| ID | 種別 | 内容 | 演出 | パラメータ |
| --- | --- | --- | --- | --- |
| `seq_101_open_classroom` | effect | 現代教室の断片。黒板の寝殿造り図。 | チャイム、蛍光灯ノイズ、画面端に栞のノート。 | なし |
| `seq_102_shift_to_mansion` | set_scene | 春朝の母屋内部へ転移。 | 几帳布がワイプのように横切る。 | なし |
| `seq_103_kohagi_first_line` | dialogue | 小萩「これ、秀頼様。あな、見苦し。」 | 小萩の顔はまだ見せず袖と口元だけ。 | なし |
| `seq_104_first_choice` | choice | 反応を選ぶ。 | 御簾が揺れる。 | 下記 |
| `seq_105_learn_boundaries` | dialogue | 御簾/几帳/廂/母屋の意味説明。 | 各建具が淡く縁取り発光。 | fantasySynchro +3 |
| `seq_106_quiz_intro` | dialogue | 小萩「名を知らぬものは、触れてはなりませぬ。」 | UI目標更新。 | なし |
| `seq_107_minigame_quiz` | trigger_minigame | 初級名称当て5問。 | 既存クイズへ接続。 | 成功/失敗 |
| `seq_108_after_quiz_success` | dialogue | 御簾の向こうから「せりざわくん」。 | 現代チャイムが一瞬混じる。 | flag `heardRealName` |
| `seq_109_complete` | dialogue | 春の朝を越える。 | 桜花びら、カモメの遠声を初出。 | chapter1Cleared |

### `seq_104_first_choice` 選択肢

1. 「ここはどこだ？ と激しく問い詰める」
   - `realityEgo +10`, `brainErosion +5`
   - 小萩の距離が半歩遠くなる。
2. 「御簾の向こうの気配に静かに平伏する」
   - `fantasySynchro +15`
   - 小萩が初めて少し柔らかくなる。
3. 「まず出口と人の配置を確認する」
   - `realityEgo +6`, `fantasySynchro +3`
   - True End寄り。現代人の観察力と場への配慮の両立。

### 追加台詞候補
- 小萩「御簾は壁にあらず。見ぬまま相手を思うための、薄き約束にございます。」
- 秀頼「壁じゃないなら、なおさら厄介だな。」
- 小萩「厄介と思えるなら、まだ帰れましょう。」

## 第2話 夏・昼「光る詞を拾う」

### 目的
邸を歩く楽しさと、用語が空間理解に直結する快感を出す。

### ビート

| ID | 種別 | 内容 | 演出 | パラメータ |
| --- | --- | --- | --- | --- |
| `seq_201_open_heat` | set_scene | 夏昼、簀子と渡殿。 | 陽炎、遠いカモメ、強い影。 | なし |
| `seq_202_kohagi_warning` | dialogue | 邸の名が乱れていると説明。 | 用語札が逆さに浮く。 | なし |
| `seq_203_ukon_intro` | dialogue | 右近登場。軽口で探索説明。 | 右近は立ち姿、槍/弓を背負う。 | なし |
| `seq_204_spawn_cards` | spawn_collectibles | 用語カード5枚。 | 光る短冊状カード。 | なし |
| `seq_205_collect_check` | require_collectibles | 5枚回収確認。 | 足りない場合は右近が方角ヒント。 | なし |
| `seq_206_place_terms` | choice | 用語を正しい場所へ戻す。 | 正解場所が淡く呼吸する。 | 正答で両パラメータ |
| `seq_207_minister_test` | dialogue/choice | 左大臣の問い。 | 廂に出た左大臣。 | 下記 |
| `seq_208_white_tanzaku` | effect/dialogue | カモメが白短冊を落とす。 | 空から白が落ち、現代ノート片へ変化。 | flag `whiteTanzaku1` |
| `seq_209_complete` | dialogue | 小萩「名は、迷わぬための灯。」 | 夏音が引く。 | chapter2Cleared |

### 用語カード配置
- `sudare` ではなく `misu`: 御簾前。間違えると小萩が「それは垂るるものなれど、場が違います」と補足。
- `hisashi`: 母屋周縁。床の色が少し違う場所。
- `sunoko`: 高欄の内側ではなく外縁の板敷。
- `watadono`: 建物間の細い通路。
- `yarimizu`: 庭の水流。

### 左大臣テスト選択肢
問い: 「母屋と廂、何が違う」

1. 「中心と周縁。人との距離も変わります」
   - `realityEgo +5`, `fantasySynchro +8`
2. 「偉い人がいるところが母屋です」
   - `brainErosion +8`
3. 「どちらも部屋なので同じです」
   - `brainErosion +12`, 右近が慌てる。

### 追加台詞候補
- 右近「若君、札を拾う姿は立派な童でございますな。」
- 秀頼「褒めてないだろ、それ。」
- 小萩「童のように学ぶ者は、老いた賢者より遠くへ行くこともあります。」

## 第3話 秋・夕「秋夕、垣間見と水底の主」

### 目的
恋愛的な緊張、観察の倫理、怪異退治を一本につなぐ。

### ビート

| ID | 種別 | 内容 | 演出 | パラメータ |
| --- | --- | --- | --- | --- |
| `seq_301_open_dusk` | set_scene | 秋夕の南庭。 | 薄、虫声、赤い西日。 | なし |
| `seq_302_kaimami_intro` | dialogue | 小萩が垣間見の作法を語る。 | 御簾と几帳が視界を遮る。 | なし |
| `seq_303_ukon_joke` | dialogue | 右近が覗きすぎを注意。 | 右近が高欄から少し離れて立つ。 | なし |
| `seq_304_trigger_kaimami` | trigger_minigame | 垣間見ミッション。 | 視点ゲージは中央下。 | 評価受取 |
| `seq_305_observation_result` | choice | 何を覚えたか選ぶ。 | 姫君の顔は最後まで明確に出さない。 | 下記 |
| `seq_306_spawn_waka_cards` | spawn_collectibles | 和歌短冊5枚収集。 | 短冊が風で舞う。 | なし |
| `seq_307_reply_waka` | choice | 返歌の方向性を選ぶ。 | 短冊UI縦書き2行。 | 下記 |
| `seq_308_water_distortion` | effect | 遣水が黒く濁る。 | 水面に現代教室。 | brainErosionに応じて強弱 |
| `seq_309_kappa_boss` | trigger_minigame | 河童の主撃破。 | 夏ボス要素の短縮版。 | 成功/失敗 |
| `seq_310_shiori_reflection` | dialogue | 水面に栞の横顔。 | 小萩が袖で水面を隠す。 | flag `sawShioriReflection` |
| `seq_311_complete` | dialogue | 秋の章クリア。 | 月が昇りかける。 | chapter3Cleared |

### 観察結果選択肢
問い: 「あなたは、何を見たことにする？」

1. 「顔立ちを覚えた」
   - `brainErosion +12`
   - 小萩「見たものを語るほど、見えぬ心から遠ざかります。」
2. 「扇の模様と香の気配を覚えた」
   - `fantasySynchro +10`
3. 「見えなかったことを、そのまま覚えた」
   - `realityEgo +5`, `fantasySynchro +8`
   - True End寄り。

### 返歌選択肢
題材: 秋、霧、待つ、袖、月。

1. 「霧の向こうの月を待つ歌」
   - 高評価。`fantasySynchro +8`
2. 「早く会いたいと直接迫る歌」
   - 低評価。`brainErosion +10`
3. 「見えぬまま、袖に残る香を返す歌」
   - 最高評価。`realityEgo +3`, `fantasySynchro +12`, flag `wakaGracefulReply`

## 第4話 冬・夜「冬夜、歌合の火花」

### 目的
プレイヤーの知識・感性を試し、敗北が物語上の重みを持つ山場にする。

### ビート

| ID | 種別 | 内容 | 演出 | パラメータ |
| --- | --- | --- | --- | --- |
| `seq_401_open_snow` | set_scene | 冬夜、火桶と雪。 | 雅楽BGM、灯火。 | なし |
| `seq_402_minister_appears` | dialogue | 左大臣が廂に出て歌合宣言。 | 高欄に食い込まない位置。 | なし |
| `seq_403_judge_intro` | dialogue | 判者登場。題を告げる。 | 扇で顔半分を隠す。 | なし |
| `seq_404_topic_snow` | choice | 一番「雪」。 | 雪片が選択肢に落ちる。 | 勝敗点 |
| `seq_405_topic_wait` | choice | 二番「待つ」。 | 灯火が揺れる。 | 勝敗点 |
| `seq_406_topic_return` | choice | 三番「帰る」。 | 現代チャイムが遠く鳴る。 | 勝敗点、ED寄与 |
| `seq_407_utakai_result` | trigger_minigame/effect | 既存歌合結果と統合。 | 判者コメントを結果前に挟む。 | 2勝以上 |
| `seq_408_win` | dialogue | 小萩が敬意を示す。 | 小萩の顔を初めて正面気味に。 | flag `utakaiWon` |
| `seq_409_lose_ed3` | ending | 敗北時ED3。 | 火桶が消える。 | ED3 |
| `seq_410_complete` | dialogue | 冬章クリア。 | 灯火が狐火配置の伏線になる。 | chapter4Cleared |

### 勝敗判定案
各題でA/B/Cを選び、内部点を加算。既存歌合ミニゲームを使う場合は、この選択で開始時ボーナスや判者コメントを変える。

- 2点: 場・季節・相手の三要素が揃う。
- 1点: 季節か感情のどちらかは合う。
- 0点: 直接的すぎる、現代的すぎる、相手を責める。

### 三番「帰る」選択肢
1. 「帰る朝だけを願う歌」
   - `realityEgo +12`
2. 「帰らぬ夢だけを願う歌」
   - `fantasySynchro +14`
3. 「帰る袖にも、残る香があると詠む歌」
   - `realityEgo +8`, `fantasySynchro +8`, True End寄り。

## 第5話 常世・黎明「常世の黎明、大鬼祓い」

### 目的
全ての学習とゲームプレイを総決算し、戦闘後に言葉で決着させる。

### ビート

| ID | 種別 | 内容 | 演出 | パラメータ |
| --- | --- | --- | --- | --- |
| `seq_501_open_tokoyo` | set_scene | 常世の黎明。 | 反転した御簾、浮遊する札。 | なし |
| `seq_502_kohagi_glitch` | dialogue/effect | 小萩が栞の姿に揺れる。 | 低ノイズ、薄紫紐が光る。 | brainErosionに応じて変化 |
| `seq_503_minister_possessed` | dialogue | 左大臣が大鬼の声になる。 | 影が巨大化。 | なし |
| `seq_504_oni_reveal` | effect | 大鬼出現。 | 御簾を裂いて登場。 | なし |
| `seq_505_boss_battle` | trigger_minigame | 大鬼戦。 | 霧結界、HP表示、武器カルーセル。 | 勝敗/被弾数 |
| `seq_506_after_battle` | dialogue | 小萩が短冊に封じられる。 | 鬼の胸部に短冊。 | なし |
| `seq_507_final_quiz_1` | choice | 破魔の連札1: 御簾。 | 正しい札が光る。 | 誤答brainErosion |
| `seq_508_final_quiz_2` | choice | 破魔の連札2: 和歌。 | 短冊が舞う。 | 誤答brainErosion |
| `seq_509_final_quiz_3` | choice | 破魔の連札3: 小萩をどう呼ぶか。 | 音が消える。 | 最重要 |
| `seq_510_ending_check` | ending_check | ED1/2/4判定。 | 朝光。 | ルート確定 |

### 最終クイズ案

#### 問1
「御簾とは、何をするものか」

- 「相手を完全に隠す壁」
  - 誤答。`brainErosion +20`
- 「見えぬ相手へ礼を保つ境」
  - 正答。`fantasySynchro +5`
- 「偉い人だけが使う飾り」
  - 誤答。`brainErosion +15`

#### 問2
「返歌に必要なのは何か」

- 「相手の言葉を受け、季節に返すこと」
  - 正答。`fantasySynchro +5`, `realityEgo +3`
- 「自分の気持ちを一番強く言うこと」
  - 誤答。`brainErosion +15`
- 「相手より難しい言葉を使うこと」
  - 誤答。`brainErosion +12`

#### 問3
「目の前の人を、何と呼ぶ」

- 「小萩」
  - fantasySynchro寄り。ED4に寄るが即誤答ではない。
- 「栞」
  - realityEgo寄り。ED2に寄るが、小萩を否定しすぎる。
- 「あなた」
  - True End寄り。`realityEgo +8`, `fantasySynchro +8`, flag `calledYou`

## 第6話 春・朝「帰る朝、残る香」

### 目的
結果画面を「物語のラストシーン」として体験させる。

### ED1 ビート
1. `seq_601_ed1_classroom`: 教室で目覚める。
2. `seq_602_ed1_tanzaku`: 机に白短冊。
3. `seq_603_ed1_shiori`: 栞と会話。
4. `seq_604_ed1_line`: 秀頼「御簾って、ただ隠すためのものじゃないんだな。」
5. `seq_605_ed1_unlock`: 回想/称号解放。

### ED2 ビート
1. `seq_621_ed2_classroom`: 普通に目覚める。
2. `seq_622_ed2_test`: テストで正答できる。
3. `seq_623_ed2_missed`: 栞の話しかけを受け流す。
4. `seq_624_ed2_hint`: 教科書の御簾だけ揺れる。

### ED3 ビート
1. `seq_631_ed3_dark`: 灯火が消える。
2. `seq_632_ed3_silent`: 小萩の声が届かない。
3. `seq_633_ed3_retry`: 歌合/退治練習導線。

### ED4 ビート
1. `seq_641_ed4_choice`: 帰り道を前に振り返る。
2. `seq_642_ed4_inside`: 御簾の内へ入る。
3. `seq_643_ed4_empty_seat`: 現代教室の空席。
4. `seq_644_ed4_beautiful_horror`: 教科書余白に平安装束の少年。

### ED5 ビート
1. `seq_651_ed5_glitch`: UI破損。
2. `seq_652_ed5_name_loss`: 秀頼の名が消える。
3. `seq_653_ed5_map_dot`: 邸俯瞰図の一点になる。
4. `seq_654_ed5_return_hint`: 「あなたの席は、まだ空いています。」

## UI/UXへの落とし込み

### ストーリーHUD
- 左上: 章題と現在目標。
- 右上: セーブ/設定/トップへ戻る。
- 下部: 会話ボックス。スマホ縦では高さを最大35%に抑える。
- 選択肢: 2-3個。各ボタンは44px以上。

### 隠しパラメータ表示
通常非表示。デバッグ時だけレーダーチャートと数値を表示。

### 結果画面
全ED共通でスクロール可能。必ず以下を表示。

- エンディング名。
- 到達理由。
- 次に狙える分岐ヒント。
- トップへ戻る。
- 章選択へ。
- 直前から再挑戦。

## 実装チェックリスト

- 第1話だけで起承転結がある。
- 小萩/栞の謎が第1話から提示される。
- 章ごとに既存ミニゲームへ1つ以上接続する。
- 選択肢で3パラメータの意味が体感できる。
- ED3/ED4/ED5にも専用の美しさがある。
- True Endが恋愛成就の断定ではなく、相手を知ろうとする始まりになっている。
