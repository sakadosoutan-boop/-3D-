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

## Phase 1 計測（2026-07-09 / codex/main-safe-reapply-20260708）

条件: Codex同梱Playwright、1400x820、`npm run benchmark`、自由散策・春・昼・歩行視点。Phase 1から `scripts/collect-benchmark.js` は乱数を固定し、待機後に `renderer.info.reset()` して代表フレームを1回描画してから記録する。

目標: 自由散策・春昼で draw calls **1,200以下**、geometries **2,000以下**。

| 指標 | Phase 1着手時 | Phase 1第二段後 | 目標 |
|---|---:|---:|---:|
| draw calls | 2,390 | **1,794** | 1,200 |
| triangles | 122,831 | **149,557** | - |
| lines | 13 | **13** | - |
| geometries | 3,444 | **1,493** | 2,000 |
| textures | 148 | **148** | - |
| programs | 27 | **27** | - |
| quality level | 0 | **0** | - |
| pixel ratio | 1 | **1** | - |

実施内容:
- ベンチコマンドを `npm run benchmark` として正式化。
- ベンチ測定の乱数を固定し、代表フレーム単位で比較できるようにした。
- 松・落葉樹の葉叢を `InstancedMesh` 化し、松葉・椿・薄・前栽などの装飾植栽を影の自動付与から外した。
- 松葉、椿、薄のジオメトリを共有化し、geometry 断片化を削減した。
- `box()` / `cyl()` の同寸法ジオメトリをキャッシュし、建築・小物の geometry 重複を削減した。
- 高欄の縦棒/擬宝珠を `InstancedMesh` 化した。
- 寝殿/対屋/渡殿/築地/竹/藤/庭の静的反復部材を、安全な範囲で自動 `InstancedMesh` バッチ化した。

残課題:
- geometries は目標達成。draw calls はまだ目標未達。
- 次の主対象は、人物モデルの細部、几帳/調度、静的な庭小物、季節物のルート追従バッチ。
- `draw calls` はまだ1,700台なので、個別メッシュ削減より `InstancedMesh` / ジオメトリ結合を優先する。
