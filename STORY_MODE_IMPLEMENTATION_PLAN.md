# ストーリーモード実装計画書

## 目的
`寝殿造り3D探訪_統合版.html` に、大規模な全6話構成のストーリーモードを追加する。
実装時はシナリオ本文・分岐・報酬・カメラ指定を外部JSONへ分離し、HTML本体には進行ロジックと既存モード連携だけを置く。

## 実装前に必要な要素

### 1. データ構造
- `story/chapters/chapter_manifest.json`: 各話のID、ファイル名、季節、時刻、クリア条件、使用ミニゲームを管理。
- `story/chapters/chapterN.json`: 各話のシナリオ本体。
- `story/schema/story.schema.json`: JSONの最低限の仕様。正式運用時は検証スクリプトへ接続する。
- `StoryManager` の保存形式: `chapterId`, `sequenceId`, 隠しパラメータ、フラグ、収集状況、ミニゲーム結果。

### 2. イベント種別
- `dialogue`: 会話表示。
- `choice`: 選択肢表示、effects適用、next分岐。
- `set_scene`: 季節・時刻・プレイヤー位置・カメラ角を設定。
- `camera`: 既存カメラを登録済みアングルへ移動。
- `spawn_collectibles`: 第2話・第3話のカード/短冊収集を生成。
- `require_collectibles`: 収集数チェック。
- `trigger_minigame`: 既存モードを起動し、成功/失敗で戻す。
- `effect`: 霧、常世、バグクラッシュ、光カードなどの演出フック。
- `set_flag`: ルートフラグを立てる。
- `ending_check`: 第5話クリア時にED1/2/4を判定。
- `ending`: 第6話のエンディング演出へ移行。

### 3. 隠しパラメータ
- `realityEgo`: 現実への執着。合理的・現代的な選択で増える。
- `fantasySynchro`: 常世への同調。小萩/栞・平安美・和歌への没入で増える。
- `brainErosion`: 脳の侵食度。誤答、戦闘ダメージ、無礼な選択で増える。100到達で即ED5。

### 4. 既存モードとの接続
- 第1話: `quiz` または専用 `quiz_beginner` ラッパー。
- 第3話: `kaimami` と `taiji` 夏ボス。
- 第4話: `utakai`。2勝未満でED3。
- 第5話: `taiji` 大鬼ボス、最終3連クイズ。
- 第6話: `showResultPanel` 系の既存結果UIを拡張、またはストーリー専用エンディングHUDを追加。

### 5. UI/HUD
- ストーリー専用ダイアログボックス。
- 話数・章題・現在目標を示す小HUD。
- 隠しパラメータは通常非表示。デバッグURL `?storyDebug=1` のみ表示。
- 選択肢は縦積み、スマホ横/縦でも押しやすい高さを確保。
- 途中セーブ/タイトルへ戻る導線をトップバーまたはストーリーHUDへ追加。

### 6. セーブ/ロード
- localStorageキー案: `shinden3d-story-save-v1`
- 保存タイミング:
  - 章開始
  - sequence遷移
  - 選択肢確定
  - ミニゲーム帰還
  - 収集進行
- セーブ内容に本文文字列は保存しない。JSONを再fetchしてIDで復元する。

### 7. 一括実装時の推奨順
1. `StoryManager` をHTMLへ統合し、`enterMode("story")` を追加。
2. ストーリーHUDと会話/選択肢UIを追加。
3. `trigger_minigame` のブリッジを作る。
4. 第1話のみを最後まで通す。
5. 第2話/第3話の収集オブジェクト生成を実装。
6. 第4話/第5話の勝敗ブリッジを実装。
7. ED1-5演出とセーブ復帰を実装。
8. 6話分JSONを本番文面へ差し替え、通しQA。

## ルート判定
- ED5: `brainErosion >= 100` になった瞬間。
- ED3: 第4話歌合敗北、または第5話大鬼戦敗北。
- ED1: 第5話クリア、`realityEgo >= 60`, `fantasySynchro >= 60`, `brainErosion <= 20`, `utakaiPerfect`, `oniPerfect`。
- ED2: 第5話クリア、`realityEgo > fantasySynchro`。
- ED4: 第5話クリア、`fantasySynchro >= realityEgo + 25`。
- 上記以外はED2寄せ。学習ゲームとして「現実へ戻る」通常終端を基準にする。

## リスク
- 外部JSON fetchは `file://` ではブラウザ制限に当たる可能性がある。GitHub Pages/ローカルサーバーでは動く。
- 現在READMEは完全オフラインを強く打ち出しているため、ストーリーモード導入時は「ストーリー版はHTTP配信推奨」と明記する必要がある。
- 単一HTML方針と外部JSON方針は緊張関係がある。本番では `story/chapters/*.json` を同梱し、公開先では相対fetchする。

## 今回準備したファイル
- `story/STORY_SCENARIO_BIBLE.md`: 全6話の詳細シナリオ、人物設定、伏線、ED演出、映像/漫画化を見据えた作品設計。
- `story/STORY_BEAT_SHEET.md`: シナリオをJSON化しやすいイベント単位へ分解した実装用ビートシート。
- `story/STORY_IMPLEMENTATION_QA.md`: 実装後に見つけた修正点、検査内容、次回改善候補。
- `story/story_manager.js`: StoryManager骨子。HTML統合前の参照実装。
- `story/chapters/chapter_manifest.json`: 全6話の管理ファイル。
- `story/chapters/chapter1.json`: 第1話サンプル。
- `story/schema/story.schema.json`: 簡易スキーマ。
