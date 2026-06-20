# ベンチマーク記録（フェーズ間 before/after 比較基準）

計測方法: URL に `?fps=1`、または起動後 `~`(Backquote)キーでオーバーレイ表示。
`renderer.info` の値を併用。代表シーン = **自由散策・昼・春**。

## 描画統計ベースライン（baseline-v0 / Phase 0 時点）

| 指標 | 計測値 | 備考 |
|---|---|---|
| draw calls | **421** | Phase 4 の削減対象 |
| triangles | **7,732** | 軽量（フィルレート非ボトルネック） |
| geometries (memory) | **2,209** | ★ 断片化が大きい → Phase 4 最優先ターゲット |
| textures (memory) | 42 | プロシージャル生成 |

### 所見
- 三角形数が 7.7k と非常に軽い一方、**draw call 421 / geometry 2,209** が重い。
  典型的な **draw-call バウンド**。→ Phase 4 は LOD より先に
  **InstancedMesh / ジオメトリ統合**で draw call と geometry 数を削るのが最有効。

## フェーズ別の影響

| フェーズ | draw / tri / geo への影響 |
|---|---|
| Phase 1（IBL） | 増なし。環境マップはオフスクリーン PMREM で時間帯変更時のみ生成。毎フレームの描画コスト無し。 |
| Phase 4（最適化） | draw call・geometry 数の削減を数値で確認する。 |

## 現行 develop 計測（2026-06-15）

条件: ヘッドレスChrome、1400x820、自由散策・春・昼・歩行視点、120フレーム平均。

| 指標 | 計測値 |
|---|---:|
| FPS | **60.3** |
| フレーム時間 | **16.58 ms** |
| draw calls | **1,120** |
| triangles | **45,916** |
| geometries | **2,524** |
| textures | **82** |
| programs | **17** |

人物と四神の高精細化後の数値。端末依存のFPSより、draw callsとgeometriesの変化をPhase 4の比較基準とする。

> FPS 実値は端末依存。PC / タブレット横 / 低スペック端末でそれぞれ `?fps=1` を記録すること。

## 現行 main 計測（2026-06-21 / bd71625）

条件: Codex同梱Playwright、1400x820、`scripts/collect-benchmark.js`、自由散策・春・昼・歩行視点、3.5秒待機後の `renderer.info`。

| 指標 | 計測値 |
|---|---:|
| draw calls | **1,702** |
| triangles | **91,695** |
| lines | **17** |
| geometries | **2,794** |
| textures | **124** |
| programs | **28** |
| quality level | **0** |
| pixel ratio | **1** |

Canva素材・タイトルBGM・追加生き物/門/畳テクスチャ反映後の基準値。次の品質向上では、表示物を増やすたびにこの値との差分を取り、特に draw calls / textures / geometries の増加を確認する。
