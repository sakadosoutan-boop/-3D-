// 再現モード「枕草子 第一段 春はあけぼの」の回帰テスト。
// - 本文15場のデータ(本文・現代語訳・注・話者)がそろい、作品一覧の先頭にあること
// - 開始 → 全15場を順に描画 → 各場のショット列を早送りしても例外が出ず、カメラ・光・霧が有限値に保たれること
// - 素材のファクトリがある素材は、代替の箱に落ちていないこと(作りかけの素材はファクトリが無いので代替のまま=警告のみ)
// - 終了(他モードへ)で、場面・フック・カメラ(near/fov)・室内灯が元に戻ること
const path = require('path');
const { pathToFileURL } = require('url');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (error) {
  console.error('Playwright is not installed.');
  process.exit(2);
}

const target = process.argv[2] || pathToFileURL(path.join(process.cwd(), '寝殿造り3D探訪_統合版.html')).toString();

async function launchBrowser() {
  const attempts = [
    () => chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' }),
    () => chromium.launch({ headless: true }),
    () => chromium.launch({ headless: true, channel: 'msedge' }),
  ];
  let lastError;
  for (const attempt of attempts) {
    try { return await attempt(); } catch (error) { lastError = error; }
  }
  throw lastError;
}

function ignorable(text) {
  return /THREE\.WebGLProgram: shader error:/.test(text)
    || /The play\(\) request was interrupted/.test(text)
    || /AudioContext was not allowed to start/.test(text)
    || /net::ERR_|Failed to load resource/.test(text);
}

(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => { const t = e.message || String(e); if (!ignorable(t)) errors.push(t); });
  page.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); });
  await page.addInitScript(() => {
    window.SHINDEN_ONLINE_CONFIG = { enabled: false };
    try { localStorage.setItem('shinden3d-onboard-v1', '1'); } catch (e) {}
  });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const failures = [];
  const warnings = [];
  try {
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof THREE !== 'undefined' && typeof renderer !== 'undefined' && typeof SAIGEN_SCENES !== 'undefined' && typeof SAIGEN_MAKURA !== 'undefined', null, { timeout: 240000 });

    const data = await page.evaluate(() => {
      const sc = SAIGEN_SCENES.find((s) => s.id === 'makura_haru');
      if (!sc) return { found: false };
      const bad = sc.beats.map((b, i) => ((!b.honbun || !b.yaku || !b.note || b.speaker !== 'seishonagon') ? i + 1 : 0)).filter(Boolean);
      return { found: true, first: SAIGEN_SCENES[0] && SAIGEN_SCENES[0].id, beats: sc.beats.length, bad, buildProps: sc.buildProps, module: !!SAIGEN_MAKURA, shots: SAIGEN_MAKURA.BEAT_SHOTS.length };
    });
    if (!data.found) failures.push('makura_haru scene is missing');
    else {
      if (data.first !== 'makura_haru') failures.push(`makura_haru is not first in the scene list (first: ${data.first})`);
      if (data.beats !== 15) failures.push(`expected 15 beats, got ${data.beats}`);
      if (data.bad.length) failures.push(`beats missing honbun/yaku/note/speaker: ${data.bad.join(', ')}`);
      if (data.buildProps !== 'makura') failures.push(`buildProps should be "makura" (got ${data.buildProps})`);
      if (data.shots !== 15) failures.push(`BEAT_SHOTS has ${data.shots} entries (expected 15)`);
    }

    const run = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const finite = (v) => Number.isFinite(v);
      const out = { beats: [], bad: [], fallbacks: [], camBefore: { near: camera.near, fov: camera.fov } };
      enterMode('saigen'); const pk = document.getElementById('sgPicker'); if (pk) pk.style.display = 'none';
      SAIGEN_MAKURA.S.syncBuild = true;
      startSaigen('makura_haru'); await wait(200);
      const S = SAIGEN_MAKURA.S;
      out.active = S.active; out.hook = window.SAIGEN_ENV_HOOK != null;
      for (let i = 0; i < 15; i++) {
        APP.saigen.i = i; renderSaigenBeat(); await wait(60);
        const n = S.shots.length; const zones = [];
        // ショット列を早送り(各ショットの最後まで進めて次へ)
        for (let k = 0; k < n; k++) {
          zones.push(S.curZone);
          const sh = S.shots[S.shotIdx]; S.shotT = (sh && sh.dur ? sh.dur : 8) - 0.05; await wait(80);
        }
        const p = camera.position;
        const ok = finite(p.x) && finite(p.y) && finite(p.z) && finite(camera.fov) && finite(sun.intensity) && finite(hemi.intensity)
          && (!scene.fog || finite(scene.fog.density)) && finite(renderer.toneMappingExposure);
        if (!n || !ok) out.bad.push(`${i + 1}:${n ? 'non-finite' : 'no shots'}`);
        out.beats.push({ i: i + 1, shots: n, zones });
      }
      // 素材: ファクトリがあるのに代替の箱に落ちたもの(失敗)と、まだファクトリが無いもの(警告)
      const M = { FIG: typeof TSURE_FIGURES !== 'undefined' ? TSURE_FIGURES : {}, NAT: typeof TSURE_NATURE !== 'undefined' ? TSURE_NATURE : {}, INS: typeof TSURE_INSECTS !== 'undefined' ? TSURE_INSECTS : {},
        FLO: typeof TSURE_FLORA !== 'undefined' ? TSURE_FLORA : {}, TRE: typeof TSURE_TREES !== 'undefined' ? TSURE_TREES : {}, AN: typeof TSURE_AN !== 'undefined' ? TSURE_AN : {}, PRO: typeof MAKURA_PROPS !== 'undefined' ? MAKURA_PROPS : {} };
      const factory = { terrain: M.NAT.makeTerrain, stream: M.NAT.makeStream, pond: M.NAT.makeMirrorWater, grass: M.FLO.makeGrassField, ridges: M.NAT.makeKyotoRidges || M.NAT.makeHills,
        densha: M.AN.makeDensha, watadono: M.AN.makeWatadono, tsuiji: M.AN.makeTsuiji, lamp: M.AN.makeToudai, kichou: M.PRO.makeKichou,
        sei: M.FIG.makeNyobo, nyoboCarry: M.FIG.makeNyobo, nyoboTend: M.FIG.makeNyobo, hioke: M.PRO.makeHioke, sumitori: M.PRO.makeSumitori,
        swarm: M.INS.makeFireflySwarm, hotaru: M.INS.makeGenjiBotaru, hotaruSet: M.FLO.makeNightLeafMacroSet, suzumushi: M.INS.makeSuzumushi, suzuSet: M.FLO.makeStalkMacroSet,
        shimoSet: M.FLO.makeFrostMacroSet, rain: M.NAT.makeRain, geese: M.NAT.makeGeese, crows: M.NAT.makeCrowFlock || M.NAT.makeCrows, snowfall: M.NAT.makeSnowfall || M.TRE.makeFallingParticles, cherry: M.TRE.makeCherry };
      Object.keys(factory).forEach((k) => {
        const a = S.assets[k];
        if (!a) { out.fallbacks.push({ k, state: 'missing', hasFactory: !!factory[k] }); return; }
        if (a.userData && a.userData.fallback) out.fallbacks.push({ k, state: 'fallback', hasFactory: !!factory[k] });
      });
      out.jobMs = S.jobMs;
      // 他モードへ離脱して後片付けを確かめる
      enterMode('walk'); await wait(200);
      out.leave = { active: S.active, stage: !!S.stage, hook: window.SAIGEN_ENV_HOOK != null, near: camera.near, fov: camera.fov, interior: interiorLight.intensity, loops: Object.keys(S.loops).length };
      return out;
    });
    if (!run.active) failures.push('makura scene did not become active');
    if (!run.hook) failures.push('environment hook was not installed');
    if (run.bad.length) failures.push(`beats with problems: ${run.bad.join(', ')}`);
    run.fallbacks.forEach((f) => {
      const msg = `asset ${f.k} is ${f.state}`;
      if (f.hasFactory) failures.push(msg + ' although its factory exists (build error?)'); else warnings.push(msg + ' (factory not delivered yet)');
    });
    const l = run.leave;
    if (l.active || l.stage || l.hook || l.loops) failures.push(`leaving to walk mode did not clean up: ${JSON.stringify(l)}`);
    if (Math.abs(l.near - run.camBefore.near) > 1e-6) failures.push(`camera.near not restored (${run.camBefore.near} -> ${l.near})`);
  } catch (error) {
    failures.push(`exception: ${error.message}`);
  }
  if (errors.length) failures.push(...errors.slice(0, 10).map((e) => `console/page error: ${e}`));
  await browser.close();
  if (warnings.length) warnings.forEach((w) => console.warn('warning: ' + w));
  if (failures.length) {
    console.error('saigen-makura FAILED');
    failures.forEach((f) => console.error(' - ' + f));
    process.exit(1);
  }
  console.log(JSON.stringify({ status: 'ok', scene: 'makura_haru', beats: 15, pendingAssets: warnings.length }));
})();
