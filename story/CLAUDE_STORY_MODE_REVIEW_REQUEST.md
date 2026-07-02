# Claude向け: ストーリーモード精査・オブジェクト制作依頼

## 重要
まだ公開実装、本体HTMLへの統合、GitHub Pages反映はしないでください。
まずはCodexが作成したストーリーモード設計と外部JSONシナリオを精査し、必要な3D/演出オブジェクト案を作成してください。

## GitHubで最初に読むファイル

1. `../STORY_MODE_IMPLEMENTATION_PLAN.md`
2. `STORY_SCENARIO_BIBLE.md`
3. `STORY_BEAT_SHEET.md`
4. `STORY_IMPLEMENTATION_QA.md`
5. `chapters/*.json`
6. `story_manager.js`

## 現状

- 本体HTMLにはまだ接続していません。
- 公開はしていません。
- 外部JSON方式のストーリー基盤、6話分シナリオ、シナリオバイブル、QAメモまで作成済みです。
- JSON構文、イベント遷移、StoryManager代表ルートはCodex側で検査済みです。
- 本体HTMLにはまだ接続しないでください。
- GitHub Pages公開やmain反映もまだ行わないでください。

## 精査してほしい観点

- 小萩/栞の二重存在が物語として魅力的か。
- 高校生が没入できる展開・謎・再プレイ動機になっているか。
- `realityEgo`, `fantasySynchro`, `brainErosion` の増減が納得できるか。
- ED1-ED5の感情差と再挑戦導線が明確か。
- `spawn_collectibles`, `trigger_minigame`, `ending_check` が本体HTMLへ接続しやすいか。
- スマホ縦画面で会話・選択肢・ED結果が邪魔にならないか。

## 作成してほしいドラフト

### 推奨出力ファイル

- `story/CLAUDE_STORY_REVIEW.md`
  - シナリオ精査結果と改善提案。

- `story/story_object_factories_draft.js`
  - Three.js r128向けの軽量オブジェクトファクトリ案。
  - まだ本体HTMLへ読み込ませない。

- `story/story_asset_requirements.md`
  - GLB化したいもの、プリミティブで十分なもの、VFXで表現するものの分類。

### 優先オブジェクト

1. `createStoryKohagiObject()`
   - 小萩。薄紫の紐飾り必須。栞へ揺らぐ半透明シルエットを重ねられる構造。

2. `createStoryHidetoraObject()`
   - 秀頼。現代高校生が平安装束を着せられた違和感。冠差分。

3. `createStoryUkonObject()`
   - 右近。座らせず立ち姿。弓・矢筒・太刀。

4. `createMinisterObject()`
   - 左大臣。第5話で影が大鬼へ繋がる構造。

5. `createUtakaiJudgeObject()`
   - 判者。扇で顔半分を隠し、題/勝敗表示を差し替えられる。

6. `createWhiteTanzakuObject()`
   - 表は平安短冊、裏は現代ノート片。

7. `createTermCardObject(label)`
   - 光る用語カード。「廂」「簀子」「渡殿」「遣水」「対屋」など。

8. `createWakaTanzakuObject(word)`
   - 縦書き短冊。「秋」「霧」「待つ」「袖」「月」。

9. `createTokoyoGlitchProps()`
   - 反転した御簾、浮遊札、壊れた建具、軽量霧リング。

10. `createGreatOniStoryObject()`
    - 大鬼。胸部に小萩の短冊影を封じるパーツ。

## 制約

- Three.js r128前提。
- スマホ動作優先。
- `Group`, `Mesh`, `PlaneGeometry`, `BoxGeometry`, `CylinderGeometry`, `ConeGeometry`, `SphereGeometry` 中心。
- SkinnedMeshや重いパーティクルは避ける。
- 動きは `position`, `rotation`, `scale`, `material.opacity`, `emissive` で表現。
- 本体HTMLは精査段階では編集しない。
