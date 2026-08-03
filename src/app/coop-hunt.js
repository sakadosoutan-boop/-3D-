/* 寝殿造り3D探訪 共同討伐
 * 移動と敵AIは端末内で処理し、共有ボスHPと行動イベントだけを同期する。
 */
(() => {
  "use strict";

  const HUD_ID = "coopHuntHud";
  const STORAGE_KEY = "shinden3d-coop-hunt-v1";
  const POLL_MS = 750;
  const SEASON_NAMES = { spring: "九尾の狐", summer: "河童の主", autumn: "合体人魂", winter: "雪女王" };
  const ACTION_NAMES = { attack: "一撃", focus: "大祓", guard: "弾き", down: "力尽きた" };
  const state = {
    active: false, context: null, snapshot: null, connected: false, syncing: false, syncPromise: null, sending: false,
    timer: 0, raf: 0, lastSequence: 0, lastActionAt: {}, pending: [],
    spirit: null, spiritMaterials: [], spiritActionUntil: 0, downed: false,
    startedAt: 0, previous: null, serverEnding: false, lastError: "",
  };

  function el(id) { return document.getElementById(id); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (_) { return null; }
  }
  function save() {
    try {
      if (!state.active || !state.context?.matchId) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify({
        matchId: state.context.matchId, context: state.context, downed: state.downed,
        pending: state.pending.slice(-12), lastSequence: state.lastSequence,
      }));
    } catch (_) {}
  }
  function actionId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `coop_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  }
  function ownPlayer(snapshot) { return snapshot?.players?.find(player => player.is_self); }
  function teammate(snapshot) { return snapshot?.players?.find(player => !player.is_self); }

  function ensureHud() {
    let hud = el(HUD_ID);
    if (hud) return hud;
    hud = document.createElement("section");
    hud.id = HUD_ID;
    hud.className = "coop-hunt-hud";
    hud.setAttribute("aria-live", "polite");
    hud.innerHTML = `
      <div class="coop-hunt-head"><span class="coop-hunt-sigil">共</span><div><b>共同討伐</b><small id="coopHuntBoss">共有霊力を接続中</small></div><i id="coopHuntConnection" title="通信状態"></i></div>
      <div class="coop-hunt-shared"><span>共有霊力</span><b id="coopHuntHpText">-- / --</b></div>
      <div class="coop-hunt-track"><i id="coopHuntHpFill"></i></div>
      <div class="coop-hunt-member"><span id="coopHuntMate">共闘者</span><b id="coopHuntContribution">0功</b></div>
      <p id="coopHuntEvent">二人の攻撃成果を同期します</p>`;
    document.body.appendChild(hud);
    return hud;
  }

  function renderHud(message) {
    const hud = ensureHud();
    hud.classList.toggle("is-active", state.active);
    hud.classList.toggle("is-spectating", state.downed);
    const boss = state.snapshot?.boss;
    const mate = teammate(state.snapshot);
    const hp = Math.max(0, Number(boss?.hp) || 0);
    const maxHp = Math.max(1, Number(boss?.max_hp) || 1);
    const season = state.context?.settings?.season || "spring";
    const connection = el("coopHuntConnection");
    if (connection) {
      connection.className = state.connected ? "is-online" : "is-reconnecting";
      connection.title = state.connected ? "同期中" : "再接続中";
    }
    if (el("coopHuntBoss")) el("coopHuntBoss").textContent = `${SEASON_NAMES[season] || "怪異"}${state.downed ? " / 見守り中" : ""}`;
    if (el("coopHuntHpText")) el("coopHuntHpText").textContent = boss ? `${hp} / ${maxHp}` : "接続中";
    if (el("coopHuntHpFill")) el("coopHuntHpFill").style.width = `${boss ? hp / maxHp * 100 : 100}%`;
    if (el("coopHuntMate")) el("coopHuntMate").textContent = mate?.display_name || state.context?.opponentName || "共闘者";
    if (el("coopHuntContribution")) el("coopHuntContribution").textContent = `${Number(mate?.contribution) || 0}功${mate?.down ? " / 離脱" : ""}`;
    if (message && el("coopHuntEvent")) el("coopHuntEvent").textContent = message;
  }

  function disposeSpirit() {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
    if (state.spirit && typeof scene !== "undefined") scene.remove(state.spirit);
    state.spirit?.traverse?.(object => object.geometry?.dispose?.());
    state.spiritMaterials.forEach(material => material.dispose?.());
    state.spirit = null; state.spiritMaterials = [];
  }

  function makeSpirit() {
    if (typeof THREE === "undefined" || typeof scene === "undefined") return;
    disposeSpirit();
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: 0x77e4d0, transparent: true, opacity: .55, depthWrite: false, depthTest: false });
    const glow = new THREE.MeshBasicMaterial({ color: 0xffdc7a, transparent: true, opacity: .72, depthWrite: false, depthTest: false });
    state.spiritMaterials.push(material, glow);
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(.38, .72, 1.55, 7), material);
    robe.position.y = .8; group.add(robe);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.3, 8, 6), glow);
    head.position.y = 1.78; group.add(head);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(.42, .46, 6), material);
    hat.position.y = 2.14; group.add(hat);
    [-1, 1].forEach(side => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, .88, 6), material);
      arm.position.set(side * .46, 1.14, 0); arm.rotation.z = side * -.42; group.add(arm);
    });
    const arena = typeof TAIJI_BOSS_ARENA !== "undefined" ? TAIJI_BOSS_ARENA : { x: 62, z: -48 };
    group.position.set(arena.x - 3.8, 0, arena.z + 7);
    group.rotation.y = -2.4; group.userData.baseY = 0;
    group.traverse(object => { if (object.isMesh) object.renderOrder = 80; });
    scene.add(group); state.spirit = group;
    animateSpirit();
  }

  function animateSpirit(now = performance.now()) {
    if (!state.active || !state.spirit) return;
    const spirit = state.spirit;
    const attacking = now < state.spiritActionUntil;
    if (typeof player !== "undefined" && typeof camera !== "undefined") {
      const forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y = 0;
      if (forward.lengthSq() < .01) forward.set(0, 0, -1); else forward.normalize();
      const side = new THREE.Vector3(-forward.z, 0, forward.x);
      const target = new THREE.Vector3(player.pos.x, 0, player.pos.z).addScaledVector(forward, 4.6).addScaledVector(side, -2.15);
      target.y = typeof groundH === "function" ? groundH(target.x, target.z) : Math.max(0, player.pos.y - 1.62);
      spirit.position.lerp(target, .11); spirit.userData.baseY = target.y;
      spirit.rotation.y = Math.atan2(forward.x, forward.z);
    }
    spirit.position.y = spirit.userData.baseY + Math.sin(now * .0025) * .08;
    spirit.rotation.z = Math.sin(now * .0017) * .025;
    const scale = attacking ? 1.1 : 1;
    spirit.scale.lerp({ x: scale, y: 1, z: scale }, .18);
    state.spiritMaterials.forEach((material, index) => { material.opacity = attacking ? (.78 - index * .04) : (.55 + index * .17); });
    state.raf = requestAnimationFrame(animateSpirit);
  }

  function flashTeammateAction(action) {
    state.spiritActionUntil = performance.now() + 480;
    const name = action.display_name || state.context?.opponentName || "共闘者";
    const label = ACTION_NAMES[action.action_type] || "援護";
    renderHud(action.action_type === "down" ? `${name}が力尽きた。討伐を託された` : `${name}の${label}　${Number(action.damage) || 0}功`);
  }

  function applySharedHp(snapshot) {
    if (!snapshot?.boss || typeof APP === "undefined" || !APP.taiji || typeof taijiBossList !== "function") return;
    const bosses = taijiBossList(APP.taiji).filter(Boolean);
    if (!bosses.length) return;
    const max = Math.max(1, Number(snapshot.boss.max_hp) || 1);
    const ratio = clamp((Number(snapshot.boss.hp) || 0) / max, 0, 1);
    bosses.forEach(boss => {
      if (boss.dead && ratio > 0) return;
      boss.hp = Math.round(boss.maxHp * ratio);
      if (typeof updateBossBar === "function") updateBossBar(boss);
    });
  }

  async function acceptSnapshot(snapshot) {
    if (!state.active || !snapshot || snapshot.match_id !== state.context?.matchId) return;
    state.connected = true; state.snapshot = snapshot;
    const own = ownPlayer(snapshot); state.downed = !!(state.downed || own?.down);
    const actions = Array.isArray(snapshot.recent_actions) ? snapshot.recent_actions : [];
    actions.filter(action => Number(action.sequence) > state.lastSequence && action.player_id !== own?.player_id).forEach(flashTeammateAction);
    state.lastSequence = Math.max(Number(snapshot.event_sequence) || 0, state.lastSequence);
    applySharedHp(snapshot); renderHud(); save();
    if (snapshot.boss?.status === "failed") finishFromServer(false);
    else if (snapshot.boss?.status === "defeated") {
      if (APP?.taiji && !state.downed) applySharedHp(snapshot);
      finishFromServer(true);
    }
  }

  async function sync() {
    if (!state.active) return null;
    if (state.syncing) {
      const current = state.syncPromise;
      return current?.then(() => state.active ? sync() : state.snapshot);
    }
    state.syncing = true;
    state.syncPromise = (async () => {
      try {
        const snapshot = await window.ONLINE_COMPETITION?.syncCoopHunt?.();
        await acceptSnapshot(snapshot);
        await flushPending();
      } catch (error) {
        state.lastError = error?.message || String(error);
        state.connected = false; renderHud("通信をつなぎ直しています。攻撃は一時保存されます");
      } finally {
        state.syncing = false; state.syncPromise = null;
        if (state.active) state.timer = window.setTimeout(sync, POLL_MS);
      }
    })();
    return state.syncPromise;
  }

  async function flushPending() {
    if (!state.active || !state.pending.length || state.sending) return;
    const item = state.pending[0];
    state.sending = true;
    try {
      const snapshot = await window.ONLINE_COMPETITION.submitCoopHuntAction(item.type, item.payload, item.id);
      state.pending.shift(); save(); await acceptSnapshot(snapshot);
    } catch (error) {
      if (/cooling down/i.test(error?.message || "")) { state.pending.shift(); save(); return; }
      throw error;
    } finally { state.sending = false; }
  }

  function submitAction(type, payload = {}) {
    if (!state.active || state.downed || !state.context?.active) return false;
    const now = performance.now();
    const localCooldown = { attack: 620, focus: 1720, guard: 850, down: 0 }[type] || 650;
    if (now - (state.lastActionAt[type] || 0) < localCooldown) return false;
    state.lastActionAt[type] = now;
    state.pending.push({ id: actionId(), type, payload: { timing: clamp(Math.round(Number(payload.timing) || 620), 0, 1000), kind: String(payload.kind || "hit").slice(0, 16) } });
    state.pending = state.pending.slice(-12); save();
    flushPending().catch(() => {});
    return true;
  }

  function restoreLocalSettings() {
    if (!state.previous || typeof APP === "undefined") return;
    APP.taijiDifficulty = state.previous.difficulty;
    APP.taijiBossRush = state.previous.bossRush;
    APP.taijiSeason = state.previous.season;
    state.previous = null;
  }

  async function showResult() {
    try { await window.ONLINE_COMPETITION?.syncChallenge?.("coop_hunt"); } catch (_) {}
    window.ONLINE_COMPETITION?.open?.();
  }

  function finishFromServer(success) {
    if (!state.active || state.serverEnding) return;
    if (APP?.taiji && !APP.taiji.done) {
      state.serverEnding = true;
      if (success) {
        const bosses = typeof taijiBossList === "function" ? taijiBossList(APP.taiji) : [];
        if (bosses.length) applySharedHp({ boss: { hp: 0, max_hp: 1 } });
        else { APP.taiji.done = true; window.setTimeout(() => endTaiji(false), 120); }
      }
      else { APP.taiji.done = true; window.setTimeout(() => endTaiji(true), 120); }
      return;
    }
    state.active = false; state.connected = false;
    clearTimeout(state.timer); state.timer = 0; disposeSpirit();
    el(HUD_ID)?.classList.remove("is-active"); restoreLocalSettings(); save();
    showResult();
  }

  function afterTaijiEnd(success) {
    if (typeof APP !== "undefined") {
      APP.mode = "walk"; APP.coopHuntActive = false;
      if (el("modeTag")) el("modeTag").textContent = "自由散策";
    }
    disposeSpirit();
    if (state.serverEnding || state.snapshot?.boss?.status === "defeated" || state.snapshot?.boss?.status === "failed") {
      state.serverEnding = false; finishFromServer(success); return;
    }
    if (!success) {
      state.downed = true; renderHud("力尽きた。共闘者の討伐を見守っています"); save();
      state.pending.unshift({ id: actionId(), type: "down", payload: { timing: 0, kind: "down" } });
      flushPending().catch(() => {});
    }
  }

  async function startOnline() {
    const context = window.ONLINE_COMPETITION?.consumeChallengeContext?.("coop_hunt");
    if (!context?.active || state.active) return false;
    const saved = loadSaved();
    state.active = true; state.context = context; state.snapshot = null; state.connected = false;
    state.lastError = "";
    state.startedAt = Date.now(); state.downed = saved?.matchId === context.matchId && !!saved.downed;
    state.pending = saved?.matchId === context.matchId && Array.isArray(saved.pending) ? saved.pending : [];
    state.lastSequence = saved?.matchId === context.matchId ? Number(saved.lastSequence) || 0 : 0;
    state.serverEnding = false;
    const season = ["spring", "summer", "autumn", "winter"].includes(context.settings?.season) ? context.settings.season : "spring";
    const difficulty = context.settings?.difficulty === "hard" ? "hard" : "normal";
    state.previous = { difficulty: APP.taijiDifficulty, bossRush: APP.taijiBossRush, season: APP.taijiSeason };
    APP.coopHuntActive = true; APP.taijiDifficulty = difficulty;
    ensureHud(); renderHud("共闘者と共有霊力を結んでいます"); sync(); save();
    try {
      if (typeof showLoading === "function") showLoading("共闘の結界を準備中…");
      if (typeof initAudio === "function") initAudio();
      APP.taijiBossRush = true; APP.taijiSeason = season;
      if (typeof applySeason === "function") applySeason(season);
      if (typeof PREFS !== "undefined") PREFS.set("season", season);
      if (location.protocol !== "file:" && typeof taijiWarmBossSeason === "function") {
        await Promise.race([taijiWarmBossSeason(season), new Promise(resolve => setTimeout(resolve, 2600))]);
      }
      enterMode("taiji");
      if (!state.active || !APP.taiji) return false;
      APP.taiji.rushQueue = [season]; APP.taiji.rushIndex = 0; APP.taiji.total = 1; APP.taiji.season = season;
      if (el("taijiRemain")) el("taijiRemain").textContent = "共闘";
      if (el("taijiMsg")) el("taijiMsg").textContent = `${context.opponentName}と霊力を合わせ、${SEASON_NAMES[season]}を祓え`;
      makeSpirit(); return true;
    } catch (error) {
      state.active = false; restoreLocalSettings(); renderHud(error?.message || "共同討伐を開始できませんでした");
      return false;
    }
  }

  function installHooks() {
    if (typeof taijiWarmBossSeason === "function" && !taijiWarmBossSeason.__coopWrapped) {
      const original = taijiWarmBossSeason;
      const wrapped = function (season) {
        if (state.active && location.protocol === "file:") return Promise.resolve(null);
        return original(season);
      };
      wrapped.__coopWrapped = true; taijiWarmBossSeason = wrapped;
    }
    if (typeof taijiAttachBossAsset === "function" && !taijiAttachBossAsset.__coopWrapped) {
      const original = taijiAttachBossAsset;
      const wrapped = function (season, group) {
        if (state.active && location.protocol === "file:") return;
        return original(season, group);
      };
      wrapped.__coopWrapped = true; taijiAttachBossAsset = wrapped;
    }
    if (typeof damageBoss === "function" && !damageBoss.__coopWrapped) {
      const original = damageBoss;
      const wrapped = function (boss, damage, kind = "hit") {
        if (!state.active || state.downed) return original(boss, damage, kind);
        const before = typeof taijiBossList === "function" && APP?.taiji
          ? taijiBossList(APP.taiji).map(item => ({ item, hp: item.hp })) : [];
        const hit = original(boss, damage, kind);
        if (!hit) return hit;
        const allowed = !["silent", "dot", "ukon"].includes(kind);
        if (state.snapshot?.boss) applySharedHp(state.snapshot);
        else before.forEach(row => { row.item.hp = row.hp; updateBossBar(row.item); });
        if (allowed) {
          const type = ["kotodama", "fuda"].includes(kind) ? "focus" : ["parry", "reflect"].includes(kind) ? "guard" : "attack";
          submitAction(type, { kind, timing: kind === "parry" ? 940 : kind === "kotodama" ? 900 : 700 });
        }
        return hit;
      };
      wrapped.__coopWrapped = true; damageBoss = wrapped;
    }
    if (typeof endTaiji === "function" && !endTaiji.__coopWrapped) {
      const original = endTaiji;
      const wrapped = function (failed) {
        if (!state.active) return original(failed);
        APP.storyTaiji = { done: success => afterTaijiEnd(success) };
        return original(failed);
      };
      wrapped.__coopWrapped = true; endTaiji = wrapped;
    }
    if (typeof taijiQuit === "function" && !taijiQuit.__coopWrapped) {
      const original = taijiQuit;
      const wrapped = function () {
        if (!state.active) return original();
        if (APP?.taiji) { APP.taiji.done = true; endTaiji(true); }
      };
      wrapped.__coopWrapped = true; taijiQuit = wrapped;
    }
  }

  installHooks();
  window.COOP_HUNT = { startOnline, sync, getState: () => ({
    active: state.active, connected: state.connected, downed: state.downed,
    matchId: state.context?.matchId || null, snapshot: state.snapshot, pending: state.pending.length, lastError: state.lastError,
  }) };
  window.COOP_HUNT_STATUS = { ready: true, version: 1, transport: "shared-state", pollMs: POLL_MS };
})();
