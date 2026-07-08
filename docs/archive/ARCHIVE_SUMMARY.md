# Archive summary

このファイルは、旧引き継ぎ・旧レビュー依頼・旧レビュー結果を統合した要約です。現行作業の正本は以下です。

- `../../IMPLEMENTATION_STATUS.md`
- `../handbook/HANDOFF_LATEST.md`
- `../handbook/PROJECT_MAP.md`
- `../../story/README.md`

## 旧 Claude/Codex handoff の要点

- 正本は常に GitHub `origin/main`。古いローカルHTMLや古い worktree を正本にしない。
- main へ公開する前に `git fetch origin` し、fast-forward できるか確認する。
- 巨大HTMLでは `ITEMS`, `register`, `pick`, `enterMode`, `animate`, CSS HUD、音声、StoryManager 周辺が衝突しやすい。
- 旧 `codex/story-priority-implementation` のストーリー系差分は、現行 main 側に同等以上の更新が入っていたため丸ごと戻さない。
- 車宿、牛車運び、太極六壬式盤、屋敷人物、絵巻机などの Codex 差分は `eded4f1` で最新 main に再適用済み。
- 現行検証は `npm test` を正とする。

## 旧 HANDOFF_NEXT / CLAUDE_HANDOFF の要点

- 古いセッションでは、ラベルキャッシュ、雨/蛍パーティクル共有、畳/水面/生き物/退治/図鑑/用語カード/撮影モード/ボスラッシュなどが段階的に追加された。
- それらは現行の `IMPLEMENTATION_STATUS.md` に吸収済み。
- 古い資料には当時の未コミット状態、古い hash、古い担当境界が含まれるため、現行判断には使わない。

## 旧ストーリーレビューの要点

- 小萩/栞の二重存在、3パラメータ、ED1-ED5の設計は維持する価値が高い。
- 旧レビューで指摘された主な問題:
  - 第1話に現代名を呼ぶ伏線が不足していた。
  - 第1話の秀頼の発話が弱かった。
  - 最良プレイが ED4 に落ちる危険があった。
  - True End 到達条件に `utakaiPerfect` / `oniPerfect` の橋渡しが必要だった。
- 現行 main では、章JSON、StoryManager、EDルート検証、回想、手動記録、EDゲージが実装済み。
- 詳細な現行仕様は `../../story/README.md`、物語本文は `../../story/chapters/*.json` を参照。

## 削除した旧ファイル

以下の内容はこの要約へ統合し、個別ファイルは削除した。

- `CLAUDE_CODEX_HANDOFF_2026-07-08.md`
- `CLAUDE_HANDOFF.md`
- `CLAUDE_STORY_MODE_REVIEW_REQUEST.md`
- `HANDOFF_NEXT.md`
- `story/CLAUDE_STORY_MODE_REVIEW_REQUEST.md`
- `story/CLAUDE_STORY_REVIEW.md`
- `tools/embed_shishin_assets.js`

`embed_shishin_assets.js` はルート直下の四神WebPを前提にした古い補助スクリプトで、現行ビルド/検証/本体実行から参照されていないため削除した。
