# リポジトリ掃除ランブック（要ローカル実行）

作成: 2026-07-12（Claude Code環境診断セッション）

Web版セッションの資格情報では **タグpush・ブランチ削除・ブランチ保護・force-push が403で実行できない**ため、
以下はPC（フル権限のgit認証）またはGitHub Web UIで実行する。各コマンドは -3D- のクローン内で実行する想定
（他リポジトリはその旨記載）。

## A. -3D- 残骸ブランチの整理（19本 → main＋作業中のみへ）

分類基準: 2026-07-11時点の `origin/main`（3f54dd1）への到達性を機械判定済み。

### A-1. マージ済み → そのまま削除してよい（5本）

```bash
git push origin --delete \
  claude/codex-integration-y7np8q \
  claude/continuation-alsfsk \
  claude/heian-3d-balance-review-n4ckxf \
  claude/story-mode-expansion-1kk3is \
  codex/main-safe-reapply-20260708
```

### A-2. 未マージ → archiveタグで保全してから削除（14本）

HANDOFF_LATEST.md の判定（丸ごとマージしない/正本に戻さない）に基づき、中身はタグとして凍結する。

```bash
git fetch origin
BRANCHES="claude/busy-sagan-bg2t95 claude/design-app-builder-opus-cg5jl4 \
claude/friendly-albattani-9po8fx claude/gifted-brahmagupta-mqbn1w \
claude/handoff-docs-publish-9lrfwo claude/handoff-docs-publish-qbox12 \
claude/saigen-mode-dev-clespl claude/vercel-skills-integration-axr2kp \
claude/workflow-automation-strategy-jofjos codex/handoff-quickwins \
codex/kitsune-boss-rig codex/saigen-fix codex/stability-ci-docs \
codex/story-priority-implementation"

for b in $BRANCHES; do
  git tag -a "archive/$b" "origin/$b" -m "ブランチ整理: 未マージのままアーカイブ" || exit 1
done
git push origin 'refs/tags/archive/*'          # ← 成功を確認してから次へ
for b in $BRANCHES; do git push origin --delete "$b"; done
```

復元方法: `git checkout -b <ブランチ名> archive/<ブランチ名>`

### A-3. 診断ブランチ

`claude/code-env-diagnostic-22ox71`（全5リポジトリ）は、対応するPRがマージ済みになった後に削除してよい。

## B. tankyu-portal のマージ済みブランチ削除

```bash
# tankyu-portal のクローン内で
git push origin --delete claude/receipt-scanning-accounting-kzz8zt
```

## C. main ブランチ保護（全5リポジトリ・GitHub Web UI）

Settings → Branches → Add branch ruleset で main を対象に、まずは軽量設定のみ:

- **Block force pushes** を有効化（履歴の巻き戻し事故防止）
- Require pull request は当面OFFでよい（portalの管理ページbotがmainへ直接pushする運用のため。
  botをbypass listに入れられる場合のみON検討）

## D. Git履歴スリム化（任意・force-push必須・最後に実行）

> **警告**: 実行前に全端末で作業を止め、未pushコミットがないことを確認。実行後は**全端末で再クローン**が必要。
> GitHub Pages は Git LFS を配信しないため、稼働中アセットのLFS化は行わないこと（履歴からの削除のみ）。

実測（2026-07-11）: 履歴のみに残存する大型blob

| リポジトリ | 対象 | 削減見込み |
|---|---|---|
| -3D- | `Manex3D-generated-model_*.glb`（rigged含む3本） | 約44MB |
| tankyu-portal | 旧ポータル `探究リサーチポータル.dc.html`（24.6MB）ほか | 約25〜30MB |
| portal | フォント4本（28.5MB）※現役参照中のため、@font-faceを外した後にのみ対象 | 約28MB |

手順（例: tankyu-portal。他リポジトリはpathを差し替え）:

```bash
pip install git-filter-repo
git clone https://github.com/sakadosoutan-boop/tankyu-portal fresh-tp && cd fresh-tp
git filter-repo --invert-paths --path '探究リサーチポータル.dc.html'
git remote add origin https://github.com/sakadosoutan-boop/tankyu-portal
git push origin --force --all
git push origin --force --tags
```

-3D- の対象: `--path-glob 'Manex3D-generated-model_*.glb'`
実行後: 各端末で旧クローンを破棄して clone し直す。ブランチ保護（C）のforce-push禁止は一時解除→再設定。
