const https = require('https');
const http = require('http');

const baseUrl = process.argv[2] || 'https://sakadosoutan-boop.github.io/-3D-/';
const version = process.argv[3] || Date.now().toString();
const appPath = encodeURIComponent('寝殿造り3D探訪_統合版.html');
const targets = [
  new URL(`index.html?v=${encodeURIComponent(version)}`, baseUrl).toString(),
  new URL(`${appPath}?v=${encodeURIComponent(version)}`, baseUrl).toString(),
];

function fetchText(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'shinden3d-verify/1.0' } }, (res) => {
      const status = res.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status) && res.headers.location && redirects < 5) {
        res.resume();
        resolve(fetchText(new URL(res.headers.location, url).toString(), redirects + 1));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
        if (body.length > 8_000_000) req.destroy(new Error('response too large'));
      });
      res.on('end', () => resolve({ url, status, body }));
    });
    req.setTimeout(30_000, () => req.destroy(new Error(`timeout: ${url}`)));
    req.on('error', reject);
  });
}

(async () => {
  const failures = [];
  const results = [];
  for (const target of targets) {
    try {
      const result = await fetchText(target);
      results.push({ url: target, status: result.status, bytes: Buffer.byteLength(result.body) });
      if (result.status !== 200) failures.push(`${target} returned HTTP ${result.status}`);
      if (!result.body.includes('寝殿造り3D探訪')) failures.push(`${target} is missing the app title`);
    } catch (error) {
      failures.push(`${target} failed: ${error.message}`);
    }
  }
  if (failures.length) {
    console.error('Public URL verification failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(JSON.stringify({ status: 'ok', results }, null, 2));
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
