// 再現モード「徒然草 第七段」の回帰テスト。
// - 本文13場のデータ(本文・現代語訳・注・話者)がそろっていること
// - 開始 → 全13場を順に描画 → 各場のショット列を早送りしても例外が出ないこと
// - カメラ・光・霧が有限値に保たれ、自前のゾーンでは空/霧/光の上書きフックが働くこと
// - 終了(表紙へ/他モードへ)で、カメラ(near/fov)・光源・フック・専用音が元に戻ること
// - 既存の2作品(枕草子・古今著聞集)が引き続き開始できること
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
  try {
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof THREE !== 'undefined' && typeof renderer !== 'undefined' && typeof SAIGEN_SCENES !== 'undefined', null, { timeout: 240000 });

    const data = await page.evaluate(() => {
      const sc = SAIGEN_SCENES.find((s) => s.id === 'tsurezure_adashino');
      if (!sc) return { found: false };
      const bad = sc.beats.map((b, i) => ((!b.honbun || !b.yaku || !b.note || b.speaker !== 'kenko') ? i + 1 : 0)).filter(Boolean);
      const shots = (typeof SAIGEN_TSUREZURE !== 'undefined' && SAIGEN_TSUREZURE) ? SAIGEN_TSUREZURE.BEAT_SHOTS.map((s) => s.length) : [];
      return { found: true, beats: sc.beats.length, bad, shots, first: sc.beats[0].honbun, last: sc.beats[sc.beats.length - 1].honbun, speaker: SAIGEN_CHARS.kenko && SAIGEN_CHARS.kenko.name };
    });
    if (!data.found) failures.push('scene tsurezure_adashino is not registered in SAIGEN_SCENES');
    else {
      if (data.beats !== 13) failures.push(`expected 13 beats, got ${data.beats}`);
      if (data.bad.length) failures.push(`beats missing honbun/yaku/note/speaker: ${data.bad.join(',')}`);
      if (data.shots.length !== 13 || data.shots.some((n) => !n)) failures.push(`every beat needs at least one shot: ${data.shots.join(',')}`);
      if (data.first !== 'あだし野の露消ゆる時なく、') failures.push(`unexpected first line: ${data.first}`);
      if (!/あさましき。$/.test(data.last)) failures.push(`unexpected last line: ${data.last}`);
      if (data.speaker !== '兼好法師') failures.push('SAIGEN_CHARS.kenko name missing');
    }

    const run = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const out = { beats: [], errors: [] };
      const saved = { near: camera.near, fov: 62, il: interiorLight.position.toArray(), sunTarget: sun.target.position.toArray(), hemi: hemi.color.getHex() };
      enterMode('saigen');
      const pk = document.getElementById('sgPicker'); if (pk) pk.style.display = 'none';
      startSaigen('tsurezure_adashino');
      await wait(400);
      const T = SAIGEN_TSUREZURE.S;
      out.built = !!window.SAIGEN_STAGE && T.active && typeof window.SAIGEN_ENV_HOOK === 'function';
      out.viewToggle = !!document.getElementById('sgView');
      for (let i = 0; i < 13; i++) {
        APP.saigen.i = i; renderSaigenBeat();
        await wait(60);
        const props = SAIGEN_STAGE.userData.props;
        // ショット列を早送り(全ショットを通過させる)
        let t = 0; const dt = 1 / 15;
        const total = T.shots.reduce((a, s) => a + (s.dur || 8), 0) + 1;
        const zones = new Set([T.curZone]);
        for (; t < total; t += dt) { props.update(dt, t); window.SAIGEN_ENV_HOOK(dt); zones.add(T.curZone); }
        await wait(30);
        const finite = [player.pos.x, player.pos.y, player.pos.z, player.yaw, player.pitch, camera.fov, sun.intensity, renderer.toneMappingExposure].every(Number.isFinite);
        const fogOk = !scene.fog || Number.isFinite(scene.fog.density);
        const label = document.getElementById('sgCounter').textContent;
        out.beats.push({ i: i + 1, zones: [...zones], shots: T.shots.length, finite, fogOk, label, speaker: document.getElementById('sgSpeaker').textContent });
      }
      // 「絵を見る」切替
      document.getElementById('sgView').click();
      out.viewOn = document.getElementById('saigenHud').classList.contains('sg-view');
      saigenBackToTitle();
      await wait(100);
      out.after = {
        active: T.active, hook: typeof window.SAIGEN_ENV_HOOK === 'function', stage: !!window.SAIGEN_STAGE,
        near: camera.near, fov: camera.fov, il: interiorLight.position.toArray(), sunTarget: sun.target.position.toArray(), hemi: hemi.color.getHex(),
        viewOff: !document.getElementById('saigenHud').classList.contains('sg-view'), mode: APP.mode,
      };
      out.saved = saved;
      // 既存の2作品
      enterMode('saigen'); if (pk) pk.style.display = 'none';
      startSaigen('makura_haru'); await wait(100);
      out.makura = APP.saigen && APP.saigen.scene.id === 'makura_haru' && !SAIGEN_TSUREZURE.S.active;
      startSaigen('chomon_uta'); await wait(100);
      APP.saigen.i = 5; renderSaigenBeat(); await wait(50);
      out.chomon = APP.saigen && APP.saigen.scene.id === 'chomon_uta';
      // 再入場→他モードへ離脱しても片付くこと
      startSaigen('tsurezure_adashino'); await wait(100);
      APP.saigen.i = 5; renderSaigenBeat(); await wait(100);
      const loopsBefore = Object.keys(SAIGEN_TSUREZURE.S.loops).length;
      enterMode('walk'); await wait(100);
      out.leave = { active: SAIGEN_TSUREZURE.S.active, hook: typeof window.SAIGEN_ENV_HOOK === 'function', loops: Object.keys(SAIGEN_TSUREZURE.S.loops).length, loopsBefore, near: camera.near, stage: !!window.SAIGEN_STAGE };
      return out;
    });

    if (!run.built) failures.push('tsurezure stage/hook did not build');
    if (!run.viewToggle) failures.push('#sgView toggle button missing');
    const expectZones = [['adashi', 'dew'], ['toribe'], ['an'], ['an'], ['an', 'leaf', 'water'], ['semi', 'an'], ['an'], ['an'], ['an'], ['an'], ['estate'], ['estate'], ['estate', 'an']];
    run.beats.forEach((b, idx) => {
      if (!b.finite) failures.push(`beat ${b.i}: non-finite camera/light values`);
      if (!b.fogOk) failures.push(`beat ${b.i}: fog density invalid`);
      if (!b.shots) failures.push(`beat ${b.i}: no shots`);
      const want = expectZones[idx];
      if (want && want.some((z) => !b.zones.includes(z))) failures.push(`beat ${b.i}: zones ${b.zones.join('/')} did not include ${want.join('/')}`);
      if (b.label !== `第${b.i}場 / 全13場`) failures.push(`beat ${b.i}: counter "${b.label}"`);
      if (b.speaker !== '— 兼好法師 —') failures.push(`beat ${b.i}: speaker "${b.speaker}"`);
    });
    if (!run.viewOn) failures.push('view-only toggle did not hide the text panel');
    const a = run.after;
    if (a.active || a.hook || a.stage) failures.push(`exit did not clean up: ${JSON.stringify(a)}`);
    if (Math.abs(a.near - run.saved.near) > 1e-9 || a.fov !== 62) failures.push(`camera not restored: near ${a.near} fov ${a.fov}`);
    if (a.il.join() !== run.saved.il.join()) failures.push(`interiorLight position not restored: ${a.il} vs ${run.saved.il}`);
    if (a.sunTarget.join() !== run.saved.sunTarget.join()) failures.push(`sun target not restored: ${a.sunTarget}`);
    if (a.hemi !== run.saved.hemi) failures.push('hemisphere light colour not restored');
    if (!a.viewOff) failures.push('view-only state leaked after exit');
    if (!run.makura) failures.push('makura_haru did not start after tsurezure');
    if (!run.chomon) failures.push('chomon_uta did not start');
    const l = run.leave;
    if (l.active || l.hook || l.loops || l.stage) failures.push(`leaving to walk mode did not clean up: ${JSON.stringify(l)}`);
    if (!l.loopsBefore) failures.push('beat 6 did not start its cicada audio loops');
  } catch (error) {
    failures.push(`exception: ${error.message}`);
  }
  if (errors.length) failures.push(...errors.slice(0, 10).map((e) => `console/page error: ${e}`));
  await browser.close();
  if (failures.length) {
    console.error('saigen-tsurezure FAILED');
    failures.forEach((f) => console.error(' - ' + f));
    process.exit(1);
  }
  console.log(JSON.stringify({ status: 'ok', scene: 'tsurezure_adashino', beats: 13 }));
})();
