# sounds/ — 生き物の声・環境音（外部ファイル方式 / Webアプリ配布対応）

本編 `寝殿造り3D探訪_統合版.html` が、このフォルダの音声を**季節×時間の「音風景」**に
従って自動再生します。欠損ファイルは合成音にフォールバックするので壊れません。

## 音風景（季節 × 時間）
本編の `SOUNDSCAPE` 表で制御。`prob`=確率／`gap`=最小間隔(ms,重なり防止)／`gain`=音量。

| 季節 | 昼 | 夕 | 夜 |
|---|---|---|---|
| 春 | 鶯×2＋メジロ(3種ローテ) | 風のみ | 風のみ |
| 夏 | 時鳥＋カッコウ(低頻度) | 蛙(小)・虫なし | 蛙(うっすら)＋虫4種ローテ |
| 秋 | (静か) | 雁(夕のみ低頻度)＋ひぐらし | 虫4種ローテ |
| 冬 | 鶴(低頻度) | 風のみ | 風のみ＋焚火(近接) |

- **鳴き声プール(ローテーション)**: `spring_bird`(uguisu01/02・mejiro)、`insect4`(suzumushi・matumsuhi・ani_ge_kirigirisui01・koorogi)、ほか時鳥/カッコウ/雁/ひぐらし/鶴/蛙。
- **環境ループ(beds)**: `water`=spring_water_on_Mt2 / `nightWind`=night_wind2 / `summer`=summer_mountains1。季節・時間変更で**即時クロスフェード**切替（残留しない）。
- **せせらぎの距離減衰**: 池(`pondCircles`)から離れるほど `water` ループが小さくなる。
- **焚火の近接再生**: 冬・夜に火桶/炭櫃へ近づくと `takibi` がループ再生（距離で音量変化）。

## ファイル一覧
鳴き声: ani_ge_uguisu01/02・mejiro・hototogisu・kakkou・kari・higurashi・tsuru・frogs2・
suzumushi・matumsuhi・ani_ge_kirigirisui01・koorogi
環境ループ: spring_water_on_Mt2・night_wind2・summer_mountains1
近接ループ: takibi
楽器試奏: biwa(琵琶)・koto(箏)・shou(笙)・ryuteki(龍笛)

- **形式**: `.mp3`（Chrome/Safari/iPad対応）。差替えは同名で上書き→本編リロードのみ。
- **楽器試奏**: 東西の対に置かれた楽器をタップすると、対応する音源を1回再生。
- **頻度/音量の微調整**: 本編 `SOUNDSCAPE` の `prob`/`gap`/`gain` を変更。
- 出典・ライセンスは [CREDITS.md](CREDITS.md) に記録（配布前に必ず確認）。
