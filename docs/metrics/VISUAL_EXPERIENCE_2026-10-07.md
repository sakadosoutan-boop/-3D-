# ビジュアル体験・図鑑の描画検証 — 2026-10-07

Chrome headless、1280×800、固定乱数・固定カメラ。同じWindowsホストで測定。時間はWebGL `finish()` を含む中央値であり、スマホ実機のFPSではない。

| 画質 | 場面 | 描画回数 | 中央値 ms |
| --- | --- | ---: | ---: |
| high | front | 1342 | 16.7 |
| high | roof-winter | 1462 | 19.3 |
| high | overview | 2345 | 27.2 |
| high | pond | 286 | 9.9 |
| high | tree | 571 | 11.3 |
| high | hime | 704 | 14.8 |
| eco | front | 1306 | 15.3 |
| eco | roof-winter | 1423 | 15.4 |
| eco | overview | 2277 | 21.9 |
| eco | pond | 259 | 6.6 |
| eco | tree | 544 | 9.3 |
| eco | hime | 672 | 10.8 |

直前の公開版ad4960aに対し、highの正面は1348→1342、全景は2318→2345（+1.16%）。ecoの正面は1314→1306。モデルの所作・葉・床採光・局所波を追加し、同じ画面の描画回数を維持した。

検証済み: app/storyの同期、HTML、物語データと経路、全モードsmoke、操作と一時停止、描画13群、牛車16群、既存残件7群、新機能16群。旧雪テストのmap=null前提を、段階的な雪マスクの状態と描画ピクセルの増減へ更新した。shader・JavaScriptエラーなし。

比較PNGとPC/スマホの図鑑画像を `artifacts/review/` に生成し、画面を確認。単独HTML・画像ファイル読み込み失敗時の埋め込みJPEGも検証した。実機の熱・電池、Safari・Firefoxの確認は含まない。
