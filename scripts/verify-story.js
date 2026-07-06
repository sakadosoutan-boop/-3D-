const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.cwd();
const HTML_FILE = '寝殿造り3D探訪_統合版.html';
const STORY_DIR = path.join(ROOT, 'story');
const CHAPTER_DIR = path.join(STORY_DIR, 'chapters');
const MANIFEST_FILE = path.join(CHAPTER_DIR, 'chapter_manifest.json');

const failures = [];
const warnings = [];
const fail = (message) => failures.push(message);
const warn = (message) => warnings.push(message);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`${path.relative(ROOT, file)} is not valid JSON: ${error.message}`);
    return null;
  }
}

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
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
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

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function targetExists(target, ids) {
  return target === 'chapter_complete' || ids.has(target);
}

function checkTarget(chapter, event, field, target, ids) {
  if (target == null || target === '') return;
  if (!targetExists(target, ids)) {
    fail(`chapter${chapter.chapterId}:${event.id}.${field} points to missing sequence "${target}"`);
  }
}

function collectTargets(chapter, event, ids) {
  checkTarget(chapter, event, 'next', event.next, ids);
  checkTarget(chapter, event, 'successNext', event.successNext, ids);
  checkTarget(chapter, event, 'failNext', event.failNext, ids);
  checkTarget(chapter, event, 'trueNext', event.trueNext, ids);
  checkTarget(chapter, event, 'falseNext', event.falseNext, ids);
  if (Array.isArray(event.options)) {
    event.options.forEach((option, index) => {
      if (!option.text) fail(`chapter${chapter.chapterId}:${event.id}.options[${index}] is missing text`);
      checkTarget(chapter, event, `options[${index}].next`, option.next, ids);
    });
  }
}

const manifest = readJson(MANIFEST_FILE);
const html = fs.existsSync(HTML_FILE) ? fs.readFileSync(HTML_FILE, 'utf8') : '';
const runtime = fs.existsSync(path.join(STORY_DIR, 'story_runtime.js'))
  ? fs.readFileSync(path.join(STORY_DIR, 'story_runtime.js'), 'utf8')
  : '';

if (!manifest) {
  fail('story manifest could not be loaded');
} else {
  if (manifest.version !== 1) fail(`manifest.version should be 1, found ${manifest.version}`);
  if (manifest.basePath !== 'story/chapters/') fail(`manifest.basePath should be story/chapters/, found ${manifest.basePath}`);
  if (!Array.isArray(manifest.chapters) || !manifest.chapters.length) fail('manifest.chapters must be a non-empty array');
}

const implementedModes = new Set([
  ...runtime.matchAll(/info\.gameMode\s*===\s*["']([^"']+)["']/g),
].map((match) => match[1]));
if (!implementedModes.size) warn('no story mini-game bridge modes were detected in story_runtime.js');

const allChapters = {};
const manifestEntries = manifest && Array.isArray(manifest.chapters) ? manifest.chapters : [];
const manifestIds = manifestEntries.map((entry) => entry.chapterId);
const duplicateManifestIds = manifestIds.filter((id, index) => manifestIds.indexOf(id) !== index);
if (duplicateManifestIds.length) fail(`duplicate manifest chapter ids: ${[...new Set(duplicateManifestIds)].join(', ')}`);

for (const entry of manifestEntries) {
  const label = `manifest chapter ${entry.chapterId}`;
  if (!entry.chapterId || !Number.isInteger(entry.chapterId)) fail(`${label} has invalid chapterId`);
  if (!entry.file) fail(`${label} is missing file`);
  if (!entry.chapterTitle) fail(`${label} is missing chapterTitle`);
  if (!['spring', 'summer', 'autumn', 'winter', 'tokoyo'].includes(entry.season)) fail(`${label} has invalid season: ${entry.season}`);
  if (!['morning', 'day', 'dusk', 'night', 'dawn'].includes(entry.timeOfDay)) fail(`${label} has invalid timeOfDay: ${entry.timeOfDay}`);
  if (!Array.isArray(entry.requiredModes)) fail(`${label} requiredModes must be an array`);
  if (!entry.clearCondition) fail(`${label} is missing clearCondition`);

  const file = path.join(CHAPTER_DIR, entry.file || '');
  if (!fs.existsSync(file)) {
    fail(`${label} file does not exist: ${entry.file}`);
    continue;
  }
  const chapter = readJson(file);
  if (!chapter) continue;
  allChapters[String(entry.chapterId)] = chapter;

  if (chapter.chapterId !== entry.chapterId) fail(`${entry.file} chapterId ${chapter.chapterId} does not match manifest ${entry.chapterId}`);
  if (chapter.chapterTitle !== entry.chapterTitle) fail(`${entry.file} title does not match manifest`);
  if (chapter.season !== entry.season) fail(`${entry.file} season does not match manifest`);
  if (chapter.timeOfDay !== entry.timeOfDay) fail(`${entry.file} timeOfDay does not match manifest`);
  if (!Array.isArray(chapter.startSequence) || !chapter.startSequence.length) {
    fail(`${entry.file} startSequence must be a non-empty array`);
    continue;
  }

  const ids = new Set();
  for (const event of chapter.startSequence) {
    if (!event.id) fail(`${entry.file} contains an event without id`);
    if (!event.type) fail(`${entry.file}:${event.id || '<no-id>'} is missing type`);
    if (event.id && ids.has(event.id)) fail(`${entry.file} duplicate sequence id: ${event.id}`);
    if (event.id) ids.add(event.id);
  }

  for (const event of chapter.startSequence) {
    if (!event.id) continue;
    collectTargets(chapter, event, ids);
    if (event.type === 'choice' && (!Array.isArray(event.options) || !event.options.length)) {
      fail(`chapter${chapter.chapterId}:${event.id} choice must have options`);
    }
    if (event.type === 'flag_branch' && !event.flag) {
      fail(`chapter${chapter.chapterId}:${event.id} flag_branch is missing flag`);
    }
    if (event.type === 'trigger_minigame') {
      if (!event.gameMode) fail(`chapter${chapter.chapterId}:${event.id} trigger_minigame is missing gameMode`);
      else if (!implementedModes.has(event.gameMode)) fail(`chapter${chapter.chapterId}:${event.id} gameMode "${event.gameMode}" is not implemented in story_runtime.js`);
      if (!event.successNext || !event.failNext) fail(`chapter${chapter.chapterId}:${event.id} must define successNext and failNext`);
    }
    if (event.type === 'spawn_collectibles') {
      if (!event.groupId) fail(`chapter${chapter.chapterId}:${event.id} spawn_collectibles is missing groupId`);
      if (!Array.isArray(event.positions) || event.positions.length !== event.count) {
        fail(`chapter${chapter.chapterId}:${event.id} positions length must match count`);
      }
      if (event.kind === 'term_card_place') {
        const missingTargets = (event.positions || []).filter((pos) => !pos.placeTarget || typeof pos.placeTarget.x !== 'number' || typeof pos.placeTarget.z !== 'number');
        if (missingTargets.length) {
          fail(`chapter${chapter.chapterId}:${event.id} term_card_place entries missing placeTarget: ${missingTargets.map((pos) => pos.id || pos.label || '<unknown>').join(', ')}`);
        }
      }
    }
    if (event.type === 'require_collectibles') {
      if (!event.groupId || !Number.isInteger(event.count)) fail(`chapter${chapter.chapterId}:${event.id} require_collectibles needs groupId and integer count`);
    }
    if (event.type === 'ending' && !event.endingId) fail(`chapter${chapter.chapterId}:${event.id} ending is missing endingId`);
    if (event.type === 'ending_check' && !event.requirements) fail(`chapter${chapter.chapterId}:${event.id} ending_check should define requirements object`);
  }
}

const chapterSix = allChapters['6'];
const endingIds = new Set();
if (chapterSix && Array.isArray(chapterSix.startSequence)) {
  for (const event of chapterSix.startSequence) {
    if (event.type === 'ending') endingIds.add(event.endingId);
  }
}
for (const endingId of ['ED1_TRUE', 'ED2_NORMAL', 'ED3_GAMEOVER', 'ED4_SYNC', 'ED5_SPOOKY']) {
  if (!endingIds.has(endingId)) fail(`chapter6 is missing ending node ${endingId}`);
}

if (!html) {
  fail(`${HTML_FILE} was not found`);
} else {
  const embedExpr = extractBalanced(html, 'window.STORY_EMBED=', '{', '}');
  if (!embedExpr) {
    fail('HTML is missing window.STORY_EMBED');
  } else {
    let embedded = null;
    try {
      embedded = vm.runInNewContext(`(${embedExpr})`, Object.create(null), { timeout: 1000 });
    } catch (error) {
      fail(`HTML STORY_EMBED could not be evaluated: ${error.message}`);
    }
    if (embedded) {
      const expected = { manifest, chapters: allChapters };
      if (stableStringify(embedded) !== stableStringify(expected)) {
        fail('HTML STORY_EMBED is out of sync with story/chapters JSON files');
      }
    }
  }
}

const endingGallery = chapterSix && chapterSix.startSequence
  ? chapterSix.startSequence.find((event) => event.id === 'seq_603_select_ending')
  : null;
if (endingGallery) {
  const lockSignals = [
    'ev.id==="seq_603_select_ending"',
    'stLoadEndings()',
    'ST_ENDING_ORDER[i]',
    '？？？（未到達）',
    'st-opt-back',
  ];
  for (const signal of lockSignals) {
    if (!runtime.includes(signal)) fail(`ending gallery spoiler lock is missing runtime signal: ${signal}`);
  }
  if (!/未到達.*伏せ札/.test(endingGallery.text || '')) {
    fail('chapter6 ending gallery text should explain that unreached endings stay face-down');
  }
}

if (failures.length) {
  console.error('Story verification failed:');
  for (const message of failures) console.error(`- ${message}`);
  if (warnings.length) {
    console.error('Warnings:');
    for (const message of warnings) console.error(`- ${message}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'ok',
  chapters: Object.keys(allChapters).length,
  events: Object.values(allChapters).reduce((sum, chapter) => sum + chapter.startSequence.length, 0),
  implementedModes: [...implementedModes].sort(),
  endings: [...endingIds].sort(),
  warnings,
}, null, 2));
