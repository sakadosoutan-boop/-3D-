# ストーリー実装後QAメモ

## 今回見つけて修正した点

### 1. 収集イベントが即時に次へ進む
`spawn_collectibles` がカード生成直後に `next` へ進むと、プレイヤーが拾う前に `require_collectibles` へ流れる恐れがあった。

修正:
- `story_manager.js` の `handleSpawnCollectibles` はイベントを返して待機する。
- `collect()` で必要数に達した時だけ、該当イベントの `next` へ進む。

### 2. 第6話のファイル名不一致
manifestは `chapter6_endings.json` を指していたが、`StoryManager.loadChapter(6)` は `chapter6.json` を読む設計だった。

修正:
- manifestを `chapter6.json` に統一。
- `story/chapters/chapter6.json` を追加。

### 3. 第1話の初手が二択で、True End思想を出しきれていない
現実寄り/雅寄りの二択だけだと、両立ルートの思想が序盤から伝わりにくかった。

修正:
- 「まず出口と人の配置を静かに確認する」を追加。
- `realityEgo` と `fantasySynchro` が両方少し上がる観察型選択肢にした。

### 4. 第2話以降のJSONがmanifestに対して未実装
manifestは全6話構成だが、第2話以降の実データがなかった。

修正:
- `chapter2.json` から `chapter6.json` まで追加。
- 各章に会話、選択肢、収集、ミニゲーム接続、ED遷移を配置。

### 5. 歌合/大鬼を成功だけでPerfect扱いしていた
True End条件の `utakaiPerfect` / `oniPerfect` は、単なる勝利ではなく高評価クリアに限定すべき。

修正:
- `chapter4.json` の成功効果は `utakaiWon` までに変更。
- `chapter5.json` の成功効果は `oniWon` までに変更。
- Perfectフラグは将来、既存ミニゲーム側の評価結果 `result.flags` で付与する設計にした。

## 実施した検査

- 全 `story/chapters/*.json` の構文チェック。
- manifest記載ファイルの存在チェック。
- 全イベントの `next` / `successNext` / `failNext` / 選択肢nextの参照先チェック。
- StoryManagerで第1話から第6話まで代表ルートを自動進行。
- 第1話から第5話まで同一セーブ状態で通し、Perfectフラグ付与時にED1へ到達することを確認。

## 次回以降の改善候補

### 1. chapter6は最終的に「選択式ギャラリー」から「endingId別表示」へ変更
現状の第6話はQAと回想向けに選択式でEDを表示できる形にしている。正式実装時は第5話の `ending_check` 結果を受け、該当EDだけを表示するUIへ接続する。

### 2. `StoryManager.loadChapter` をmanifest参照式へ拡張
現在は `chapter${id}.json` 固定読み込み。将来、ファイル名を自由にしたい場合はmanifestを先に読み、`chapter.file` を使ってfetchする。

### 3. ミニゲーム評価の標準化
`resumeFromMiniGame({ success, score, rank, flags, effects })` の運用を全モードで統一すると、True End条件や称号連携が安定する。

### 4. ED5警告演出
`brainErosion` が80以上になった時点で、専用hookまたは `onStateChanged` からUI警告を出す必要がある。

### 5. セーブ復帰時のchapter再fetch
セーブには本文を保存せずIDだけを保存する方針。正式統合時は `load()` 後に該当chapterをfetchし、`currentSequenceId` を復元する導線を追加する。
