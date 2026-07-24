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
  await page.addInitScript(() => {
    window.SHINDEN_ONLINE_CONFIG = { enabled: false };
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
      let lowPowerOk = false;
      let lowPowerRestoreOk = false;
      try {
        const before = window.LOW_POWER?.getStatus?.();
        window.LOW_POWER?.enable?.();
        const enabled = window.LOW_POWER?.getStatus?.();
        lowPowerOk = window.LOW_POWER_STATUS?.ready === true
          && enabled?.active === true
          && enabled?.fps === 30
          && enabled?.quality === 3
          && enabled?.bloom === 'off'
          && enabled?.shadows === false
          && !!document.getElementById('gfxEco_on')?.classList.contains('on');
        window.LOW_POWER?.disable?.();
        const restored = window.LOW_POWER?.getStatus?.();
        lowPowerRestoreOk = restored?.active === false
          && restored?.fps === before?.fps
          && restored?.shadows === before?.shadows;
      } catch (_) {}
      let kohAwaseOk = false;
      let kohCanvasOk = false;
      try {
        window.KOH_AWASE?.reset?.();
        window.KOH_AWASE?.start?.({ seed: 20260723 });
        window.KOH_AWASE?.open?.();
        await new Promise((resolve) => setTimeout(resolve, 100));
        const initial = window.KOH_AWASE?.getTestState?.();
        const briefOk = initial?.phase === 'motif'
          && document.querySelectorAll('#kohAwaseModal .koh-awase-brief-item').length === 3
          && document.querySelectorAll('#kohAwaseModal .koh-awase-option').length === 0;
        const canvas = document.querySelector('#kohAwaseModal canvas');
        if (canvas?.width && canvas?.height) {
          const pixels = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height)?.data;
          const colors = new Set();
          for (let i = 0; pixels && i < pixels.length; i += Math.max(4, Math.floor(pixels.length / 1600 / 4) * 4)) {
            colors.add(`${pixels[i] >> 4},${pixels[i + 1] >> 4},${pixels[i + 2] >> 4}`);
          }
          kohCanvasOk = colors.size >= 12;
        }
        let roundsOk = true;
        for (let roundIndex = 0; roundIndex < 3; roundIndex += 1) {
          roundsOk = window.KOH_AWASE.next() === true && roundsOk;
          const state = window.KOH_AWASE.getState();
          const round = state.session.rounds[state.session.index];
          const scenario = window.KOH_AWASE.scenarioBank.find((item) => item.id === round.scenarioId);
          window.KOH_AWASE.setBlend('byakudan', 2);
          window.KOH_AWASE.setBlend('jinko', 1);
          window.KOH_AWASE.setBlend('kanso', 1);
          window.KOH_AWASE.setBlend('kakkou', 1);
          roundsOk = window.KOH_AWASE.setTitle(scenario.title) === true && roundsOk;
          roundsOk = window.KOH_AWASE.setHeat(scenario.heat) === true && roundsOk;
          roundsOk = window.KOH_AWASE.submitBlend() === true && roundsOk;
          roundsOk = document.querySelectorAll('#kohAwaseModal .koh-awase-option').length === 4 && roundsOk;
          const listenScore = window.KOH_AWASE.answer(0);
          roundsOk = Number.isFinite(listenScore) && listenScore >= 4 && roundsOk;
          roundsOk = window.KOH_AWASE.finishRound() === true && roundsOk;
          roundsOk = window.KOH_AWASE.next() === true && roundsOk;
        }
        const completed = window.KOH_AWASE.getState();
        kohAwaseOk = window.KOH_AWASE_STATUS?.ready === true
          && window.KOH_AWASE_STATUS?.questions >= 12
          && window.KOH_AWASE_STATUS?.gameLoop === 'brief-blend-listen-review'
          && !!document.getElementById('kohAwaseEntry')
          && briefOk
          && roundsOk
          && completed.session.complete === true
          && completed.session.score > 0
          && document.querySelectorAll('#kohAwaseModal .koh-awase-review-item').length === 3;
        window.KOH_AWASE.close();
      } catch (_) {}
      let kemariOk = false;
      let kemariCanvasOk = false;
      try {
        localStorage.setItem('shinden3d-kemari-help', '1');
        if (typeof enterMode === 'function') enterMode('kemari');
        await new Promise((resolve) => setTimeout(resolve, 100));
        const initial = window.KEMARI_GAME?.getState?.();
        window.KEMARI_GAME?.__test?.setDelivery?.(1, 'receive', 0.55);
        window.KEMARI_GAME?.selectTechnique?.('receive');
        window.KEMARI_GAME?.move?.(1);
        window.KEMARI_GAME?.attempt?.();
        const queued = window.KEMARI_GAME?.getState?.();
        window.KEMARI_GAME?.__test?.advance?.(0.95);
        const assisted = window.KEMARI_GAME?.getState?.();
        window.KEMARI_GAME?.selectTechnique?.('pass');
        const selected = window.KEMARI_GAME?.getState?.();
        for (let i = 0; i < 29; i += 1) window.KEMARI_GAME?.testResolve?.('perfect');
        const completed = window.KEMARI_GAME?.getState?.();
        const canvas = document.getElementById('kemariCanvas');
        if (canvas?.width && canvas?.height) {
          const pixels = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height)?.data;
          const colors = new Set();
          for (let i = 0; pixels && i < pixels.length; i += Math.max(4, Math.floor(pixels.length / 1800 / 4) * 4)) {
            colors.add(`${pixels[i] >> 4},${pixels[i + 1] >> 4},${pixels[i + 2] >> 4}`);
          }
          kemariCanvasOk = colors.size >= 18;
        }
        kemariOk = initial?.poise === 3
          && initial?.round === 1
          && queued?.kickQueued === true
          && assisted?.quickStep === true
          && assisted?.rally === 1
          && selected?.selected === 'pass'
          && completed?.round === 4
          && completed?.rally === 30
          && completed?.victory === true
          && window.KEMARI_GAME?.version === 3
          && !!document.getElementById('kmrReadout')
          && document.getElementById('kemariGameOver')?.classList.contains('show')
          && (document.getElementById('kmrGoTitle')?.textContent || '').includes('四懸');
        if (typeof enterMode === 'function') enterMode('walk');
      } catch (_) {}
      let onlineCompetitionOk = false;
      let onlineQuizSeedOk = false;
      let onlineRankingOk = false;
      let normalQuizOnlineRankOk = false;
      let onlineKemariLaunchOk = false;
      let onlineKemariLaunchDetail = null;
      let onlineCompetitionError = null;
      try {
        const submitted = [];
        let mockMatch = null;
        const mockTransport = {
          async ensureSession() { return { access_token: 'smoke' }; },
          async setProfile() { return true; },
          async createMatch(mode) {
            mockMatch = {
              id: 'match-smoke', room_code: 'HEIAN1', mode, seed: 20260723, status: 'waiting',
              players: [{ is_self: true, is_host: true, display_name: '東方', status: 'ready', progress: 0, score: 0 }],
            };
            return mockMatch;
          },
          async joinMatch() { return mockMatch; },
          async getMatch() { return mockMatch; },
          async startMatch() { mockMatch.status = 'active'; return mockMatch; },
          async updateMatch(data) {
            const self = mockMatch.players.find((player) => player.is_self);
            Object.assign(self, { progress: data.progress, score: data.score, status: data.status, duration_ms: data.durationMs });
            return mockMatch;
          },
          async leaveMatch() { return true; },
          async submitScore(data) { submitted.push(data); return { accepted: true }; },
          async leaderboard() {
            return [
              { rank: 1, display_name: '東方', score: 1420, duration_ms: 12340, is_self: true },
              { rank: 2, display_name: '西方', score: 1180, duration_ms: 14600 },
            ];
          },
          async myRank() { return [{ rank: 2, total_players: 14, score: 88, duration_ms: 5200 }]; },
        };
        window.ONLINE_COMPETITION?.configure?.({ transport: mockTransport });
        window.ONLINE_COMPETITION?.setDisplayName?.('東方');
        window.ONLINE_COMPETITION?.open?.();
        await window.ONLINE_COMPETITION?.createMatch?.('quiz');
        mockMatch.players.push({ is_self: false, is_host: false, display_name: '西方', status: 'ready', progress: 0, score: 0 });
        await window.ONLINE_COMPETITION?.startMatch?.();
        const firstQuiz = window.ONLINE_COMPETITION?.buildQuiz?.(20260723).map((question) => question.id).join(',');
        const secondQuiz = window.ONLINE_COMPETITION?.buildQuiz?.(20260723).map((question) => question.id).join(',');
        const differentQuiz = window.ONLINE_COMPETITION?.buildQuiz?.(20260724).map((question) => question.id).join(',');
        onlineQuizSeedOk = !!firstQuiz && firstQuiz === secondQuiz && firstQuiz !== differentQuiz;
        for (let index = 0; index < 10; index += 1) {
          const quiz = window.ONLINE_COMPETITION?.__test?.getState?.().quiz;
          await window.ONLINE_COMPETITION?.answerQuiz?.(quiz.questions[quiz.index].answer);
          await new Promise((resolve) => setTimeout(resolve, 700));
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
        const afterMatch = window.ONLINE_COMPETITION?.getStatus?.();
        document.querySelectorAll('#onlineCompetitionModal .online-tab')[1]?.click();
        await new Promise((resolve) => setTimeout(resolve, 120));
        onlineRankingOk = document.querySelectorAll('#onlineCompetitionModal .online-ranking-row').length === 2
          && (document.querySelector('#onlineCompetitionModal .online-ranking-row')?.textContent || '').includes('東方');
        onlineCompetitionOk = window.ONLINE_COMPETITION_STATUS?.ready === true
          && window.ONLINE_COMPETITION_STATUS?.quizCount === 10
          && !!document.getElementById('onlineCompetitionEntry')
          && afterMatch?.screen === 'result'
          && submitted.some((item) => item.mode === 'quiz')
          && (document.getElementById('onlineCompetitionModal')?.textContent || '').includes('順位表');
        window.ONLINE_COMPETITION?.close?.();
        APP.quiz = { ta: false, score: 88, miss: 1, missed: [], maxCombo: 3, tStart: performance.now() - 5200 };
        APP.mode = 'quiz';
        endQuiz();
        await new Promise((resolve) => setTimeout(resolve, 140));
        normalQuizOnlineRankOk = (document.getElementById('resTitle')?.textContent || '').includes('名称当てクイズ')
          && (document.getElementById('quizOnlineRank')?.textContent || '').includes('共有順位・今週')
          && (document.getElementById('quizOnlineRank')?.textContent || '').includes('2位 / 14人中');
        closeResultPanel();
        await window.ONLINE_COMPETITION?.leaveMatch?.();
        window.ONLINE_COMPETITION?.open?.();
        await window.ONLINE_COMPETITION?.createMatch?.('kemari');
        mockMatch.players.push({ is_self: false, is_host: false, display_name: '西方', status: 'ready', progress: 0, score: 0 });
        await window.ONLINE_COMPETITION?.startMatch?.();
        const kemariBeforeLaunch = window.ONLINE_COMPETITION?.getStatus?.();
        window.ONLINE_COMPETITION?.launchChallenge?.();
        await new Promise((resolve) => setTimeout(resolve, 100));
        const onlineKemari = window.KEMARI_GAME?.getState?.();
        if (typeof enterMode === 'function') enterMode('walk');
        if (typeof enterMode === 'function') enterMode('kemari');
        const ordinaryKemari = window.KEMARI_GAME?.getState?.();
        onlineKemariLaunchOk = onlineKemari?.online === true && ordinaryKemari?.online === false;
        onlineKemariLaunchDetail = {
          screen: kemariBeforeLaunch?.screen,
          matchMode: kemariBeforeLaunch?.match?.mode,
          appMode: APP.mode,
          online: onlineKemari?.online,
          ordinary: ordinaryKemari?.online
        };
        if (typeof enterMode === 'function') enterMode('walk');
        await window.ONLINE_COMPETITION?.leaveMatch?.();
        window.ONLINE_COMPETITION?.configure?.({ clear: true });
      } catch (error) {
        onlineCompetitionError = error.message || String(error);
      }
      let livingEstateOk = false;
      let livingEstateModeOk = false;
      let livingEstateArrivalOk = false;
      try {
        const estate = window.LIVING_ESTATE;
        estate?.init?.();
        estate?.setTimeForTest?.('dawn');
        estate?.update?.(0.016, 1);
        const keishi = window.householdPeople?.find((root) => root.userData?.householdId === 'keishi');
        const scheduleOk = window.LIVING_ESTATE_STATUS?.ready === true
          && window.LIVING_ESTATE_STATUS?.actorCount === 7
          && window.LIVING_ESTATE_STATUS?.overheardCount >= 7
          && window.LIVING_ESTATE_STATUS?.schedulePhases?.keishi === 'ledger'
          && keishi?.userData?.estateActivityName?.includes('帳簿');
        estate?.openSchedule?.();
        const panelOk = !!document.getElementById('tbEstateLife')
          && document.getElementById('estateLifePanel')?.classList.contains('open')
          && (document.getElementById('estateLifePanel')?.textContent || '').includes('来訪の気配');
        estate?.closeSchedule?.();
        APP.mode = 'title';
        estate?.update?.(0.016, 2);
        const paused = keishi?.userData?.walkReady === false;
        APP.mode = 'walk';
        estate?.update?.(0.016, 3);
        const resumed = keishi?.userData?.walkReady === true;
        livingEstateOk = scheduleOk && panelOk;
        livingEstateModeOk = paused && resumed;

        const visitorStarted = estate?.triggerArrival?.('visitor') === true;
        estate?.update?.(0.016, 4);
        const visitorVisible = scene.children.some((root) => root.userData?.estateVisitor === true);
        estate?.reset?.();
        const visitorRemoved = !scene.children.some((root) => root.userData?.estateVisitor === true)
          && window.LIVING_ESTATE_STATUS?.activeArrival == null;
        const previousCarry = APP.gisshaCarry;
        APP.gisshaCarry = { active: true };
        const carryGuarded = estate?.triggerArrival?.('oxCart') === false;
        APP.gisshaCarry = previousCarry;
        livingEstateArrivalOk = visitorStarted && visitorVisible && visitorRemoved && carryGuarded;
      } catch (_) {}
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
      let storySlotsOk = false;
      let storySlotsDetail = {};
      try {
        const slots = window.STORY_SLOTS;
        const saved = slots?.save?.(1);
        const record = slots?.load?.(1);
        const serialized = JSON.parse(record?.data || '{}');
        const migratedManager = new StoryManager({ saveKey: 'shinden3d-story-smoke-migrate-v1' });
        const legacyData = { ...serialized };
        delete legacyData.version;
        migratedManager.deserialize(legacyData);
        localStorage.setItem(slots.key(2), '{broken');
        localStorage.setItem(slots.key(3), JSON.stringify({data: record.data, meta: record.meta}));
        storySlotsDetail = {
          saved: saved === true,
          format: record?.format === 1,
          chapter: record?.meta?.ch === 1,
          sequence: typeof serialized.currentSequenceId === 'string' && serialized.currentSequenceId === record?.meta?.seq,
          migrated: migratedManager.state.chapterId === 1 && migratedManager.currentSequenceId === serialized.currentSequenceId,
          corruptRejected: slots.load(2) === null,
          legacyLoaded: slots.load(3)?.data === record?.data,
        };
        storySlotsOk = Object.values(storySlotsDetail).every(Boolean);
        localStorage.removeItem('shinden3d-story-smoke-migrate-v1');
      } catch (error) { storySlotsDetail.error = error.message || String(error); }
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
        if (typeof enterMode === 'function') enterMode('walk');
        window.LIVING_ESTATE?.setTimeForTest?.('day');
        window.LIVING_ESTATE?.update?.(0.016, 8);
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
          // 占断は「所作→兆し→占断」の儀式演出(天盤回転→落款→開示)を経て結果文が出るため、
          // 固定待ちではなく出現をポーリングで待つ(最大5秒)。演出時間の調整でsmokeが壊れないように。
          let resultText = '';
          for (let i = 0; i < 25; i += 1) {
            await new Promise((resolve) => setTimeout(resolve, 200));
            resultText = document.getElementById('onmyoOracleMsg')?.textContent || '';
            if (resultText.includes('式盤の運行')) break;
          }
          const panelVisible = getComputedStyle(document.getElementById('onmyoDivinationPanel')).display !== 'none';
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
        lowPowerOk,
        lowPowerRestoreOk,
        kohAwaseOk,
        kohCanvasOk,
        kemariOk,
        kemariCanvasOk,
        onlineCompetitionOk,
        onlineQuizSeedOk,
        onlineRankingOk,
        normalQuizOnlineRankOk,
        onlineKemariLaunchOk,
        onlineKemariLaunchDetail,
        onlineCompetitionError,
        livingEstateOk,
        livingEstateModeOk,
        livingEstateArrivalOk,
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
        storySlotsOk,
        storySlotsDetail,
        storyHudGaugeGatedOk,
        storyExitOk,
        modelSmoke,
        canvas: !!document.querySelector('canvas'),
        objects: typeof scene !== 'undefined' ? scene.children.length : null,
      };
    });
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileStatus = await page.evaluate(async () => {
      if (typeof enterMode === 'function') enterMode('walk');
      window.KOH_AWASE?.open?.();
      await new Promise((resolve) => setTimeout(resolve, 80));
      const kohRect = document.getElementById('kohAwaseModal')?.getBoundingClientRect();
      const kohFits = !!kohRect && kohRect.left >= 0 && kohRect.right <= innerWidth && kohRect.bottom <= innerHeight;
      window.KOH_AWASE?.close?.();
      window.ONLINE_COMPETITION?.open?.();
      await new Promise((resolve) => setTimeout(resolve, 80));
      const onlineRect = document.querySelector('#onlineCompetitionModal .online-sheet')?.getBoundingClientRect();
      const onlineFits = !!onlineRect && onlineRect.left >= 0 && onlineRect.right <= innerWidth && onlineRect.bottom <= innerHeight;
      window.ONLINE_COMPETITION?.close?.();
      localStorage.setItem('shinden3d-kemari-help', '1');
      if (typeof enterMode === 'function') enterMode('kemari');
      await new Promise((resolve) => setTimeout(resolve, 80));
      const kemariBoardRect = document.getElementById('kemariBoard')?.getBoundingClientRect();
      const kemariControlsRect = document.getElementById('kmrControls')?.getBoundingClientRect();
      const kemariFits = !!kemariBoardRect
        && !!kemariControlsRect
        && kemariBoardRect.left >= 0
        && kemariBoardRect.right <= innerWidth
        && kemariControlsRect.left >= 0
        && kemariControlsRect.right <= innerWidth
        && kemariControlsRect.bottom <= innerHeight;
      if (typeof enterMode === 'function') enterMode('walk');
      window.LIVING_ESTATE?.openSchedule?.();
      const estateRect = document.getElementById('estateLifePanel')?.getBoundingClientRect();
      const estateFits = !!estateRect && estateRect.left >= 0 && estateRect.right <= innerWidth && estateRect.bottom <= innerHeight;
      window.LIVING_ESTATE?.closeSchedule?.();
      return { kohFits, onlineFits, kemariFits, estateFits, horizontalOverflow: document.documentElement.scrollWidth <= innerWidth };
    });
    if (status.missing.length) errors.push(`missing UI ids: ${status.missing.join(', ')}`);
    if (!status.walkOk) errors.push('walk mode did not start');
    if (!status.codexOk) errors.push('codex did not open');
    if (!status.gfxOk) errors.push('graphics settings did not open');
    if (!status.lowPowerOk || !status.lowPowerRestoreOk) errors.push('low-power mode did not apply and restore cleanly');
    if (!status.kohAwaseOk) errors.push('standalone koh-awase learning flow failed');
    if (!status.kohCanvasOk) errors.push('koh-awase canvas did not render enough visual detail');
    if (!status.kemariOk) errors.push('kemari four-round cooperative game flow failed');
    if (!status.kemariCanvasOk) errors.push('kemari canvas did not render enough visual detail');
    if (status.onlineCompetitionError) errors.push(`online competition smoke failed: ${status.onlineCompetitionError}`);
    if (!status.onlineCompetitionOk) errors.push('online match did not create, start, finish, and submit a score');
    if (!status.onlineQuizSeedOk) errors.push('online quiz seed did not produce a stable shared question set');
    if (!status.onlineRankingOk) errors.push('online shared ranking did not render');
    if (!status.normalQuizOnlineRankOk) errors.push('normal quiz result did not show the shared weekly rank');
    if (!status.onlineKemariLaunchOk) errors.push('online kemari launch leaked into an ordinary kemari session');
    if (!status.livingEstateOk) errors.push('living-estate schedules or daily-life panel failed');
    if (!status.livingEstateModeOk) errors.push('living-estate actors did not pause and resume with walk mode');
    if (!status.livingEstateArrivalOk) errors.push('living-estate visitor/cart arrival safeguards failed');
    if (!mobileStatus.kohFits || !mobileStatus.onlineFits || !mobileStatus.kemariFits || !mobileStatus.estateFits || !mobileStatus.horizontalOverflow) errors.push('new panels overflowed the 390px mobile viewport');
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
    if (!status.storySlotsOk) errors.push('story manual save slots did not preserve, restore, or migrate safely');
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
      console.error(JSON.stringify({ status, mobileStatus, errors }, null, 2));
      process.exit(1);
    }
    console.log(JSON.stringify({ status: 'ok', target, app: status, mobile: mobileStatus }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
