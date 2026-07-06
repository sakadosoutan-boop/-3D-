const path = require('path');
const { pathToFileURL } = require('url');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (error) {
  console.error('Playwright is not installed. Install it locally or use the bundled Codex runtime to run this smoke test.');
  process.exit(2);
}

const target = process.argv[2] || pathToFileURL(path.join(process.cwd(), '寝殿造り3D探訪_統合版.html')).toString();

async function launchBrowser() {
  const attempts = [
    () => chromium.launch({ headless: true }),
    () => chromium.launch({ headless: true, channel: 'chrome' }),
    () => chromium.launch({ headless: true, channel: 'msedge' }),
  ];
  let lastError;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  try {
    await page.goto(target, { waitUntil: 'load', timeout: 45_000 });
    await page.waitForFunction(() => typeof THREE !== 'undefined' && typeof renderer !== 'undefined' && !!document.querySelector('canvas'), { timeout: 45_000 });
    const status = await page.evaluate(async () => {
      const ids = ['btnWalk', 'btnQuiz', 'tbTime', 'tbSeason', 'btnKaimami', 'btnCodex', 'tbGfx', 'tbCodex'];
      const missing = ids.filter((id) => !document.getElementById(id));
      if (typeof enterMode === 'function') enterMode('walk');
      await new Promise((resolve) => setTimeout(resolve, 500));
      const walkOk = typeof APP !== 'undefined' && APP.mode === 'walk';
      if (typeof openCodex === 'function') openCodex();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const codexOk = !!document.getElementById('codex')?.classList.contains('open');
      if (typeof closeCodex === 'function') closeCodex();
      document.getElementById('tbGfx')?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const gfx = document.getElementById('gfx');
      const gfxOk = !!gfx && getComputedStyle(gfx).display !== 'none';
      if (gfx) gfx.style.display = 'none';
      if (typeof enterMode === 'function') enterMode('kaimami');
      await new Promise((resolve) => setTimeout(resolve, 500));
      const kaimamiOk = typeof APP !== 'undefined' && APP.mode === 'kaimami';
      const kaimamiRoutes = Array.isArray(KAIMAMI_SECRETS) ? KAIMAMI_SECRETS.map((route) => route.id) : [];
      const kaimamiText = document.getElementById('questText')?.textContent || '';
      localStorage.setItem('shinden3d-modebrief-v1-taiji', 'hide');
      if (typeof enterMode === 'function') enterMode('taiji');
      await new Promise((resolve) => setTimeout(resolve, 600));
      if (typeof hideModeBrief === 'function') hideModeBrief(true);
      if (APP.taiji) {
        APP.taiji.tutorialBlocked = false;
        APP.taiji.tutorialGraceUntil = 0;
      }
      const sendTaijiKey = (key) => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      const sendTaijiKeyUp = (key) => window.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
      sendTaijiKey('3');
      const taijiSwordOk = APP.taiji?.weapon === 'sword';
      sendTaijiKey('e');
      const taijiNextOk = APP.taiji?.weapon === 'bow';
      sendTaijiKey('q');
      const taijiPrevOk = APP.taiji?.weapon === 'sword';
      sendTaijiKey('f');
      const taijiGuardOk = !!APP.taiji?.guarding;
      sendTaijiKeyUp('f');
      const taijiGuardReleaseOk = !APP.taiji?.guarding;
      const canvas = document.querySelector('canvas');
      const rightDown = new MouseEvent('mousedown', { button: 2, clientX: innerWidth / 2, clientY: innerHeight / 2, bubbles: true, cancelable: true });
      canvas?.dispatchEvent(rightDown);
      const taijiRightGuardOk = !!APP.taiji?.guarding && rightDown.defaultPrevented;
      const ctx = new MouseEvent('contextmenu', { button: 2, clientX: innerWidth / 2, clientY: innerHeight / 2, bubbles: true, cancelable: true });
      canvas?.dispatchEvent(ctx);
      const taijiContextBlockedOk = ctx.defaultPrevented;
      window.dispatchEvent(new MouseEvent('mouseup', { button: 2, clientX: innerWidth / 2, clientY: innerHeight / 2, bubbles: true, cancelable: true }));
      const taijiRightReleaseOk = !APP.taiji?.guarding;
      sendTaijiKey(' ');
      const taijiDodgeOk = !!APP.taiji && APP.taiji.dodgeUntil > performance.now();
      if (APP.taiji) {
        APP.taiji.hp = 50;
        APP.taiji.sakeCd = 0;
        APP.taiji.sakeDrinkUntil = 0;
      }
      const sakeBefore = APP.taiji?.sake ?? 0;
      sendTaijiKey('r');
      await new Promise((resolve) => setTimeout(resolve, 80));
      const taijiSakeOk = !!APP.taiji && APP.taiji.sake === sakeBefore - 1 && APP.taiji.hp > 50;
      sendTaijiKey('w');
      const taijiKeyStuckSetupOk = keys.w === true;
      if (typeof endTaiji === 'function') endTaiji(true);
      await new Promise((resolve) => setTimeout(resolve, 120));
      const taijiEndOk = APP.mode === 'walk' && !APP.taiji && getComputedStyle(document.getElementById('taijiHud')).display === 'none';
      const taijiKeyResetOk = keys.w === false && keys.shift === false;
      const taijiResultOk = getComputedStyle(document.getElementById('result')).display !== 'none';
      if (typeof closeResultPanel === 'function') closeResultPanel();
      if (typeof applySeason === 'function') applySeason('summer');
      if (typeof setTime === 'function') setTime('night');
      await new Promise((resolve) => setTimeout(resolve, 500));
      const tourou = typeof tourouGroup !== 'undefined' ? tourouGroup : null;
      const tourouOk = !!tourou?.visible;
      const tourouRipples = tourou?.userData?.lanterns?.filter((lantern) => !!lantern.ripple).length || 0;
      const emakiCount = typeof EMAKI_FRAGMENT_IDS !== 'undefined' ? EMAKI_FRAGMENT_IDS.length : 0;
      const emakiVisible = typeof emakiFragments !== 'undefined' ? emakiFragments.filter((fragment) => fragment.visible).length : 0;
      return {
        missing,
        walkOk,
        codexOk,
        gfxOk,
        kaimamiOk,
        kaimamiRoutes,
        kaimamiTextOk: kaimamiText.includes('三つの観察地点'),
        taijiSwordOk,
        taijiNextOk,
        taijiPrevOk,
        taijiGuardOk,
        taijiGuardReleaseOk,
        taijiRightGuardOk,
        taijiContextBlockedOk,
        taijiRightReleaseOk,
        taijiDodgeOk,
        taijiSakeOk,
        taijiKeyStuckSetupOk,
        taijiKeyResetOk,
        taijiEndOk,
        taijiResultOk,
        tourouOk,
        tourouRipples,
        emakiCount,
        emakiVisible,
        canvas: !!document.querySelector('canvas'),
        objects: typeof scene !== 'undefined' ? scene.children.length : null,
      };
    });
    if (status.missing.length) errors.push(`missing UI ids: ${status.missing.join(', ')}`);
    if (!status.walkOk) errors.push('walk mode did not start');
    if (!status.codexOk) errors.push('codex did not open');
    if (!status.gfxOk) errors.push('graphics settings did not open');
    if (!status.kaimamiOk) errors.push('kaimami mode did not start');
    if (status.kaimamiRoutes.join(',') !== 'east,north,tsumado') errors.push(`unexpected kaimami routes: ${status.kaimamiRoutes.join(',')}`);
    if (!status.kaimamiTextOk) errors.push('kaimami instructions did not mention the three observation points');
    if (!status.taijiSwordOk) errors.push('taiji key 3 did not select sword');
    if (!status.taijiNextOk || !status.taijiPrevOk) errors.push('taiji Q/E weapon cycling failed');
    if (!status.taijiGuardOk || !status.taijiGuardReleaseOk) errors.push('taiji F guard press/release failed');
    if (!status.taijiRightGuardOk || !status.taijiRightReleaseOk) errors.push('taiji right-click guard press/release failed');
    if (!status.taijiContextBlockedOk) errors.push('taiji context menu was not blocked');
    if (!status.taijiDodgeOk) errors.push('taiji Space dodge failed');
    if (!status.taijiSakeOk) errors.push('taiji R sake failed');
    if (!status.taijiKeyStuckSetupOk || !status.taijiKeyResetOk) errors.push('taiji key state reset failed after battle');
    if (!status.taijiEndOk || !status.taijiResultOk) errors.push('taiji end/reset flow failed');
    if (!status.tourouOk) errors.push('tourou lanterns did not appear in summer night');
    if (status.tourouRipples !== 8) errors.push(`unexpected tourou ripple count: ${status.tourouRipples}`);
    if (status.emakiCount !== 6 || status.emakiVisible !== 6) errors.push(`unexpected emaki fragments: ${status.emakiVisible}/${status.emakiCount}`);
    if (errors.length) {
      console.error(JSON.stringify({ status, errors }, null, 2));
      process.exit(1);
    }
    console.log(JSON.stringify({ status: 'ok', target, app: status }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
