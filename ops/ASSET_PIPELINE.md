# アセット組み込みSOP（GLB / 画像 / 音源）

新しいアセット（Manex3Dで生成したGLB、Canvaの画像、効果音・BGM）をこのプロジェクトへ
組み込むときの標準手順。Claude に任せる場合は **`/asset-intake`** と書いてファイルの場所を伝えるだけでよい。

## 共通ルール

1. **リポジトリのルート直下に置かない。** 置き場所は以下で固定:

   | 種類 | 置き場所 | 命名 |
   |---|---|---|
   | ボス等のGLB | `assets/bosses/` （新カテゴリは `assets/<カテゴリ>/`） | `<名前ローマ字>_<テクスチャ上限>.glb` 例: `kappa_boss_2048.glb` |
   | UIアイコン・概念画 | `icons/` | `<名前ローマ字>_<用途>.webp` 例: `chochin_concept.webp` |
   | 効果音・BGM | `sounds/` | 内容がわかる日本語名可 例: `九尾狐戦.mp3` |
   | 生データ・作業ファイル | `.asset_work/` （gitignore済み・コミットされない） | 自由 |

2. **生データ（Manex3Dの出力そのまま等）はコミットしない。** `.asset_work/` に置いて最適化後の派生物だけをコミットする。
   ルートに5MB超のファイルがあると `npm run preflight` が警告する。
3. **出典・権利を必ず記録する。**
   - GLB → 同ディレクトリの `ASSET_MANIFEST.md`（未記載はプリフライトが警告）
   - 音源 → `sounds/CREDITS.md`（未記載は verify-html が**エラー**にする）
   - Canva → 埋め込み箇所のコメントに design ID を記録（例: `DAHNGjt96Zo`）
4. ライセンス・出典が不明なものは公開ビルド（main）に入れない。

## GLB の手順（Manex3D → ボス表示）

1. 生成したGLBを `.asset_work/` に置く。
2. 軽量化（形状保持・テクスチャ2048/WebP）:
   ```bash
   npx @gltf-transform/cli optimize .asset_work/raw.glb assets/bosses/<name>_2048.glb \
     --texture-size 2048 --texture-compress webp --simplify false --compress false
   ```
   - **メッシュ簡略化・ジオメトリ圧縮は無効のまま**（アプリ内蔵の軽量GLBローダーとの互換のため。頂点レイアウトを変えない）。
   - 目標サイズ: **1体3MB以下**。超える場合はテクスチャ1024で再試行。
3. `assets/bosses/ASSET_MANIFEST.md` に追記: ファイル名 / 追加日 / 出典（Manex3D生成等） / 最適化ツールと設定。
4. アプリへの接続: HTML内の `BOSS_CFG` 付近（検索アンカー: `spawnBoss`）でパスを差し替え。
   接地・スケール・向きは実機系の不具合が出やすいので、組み込み後にボス戦を起動して確認する。
5. `npm run preflight` → コミット（`feat: <名前>ボスGLBを適用` 等）。

## 画像の手順（Canva → 埋め込み）

本体HTMLはオフライン完結のため、画像は**外部参照ではなくdata URIで埋め込む**。

1. Canvaからエクスポート（屏風絵の実績: JPEG 1024×576）。design ID を控える。
2. base64化して該当 `<img>` の `src` を置換:
   ```bash
   base64 -w0 .asset_work/export.jpg > .asset_work/export.b64
   # data:image/jpeg;base64,<中身> の形で src を差し替え
   ```
3. **読込失敗時のフォールバック（手続き生成画）を消さない。**
4. 埋め込み箇所のコメントに Canva design ID と制作名を記録。
5. `npm run preflight` で htmlBytes の増分を確認（画像1点で概ね +100〜300KB。1MBを超える増分は要再圧縮）。

## 音源の手順

1. mp3 を `sounds/` へ。**追加したら必ず `sounds/CREDITS.md` に出典・権利者を記載**（verify-html がファイル存在と記載の両方を検査する）。
2. サイズ指針:
   - 効果音（〜数百KB）: `SFX.se` で先読み登録可
   - BGM級（2MB超）: 先読みせず遅延ロード（実績: `playBossBgm` 方式）
3. mp3が無い環境でのフォールバック（合成音）を壊さない。
4. `npm run preflight` → コミット。

## やってはいけないこと

- ルート直下へのアセット追加（過去の `Manex3D-generated-model_*.glb` ×2 が現状これに該当。移動または削除は**ユーザー確認の上で**行う）
- 元データの削除・上書き（`.asset_work/` の生データは次回の再最適化に必要）
- CREDITSやmanifestの記載を後回しにしたままpush
- 外部CDN・外部URL参照の追加（オフライン方針違反。追加はユーザー承認制）
