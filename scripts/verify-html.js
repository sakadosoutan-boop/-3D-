const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML_FILE = '寝殿造り3D探訪_統合版.html';
const html = fs.readFileSync(HTML_FILE, 'utf8');
const creditsPath = path.join('sounds', 'CREDITS.md');
const credits = fs.existsSync(creditsPath) ? fs.readFileSync(creditsPath, 'utf8') : '';

const failures = [];
const fail = (message) => failures.push(message);

function extractBalanced(source, marker, openChar, closeChar) {
  const start = source.indexOf(marker);
  if (start < 0) return null;
  const open = source.indexOf(openChar, start);
  if (open < 0) return null;
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === openChar) depth++;
    if (ch === closeChar) depth--;
    if (depth === 0) return source.slice(open, i + 1);
  }
  return null;
}

function evaluateExpression(expr, label) {
  try {
    return vm.runInNewContext(`(${expr})`, Object.create(null), { timeout: 1000 });
  } catch (error) {
    fail(`${label} could not be evaluated: ${error.message}`);
    return null;
  }
}

function countDuplicates(values) {
  const seen = new Set();
  const dupes = new Set();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes];
}

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
if (scripts.length !== 3) fail(`expected 3 inline <script> blocks, found ${scripts.length}`);
const mainScript = scripts[2] || '';

try {
  new Function(mainScript);
} catch (error) {
  fail(`main script syntax error: ${error.message}`);
}

const ids = [...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]);
const duplicateIds = countDuplicates(ids);
if (duplicateIds.length) fail(`duplicate DOM ids: ${duplicateIds.join(', ')}`);

const domRefs = [
  ...mainScript.matchAll(/\$\(["']([^"']+)["']\)/g),
  ...mainScript.matchAll(/document\.getElementById\(["']([^"']+)["']\)/g),
].map((match) => match[1]);
const missingDomRefs = [...new Set(domRefs.filter((id) => !ids.includes(id)))];
if (missingDomRefs.length) fail(`missing DOM ids referenced by script: ${missingDomRefs.join(', ')}`);

const forbiddenR128Apis = ['SRGBColorSpace', '.colorSpace'];
for (const token of forbiddenR128Apis) {
  if (mainScript.includes(token)) fail(`r128-incompatible API found in main script: ${token}`);
}

const soundRefs = [
  ...html.matchAll(/sounds\/([^'")<>\s]+?\.mp3)/g),
].map((match) => decodeURIComponent(match[1]));
const quotedSoundRefs = [
  ...mainScript.matchAll(/["']([^"']+?\.mp3)["']/g),
].map((match) => match[1]);
soundRefs.push(...quotedSoundRefs);
const uniqueSoundRefs = [...new Set(soundRefs)].sort();
const missingSoundFiles = uniqueSoundRefs.filter((name) => !fs.existsSync(path.join('sounds', name)));
if (missingSoundFiles.length) fail(`HTML references missing sound files: ${missingSoundFiles.join(', ')}`);
const missingCreditRows = uniqueSoundRefs.filter((name) => !credits.includes(name));
if (missingCreditRows.length) fail(`sounds/CREDITS.md missing referenced files: ${missingCreditRows.join(', ')}`);

const itemExpr = extractBalanced(mainScript, 'const ITEMS', '{', '}');
if (!itemExpr) {
  fail('const ITEMS object was not found');
} else {
  const itemKeys = [];
  let depth = 0;
  let quote = null;
  let escaped = false;
  let token = '';
  for (let i = 1; i < itemExpr.length - 1; i++) {
    const ch = itemExpr[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{' || ch === '[' || ch === '(') depth++;
    if (ch === '}' || ch === ']' || ch === ')') depth--;
    if (depth === 0 && /[A-Za-z0-9_]/.test(ch)) {
      token += ch;
      continue;
    }
    if (depth === 0 && ch === ':' && token) {
      itemKeys.push(token);
      token = '';
      continue;
    }
    if (depth === 0 && ch !== '_' && !/[A-Za-z0-9]/.test(ch)) token = '';
  }
  const duplicateItemKeys = countDuplicates(itemKeys);
  if (duplicateItemKeys.length) fail(`duplicate ITEMS keys: ${duplicateItemKeys.join(', ')}`);
  const items = evaluateExpression(itemExpr, 'ITEMS');
  if (items) {
    const invalid = Object.entries(items).filter(([, value]) => !value.n || !value.k || !value.cat || !value.d);
    if (invalid.length) fail(`ITEMS entries missing n/k/cat/d: ${invalid.map(([key]) => key).join(', ')}`);
  }
}

const wakaExpr = extractBalanced(mainScript, 'const WAKA_DATA', '[', ']');
const waka = wakaExpr ? evaluateExpression(wakaExpr, 'WAKA_DATA') : null;
if (!wakaExpr) {
  fail('const WAKA_DATA array was not found');
} else if (Array.isArray(waka)) {
  if (waka.length !== 100) fail(`WAKA_DATA should contain 100 poems, found ${waka.length}`);
  const duplicateWakaIds = countDuplicates(waka.map((entry) => entry.id));
  if (duplicateWakaIds.length) fail(`duplicate WAKA_DATA ids: ${duplicateWakaIds.join(', ')}`);
  const allowedSeasons = new Set(['spring', 'summer', 'autumn', 'winter']);
  const invalidSeasons = waka.filter((entry) => !allowedSeasons.has(entry.season));
  if (invalidSeasons.length) fail(`invalid WAKA_DATA seasons: ${invalidSeasons.map((entry) => entry.id).join(', ')}`);
  const missingFields = waka.filter((entry) => !entry.id || !entry.poem || !entry.auth || !entry.interp);
  if (missingFields.length) fail(`WAKA_DATA entries missing fields: ${missingFields.map((entry) => entry.id || '<no id>').join(', ')}`);
} else {
  fail('WAKA_DATA did not evaluate to an array');
}

if (failures.length) {
  console.error('HTML verification failed:');
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'ok',
  htmlBytes: Buffer.byteLength(html),
  scripts: scripts.length,
  domIds: ids.length,
  soundRefs: uniqueSoundRefs.length,
  wakaEntries: waka ? waka.length : 0,
}, null, 2));
