# ビジュアル残件の改修記録 — 2026-10-06

改修対象は [残件一覧の12項目](../visual-quality-backlog.md)。基準は既存の視覚修正を保持する `22d61be`、作業ブランチは `codex/complete-visual-backlog`。公開版への反映は別工程。

## 検証

`npm test` の全構成検査を通過。HTML・ソース同期、6章342イベントとEDルート、各モード・オンライン模擬通信・保存・390px幅、品質回帰、描画回帰、牛車配送、今回の残件回帰を確認。一時停止検査の固定時間閾値による不安定さを直し、品質・描画・牛車・残件検査を再実行した。

今回追加した7検査:

- added garden detail has finite bounds and leaves the walking, bridge and carriage routes clear
- rendered snow brightens upward rock faces and leaves vertical faces unchanged
- deciduous foliage and settled snow restore correctly through season changes
- floor light spill follows each lamp and disappears during daylight
- eco hides added detail and high quality restores it
- four seasons and four times of day reuse scene geometry and textures
- carriage cabin sways without raising the wheel axle and rests when stopped

追加配置は下草243株・岩28個、岸の頂点480点、隅棟512区間。通行線・牛車の走路・橋の出入口からの距離、有限値、インスタンスのカリング範囲を確認。積雪の画面比較では岩の上面が明るくなり、垂直面の差は0.00。

## 同条件の計測

Windows上のChrome headless、1280×800、固定シード・固定カメラ、適応解像度とブルームを停止。8視点を高画質・省電力で比較。時間は24サンプルの中央値で、CPU処理とGPU完了待ちを含む。ブラウザ自動検証の値なので、物理端末の連続プレイFPSとは区別する。

| 画質 | 視点 | 描画回数 前 → 後 | 増減 | 時間(ms) 前 → 後 |
| --- | --- | --- | --- | --- |
| 高画質 | 正面 | 1574 → 1348 | -14.4% | 16.1 → 9.5 |
| 高画質 | 俯瞰 | 2444 → 2318 | -5.2% | 23.5 → 14.9 |
| 高画質 | 室内 | 817 → 815 | -0.2% | 12.2 → 8 |
| 高画質 | 池 | 281 → 284 | 1.1% | 9.2 → 4.9 |
| 高画質 | 広葉樹 | 552 → 569 | 3.1% | 11.9 → 7.3 |
| 高画質 | 冬の松 | 627 → 624 | -0.5% | 12 → 6.7 |
| 高画質 | 橋 | 526 → 531 | 1% | 8.7 → 7.7 |
| 高画質 | 夜の正面 | 1379 → 1323 | -4.1% | 13.8 → 9.6 |
| 省電力 | 正面 | 1559 → 1314 | -15.7% | 12.6 → 9 |
| 省電力 | 俯瞰 | 2422 → 2276 | -6% | 21.4 → 12.4 |
| 省電力 | 室内 | 805 → 783 | -2.7% | 7.7 → 5.8 |
| 省電力 | 池 | 278 → 263 | -5.4% | 4.4 → 3.2 |
| 省電力 | 広葉樹 | 547 → 544 | -0.5% | 6.2 → 4.2 |
| 省電力 | 冬の松 | 618 → 594 | -3.9% | 6.8 → 4.6 |
| 省電力 | 橋 | 519 → 505 | -2.7% | 6.3 → 4.7 |
| 省電力 | 夜の正面 | 1364 → 1289 | -5.5% | 11.5 → 7.5 |

詳細な三角形数、ジオメトリ・テクスチャ、メモリ、p95、追加6視点は [JSON](VISUAL_BACKLOG_2026-10-06.json) に保存。物理端末の発熱・電池・GPU時間は次回の計測項目。

## 再実行

`npm test` / `npm run test:visual-backlog`。画像・計測は `node scripts/benchmark-visual.js <label>` で生成する。今回の前後画像と追加の人物・鴛鴦・鶴・牛車近景は `artifacts/review/visual-backlog-final-*.png`。

仕上げソースは `src/app/visual-finish.js`。本体へ `npm run build:app` で埋め込み、単一HTMLのオフライン動作を維持。時刻・季節で資源を再生成せず、省電力では追加装飾を隠す。鎌倉マップには追加植栽を生成しない。
