# Claude向け: ストーリーモード精査・オブジェクト制作依頼

## 重要
まだ公開実装、本体HTMLへの統合、GitHub Pages反映はしないでください。
まずはこのブランチに追加されたストーリーモード設計と外部JSONシナリオを精査し、必要な3D/演出オブジェクト案を作成してください。

## GitHubで最初に読むファイル

1. `STORY_MODE_IMPLEMENTATION_PLAN.md`
   - 実装方針、StoryManager、既存モード接続、セーブ/ロード方針。

2. `story/STORY_SCENARIO_BIBLE.md`
   - 作品コンセプト、人物設定、全6話の物語、ED1-ED5、映像/漫画化を見据えた演出。

3. `story/STORY_BEAT_SHEET.md`
   - 各章のイベントID、選択肢、演出、パラメータ効果。

4. `story/STORY_IMPLEMENTATION_QA.md`
   - Codexが実装後に見つけたミス、修正済み内容、次回改善候補。

5. `story/chapters/*.json`
   - 第1話から第6話までの外部シナリオJSON。

6. `story/story_manager.js`
   - 外部JSONをfetchして進行するStoryManager骨子。

## 現状

- 本体HTMLにはまだ接続していません。
- 公開はしていません。
- 外部JSON方式のストーリー基盤、6話分シナリオ、シナリオバイブル、QAメモまで作成済みです。
- JSON構文、イベント遷移、StoryManager代表ルートはCodex側で検査済みです。

## Claudeに精査してほしい観点

### 1. 物語品質
- 高校生が没入できる導入になっているか。
- 小萩/栞の二重存在が魅力的かつ分かりやすいか。
- ED1-ED5の感情差が明確か。
- 古典学習要素が説教臭くならず、ゲーム内の必然になっているか。
- 恋愛要素、垣間見、歌合、物の怪退治が一本の物語として繋がっているか。

### 2. 分岐設計
- `realityEgo`, `fantasySynchro`, `brainErosion` の増減が納得できるか。
- True End条件が厳しすぎないか。
- Bad Endにも再挑戦したくなる魅力があるか。
- 選択肢が単なる正解/不正解ではなく、価値観の選択になっているか。

### 3. 実装リスク
- StoryManagerの設計で本体HTMLへ接続しにくい箇所がないか。
- `spawn_collectibles` / `trigger_minigame` / `ending_check` の仕様に不足がないか。
- セーブ/ロード復帰時に必要な追加処理は何か。
- `file://` 直接起動と外部JSON fetchの相性問題への対策案。

### 4. UI/UX
- スマホ縦画面で会話・選択肢・結果画面が邪魔にならないか。
- ED結果画面は全モード共通仕様にできるか。
- 隠しパラメータは通常非表示でよいか、演出でどの程度見せるべきか。

## Claudeに作成を頼みたいオブジェクト案

本体統合前に、まず「軽量なThree.jsオブジェクトファクトリ」または「GLB/プリミティブ設計案」として作成してください。
スマホ動作優先なので、SkinnedMesh多用や重いパーティクルは避けてください。

### A. ストーリー主要人物

1. `createStoryKohagiObject()`
   - 小萩。若い女房。
   - 薄紫の紐飾りを必ず入れる。
   - 表情差分は目元・口元・扇の角度で軽量に表現。
   - 小萩から栞へ揺らぐ演出用に、制服色の薄い半透明シルエットを重ねられる構造。

2. `createStoryHidetoraObject()`
   - 秀頼。現代高校生が平安装束を着せられた違和感。
   - 序盤は冠が少しずれている。
   - ED4用に冠を深く被る差分があるとよい。

3. `createStoryUkonObject()`
   - 右近。軽口の侍/随身。
   - 座らせず、立ち姿で自然に配置。
   - 弓・矢筒・簡易太刀を背負わせる。

4. `createMinisterObject()`
   - 左大臣。
   - 威厳とコミカルさの両立。
   - 第5話で影が伸びて大鬼へ繋がるよう、背後に黒い半透明影メッシュを持てる設計。

5. `createUtakaiJudgeObject()`
   - 判者。
   - 扇で顔半分を隠す。
   - 扇に「勝ち」「負け」表示や題表示を差し替えられるとよい。

### B. ストーリー専用アイテム

1. `createWhiteTanzakuObject()`
   - カモメが落とす白短冊。
   - 表面は平安風、裏面は現代ノート片に見える二面構造。

2. `createTermCardObject(label)`
   - 第2話の光る用語カード。
   - `label` に「廂」「簀子」「渡殿」「遣水」「対屋」などを表示。
   - 正しい場所に戻すと淡く光って消える。

3. `createWakaTanzakuObject(word)`
   - 第3話の和歌短冊。
   - 「秋」「霧」「待つ」「袖」「月」を縦書きで表示。

4. `createPurpleCordMotif()`
   - 小萩/栞を繋ぐ薄紫の紐モチーフ。
   - 小萩の袖、栞のノート、True End短冊に使い回せること。

### C. 演出オブジェクト

1. `createMisuBoundaryEffect()`
   - 御簾が「隔てる/つなぐ」ことを示す半透明の揺れ。
   - 会話開始時やED1で使用。

2. `createTokoyoGlitchProps()`
   - 第5話常世用。
   - 反転した御簾、浮遊札、壊れた建具、低負荷の霧リング。

3. `createBrainErosionOverlay(level)`
   - 侵食度に応じたUI/画面演出。
   - 20/40/60/80/100で段階差。
   - CSS/DOMとThree.jsの軽量併用でよい。

4. `createUtakaiStageProps()`
   - 冬夜の歌合会場。
   - 火桶、灯火、雪、判者席、題札。
   - 雅楽BGMと相性のよい静的オブジェクト。

### D. ラスボス関連

1. `createGreatOniStoryObject()`
   - 大鬼。
   - 既存鬼と差別化し、建具・御簾・短冊を破壊する物語ボス感。
   - 胸部に小萩の短冊影を封じるパーツ。

2. `createNameSealEffect(label)`
   - 「母屋」「廂」「御簾」など、正しい名前を呼ぶと光る札。
   - 第5話の最終演出で邸を再構築するために使う。

3. `createFinalQuizThreeSeals()`
   - 破魔の連札3問用の三枚札。
   - 選択肢と連動して光る/割れる/燃える。

## オブジェクト制作制約

- Three.js r128前提。
- スマホ動作優先。
- `Group`, `Mesh`, `PlaneGeometry`, `BoxGeometry`, `CylinderGeometry`, `ConeGeometry`, `SphereGeometry` 中心。
- 動きは `position`, `rotation`, `scale`, `material.opacity`, `emissive` で表現。
- 生成破棄を繰り返すものはオブジェクトプール化を検討。
- 既存の世界観に合わせ、過度にリアルではなく低ポリ/和風/読みやすさ優先。

## Claudeの出力先候補

まだ本体実装しない場合は、次のような新規ファイルに案をまとめてください。

- `story/CLAUDE_STORY_REVIEW.md`
  - シナリオ精査結果、修正提案。

- `story/story_object_factories_draft.js`
  - Three.jsオブジェクトファクトリのドラフト。
  - 本体HTMLへまだ読み込ませない。

- `story/story_asset_requirements.md`
  - GLB化したいもの、プリミティブで十分なもの、VFXで表現するものの分類。

## 注意

メイン直下の `寝殿造り3D探訪_統合版.html` はClaude側・ユーザー側の変更が入っている可能性が高いです。
今回の精査段階では、原則として本体HTMLを編集しないでください。
