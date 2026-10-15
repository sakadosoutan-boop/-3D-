# 兼好の草庵へ直接訪問

`src/app/kenko-hermitage.js/css` が入口・自由歩行・解説・退出を担当する。既存 `SAIGEN_TSUREZURE.createHermitage(stage)` は本来の `buildAn` と `buildKenko("read")` を使用し、十三場の本文・ショット列・通常の再現APIは変更しない。庭の地形、遣水、草、松・楓・竹・萩、遠山、草庵、文机・硯・燈台・円座・脇息、兼好の人物を同じ品質設定で生成する。別の簡易モデルや写真テクスチャを追加しない。

タイトルの `#homeNext` と散策のその他メニューから訪問できる。`?visit=kenko` は起動時に一度だけ訪問し、`?map=kamakura&visit=kenko` からも元の鎌倉屋敷へ帰還する。URLに残った入口指定で、退出後に再入場を繰り返さない。

鎌倉から第七段の再現を選んだ場合は「平安の屋敷で再現を見る」と表示し、元の館を復元してから同じHTMLの平安側 `?replay=tsurezure7` へ移る。草庵を歩く訪問は同じrendererのまま帰還するが、再現への移動は新しいページで既存の十三場を始める。鎌倉の通常モード制限は解除しない。鎌倉の起動時の遅延マスクは、訪問stageを隠さないよう親のmap統合で除外する。

## 統合API

末尾の `KENKO_HERMITAGE.open()` は非同期で、準備完了時にtrue、取消・失敗時にfalseを返す。`active` は準備中もtrue、`loading` は準備中だけtrue。`leave()` は取消と退出を兼ねる。公開 `heightAt(x,z)`、`resolveMove(fromX,fromZ,toX,toZ)` は実際の歩行でも使用する。

本体animateの `const t=clock.elapsedTime;` 直後に以下を置く。通常の屋敷更新で非表示の気象・怪異・人物を再表示しないため、訪問中は専用frameが入力・模型更新・環境・描画を受け持つ。

```js
if(typeof KENKO_HERMITAGE!=="undefined"&&KENKO_HERMITAGE.active){KENKO_HERMITAGE.frame(dt,t);return;}
```

新JSは既存再現モジュール、selected UX、鎌倉ゲームの後にロードする。新CSSも同梱する。HTML・manifest・packageの統合は親担当。入場前に笠懸・旧弓稽古・生活体験・対話・図鑑・写真・中断・結果・自動案内を閉じる。牛車を運搬中なら車宿へ戻してから訪問する。

## 移動と復元

草庵だけ原点へ配置し、通常屋敷のscene子rootを一時的に隠す。APP.map、floorZones、WALK_SOLIDS、rayTargetsは変更しない。庭の高さは元の `hAn`、床と縁は `hut.userData.dims`、沓脱石は実アンカーを使う。前の石から縁へ上がり、開いた南正面から室内を歩ける。壁・柱・家具・樹幹・柴垣・遣水・庭の端は掃引式の小刻みな判定で通り抜けを防ぐ。大きな床段差は石を経由する。PCキー、タッチのjoy/視点、ゲームパッド、感度・上下反転設定に対応する。

準備は空、庭/建物、調度/人物の三段階。最初にUIを描画してから既存の生成関数を実行し、準備中は移動を止め、帰還ボタンで取り消せる。途中のタイマーは入場世代を確認し、取消後に模型を再表示しない。全sceneを作る再現用のbackground job列は開始しない。

退出時は同じ資産の `userData.dispose` と参照カウントを使い、独自stageをsceneから除く。rendererを作り直さない。屋敷と天体のvisible、playerとcameraの位置/角度/near/far/fov、dummyCam、light色/強度/位置、太陽のtargetとshadow範囲、background/environment/fog/exposure、気象フラグ、名称札・自動時刻・背景音を戻す。専用環境音のcloneは既存disposeで停止・解放する。enterModeへ進む際も先に退出する。第七段への入口は退出後に元の再現を先頭から開始する。

## 原文の根拠

案内は作品本文の短い引用と自作の説明を使う。序段の執筆、第七段の無常、第十段の住まい/庭/調度へ結び付ける。公開本文と現代の注釈は区別し、注釈の文章を転用しない。

- [序段の公開本文](https://www2.yamanashi-ken.ac.jp/~itoyo/tsuredure/turedure000_049/turedure000.htm)
- [第七段の公開本文](https://www2.yamanashi-ken.ac.jp/~itoyo/tsuredure/turedure000_049/turedure007.htm)
- [第十段の公開本文](https://www2.yamanashi-ken.ac.jp/~itoyo/tsuredure/turedure000_049/turedure010.htm)
- [京都府：雙ヶ岡](https://www.pref.kyoto.jp/select200/historical28.html)

京都府の案内は雙ヶ岡を兼好ゆかりの地としている。本文はこの模型の建物寸法・敷地配置・調度を特定していないため、UIでは実測復元として扱わず、原文を読むための観察模型であることを示す。史跡の位置や執筆場所を断定しない。

## 検証

2026-10-14、`node scripts/kenko-hermitage-test.cjs` のCPU検査7項目成功。実ソースの移動/高さ関数と元の建物定数/地形関数を使用し、床・石・庭の高さ、庭から縁への移動、床縁の直接乗り越え防止、壁・柱・家具・水路・範囲の衝突、反復時の有限値を確認した。JSと専用Playwrightの構文確認、担当差分の空白検査も成功。

親のbuild後に `node scripts/kenko-hermitage-playwright.cjs` を実行する。実資産と実APIで生成、実Wキーで庭→沓脱石→高床へ歩くこと、解説中の停止、夜の燈火、全所有geometryのdisposeイベント、renderer再利用と世界/照明/床配列/HUDの復元、title/quiz/walkへの退出、準備取消、URL直接訪問を検査する。訪問から再現へ進み、十三場の全ショット列を実際の模型で早送り描画して互換性を確認する。JSONと夜の室内PNGを `artifacts/kenko-hermitage` へ保存する。既存 `scripts/saigen-tsurezure-playwright.js` も全体検証で維持する。

2026-10-14の初回専用ブラウザ検査は成功。実Wキー110フレームで庭のz=5からz=0.6へ歩き、床0.55mに対して目の高さ2.17mを確認した。renderer再利用、元世界とカメラ/照明/天体/気象/環境音/HUDの復元、全所有geometryのdispose、三つの退出モード、準備取消、訪問後の十三場全ショット描画、鎌倉URL直訪からの帰還が成功し、JS/GLSLエラー0だった。

初回後に鎌倉→平安再現route、遅延マスク除外、草庵内の他ゲーム/約束HUD非表示を補正した。画像QAでは、起動後のモード案内と再現の本文選択パネルの残留も発見し、専用frameで案内を閉じ、直接再現開始時に選択パネルを閉じる処理を追加した。

2026-10-14、親の最終build（10,148,827bytes）で修正版専用ブラウザ検査が全判定成功。所有geometry 124個・material 143個・texture 55個についてdisposeイベントによる全解放を確認した。実歩行と夜の灯、全復元、退出/取消、十三場の全ショット描画は再度成功。鎌倉の遅延処理を含む5.1秒後も草庵stageが表示され、帰還先は元の館だった。390×844pxのHUDが画面内に収まり、モード案内による入力停止がないことを確認した。鎌倉の実再現ボタンから平安側へ移り、5.1秒後も再現が続き、タイトル・モード案内・本文選択パネルが遮らないことを確認した。JS/GLSLエラー0。

`artifacts/kenko-hermitage/report.json` に最終実値を保存した。`interior-night.png`、`mobile-yard.png`、`mobile-notes.png`、`mobile-routed-replay.png` を保存し、スマホの三枚を目視確認した。操作札と解説の文字は切れず、既存の草庵/兼好/調度と、元再現の露の場面が表示されている。この担当ではHTMLをbuildせず、専用ブラウザは親の許可した直列工程だけで実行して終了した。全体npm testは親の統合工程が担当する。
