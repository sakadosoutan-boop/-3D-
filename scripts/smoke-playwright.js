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
      return {
        missing,
        walkOk,
        codexOk,
        gfxOk,
        kaimamiOk,
        kaimamiRoutes,
        kaimamiTextOk: kaimamiText.includes('三つの観察地点'),
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
