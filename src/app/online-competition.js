/* 寝殿造り3D探訪 オンライン御前試合
 * Supabase の匿名認証 + RPC を利用する。未設定時も既存ゲームは完全にオフラインで動作する。
 */
(() => {
  "use strict";

  const ENTRY_ID = "onlineCompetitionEntry";
  const MODAL_ID = "onlineCompetitionModal";
  const CONFIG_KEY = "shinden3d-online-config-v1";
  const SESSION_KEY = "shinden3d-online-session-v1";
  const PREF_KEY = "shinden3d-online-pref-v1";
  const PENDING_KEY = "shinden3d-online-pending-v1";
  const ACTIVE_KEY = "shinden3d-online-active-v1";
  const PRODUCTION_CONFIG = {
    url: "https://cbyvvsevykqrhpvvvnjo.supabase.co",
    anonKey: "sb_publishable_unPMDrLMLCxKhb95Ks8O9w_lLERwI7H",
  };
  const MODES = {
    gozen5: { label: "御前五番勝負", unit: "点", order: "desc", challenge: true, featured: true },
    quiz: { label: "名称当てクイズ", unit: "点", order: "desc", live: true },
    quiz_ta: { label: "名称当てタイムアタック", unit: "秒", order: "asc" },
    kemari: { label: "蹴鞠", unit: "点", order: "desc", challenge: true },
    koh_awase: { label: "香合わせ", unit: "点", order: "desc", challenge: true },
  };
  const PERIODS = { daily: "本日", weekly: "今週", all: "歴代" };
  const QUIZ_COUNT = 10;
  const state = {
    open: false,
    tab: "match",
    screen: "lobby",
    busy: false,
    message: "",
    error: "",
    match: null,
    ranking: [],
    myRank: null,
    rankingMode: "quiz",
    rankingPeriod: "weekly",
    quiz: null,
    pollTimer: 0,
    lastMatchSignature: "",
    challengeLaunch: null,
  };
  let modal = null;
  let transportOverride = null;

  function safeJson(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function readLocal(key, fallback) {
    try { return safeJson(localStorage.getItem(key), fallback); } catch (_) { return fallback; }
  }
  function writeLocal(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function create(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = String(text);
    return el;
  }
  function normalizeName(value) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, 12);
  }
  function pref() {
    const saved = readLocal(PREF_KEY, {});
    return { displayName: normalizeName(saved.displayName) || "名もなき殿上人" };
  }
  function setPref(patch) {
    const next = Object.assign(pref(), patch || {});
    next.displayName = normalizeName(next.displayName) || "名もなき殿上人";
    writeLocal(PREF_KEY, next);
    return next;
  }
  function config() {
    const runtime = window.SHINDEN_ONLINE_CONFIG || {};
    const local = readLocal(CONFIG_KEY, {}) || {};
    const metaUrl = document.querySelector('meta[name="shinden-online-url"]')?.content || "";
    const metaKey = document.querySelector('meta[name="shinden-online-key"]')?.content || "";
    const url = String(runtime.url || local.url || metaUrl || PRODUCTION_CONFIG.url || "").replace(/\/+$/, "");
    const anonKey = String(runtime.anonKey || runtime.publishableKey || local.anonKey || metaKey || PRODUCTION_CONFIG.anonKey || "");
    return { url, anonKey, enabled: runtime.enabled !== false && !!url && !!anonKey };
  }
  function configured() { return !!transportOverride || config().enabled; }
  function modeMeta(mode) { return MODES[mode] || MODES.quiz; }
  function formatValue(mode, score, durationMs) {
    if (mode === "quiz_ta") return `${((durationMs || score || 0) / 1000).toFixed(1)}秒`;
    return `${Number(score || 0).toLocaleString("ja-JP")}${modeMeta(mode).unit}`;
  }
  function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function seedRandom(seed) {
    let value = (Number(seed) || 1) >>> 0;
    return () => {
      value += 0x6d2b79f5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(list, random) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  function buildQuiz(seed) {
    const ids = (typeof QUIZ_POOL !== "undefined" ? QUIZ_POOL : Object.keys(window.ITEMS || {}))
      .filter(id => typeof ITEMS !== "undefined" && ITEMS[id]?.n && ITEMS[id]?.d);
    const random = seedRandom(seed);
    return shuffle(ids, random).slice(0, QUIZ_COUNT).map((id) => {
      const item = ITEMS[id];
      const distractors = shuffle(ids.filter(other => other !== id), random).slice(0, 3);
      const options = shuffle([id].concat(distractors), random);
      const answerPattern = new RegExp(escapeRegExp(item.n), "g");
      const clue = String(item.d || "").replace(/<[^>]+>/g, "").replace(answerPattern, "この場所・品");
      return { id, prompt: clue, options, answer: options.indexOf(id) };
    });
  }

  class SupabaseTransport {
    constructor(getConfig) { this.getConfig = getConfig; this.session = readLocal(SESSION_KEY, null); }
    async request(path, options) {
      const cfg = this.getConfig();
      const headers = Object.assign({ apikey: cfg.anonKey, "Content-Type": "application/json" }, options?.headers || {});
      const response = await fetch(cfg.url + path, Object.assign({}, options, { headers }));
      const raw = await response.text();
      const body = safeJson(raw, raw);
      if (!response.ok) throw new Error(body?.message || body?.error_description || body?.hint || `通信エラー ${response.status}`);
      return body;
    }
    async ensureSession() {
      const now = Math.floor(Date.now() / 1000);
      if (this.session?.access_token && Number(this.session.expires_at || 0) > now + 45) return this.session;
      if (this.session?.refresh_token) {
        try {
          const refreshed = await this.request("/auth/v1/token?grant_type=refresh_token", {
            method: "POST", body: JSON.stringify({ refresh_token: this.session.refresh_token }),
          });
          this.session = Object.assign({}, refreshed, { expires_at: now + Number(refreshed.expires_in || 3600) });
          writeLocal(SESSION_KEY, this.session);
          return this.session;
        } catch (_) {}
      }
      const created = await this.request("/auth/v1/signup", { method: "POST", body: JSON.stringify({ data: { source: "shinden3d" } }) });
      this.session = Object.assign({}, created, { expires_at: now + Number(created.expires_in || 3600) });
      writeLocal(SESSION_KEY, this.session);
      return this.session;
    }
    async rpc(name, args) {
      const session = await this.ensureSession();
      return this.request(`/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(args || {}),
      });
    }
    setProfile(displayName) { return this.rpc("online_set_profile", { p_display_name: displayName }); }
    async createMatch(mode) {
      const created = await this.rpc("online_create_match", { p_mode: mode });
      return this.getMatch(created?.match_id || created?.id);
    }
    joinMatch(code) { return this.rpc("online_join_match", { p_room_code: code }); }
    getMatch(matchId) { return this.rpc("online_match_state", { p_match_id: matchId }); }
    startMatch(matchId) { return this.rpc("online_start_match", { p_match_id: matchId }); }
    updateMatch(data) {
      return this.rpc("online_update_match_player", {
        p_match_id: data.matchId, p_score: data.score || 0, p_duration_ms: data.durationMs || 0,
        p_progress: Object.assign({ answered: data.progress || 0 }, data.payload || {}),
        p_finished: data.status === "finished",
      });
    }
    leaveMatch(matchId) { return this.rpc("online_leave_match", { p_match_id: matchId }); }
    submitScore(data) {
      return this.rpc("online_submit_score", {
        p_mode: data.mode, p_score: data.score || 0, p_duration_ms: data.durationMs || 0, p_metadata: data.metadata || {},
      });
    }
    leaderboard(mode, period, limit) {
      return this.rpc("online_leaderboard", { p_mode: mode, p_period: period === "all" ? "all_time" : period, p_limit: limit || 20 });
    }
    myRank(mode, period) {
      return this.rpc("online_my_rank", { p_mode: mode, p_period: period === "all" ? "all_time" : period });
    }
  }
  const nativeTransport = new SupabaseTransport(config);
  function transport() { return transportOverride || nativeTransport; }
  function firstResult(value) {
    if (Array.isArray(value)) return value[0] ?? null;
    return value?.data ?? value;
  }
  function normalizeMatch(value) {
    const raw = firstResult(value) || {};
    if (raw.match && typeof raw.match === "object") return Object.assign({}, raw.match, { players: raw.players || raw.match.players || [] });
    const normalized = Object.assign({}, raw, { id: raw.id || raw.match_id, players: raw.players || [] });
    normalized.players = normalized.players.map(player => Object.assign({}, player, {
      is_host: player.is_host ?? player.role === "host",
      is_self: player.is_self ?? player.is_me ?? false,
    }));
    return normalized;
  }

  async function withBusy(action) {
    if (state.busy) return null;
    state.busy = true; state.error = ""; render();
    try { return await action(); }
    catch (error) { state.error = error?.message || String(error); return null; }
    finally { state.busy = false; render(); }
  }
  async function identify() {
    const name = pref().displayName;
    await transport().ensureSession?.();
    await transport().setProfile?.(name);
    return name;
  }
  function stopPolling() {
    if (state.pollTimer) clearTimeout(state.pollTimer);
    state.pollTimer = 0;
  }
  function schedulePoll(delay) {
    stopPolling();
    if (!state.open || !state.match?.id) return;
    state.pollTimer = window.setTimeout(pollMatch, delay || 1100);
  }
  function playerRows(match) { return Array.isArray(match?.players) ? match.players : []; }
  function isHost(match) {
    const own = playerRows(match).find(player => player.is_self || player.self);
    return !!(own?.is_host || own?.host || match?.is_host);
  }
  function opponent(match) { return playerRows(match).find(player => !(player.is_self || player.self)); }
  function ownPlayer(match) { return playerRows(match).find(player => player.is_self || player.self); }
  function playerProgress(player) {
    if (!player) return 0;
    if (Number.isFinite(Number(player.progress))) return Number(player.progress);
    return Number(player.progress?.answered || 0);
  }
  function matchFinished(match) {
    const players = playerRows(match);
    return match?.status === "finished" || (players.length >= 2 && players.every(player => player.status === "finished"));
  }
  async function pollMatch() {
    if (!state.match?.id || !configured()) return;
    try {
      const next = normalizeMatch(await transport().getMatch(state.match.id));
      if (next?.id) {
        state.match = next;
        writeLocal(ACTIVE_KEY, { id: next.id, code: next.room_code || next.code });
        if (next.status === "active" && state.screen === "waiting") {
          if (next.mode === "quiz") startOnlineQuiz(next);
          else state.screen = "challenge";
        }
        if (["cancelled", "expired"].includes(next.status)) {
          state.screen = "ended";
          writeLocal(ACTIVE_KEY, null);
        }
        if (matchFinished(next) && state.screen !== "result") state.screen = "result";
        const signature = JSON.stringify([next.status, playerRows(next).map(p => [p.status, p.progress, p.score])]);
        if (signature !== state.lastMatchSignature) { state.lastMatchSignature = signature; render(); }
      }
    } catch (error) {
      state.message = "再接続を試みています";
    }
    schedulePoll();
  }
  async function createMatch(mode) {
    await withBusy(async () => {
      await identify();
      const match = normalizeMatch(await transport().createMatch(mode));
      if (!match?.id) throw new Error("対戦部屋を作成できませんでした");
      state.match = match; state.screen = "waiting"; state.message = "相手を待っています";
      writeLocal(ACTIVE_KEY, { id: match.id, code: match.room_code || match.code });
      schedulePoll(200);
    });
  }
  async function joinMatch(code) {
    const normalized = String(code || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
    if (normalized.length !== 6) { state.error = "六文字の部屋番号を入力してください"; render(); return; }
    await withBusy(async () => {
      await identify();
      const match = normalizeMatch(await transport().joinMatch(normalized));
      if (!match?.id) throw new Error("対戦部屋が見つかりません");
      state.match = match; state.screen = match.status === "active" ? (match.mode === "quiz" ? "quiz" : "challenge") : "waiting";
      writeLocal(ACTIVE_KEY, { id: match.id, code: normalized });
      if (match.status === "active" && match.mode === "quiz") startOnlineQuiz(match);
      schedulePoll(200);
    });
  }
  async function resumeMatch() {
    const active = readLocal(ACTIVE_KEY, null);
    if (!configured() || !active?.id) return;
    await withBusy(async () => {
      await identify();
      const match = normalizeMatch(await transport().getMatch(active.id));
      if (!match?.id || ["finished", "cancelled", "expired"].includes(match.status)) {
        writeLocal(ACTIVE_KEY, null); return;
      }
      state.match = match;
      state.screen = match.status === "active" ? (match.mode === "quiz" ? "quiz" : "challenge") : "waiting";
      if (state.screen === "quiz") startOnlineQuiz(match);
      schedulePoll(200);
    });
  }
  async function startMatch() {
    if (!state.match?.id) return;
    await withBusy(async () => {
      state.match = normalizeMatch(await transport().startMatch(state.match.id));
      if (state.match.mode === "quiz") startOnlineQuiz(state.match);
      else state.screen = "challenge";
      schedulePoll(200); render();
    });
  }
  async function leaveMatch() {
    const matchId = state.match?.id;
    stopPolling();
    if (matchId && configured()) {
      try { await transport().leaveMatch(matchId); } catch (_) {}
    }
    state.match = null; state.quiz = null; state.screen = "lobby"; state.message = "";
    writeLocal(ACTIVE_KEY, null); render();
  }

  function startOnlineQuiz(match) {
    if (state.quiz?.matchId === match.id) return;
    const seed = Number(match.seed || match.quiz_seed || 1);
    state.quiz = { matchId: match.id, questions: buildQuiz(seed), index: 0, score: 0, correct: 0, startedAt: Date.now(), questionStartedAt: Date.now(), answered: false, selected: null };
    state.screen = "quiz";
    render();
  }
  async function answerQuiz(index) {
    const quiz = state.quiz;
    if (!quiz || quiz.answered) return;
    const question = quiz.questions[quiz.index];
    quiz.answered = true; quiz.selected = index;
    const correct = index === question.answer;
    const elapsed = Date.now() - quiz.startedAt;
    const responseTime = Date.now() - quiz.questionStartedAt;
    const speedBonus = Math.round(clamp(50 - responseTime / 100, 0, 50));
    if (correct) { quiz.correct += 1; quiz.score += 100 + speedBonus; }
    render();
    try {
      await transport().updateMatch({
        matchId: quiz.matchId, progress: quiz.index + 1, score: quiz.score, status: "playing",
        durationMs: elapsed, payload: { correct: quiz.correct },
      });
    } catch (_) {}
    window.setTimeout(() => {
      if (!state.quiz || state.quiz.matchId !== quiz.matchId) return;
      quiz.index += 1; quiz.answered = false; quiz.selected = null; quiz.questionStartedAt = Date.now();
      if (quiz.index >= quiz.questions.length) finishOnlineQuiz();
      else render();
    }, 650);
  }
  async function finishOnlineQuiz() {
    const quiz = state.quiz;
    if (!quiz) return;
    const durationMs = Date.now() - quiz.startedAt;
    await withBusy(async () => {
      await transport().updateMatch({
        matchId: quiz.matchId, progress: QUIZ_COUNT, score: quiz.score, status: "finished",
        durationMs, payload: { correct: quiz.correct },
      });
      await submitScore("quiz", quiz.score, durationMs, { correct: quiz.correct, source: "online_match" }, true);
      state.match = normalizeMatch(await transport().getMatch(quiz.matchId));
      state.screen = "result"; schedulePoll(300); render();
    });
  }
  function openChallengeGame() {
    const mode = state.match?.mode;
    state.challengeLaunch = {
      mode,
      matchId: state.match?.id,
      expiresAt: Date.now() + 5000,
    };
    close(false);
    if (mode === "gozen5") {
      window.GOZEN_FIVE?.startOnline?.();
    } else if (mode === "kemari") {
      if (typeof enterMode === "function") enterMode("kemari");
    } else if (mode === "koh_awase") {
      window.KOH_AWASE?.start?.({ seed: Number(state.match?.seed || 1) });
      window.KOH_AWASE?.open?.();
    }
  }
  async function finishChallenge(mode, score, durationMs, metadata) {
    if (!state.match || state.match.mode !== mode || state.match.status !== "active") return false;
    const completed = await withBusy(async () => {
      await transport().updateMatch({
        matchId: state.match.id, progress: 1, score, status: "finished", durationMs: durationMs || 0, payload: metadata || {},
      });
      await submitScore(mode, score, durationMs, Object.assign({ source: "online_match" }, metadata), true);
      state.match = normalizeMatch(await transport().getMatch(state.match.id));
      state.screen = "result"; open(); schedulePoll(300);
      return true;
    });
    return completed === true;
  }

  async function submitScore(mode, score, durationMs, metadata, immediate) {
    if (!MODES[mode]) return { queued: false, ignored: true };
    const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, mode, score: mode === "quiz_ta" ? 0 : Math.max(0, Math.round(Number(score) || 0)), durationMs: Math.max(0, Math.round(Number(durationMs) || 0)), metadata: metadata || {}, createdAt: Date.now() };
    if (!configured()) return { queued: false, offline: true };
    if (!immediate) {
      const pending = readLocal(PENDING_KEY, []);
      pending.push(item); writeLocal(PENDING_KEY, pending.slice(-20));
    }
    try {
      await identify();
      const result = await transport().submitScore(item);
      if (!immediate) writeLocal(PENDING_KEY, readLocal(PENDING_KEY, []).filter(entry => entry.id !== item.id));
      return { queued: false, submitted: true, result: firstResult(result) };
    } catch (error) {
      if (immediate) {
        const pending = readLocal(PENDING_KEY, []);
        pending.push(item); writeLocal(PENDING_KEY, pending.slice(-20));
      }
      return { queued: true, error: error?.message || String(error) };
    }
  }
  async function flushPending() {
    if (!configured()) return;
    const pending = readLocal(PENDING_KEY, []);
    if (!pending.length) return;
    const keep = [];
    for (const item of pending) {
      try { await identify(); await transport().submitScore(item); } catch (_) { keep.push(item); }
    }
    writeLocal(PENDING_KEY, keep);
  }
  async function loadRanking() {
    if (!configured()) { state.ranking = []; state.myRank = null; render(); return; }
    await withBusy(async () => {
      await identify();
      const [result, mine] = await Promise.all([
        transport().leaderboard(state.rankingMode, state.rankingPeriod, 20),
        transport().myRank?.(state.rankingMode, state.rankingPeriod) || Promise.resolve([]),
      ]);
      const raw = Array.isArray(result) ? result : (result?.rows || result?.leaderboard || []);
      state.ranking = raw;
      state.myRank = firstResult(mine)?.rank || result?.my_rank || result?.myRank || null;
    });
  }

  async function getMyRank(mode, period = "weekly") {
    if (!configured() || !MODES[mode]) return { available: false, rank: null, totalPlayers: null };
    await identify();
    const row = firstResult(await transport().myRank?.(mode, period));
    return {
      available: true,
      rank: Number(row?.rank) || null,
      totalPlayers: Number(row?.total_players || row?.totalPlayers) || null,
      score: Number(row?.score) || 0,
      durationMs: Number(row?.duration_ms || row?.durationMs) || 0,
    };
  }

  function challengeContext(mode) {
    const match = state.match;
    if (!match || match.mode !== mode || !["active", "finished"].includes(match.status)) return null;
    const rival = opponent(match);
    return {
      active: match.status === "active",
      matchId: match.id,
      seed: Number(match.seed || 1),
      opponentName: rival?.display_name || rival?.name || "対戦相手",
      opponentScore: Number(rival?.score) || 0,
      opponentStatus: rival?.status || "waiting",
      opponentProgress: rival?.progress && typeof rival.progress === "object" ? rival.progress : {},
    };
  }

  function consumeChallengeContext(mode) {
    const launch = state.challengeLaunch;
    state.challengeLaunch = null;
    if (!launch || launch.mode !== mode || launch.expiresAt < Date.now() || launch.matchId !== state.match?.id) return null;
    return challengeContext(mode);
  }

  async function syncChallenge(mode) {
    const context = challengeContext(mode);
    if (!context?.matchId) return context;
    const next = normalizeMatch(await transport().getMatch(context.matchId));
    if (state.match?.id === context.matchId) state.match = next;
    return challengeContext(mode);
  }

  async function updateChallengeProgress(mode, score, durationMs, metadata) {
    const context = challengeContext(mode);
    if (!context?.active) return context;
    const next = normalizeMatch(await transport().updateMatch({
      matchId: context.matchId,
      progress: Math.max(0, Number(metadata?.rally || metadata?.progress) || 0),
      score: Math.max(0, Math.round(Number(score) || 0)),
      status: "playing",
      durationMs: Math.max(0, Math.round(Number(durationMs) || 0)),
      payload: metadata || {},
    }));
    if (state.match?.id === context.matchId) state.match = next;
    return challengeContext(mode);
  }

  function ensureModal() {
    if (modal) return modal;
    modal = create("div", "online-modal");
    modal.id = MODAL_ID;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "onlineCompetitionTitle");
    modal.addEventListener("mousedown", event => { if (event.target === modal) close(); });
    modal.addEventListener("keydown", event => { if (event.key === "Escape") close(); });
    document.body.appendChild(modal);
    return modal;
  }
  function button(label, className, handler) {
    const el = create("button", className || "online-action", label);
    el.type = "button"; el.disabled = state.busy;
    if (handler) el.addEventListener("click", handler);
    return el;
  }
  function notice(body) {
    if (state.error) body.append(create("div", "online-notice is-error", state.error));
    else if (state.message) body.append(create("div", "online-notice", state.message));
  }
  function renderLobby(body) {
    const p = pref();
    const identity = create("div", "online-field");
    const nameLabel = create("label", null, "対戦名");
    const nameInput = create("input");
    nameInput.id = "onlineDisplayName"; nameInput.value = p.displayName; nameInput.maxLength = 12; nameInput.autocomplete = "nickname";
    nameInput.addEventListener("change", () => setPref({ displayName: nameInput.value }));
    nameLabel.append(nameInput); identity.append(nameLabel);
    const modeLabel = create("label", null, "種目");
    const modeSelect = create("select"); modeSelect.id = "onlineMatchMode";
    ["gozen5", "quiz", "kemari", "koh_awase"].forEach(id => {
      const option = create("option", null, modeMeta(id).label); option.value = id; modeSelect.append(option);
    });
    modeLabel.append(modeSelect); identity.append(modeLabel); body.append(identity);
    const createArea = create("section", "online-block");
    createArea.append(create("h3", null, "部屋をつくる"), create("p", null, "六文字の部屋番号を相手に伝えます。二人がそろうと開始できます。"));
    createArea.append(button("新しい対戦部屋", "online-action is-primary", () => createMatch(modeSelect.value)));
    const joinArea = create("section", "online-block");
    joinArea.append(create("h3", null, "部屋に入る"));
    const joinRow = create("div", "online-code-row");
    const code = create("input"); code.id = "onlineRoomCode"; code.maxLength = 6; code.placeholder = "部屋番号"; code.autocapitalize = "characters";
    code.addEventListener("input", () => { code.value = code.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase(); });
    joinRow.append(code, button("参加", "online-action", () => joinMatch(code.value))); joinArea.append(joinRow);
    body.append(createArea, joinArea);
  }
  function renderWaiting(body) {
    const match = state.match, code = match?.room_code || match?.code || "------";
    const codeBox = create("div", "online-room-code"); codeBox.append(create("span", null, "部屋番号"), create("strong", null, code));
    body.append(codeBox, create("p", "online-mode-label", modeMeta(match?.mode).label));
    const players = create("div", "online-players");
    playerRows(match).forEach(player => {
      const item = create("div", "online-player");
      item.append(create("span", "online-player-mark", player.is_host || player.host ? "主" : "客"), create("b", null, player.display_name || player.name || "参加者"), create("small", null, player.status === "ready" ? "準備済み" : "待機中"));
      players.append(item);
    });
    if (playerRows(match).length < 2) {
      const item = create("div", "online-player is-empty"); item.append(create("span", "online-player-mark", "客"), create("b", null, "相手を待っています")); players.append(item);
    }
    body.append(players);
    const actions = create("div", "online-actions");
    if (isHost(match)) {
      const start = button("対戦を始める", "online-action is-primary", startMatch);
      start.disabled = state.busy || playerRows(match).length < 2; actions.append(start);
    } else actions.append(create("p", "online-wait", "部屋の主が開始するのを待っています"));
    actions.append(button("退出", "online-action is-quiet", leaveMatch)); body.append(actions);
  }
  function renderQuiz(body) {
    const quiz = state.quiz;
    if (!quiz) { body.append(create("p", null, "問題を準備しています")); return; }
    const question = quiz.questions[quiz.index];
    if (!question) {
      body.append(create("div", "online-empty", "勝負の結果を集計しています"));
      return;
    }
    body.append(create("div", "online-progress", `${quiz.index + 1} / ${quiz.questions.length}　${quiz.score}点`));
    const progress = create("div", "online-progress-track"); const fill = create("i"); fill.style.width = `${quiz.index / quiz.questions.length * 100}%`; progress.append(fill); body.append(progress);
    body.append(create("h3", "online-question", question.prompt));
    const choices = create("div", "online-choices");
    question.options.forEach((id, index) => {
      const choice = button(`${index + 1}. ${ITEMS[id].n}`, "online-choice", () => answerQuiz(index));
      if (quiz.answered) {
        choice.disabled = true;
        if (index === question.answer) choice.classList.add("is-correct");
        else if (index === quiz.selected) choice.classList.add("is-wrong");
      }
      choices.append(choice);
    });
    body.append(choices);
    const rival = opponent(state.match);
    if (rival) body.append(create("div", "online-rival", `相手　${rival.display_name || rival.name || "参加者"}　${playerProgress(rival)}/${QUIZ_COUNT}問　${rival.score || 0}点`));
  }
  function renderChallenge(body) {
    const match = state.match, own = ownPlayer(match), rival = opponent(match);
    body.append(create("p", "online-mode-label", `${modeMeta(match?.mode).label} 御前勝負`));
    body.append(create("p", "online-challenge-copy", match?.mode === "gozen5"
      ? "札・貝・香・歌・鞠の五局を、同じ出題と同じ鞠順で競います。相手を待たずに進められます。"
      : "同じ種目を一度ずつ遊び、記録の高い方が勝ちです。終了すると結果が自動で届きます。"));
    const players = create("div", "online-players");
    [own, rival].filter(Boolean).forEach(player => {
      const item = create("div", "online-player");
      item.append(create("span", "online-player-mark", player.is_self || player.self ? "自" : "相"), create("b", null, player.display_name || player.name || "参加者"), create("small", null, player.status === "finished" ? formatValue(match.mode, player.score, player.duration_ms) : "挑戦中"));
      players.append(item);
    });
    body.append(players);
    if (own?.status !== "finished") body.append(button(`${modeMeta(match.mode).label}を始める`, "online-action is-primary online-launch", openChallengeGame));
    else body.append(create("p", "online-wait", "相手の結果を待っています"));
    body.append(button("対戦画面を閉じる", "online-action is-quiet", () => close(false)));
  }
  function renderResult(body) {
    const match = state.match, rows = playerRows(match).slice().sort((a, b) => {
      if (match?.mode === "quiz_ta") return (a.duration_ms || Infinity) - (b.duration_ms || Infinity);
      return (b.score || 0) - (a.score || 0);
    });
    body.append(create("p", "online-result-title", "御前試合　決着"));
    const board = create("div", "online-result-board");
    rows.forEach((player, index) => {
      const row = create("div", `online-result-row${player.is_self || player.self ? " is-self" : ""}`);
      row.append(create("strong", null, `${index + 1}位`), create("span", null, player.display_name || player.name || "参加者"), create("b", null, formatValue(match?.mode, player.score, player.duration_ms)));
      board.append(row);
    });
    body.append(board, button("新しい勝負へ", "online-action is-primary", leaveMatch));
  }
  function renderEnded(body) {
    const expired = state.match?.status === "expired";
    body.append(
      create("p", "online-result-title", expired ? "対戦部屋の期限が切れました" : "対戦は中止されました"),
      create("p", "online-challenge-copy", expired ? "長時間更新がなかったため、この部屋を閉じました。新しい部屋から再開できます。" : "参加者が退出したため、この勝負は順位や戦績に数えません。"),
      button("新しい勝負へ", "online-action is-primary", leaveMatch),
    );
  }
  function renderRanking(body) {
    const controls = create("div", "online-ranking-controls");
    const mode = create("select"); mode.setAttribute("aria-label", "順位表の種目");
    Object.keys(MODES).forEach(id => { const option = create("option", null, MODES[id].label); option.value = id; option.selected = id === state.rankingMode; mode.append(option); });
    const period = create("select"); period.setAttribute("aria-label", "順位表の期間");
    Object.keys(PERIODS).forEach(id => { const option = create("option", null, PERIODS[id]); option.value = id; option.selected = id === state.rankingPeriod; period.append(option); });
    const reload = () => { state.rankingMode = mode.value; state.rankingPeriod = period.value; loadRanking(); };
    mode.addEventListener("change", reload); period.addEventListener("change", reload); controls.append(mode, period, button("更新", "online-icon-action", reload)); body.append(controls);
    if (!configured()) {
      body.append(create("div", "online-empty", "共有順位表はオンラインサーバーの設定後に利用できます。端末内の自己記録はこれまでどおり保存されます。")); return;
    }
    if (state.busy && !state.ranking.length) { body.append(create("div", "online-empty", "順位を読み込んでいます")); return; }
    const table = create("div", "online-ranking");
    state.ranking.forEach((entry, index) => {
      const row = create("div", `online-ranking-row${entry.is_self || entry.is_me || entry.self ? " is-self" : ""}`);
      row.append(create("strong", null, `${entry.rank || index + 1}`), create("span", null, entry.display_name || entry.name || "参加者"), create("b", null, formatValue(state.rankingMode, entry.score, entry.duration_ms)));
      table.append(row);
    });
    if (!state.ranking.length) table.append(create("div", "online-empty", "この期間の記録はまだありません"));
    body.append(table);
    if (state.myRank && !state.ranking.some(entry => entry.is_self || entry.is_me || entry.self)) body.append(create("p", "online-my-rank", `あなたの順位　${state.myRank}位`));
  }
  function render() {
    if (!modal) return;
    const sheet = create("section", "online-sheet");
    const head = create("header", "online-head");
    const words = create("div"); words.append(create("span", "online-kicker", configured() ? "オンライン接続" : "接続設定待ち"));
    const title = create("h2", null, "オンライン御前試合"); title.id = "onlineCompetitionTitle"; words.append(title);
    head.append(words, button("×", "online-close", () => close())); sheet.append(head);
    const tabs = create("div", "online-tabs");
    [["match", "対戦"], ["ranking", "順位表"]].forEach(([id, label]) => {
      const tab = button(label, `online-tab${state.tab === id ? " is-active" : ""}`, () => {
        state.tab = id; state.error = ""; render(); if (id === "ranking") loadRanking();
      });
      tab.setAttribute("aria-pressed", String(state.tab === id)); tabs.append(tab);
    });
    sheet.append(tabs);
    const body = create("main", "online-body");
    if (!configured()) {
      const status = create("div", "online-offline");
      status.append(create("strong", null, "オンライン対戦は現在準備中です"), create("span", null, "散策、クイズ、ミニゲームと端末内記録はそのまま遊べます。"));
      body.append(status);
    }
    notice(body);
    if (state.tab === "ranking") renderRanking(body);
    else if (!configured()) body.append(create("p", "online-safe-note", "接続先を設定すると、匿名の対戦名だけで部屋対戦と共有順位表を利用できます。個人情報は入力しないでください。"));
    else if (state.screen === "waiting") renderWaiting(body);
    else if (state.screen === "quiz") renderQuiz(body);
    else if (state.screen === "challenge") renderChallenge(body);
    else if (state.screen === "result") renderResult(body);
    else if (state.screen === "ended") renderEnded(body);
    else renderLobby(body);
    sheet.append(body); modal.replaceChildren(sheet);
  }
  function open() {
    state.open = true; ensureModal().classList.add("is-open"); render();
    if (state.match?.id) schedulePoll(100); else resumeMatch();
  }
  function close(stop = true) {
    state.open = false; modal?.classList.remove("is-open"); if (stop) stopPolling();
  }
  function injectEntry() {
    // 表紙の「遊び方を選ぶ」は5枚に絞ったので、対戦は図鑑などと同じ常設入口の段へ置く。
    // 旧構成(#titleSubEntriesが無いHTML)へ戻された場合はメインのモード欄へフォールバックする。
    const host = document.getElementById("titleSubEntries") || document.querySelector("#mainModes .t-modes");
    if (!host || document.getElementById(ENTRY_ID)) return !!host;
    const sub = host.id === "titleSubEntries";
    const entry = create("button", sub ? "t-btn t-codex-btn online-entry" : "t-btn t-cat-btn online-entry");
    entry.id = ENTRY_ID; entry.type = "button";
    if (sub) {
      entry.append(create("span", "oc-entry-mark", "競"), document.createTextNode("オンライン御前試合"), create("small", null, "六文字の部屋番号で二人対戦。五番勝負・クイズ・蹴鞠・香合わせ"));
    } else {
      entry.append(create("span", "mode-meta", "対戦 / 共有順位"), create("div", "cat-icon", "競"), create("span", "mode-name", "オンライン御前試合"), create("small", null, "五番勝負・クイズ・蹴鞠・香合わせで競う"));
    }
    entry.addEventListener("click", open); host.append(entry); return true;
  }
  function boot() {
    injectEntry(); let attempts = 0;
    const timer = setInterval(() => { attempts += 1; if (injectEntry() || attempts > 40) clearInterval(timer); }, 250);
    window.addEventListener("online", flushPending);
    if (configured()) flushPending();
  }
  function configure(next) {
    if (next?.transport) transportOverride = next.transport;
    if (next?.url && next?.anonKey) writeLocal(CONFIG_KEY, { url: next.url, anonKey: next.anonKey });
    if (next?.clear) { transportOverride = null; writeLocal(CONFIG_KEY, null); }
    render(); return getStatus();
  }
  function getStatus() {
    return {
      ready: true, configured: configured(), open: state.open, tab: state.tab, screen: state.screen,
      match: state.match, quiz: state.quiz && { index: state.quiz.index, score: state.quiz.score, correct: state.quiz.correct },
      rankingCount: state.ranking.length, pendingScores: readLocal(PENDING_KEY, []).length,
    };
  }

  window.ONLINE_COMPETITION = {
    open, close, configure, createMatch, joinMatch, startMatch, leaveMatch, answerQuiz,
    submitScore, finishChallenge, loadRanking, getMyRank, getStatus, launchChallenge: openChallengeGame,
    getChallengeContext: challengeContext, consumeChallengeContext, syncChallenge, updateChallengeProgress,
    setDisplayName: name => setPref({ displayName: name }),
    buildQuiz: seed => buildQuiz(seed),
    __test: {
      setTransport(value) { transportOverride = value; },
      setMatch(value) { state.match = value; state.screen = value?.status === "active" ? (value.mode === "quiz" ? "quiz" : "challenge") : "waiting"; if (state.screen === "quiz") startOnlineQuiz(value); render(); },
      getState: () => state,
    },
  };
  window.ONLINE_COMPETITION_STATUS = { ready: true, version: 3, modes: Object.keys(MODES), quizCount: QUIZ_COUNT };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true }); else boot();
})();
