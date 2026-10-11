# 選択された学習改善（2026-10-08）

担当: #12 / #20 / #21 / #31 / #35 / #36 / #37。

## 統合仕様

`waka-notes.js` を `learning-extension.js` より前、`learning-extension.js` を全既存関数の定義と `codex-viewer.js` の初期化より後へ同梱する。`learning-extension.css` を既存CSSより後へ同梱する。親担当がmanifestと本体HTMLを同期する。担当側は本体HTML・items.js・app.css・package.jsonを変更していない。

新しい公開APIは `window.LEARNING_EXTENSION.startReview()`、`startIdentification(optionalIds)`、`dueIds(optionalTimestamp)`、`eligible()`、`refresh()`。返り値は開始成功の真偽値または項目ID配列。入口は `#learningReviewStart` / `#learningIdentificationStart`。図鑑の学習欄は `#learningStudyTools`。表紙担当のおすすめからも同じAPIを呼べる。

図鑑詳細・和歌集・クイズ関数・モード移動は末尾の薄いラップで接続する。既存の採点とモード専用スケジューラーを利用する。`taijiBossCodexNotes(id)` が存在するときは、図鑑詳細末尾と解説パネル内の専用 `#infoBossCodexNotes` へ追加する。

## 実装内容

| 選択 | 内容 |
|---|---|
| #12 | 実際のquizAnswer受理時に端末へ解答回数・最終選択・日付を保存。成功間隔は1→3→7→14→30日、誤答/ヒント使用は翌日。日付は端末の暦日、同日の反復で間隔を先送りできない。期日の項目だけ実際のクイズへ渡す。未発見項目は復習入口に出さない。保存不可は起動中の記録と表示。 |
| #20 | 発見済みの調度・建具の実模型を単体表示、周囲・場所・札・名前・写真タブを隠し、開始角度と名前の選択肢をランダム化。元のquizAnswerへ解答し、採点・次問・解答記録へ接続。Escape/終了時は散策へ復帰。 |
| #21 | 既存の注釈11首を図鑑詳細と和歌集へ接続。本文・作者表記・歌番号は日文研の原文データで照合。語釈・修辞・鑑賞は教材編集者の読みと表示し、伝記や成立事情の未検証説明は表示しない。 |
| #31 | 発見済みの任意の2模型を左右のviewport/scissorで表示。同じrenderer・同じscene・元の模型を使い、回転と拡大率を共有。寸法は各模型に合わせるので画面上の大きさを実物の比率と誤解しない説明を表示。複製もGPU資源の新規所有もない。閉じると可視性・カメラ設定を戻す。 |
| #35 | 実写真2枚/2項目を追加。合計13枚/14項目。ローカル写真・単独HTML内のdata URL双方を同梱、同一バイトを検証。写真拡大もスクロール時に左端が失われないよう修正。 |
| #36 | 模型閲覧に「模型の簡略化と関連資料」を追加。紫宸殿と貴族寝殿、楽琵琶と平家琵琶、現代の復元衣装/牛車、後世の調度写真等の比較限界を項目ごとに説明。 |
| #37 | 植物↔和歌、楽器同士、間仕切り同士の関連を追加。模型/写真の閲覧中と和歌集からも関連先へ移動可能。未発見先は？？？・disabledを維持。 |

## 写真の確認と権利

新規写真は2026-10-08に記述ページ・許諾・所蔵館情報を確認し、ローカル画像を目視した。

- 屏風: [Wikimedia Commonsの写真](https://commons.wikimedia.org/wiki/File:%E8%8A%A5%E5%AD%90%E5%9B%B3%E5%B1%8F%E9%A2%A8-Red_and_White_Poppies_MET_ASA236.jpg)、[Met所蔵資料 62.36.1](https://www.metmuseum.org/art/collection/search/44914)、[CC0](https://creativecommons.org/publicdomain/zero/1.0/)。17世紀初頭の六曲屏風の右端二面を撮った資料で、全六面を写した写真として扱わない。土佐光茂への帰属は所蔵館が未確定としている。写真提供はMet。絵柄を平安期の復元として扱わない。
- 龍笛: [Wikimedia Commonsの写真](https://commons.wikimedia.org/wiki/File:Komabue_and_Ryuteki_fue.jpg)、[Met所蔵資料 48.126.1](https://www.metmuseum.org/art/collection/search/503033)、[CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/)。撮影者 unforth / Claire H.。下段のケース内が龍笛、上段は高麗笛。19世紀の個体で、管の一部はケースに隠れる。この写真の再利用・改変には同ライセンスの条件が適用される。

両方とも長辺1200pxへ縮小しJPEGを再圧縮した。色調・内容・トリミング変更なし。作者・ライセンスURL・出典URL・加工内容を写真欄と `assets/codex/credits.json` に保持する。取得手順は `scripts/import-learning-photos.py`（Pillowが必要、HTMLをビルドしない）。

既存11枚の権利情報・写真内容を維持し、別項目へ雑に使い回して対象数を増やしていない。

## 和歌資料照合

原文照合の情報源は国際日本文化研究センターの和歌データベース。歌集本文・作者表記・収録歌番号を確認した。作者の伝記、歌の成立をめぐる諸説、解釈の正しさ全般を確認したという意味ではない。

| 歌集の原文データ | 接続した歌と収録番号 |
|---|---|
| [古今集](https://lapis.nichibun.ac.jp/waka/waka_i001.html) | waka_au1 691 / waka_sp3 113 / waka_au4 215 / waka_au2 294 / waka_sp1 53 / waka_sp10 42 |
| [後撰集](https://lapis.nichibun.ac.jp/waka/waka_i002.html) | waka_au3 302 |
| [後拾遺集](https://lapis.nichibun.ac.jp/waka/waka_i004.html) | waka_wi1 939 / waka_au10 860 |
| [新古今集](https://lapis.nichibun.ac.jp/waka/waka_i010.html) | waka_su6 175 / waka_su5 1034 |

日文研DBは後置の「異同資料句番号」が直前の歌番号と異なる箇所を持つ。例えば三条院の歌は歌番号00860、後置番号00861。後置番号を出典歌番号へ誤って転記していない。

既存注釈の明確な問題を修正: 素性を父とともに六歌仙と取れる記述、三条院歌の「係り結び」、玉の緒の語源を魂と断定する説明、持統歌における万葉の「らし」を断定と呼ぶ説明。猿丸歌は古今集の「よみ人しらず」と百人一首での帰属を区別。成立場面を本文だけで断定せず、資料で確認できる詞書の範囲を表示した。

## 検証

`node scripts/learning-extension-playwright.cjs` は学習ソースだけをメモリ内のHTMLへ重ねてローカル配信する。本体HTMLの生成/保存はしない。Chromium/Chromeで実際のクイズ・図鑑・WebGL模型・写真を操作し、暦日の算定、解答保存、保存不可の表示、再読込、ロック、可視性/配置復元、GPU資源の再利用、関連リンクの移動、モバイル操作を検証する。2026-10-09、静的模型結合を含む最新統合版で18チェック合格、JS例外0。証跡は `artifacts/learning/`。

親統合の追加確認: `npm run build:app` と `npm test`、既存写真テストの枚数期待値11→13への変更。
