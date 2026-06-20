const path = require('path');
const { pathToFileURL } = require('url');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (error) {
  console.error('Playwright is not installed. Install it locally or use the bundled Codex runtime to collect benchmarks.');
  process.exit(2);
}

const targetArg = process.argv[2] || pathToFileURL(path.join(process.cwd(), '寝殿造り3D探訪_統合版.html')).toString();
const target = targetArg.includes('?') ? `${targetArg}&fps=1` : `${targetArg}?fps=1`;

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
  const page = await browser.newPage({ viewport: { width: 1400, height: 820 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  try {
    await page.goto(target, { waitUntil: 'load', timeout: 45_000 });
    await page.waitForFunction(() => typeof renderer !== 'undefined' && typeof scene !== 'undefined', { timeout: 45_000 });
    const metrics = await page.evaluate(async () => {
      if (typeof enterMode === 'function') enterMode('walk');
      if (typeof applySeason === 'function') applySeason('spring');
      if (typeof setTime === 'function') setTime('day');
      await new Promise((resolve) => setTimeout(resolve, 3500));
      const info = renderer.info;
      return {
        render: {
          calls: info.render.calls,
          triangles: info.render.triangles,
          points: info.render.points,
          lines: info.render.lines,
        },
        memory: {
          geometries: info.memory.geometries,
          textures: info.memory.textures,
        },
        programs: info.programs ? info.programs.length : null,
        quality: typeof QUALITY !== 'undefined' ? { level: QUALITY.level, pixelRatio: renderer.getPixelRatio() } : null,
      };
    });
    if (errors.length) {
      console.error(JSON.stringify({ target, metrics, errors }, null, 2));
      process.exit(1);
    }
    console.log(JSON.stringify({ target, metrics }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
