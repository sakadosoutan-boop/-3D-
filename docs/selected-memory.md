# #146 モード往復のメモリ検証

`node scripts/selected-memory-playwright.js` で、同じブラウザページを再読込せず、実際のモード初期化・終了処理を反復する。標準はウォームアップ4回＋測定24回（計28往復）。初回表示のGPU登録・共有キャッシュの作成を測定区間から除外する。

## 操作経路

表紙 → 散策 → 退治（実在する結界霊を配置・描画、quitハンドラで終了）→ 恋の母屋（対象選択、新規ハブを構築・描画）→ 貝合わせ（難易度選択、実際の盤面とタイマーを開始）→ 歌合（実際の手札・判者・舞台を初期化・描画）→ 散策 → 図鑑（几帳/屏風の二模型比較・同梱写真）→ 表紙。

ダミーのAPP状態を代入してモード開始を省略しない。初期化・終了はゲームの関数/ボタンハンドラを呼ぶ。反復を短時間で十分な回数実施するため、自動フレームは測定の合間だけ停止し、各3Dモードで実際の `animate` を呼び、図鑑では実際のrendererへ描画する。通常の遊び時間を28回分模擬したという意味ではない。

## 計測

- `renderer.info.memory.geometries` / `textures`: WebGLへ登録された資源数。sceneから除去しただけで残る資源も検出。
- sceneのobject数と生存するgeometry/material/texture数: 表紙に戻った後に比較。
- `rayTargets` / `floorZones` / `HEIAN_EXPRESSIONS`: 破棄したモードの参照が残らないか比較。
- DOM数、各資源のdispose実行数、モード別増分も記録。
- DOMは表紙復帰300ms＋2フレーム後に、同じ貝合わせ難易度/恋の母屋対象ごとに比較。総数と7つのモード別コンテナの増分・rangeを厳密0で検査する。
- Chromium CDPのGC後 `Runtime.getHeapUsage.usedSize`: 回収後の保持JSヒープ。OSの総プロセスメモリやGPU実メモリの測定ではない。
- ページのnavigation回数、JS例外、舞台親ノード・タイマー・各モード状態・図鑑の閉じ方を検査。

舞台などの常設キャッシュは再利用しているため、表紙でもsceneに非表示の要素が残る場合がある。それを破棄漏れと混同せず、ウォームアップ後の同じ状態の増分を判定する。最終検査ではr128がGPU資源登録時に付けるdisposeイベントリスナーを観測し、geometry/textureのIDと所有元を追跡する。退治の霊・HPバーと恋の母屋の個体所有資源は、表紙へ戻った全測定で残留0を要求する。全体のGPU増分は新規登録された常設scene/共有キャッシュ資源のID数以内であることを要求し、閾値を緩めて動的資源の漏れを許容しない。scene数は増分2/範囲5、ray/floor/表情レジストリ増分0。保持JSヒープは測定24回で増分8MiB以下を上限とする。計測用の数値ID/メタデータもJSヒープに含むが、破棄したオブジェクト自体を計測のために保持しない。

## 修正前の実結果

ウォームアップ4回＋測定24回、navigationは最初の1回のみ、JS例外0、モード開始/終了は全回成功。測定区間は以下の継続的な増加を示した。

| 指標 | 測定開始 | 測定終了 | 増分 |
|---|---:|---:|---:|
| WebGL geometry | 1377 | 1694 | +317 |
| WebGL texture | 191 | 285 | +94 |
| scene object | 5726 | 5726 | 0 |
| scene内のgeometry | 2503 | 2503 | 0 |
| rayTargets | 3484 | 3484 | 0 |
| floorZones | 24 | 24 | 0 |
| GC後JSヒープ | 34,398,116 bytes | 36,042,996 bytes | +1,644,880 bytes |

sceneが一定でもGPU資源が増える漏れだった。典型的な一往復のモード別増分は、退治の描画+8 geometry/+4 texture、退治quit後も減らず、恋の母屋は+44 geometryを登録して終了時に40だけ減り、次の歌合描画でさらに1つ登録されていた。

証跡: `artifacts/selected-memory/before-fix-report.json`。二つの修正前測定により、初回の共有テクスチャ読込とは異なる周期的な増加を確認した。

## 修正

退治の結界霊は `makeTaijiKekkai` が球geometry・materialを個体ごとに新規生成している。従来の終了はscene.removeのみだった。HPバーのCanvasTextureも個体所有だった。`taijiDisposeSpirit` をquitと終了の両方で呼び、Setで重複なく解放する。HP画像に個体所有の印を付け、Three.js共有のSprite geometryや他の画像を解放しない。

恋の母屋は、女房以下のgeometryを全て共有とみなして除外していたが、顔・手・扇などの合成geometryは個体所有だった。親管理の本体関数 `disposeRenaiSimStage` を `scripts/snippets/dispose-renai-sim-stage.js` へ置換した。constructor共有のHEIAN_GEO / FINGER / SHAKU、GEO_CACHE、MAT / HEIAN_MATS、ラベル画像キャッシュと他の生存sceneが使う資源を保護し、それ以外の個体資源だけを解放する。表情レジストリから破棄した女房も外す。

ラベル画像は `_labelTexCache` に共有されているため、sprite.material.mapを無条件disposeしない。舞台のsprite.materialだけは個体所有として解放する。

## 修正後の結果

2026-10-10 JSTに、最終統合済みの本体（9,199,416 bytes）で `npm test` を最初から最後まで実行し、終了コード0。同pipelineの最後に同じウォームアップ4回＋測定24回を実施し、DOM条件別判定を含む10判定すべて合格した。最新の証跡は `artifacts/selected-memory/report.json`（開始時刻 `2026-10-10T10:56:51.389Z`）、表紙へ戻った画面は `artifacts/selected-memory/round-trips-title.png`。

| 指標 | 測定開始 | 測定終了 | 増分・判定 |
|---|---:|---:|---|
| WebGL geometry | 1228 | 1338 | +110（常設/共有の遅延初登録110 IDと一致） |
| WebGL texture | 176 | 178 | +2（常設/共有の遅延初登録2 IDと一致） |
| 破棄したモードのGPU geometry/texture | 0 / 0 | 0 / 0 | 全24回の残留0 |
| scene object | 5763 | 5763 | 0 |
| scene内のgeometry/material/texture | 2533 / 1585 / 300 | 2533 / 1585 / 300 | 全て0 |
| rayTargets / floorZones / 表情リグ | 3521 / 24 / 18 | 3521 / 24 / 18 | 全て0 |
| GC後JSヒープ | 34,555,660 bytes | 35,736,356 bytes | +1,180,696 bytes（約1.13MiB） |

通常の一往復でgeometry128個のdisposeを実行している。sceneの絶対数は並行実装の常設模型追加により修正前と異なるため、各実行内の増分を比較する。修正前の周期的なGPU増分（+317 geometry/+94 texture）は消え、破棄した動的資源の残留0を確認した。scene、当たり判定、段差登録、表情レジストリは全測定で一定。再読込0回、JS例外0、実際のモード開始/終了と図鑑の閉じ方は全28回成功。

最終DOM数は2480/2508を交互に繰り返す。以下の条件別の各6回で、増分とrangeは厳密0だった。

| 貝合わせ / 恋の母屋対象 | 測定回数 | 総DOM件数（最初→最後） | 増分 / range | kaiBoard内の要素 / 実カード |
|---|---:|---:|---:|---:|
| やさしい / 葵の君 | 6 | 2480→2480 | 0 / 0 | 84 / 12 |
| やさしい / 紅葉の君 | 6 | 2480→2480 | 0 / 0 | 84 / 12 |
| ふつう / 夕顔の君 | 6 | 2508→2508 | 0 / 0 | 112 / 16 |
| ふつう / 雪の君 | 6 | 2508→2508 | 0 / 0 | 112 / 16 |

カード1枚は7 DOM要素で、難易度の4枚差がちょうど28要素になる。他の6コンテナ（rnChoices、renaiTargetPicker、ukHand、codex、codexViewer、homeNext）も全条件でrange0。非表示になった盤面は次回の実開始で消して作り直しており、難易度ごとの件数も総数の上限も増えていない。全体の始点がやさしい、終点がふつうであるため生の全体差は+28となるが、同条件の厳密比較と実盤面の要素数で、蓄積ではなくこの盤面差と確認した。

DOM判定を追加する前の最終pipeline（GPU+18/+4、保持heap+799,676 bytes、全8判定成功）のレポートは `artifacts/selected-memory/pipeline-before-dom-check-report.json` に保持する。最新結果は条件別比較を実施した上記10判定の実行を正本とする。

固定4回のウォームアップ後にも、ランダムな歌合場面・視点によって常設資源が初めて描画される回があることを確認した。最初の修正後試行は生の個数に小さい固定閾値を適用して失敗したため、資源IDで所有元とdisposeを追跡して検証を厳密化した。これは漏れを許すための閾値緩和ではない。試行の記録は `artifacts/selected-memory/first-after-fix-report.json` に保持する。

## 実機の長時間計測

PCのこの反復テストは継続的な資源漏れと終了処理を確認する。iPhone/iPadの15分間のFPS・温度・電池消費は別の実機計測であり、ここで完了したとは扱わない。ゲームの設定内にある端末計測画面から15分間の実測と結果JSON保存を行う。
