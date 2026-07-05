#!/usr/bin/env node
// push前の一括プリフライト検証。
//
// 使い方:
//   node scripts/preflight.js             … 静的検査 + アセット監査 + スモーク(Playwrightがあれば)
//   node scripts/preflight.js --bench     … 上記 + 描画ベンチ採取(BENCHMARKS.md追記用の文面を出力)
//   node scripts/preflight.js --no-smoke  … スモークを省略(急ぎの文言修正など)
//
// 終了コード: 必須検査(静的検査)が失敗したときのみ非0。
// スモークはPlaywright未導入/ブラウザ起動不可の環境ではSKIP扱い(非0にしない)。

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const wantBench = args.includes('--bench');
const noSmoke = args.includes('--no-smoke');

const results = [];
const record = (name, status, note = '') => results.push({ name, status, note });

function runNode(script, extra = []) {
  return spawnSync(process.execPath, [script, ...extra], { encoding: 'utf8', cwd: path.join(__dirname, '..') });
}

function gitShortHash() {
  const r = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : 'unknown';
}

// ---------- 1. 静的検査(必須) ----------
{
  const r = runNode('scripts/verify-html.js');
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  record('静的検査 verify-html', r.status === 0 ? 'PASS' : 'FAIL',
    r.status === 0 ? '' : '上記の failures を修正してから再実行');
}

// ---------- 2. アセット監査(警告のみ・非破壊) ----------
{
  const notes = [];
  const root = path.join(__dirname, '..');
  const HUGE = 5 * 1024 * 1024;
  const allowHuge = new Set(['寝殿造り3D探訪_統合版.html']);

  // ルート直下の巨大な迷子ファイル(GLB等)を検出
  for (const f of fs.readdirSync(root)) {
    const p = path.join(root, f);
    const st = fs.statSync(p);
    if (st.isFile() && st.size > HUGE && !allowHuge.has(f)) {
      notes.push(`ルート直下に ${(st.size / 1048576).toFixed(1)}MB の「${f}」。規約: assets/ 配下へ移動しmanifest記載(ops/ASSET_PIPELINE.md参照)`);
    }
  }

  // assets/ 配下のGLBが同ディレクトリの ASSET_MANIFEST.md に記載されているか
  const assetsDir = path.join(root, 'assets');
  if (fs.existsSync(assetsDir)) {
    const walk = (dir) => {
      for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) { walk(p); continue; }
        if (!/\.(glb|gltf)$/i.test(f)) continue;
        const manifestPath = path.join(dir, 'ASSET_MANIFEST.md');
        const manifest = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, 'utf8') : '';
        if (!manifest.includes(f)) {
          notes.push(`${path.relative(root, p)} が ASSET_MANIFEST.md 未記載(出典・最適化条件を追記する)`);
        }
      }
    };
    walk(assetsDir);
  }

  record('アセット監査', notes.length ? 'WARN' : 'PASS', notes.join(' / '));
}

// ---------- 3. ブラウザスモーク(任意・環境依存) ----------
if (noSmoke) {
  record('スモーク smoke-playwright', 'SKIP', '--no-smoke 指定');
} else {
  let hasPlaywright = true;
  try { require.resolve('playwright', { paths: [path.join(__dirname, '..')] }); } catch { hasPlaywright = false; }
  if (!hasPlaywright) {
    record('スモーク smoke-playwright', 'SKIP', 'Playwright未導入。npm i -D playwright 後に再実行可');
  } else {
    const r = runNode('scripts/smoke-playwright.js');
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    const err = (r.stderr || '') + (r.stdout || '');
    const envIssue = /Executable doesn't exist|Failed to launch|browserType\.launch|missing dependencies/i.test(err);
    if (r.status === 0) record('スモーク smoke-playwright', 'PASS');
    else if (r.status === 2 || envIssue) record('スモーク smoke-playwright', 'SKIP', 'ブラウザ起動不可(環境要因)。CIのsmokeジョブ結果を確認すること');
    else record('スモーク smoke-playwright', 'FAIL', 'アプリ側の回帰の可能性。上記エラーを確認');
  }
}

// ---------- 4. ベンチ採取(--bench 指定時のみ) ----------
if (wantBench) {
  let hasPlaywright = true;
  try { require.resolve('playwright', { paths: [path.join(__dirname, '..')] }); } catch { hasPlaywright = false; }
  if (!hasPlaywright) {
    record('ベンチ collect-benchmark', 'SKIP', 'Playwright未導入');
  } else {
    const r = runNode('scripts/collect-benchmark.js');
    if (r.status === 0) {
      try {
        const json = JSON.parse(r.stdout);
        const m = json.metrics;
        const today = new Date().toISOString().slice(0, 10);
        const block = [
          '',
          `## 計測（${today} / ${gitShortHash()}）`,
          '',
          '条件: ヘッドレスChrome、1400x820、`scripts/collect-benchmark.js`、自由散策・春・昼・歩行視点、3.5秒待機後の `renderer.info`。',
          '',
          '| 指標 | 計測値 |',
          '|---|---:|',
          `| draw calls | **${m.render.calls.toLocaleString()}** |`,
          `| triangles | **${m.render.triangles.toLocaleString()}** |`,
          `| lines | **${m.render.lines}** |`,
          `| geometries | **${m.memory.geometries.toLocaleString()}** |`,
          `| textures | **${m.memory.textures}** |`,
          `| programs | **${m.programs}** |`,
          m.quality ? `| quality level | **${m.quality.level}** |` : null,
          m.quality ? `| pixel ratio | **${m.quality.pixelRatio}** |` : null,
          '',
        ].filter((l) => l !== null).join('\n');
        console.log('\n===== BENCHMARKS.md への追記用ブロック(コピペ可) =====');
        console.log(block);
        record('ベンチ collect-benchmark', 'PASS', '上のブロックをBENCHMARKS.mdへ追記して差分を確認');
      } catch (e) {
        record('ベンチ collect-benchmark', 'FAIL', `出力の解析に失敗: ${e.message}`);
      }
    } else {
      if (r.stderr) process.stderr.write(r.stderr);
      const envIssue = r.status === 2 || /Executable doesn't exist|Failed to launch|browserType\.launch/i.test(r.stderr || '');
      record('ベンチ collect-benchmark', envIssue ? 'SKIP' : 'FAIL', envIssue ? 'ブラウザ起動不可(環境要因)' : '');
    }
  }
}

// ---------- 結果サマリー ----------
console.log('\n===== プリフライト結果 =====');
for (const r of results) {
  const mark = { PASS: '✅', FAIL: '❌', WARN: '⚠️ ', SKIP: '⏭️ ' }[r.status] || '?';
  console.log(`${mark} ${r.status.padEnd(4)} ${r.name}${r.note ? ` — ${r.note}` : ''}`);
}
const failed = results.some((r) => r.status === 'FAIL');
console.log(failed
  ? '\n❌ 必須検査に失敗があります。push しないでください。'
  : '\n✅ プリフライト通過。スモークがSKIPの場合はCIの結果、実機確認項目は ops/WORKFLOW_KAIZEN_REPORT.md のチェックリストを参照。');
process.exit(failed ? 1 : 0);
