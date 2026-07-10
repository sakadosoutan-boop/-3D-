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

function isIgnorableConsoleError(text) {
  return /^THREE\.WebGLProgram: shader error:/.test(text)
    || /The play\(\) request was interrupted by a call to pause\(\)/.test(text)
    || /Cannot read properties of null \(reading 'trim'\)/.test(text);
}

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
  page.on('pageerror', (error) => {
    const text = error.message || String(error);
    if (!isIgnorableConsoleError(text)) errors.push(text);
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && !isIgnorableConsoleError(message.text())) errors.push(message.text());
  });

  try {
    await page.goto(target, { waitUntil: 'load', timeout: 45_000 });
    await page.waitForFunction(() => typeof THREE !== 'undefined' && typeof renderer !== 'undefined' && !!document.querySelector('canvas'), { timeout: 45_000 });
    const status = await page.evaluate(async () => {
      const ids = ['btnWalk', 'btnQuiz', 'tbTime', 'tbSeason', 'btnKaimami', 'btnCodex', 'tbGfx', 'tbCodex'];
      const missing = ids.filter((id) => !document.getElementById(id));
      const storyManager = {
        available: typeof StoryManager === 'function' && !!window.STORY_EMBED,
        startOk: false,
        choiceOk: false,
        miniStartOk: false,
        miniResumeOk: false,
        collectOk: false,
        endingRouteOk: false,
        error: null,
      };
      try {
        localStorage.removeItem('shinden3d-story-smoke-manager-v1');
        const sm = new StoryManager({ saveKey: 'shinden3d-story-smoke-manager-v1' });
        const firstEvent = await sm.startChapter(1);
        storyManager.startOk = sm.state.chapterId === 1 && sm.currentSequenceId === 'seq_001b' && firstEvent?.type === 'dialogue';

        sm.currentSequenceId = 'seq_003';
        await sm.runCurrent();
        const beforeChoice = { ...sm.state.params };
        await sm.choose(2);
        storyManager.choiceOk = sm.currentSequenceId === 'seq_004_observe'
          && sm.state.params.realityEgo > beforeChoice.realityEgo
          && sm.state.params.fantasySynchro > beforeChoice.fantasySynchro;

        sm.currentSequenceId = 'seq_005_quiz';
        await sm.runCurrent();
        storyManager.miniStartOk = sm.state.lastMiniGame?.gameMode === 'quiz_beginner';
        await sm.resumeFromMiniGame({ success: true, flags: { smokeFlag: true } });
        storyManager.miniResumeOk = sm.currentSequenceId === 'seq_005_after' && sm.state.routeFlags.smokeFlag === true;

        await sm.loadChapter(2);
        sm.currentSequenceId = 'seq_205_spawn_cards';
        await sm.runCurrent();
        const cards = window.STORY_EMBED.chapters[2].startSequence.find((event) => event.id === 'seq_205_spawn_cards').positions;
        cards.forEach((card) => sm.collect('chapter2_terms', card.id));
        storyManager.collectOk = sm.currentSequenceId === 'seq_206b';

        await sm.loadChapter(5);
        Object.assign(sm.state.params, { realityEgo: 80, fantasySynchro: 80, brainErosion: 0 });
        Object.assign(sm.state.routeFlags, { utakaiPerfect: true, oniPerfect: true, calledYou: true });
        sm.currentSequenceId = 'seq_511_ending_check';
        await sm.runCurrent();
        storyManager.endingRouteOk = sm.state.chapterId === 6 && sm.currentSequenceId === 'seq_ed1_wake1';
      } catch (error) {
        storyManager.error = error.message || String(error);
      } finally {
        localStorage.removeItem('shinden3d-story-smoke-manager-v1');
      }
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

      const storyKeys = [
        'shinden3d-story-save-v1',
        'shinden3d-story-read-v1',
        'shinden3d-story-endings-v1',
        'shinden3d-story-slot1-v1',
        'shinden3d-story-slot2-v1',
        'shinden3d-story-slot3-v1',
      ];
      storyKeys.forEach((key) => localStorage.removeItem(key));
      localStorage.setItem('shinden3d-story-textspeed-v1', '0');
      const storyButtonOk = !!document.getElementById('btnStory') && document.getElementById('btnStory').textContent.includes('御簾の向こうへ');
      if (typeof enterMode === 'function') enterMode('story');
      await new Promise((resolve) => setTimeout(resolve, 700));
      const storyModeOk = APP.mode === 'story' && document.body.classList.contains('story-mode');
      const storyHudOk = !!document.getElementById('storyHud') && getComputedStyle(document.getElementById('storyHud')).display !== 'none';
      const storyMenuTitle = document.getElementById('stPanelTitle')?.textContent || '';
      const storyMenuBody = document.getElementById('stPanelBody')?.textContent || '';
      let storyMenuButtons = [...document.querySelectorAll('#stPanelBtns .st-opt')];
      const storyMenuOk = storyMenuTitle.includes('御簾の向こうへ') && storyMenuBody.includes('デモ版') && storyMenuButtons.length >= 7;
      // 波AN: ED分岐ゲージは「クリア(結末到達)後に解放」する仕様。フレッシュ状態では隠れているのが正しい
      const storyMenuGaugeGatedOk = document.querySelectorAll('#stPanelBody .st-ed-orb').length === 0;
      const galleryButton = storyMenuButtons.find((button) => button.textContent.includes('結末の回想'));
      if (galleryButton) galleryButton.click();
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const storyGalleryLockOk = (document.getElementById('stText')?.textContent || '').includes('伏せ札')
        && document.querySelectorAll('#stOpts .st-opt.locked').length === 5
        && [...document.querySelectorAll('#stOpts .st-opt.locked')].every((button) => button.textContent.includes('？？？'))
        && !!document.querySelector('#stOpts .st-opt-back');
      document.querySelector('#stOpts .st-opt-back')?.click();
      await new Promise((resolve) => setTimeout(resolve, 400));
      storyMenuButtons = [...document.querySelectorAll('#stPanelBtns .st-opt')];
      const storyChapterButton = storyMenuButtons.find((button) => button.textContent.includes('第1話'));
      if (storyChapterButton) storyChapterButton.click();
      await new Promise((resolve) => setTimeout(resolve, 3500));
      let storySaveOk = false;
      try {
        const save = JSON.parse(localStorage.getItem('shinden3d-story-save-v1') || '{}');
        storySaveOk = save?.state?.chapterId === 1 && typeof save.currentSequenceId === 'string';
      } catch (_) {}
      const storyChapterTitle = document.getElementById('stChTitle')?.textContent || '';
      const storyText = document.getElementById('stText')?.textContent || '';
      const storySpeaker = document.getElementById('stSpk')?.textContent || '';
      const storyChapterStartedOk = storyChapterTitle.includes('第1話') && storySaveOk;
      const storyDialogueOk = getComputedStyle(document.getElementById('stBox')).display !== 'none' && (storyText.length > 0 || storySpeaker.length > 0);
      // 波AN: フレッシュ状態(結末未到達)ではHUDのゲージも隠れているのが正しい
      const storyHudGaugeGatedOk = document.querySelectorAll('#stParamViz .st-ed-orb').length === 0;
      if (typeof stExitToTitle === 'function') stExitToTitle();
      await new Promise((resolve) => setTimeout(resolve, 200));
      const storyExitOk = APP.mode === 'title' && !document.body.classList.contains('story-mode');
      // 波AN: 結末に一度到達した後は、同じゲージが章メニューで解放されることを確認
      localStorage.setItem('shinden3d-story-endings-v1', JSON.stringify(['ED2_NORMAL']));
      if (typeof enterMode === 'function') enterMode('story');
      await new Promise((resolve) => setTimeout(resolve, 600));
      const gaugeBody = document.getElementById('stPanelBody')?.textContent || '';
      const storyMenuGaugeShownOk = document.querySelectorAll('#stPanelBody .st-ed-orb').length === 3
        && gaugeBody.includes('現在の予兆')
        && gaugeBody.includes('現 60以上')
        && gaugeBody.includes('蝕 20以下');
      localStorage.removeItem('shinden3d-story-endings-v1');
      if (typeof stExitToTitle === 'function') stExitToTitle();
      await new Promise((resolve) => setTimeout(resolve, 200));
      const countMeshes = (root) => {
        let count = 0;
        root?.traverse?.((node) => {
          if (node.isMesh) count += 1;
        });
        return count;
      };
      const modelSmoke = {
        standingOk: false,
        gooseOk: false,
        warawaOk: false,
        guardOk: false,
        householdOk: false,
        householdIdsOk: false,
        householdItemsOk: false,
        householdLabelsOk: false,
        householdWalkOk: false,
        householdAruiStaticOk: false,
        householdWorkingWalkOk: false,
        householdMovementOk: false,
        himeInMichoudaiOk: false,
        rightTatamiNyoboOk: false,
        bambooGroveOk: false,
        emakiDeskOk: false,
        firstRoutePanelOk: false,
        emakiAssemblyFlowOk: false,
        gisshaYardOk: false,
        gisshaLayoutOk: false,
        gisshaYardVisibilityOk: false,
        gisshaCarryOk: false,
        onmyoDivinationOk: false,
        error: null,
      };
      try {
        const standing = makeHeianFigure({
          role: 'himegimi',
          palette: [0x8f2438, 0xc04a42, 0xe28335, 0x77863f],
          scale: 1,
          prop: 'fan',
          pose: 'standing',
        });
        modelSmoke.standingOk = standing?.userData?.standing === true && countMeshes(standing) >= 34;
        if (typeof scene !== 'undefined') scene.remove(standing);
        const goose = makeGooseMark(1);
        let gooseWingTags = 0;
        goose.traverse((node) => {
          if (node.userData?.wingSide) gooseWingTags += 1;
        });
        modelSmoke.gooseOk = countMeshes(goose) >= 10 && gooseWingTags >= 4;
        if (typeof scene !== 'undefined') scene.remove(goose);
        const warawa = makeWarawa();
        modelSmoke.warawaOk = !!warawa.userData?.head && !!warawa.userData?.body && countMeshes(warawa) >= 24;
        if (typeof scene !== 'undefined') scene.remove(warawa);
        const guard = makeKaimamiGuard();
        modelSmoke.guardOk = !!guard.userData?.head && Array.isArray(guard.userData?.arms) && countMeshes(guard) >= 35;
        if (typeof scene !== 'undefined') scene.remove(guard);
        const householdList = Array.isArray(window.householdPeople)
          ? window.householdPeople
          : (typeof householdPeople !== 'undefined' && Array.isArray(householdPeople) ? householdPeople : []);
        const householdIds = ['aruji', 'kita_no_kata', 'kodomo_e', 'kodomo_w', 'keishi', 'menoto', 'myobu', 'gejo', 'zuishin', 'toneri', 'genan'];
        modelSmoke.householdOk = window.HOUSEHOLD_MODEL_STATUS?.loaded === 11 && householdList.length >= 11;
        modelSmoke.householdIdsOk = householdIds.every((id) => !!interactables[id]?.roots?.length);
        modelSmoke.householdItemsOk = householdIds.every((id) => ITEMS[id]?.cat === 'p');
        modelSmoke.householdLabelsOk = householdIds.every((id) => labels.some((label) => label.id === id));
        modelSmoke.householdWalkOk = window.HOUSEHOLD_WALK_READY?.enabled === true
          && window.HOUSEHOLD_WALK_READY?.count >= 6
          && householdList.filter((root) => root.userData?.walkReady).length >= 6;
        const householdById = new Map(householdList.map((root) => [root.userData?.householdId, root]));
        modelSmoke.householdAruiStaticOk = householdById.get('aruji')?.userData?.walkReady !== true;
        modelSmoke.householdWorkingWalkOk = ['menoto', 'myobu', 'gejo'].every((id) =>
          householdById.get(id)?.userData?.walkReady === true
        );
        const movingRoot = householdList.find((root) => root.userData?.walkReady);
        if (movingRoot && typeof updateHouseholdWalk === 'function') {
          const prevMode = APP.mode;
          APP.mode = 'walk';
          const before = movingRoot.position.clone();
          updateHouseholdWalk(0.016, 123.456);
          modelSmoke.householdMovementOk = movingRoot.position.distanceTo(before) > 0.001;
          APP.mode = prevMode;
        }
        modelSmoke.himeInMichoudaiOk = window.CHARACTER_LAYOUT_STATUS?.himeInMichoudai === true;
        modelSmoke.rightTatamiNyoboOk = (interactables.nyobo?.roots || []).some((root) =>
          Math.abs(root.position.x - (SH.cx + 6.8)) < 0.6
          && Math.abs(root.position.z - (SH.cz + 1.6)) < 0.6
        );
        modelSmoke.bambooGroveOk = window.BAMBOO_GROVE_STATUS?.built === true
          && window.BAMBOO_GROVE_STATUS?.clusters >= 10
          && window.BAMBOO_GROVE_STATUS?.culms >= 140
          && window.BAMBOO_GROVE_STATUS?.takenoko >= 40
          && window.BAMBOO_GROVE_STATUS?.takenokoLayers >= 5
          && window.BAMBOO_GROVE_STATUS?.sheathsPerLayer >= 2
          && window.BAMBOO_GROVE_STATUS?.mixedRadius === true;
        modelSmoke.emakiDeskOk = ITEMS.emaki_desk?.cat === 'c'
          && !!interactables.emaki_desk?.roots?.length
          && labels.some((label) => label.id === 'emaki_desk');
        modelSmoke.firstRoutePanelOk = !!document.getElementById('firstRoutePanel')
          && !!document.getElementById('btnFirstRoute')
          && (document.getElementById('frSteps')?.textContent || '').includes('絵巻');
        if (typeof completeEmakiAssembly === 'function' && typeof updateEmakiVisibility === 'function') {
          localStorage.removeItem('shinden3d-emaki-assembled-v1');
          EMAKI_FRAGMENT_IDS.forEach((id) => codexUnlocked.add(id));
          if (typeof saveCodex === 'function') saveCodex();
          updateEmakiVisibility();
          const guideVisible = emakiAssembly?.guide?.visible === true && emakiAssembly?.beam?.visible === true;
          const completed = completeEmakiAssembly() === true;
          const stored = localStorage.getItem('shinden3d-emaki-assembled-v1') === '1';
          const resultVisible = getComputedStyle(document.getElementById('result')).display !== 'none';
          const guideHidden = emakiAssembly?.guide?.visible === false && emakiAssembly?.beam?.visible === false;
          const routeDoneText = (document.getElementById('frSteps')?.textContent || '').includes('完了');
          modelSmoke.emakiAssemblyFlowOk = guideVisible && completed && stored && resultVisible && guideHidden && routeDoneText;
          if (typeof closeResultPanel === 'function') closeResultPanel();
        }
        modelSmoke.gisshaYardOk = ITEMS.kurumayadori?.cat === 'b'
          && !!interactables.kurumayadori?.roots?.length
          && !!interactables.gissha?.roots?.length
          && labels.some((label) => label.id === 'kurumayadori')
          && window.GISSHA_YARD_STATUS?.built === true
          && window.GISSHA_YARD_STATUS?.routePoints >= 4;
        modelSmoke.gisshaLayoutOk = window.GISSHA_YARD_STATUS?.oldShedVisible === false
          && window.GISSHA_YARD_STATUS?.sheds >= 2
          && window.GISSHA_YARD_STATUS?.parkedCarts >= 2
          && window.GISSHA_YARD_STATUS?.attachedToTsuiji === true
          && window.GISSHA_YARD_STATUS?.sideEnclosed === true
          && window.GISSHA_YARD_STATUS?.oxFront === true
          && window.GISSHA_YARD_STATUS?.referenceStyle === 'tsuiji-long-row';
        if (typeof updateGisshaYardVisibility === 'function' && typeof GISSHA_YARD !== 'undefined') {
          const prevMode = APP.mode;
          updateGisshaYardVisibility('walk');
          const walkVisible = GISSHA_YARD.root?.visible === true && window.GISSHA_YARD_STATUS?.visible === true;
          updateGisshaYardVisibility('taiji');
          const taijiHidden = GISSHA_YARD.root?.visible === false && window.GISSHA_YARD_STATUS?.visible === false;
          updateGisshaYardVisibility(prevMode);
          modelSmoke.gisshaYardVisibilityOk = walkVisible && taijiHidden;
        }
        if (typeof startGisshaCarry === 'function' && typeof updateGisshaCarry === 'function' && typeof endGisshaCarry === 'function') {
          if (typeof enterMode === 'function') enterMode('walk');
          await new Promise((resolve) => setTimeout(resolve, 120));
          const started = startGisshaCarry() === true;
          const before = GISSHA_YARD.cart?.position.clone();
          if (APP.gisshaCarry) APP.gisshaCarry.speed = 0.12;
          updateGisshaCarry(0.5, 1.0);
          const after = GISSHA_YARD.cart?.position.clone();
          const hudVisible = getComputedStyle(document.getElementById('gisshaCarryHud')).display !== 'none';
          const active = APP.gisshaCarry?.active === true && window.GISSHA_YARD_STATUS?.carryActive === true;
          modelSmoke.gisshaCarryOk = started && active && hudVisible && before && after && after.distanceTo(before) > 0.05;
          endGisshaCarry(false, true);
        }
        if (typeof openOnmyoDivinationPanel === 'function' && typeof executeOnmyoDivination === 'function') {
          openOnmyoDivinationPanel();
          await new Promise((resolve) => setTimeout(resolve, 100));
          const yearInput = document.getElementById('onmyoYearInput');
          const yearApply = document.getElementById('onmyoYearApply');
          if (yearInput && yearApply) {
            yearInput.value = '1990';
            yearApply.click();
          }
          const zodiacOk = document.getElementById('onmyoZodiacSelect')?.value === String((1990 - 4) % 12);
          executeOnmyoDivination();
          await new Promise((resolve) => setTimeout(resolve, 1400));
          const panelVisible = getComputedStyle(document.getElementById('onmyoDivinationPanel')).display !== 'none';
          const resultText = document.getElementById('onmyoOracleMsg')?.textContent || '';
          modelSmoke.onmyoDivinationOk = ITEMS.onmyo_shikiban?.cat === 'c'
            && !!interactables.onmyo_shikiban?.roots?.length
            && labels.some((label) => label.id === 'onmyo_shikiban')
            && window.ONMYO_SHIKIBAN_STATUS?.built === true
            && window.ONMYO_DIVINATION_STATUS?.ready === true
            && !!window.ONMYO_DIVINATION_STATUS?.lastGeneral
            && zodiacOk
            && panelVisible
            && resultText.includes('式盤の運行');
          if (typeof closeOnmyoDivinationPanel === 'function') closeOnmyoDivinationPanel(true);
        }
      } catch (error) {
        modelSmoke.error = error.message || String(error);
      }
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
        storyManager,
        storyButtonOk,
        storyModeOk,
        storyHudOk,
        storyMenuOk,
        storyMenuGaugeGatedOk,
        storyMenuGaugeShownOk,
        storyGalleryLockOk,
        storyChapterStartedOk,
        storyDialogueOk,
        storyHudGaugeGatedOk,
        storyExitOk,
        modelSmoke,
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
    if (!status.storyManager.available) errors.push('StoryManager or STORY_EMBED was not available');
    if (status.storyManager.error) errors.push(`StoryManager smoke failed: ${status.storyManager.error}`);
    if (!status.storyManager.startOk) errors.push('StoryManager did not start chapter 1 correctly');
    if (!status.storyManager.choiceOk) errors.push('StoryManager choice effects/routing failed');
    if (!status.storyManager.miniStartOk || !status.storyManager.miniResumeOk) errors.push('StoryManager mini-game start/resume failed');
    if (!status.storyManager.collectOk) errors.push('StoryManager collectible completion failed');
    if (!status.storyManager.endingRouteOk) errors.push('StoryManager true ending epilogue routing failed');
    if (!status.storyButtonOk) errors.push('story mode title button was missing or mislabeled');
    if (!status.storyModeOk || !status.storyHudOk) errors.push('story mode did not start cleanly');
    if (!status.storyMenuOk) errors.push('story chapter menu did not render expected controls');
    if (!status.storyMenuGaugeGatedOk) errors.push('story ending gauge should be hidden until an ending is reached (chapter menu)');
    if (!status.storyMenuGaugeShownOk) errors.push('story ending gauge did not render in the chapter menu after an ending was reached');
    if (!status.storyGalleryLockOk) errors.push('story ending gallery did not lock unreached endings');
    if (!status.storyChapterStartedOk) errors.push('story chapter 1 did not start or save progress');
    if (!status.storyDialogueOk) errors.push('story chapter 1 did not show dialogue text');
    if (!status.storyHudGaugeGatedOk) errors.push('story ending gauge should be hidden in the HUD until an ending is reached');
    if (!status.storyExitOk) errors.push('story mode did not return to title cleanly');
    if (status.modelSmoke.error) errors.push(`model smoke failed: ${status.modelSmoke.error}`);
    if (!status.modelSmoke.standingOk) errors.push('standing Heian figure did not generate expected detail');
    if (!status.modelSmoke.gooseOk) errors.push('goose model did not generate expected detail');
    if (!status.modelSmoke.warawaOk) errors.push('warawa model did not generate expected detail');
    if (!status.modelSmoke.guardOk) errors.push('guard model did not generate expected detail');
    if (!status.modelSmoke.householdOk) errors.push('household role models did not initialize');
    if (!status.modelSmoke.householdIdsOk) errors.push('household role interactables were not registered');
    if (!status.modelSmoke.householdItemsOk) errors.push('household role encyclopedia entries were not registered');
    if (!status.modelSmoke.householdLabelsOk) errors.push('household role labels were not generated');
    if (!status.modelSmoke.householdWalkOk) errors.push('household walking routes were not enabled');
    if (!status.modelSmoke.householdAruiStaticOk) errors.push('aruji should stay static and not join household walking routes');
    if (!status.modelSmoke.householdWorkingWalkOk) errors.push('working household women were not enabled for walking routes');
    if (!status.modelSmoke.householdMovementOk) errors.push('household walking update did not move a route actor');
    if (!status.modelSmoke.himeInMichoudaiOk) errors.push('himegimi was not placed inside the michoudai');
    if (!status.modelSmoke.rightTatamiNyoboOk) errors.push('right-side moya tatami nyobo was not placed');
    if (!status.modelSmoke.bambooGroveOk) errors.push('bamboo grove density/layered shoot metadata was not built');
    if (!status.modelSmoke.emakiDeskOk) errors.push('emaki assembly desk was not registered with label/codex');
    if (!status.modelSmoke.firstRoutePanelOk) errors.push('first-route guide panel was not rendered');
    if (!status.modelSmoke.emakiAssemblyFlowOk) errors.push('emaki assembly guide/completion flow failed');
    if (!status.modelSmoke.gisshaYardOk) errors.push('gissha yard/shed was not registered with label/codex/route metadata');
    if (!status.modelSmoke.gisshaLayoutOk) errors.push('gissha layout did not remove the old shed or add two side sheds/carts');
    if (!status.modelSmoke.gisshaYardVisibilityOk) errors.push('gissha yard did not toggle visibility by mode');
    if (!status.modelSmoke.gisshaCarryOk) errors.push('gissha carry mini-game did not start and move the cart');
    if (!status.modelSmoke.onmyoDivinationOk) errors.push('onmyo divination panel did not register/open/resolve');
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
