#!/usr/bin/env node
/*
 * verify-story-routes.js — ED到達バランス/分岐網羅の自動検証。
 *
 * StoryManager を全章の実データで駆動する軽量シミュレータを組み、
 * 「選択方針(policy)」ごとに第1話から結末まで走破し、到達したEDを検証する。
 *   - 理想ルート(均衡した選択+ミニゲーム完勝+最後に「あなた」) → ED1 True End
 *   - 雅偏重で役名固定 → ED4 常世の婿
 *   - 歌合敗北を受け入れる → ED3 歌なき夜
 *   - 「良い選択をしているのに ED4 へ誤誘導」の再発防止(理想ルートのED1到達で担保)
 *
 * ミニゲームは headless では実プレイできないため policy.mini(gameMode) の
 * {success, flags} で解決する(本番の resumeFromMiniGame と同じ入口)。
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");

function loadEmbed() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "story/chapters/chapter_manifest.json"), "utf8"));
  const chapters = {};
  for (let i = 1; i <= 6; i++) {
    chapters[String(i)] = JSON.parse(fs.readFileSync(path.join(ROOT, `story/chapters/chapter${i}.json`), "utf8"));
  }
  return { manifest, chapters };
}

// StoryManager を vm サンドボックスで読み込む。window(=IIFEのglobal)へ STORY_EMBED と
// localStorage スタブを載せておくと、fetch なしで同梱データから章を読める。
function loadStoryManagerCtx(embed) {
  const memStore = {};
  const win = {
    STORY_EMBED: embed,
    localStorage: {
      getItem: (k) => (k in memStore ? memStore[k] : null),
      setItem: (k, v) => { memStore[k] = String(v); },
      removeItem: (k) => { delete memStore[k]; },
    },
  };
  const sandbox = { window: win, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const src = fs.readFileSync(path.join(ROOT, "story/story_manager.js"), "utf8");
  vm.runInContext(src, sandbox, { filename: "story_manager.js" });
  return { StoryManager: win.StoryManager, memStore };
}

function tick() { return new Promise((r) => setImmediate(r)); }
function snap(sm) {
  return {
    endingId: sm.state.endingId,
    params: Object.assign({}, sm.state.params),
    flags: Object.assign({}, sm.state.routeFlags),
  };
}

async function runRoute(StoryManager, memStore, policy, maxSteps = 6000) {
  Object.keys(memStore).forEach((k) => delete memStore[k]);
  const sm = new StoryManager({ hooks: {} });
  await sm.startChapter(1); // 最初の待機点(dialogue/choice)まで自走
  let steps = 0;
  while (steps++ < maxSteps) {
    if (sm.state.endingId) return snap(sm);
    const cur = sm.currentSequenceId;
    // 章クリア(chapter_complete)は本番では onChapterComplete フックが次章をロードする。
    // sim ではそれを肩代わりし、第1〜4話 → 次章、第5話は ending_check 経由なので到達しない。
    if (cur === "chapter_complete") {
      const nextId = (sm.state.chapterId || 0) + 1;
      if (nextId <= 5) { await sm.startChapter(nextId); await tick(); continue; }
      throw new Error("chapter_complete beyond ch5 (unexpected: " + sm.state.chapterId + ")");
    }
    const ev = sm.sequenceMap.get(cur);
    if (!ev) throw new Error("lost at " + cur);
    switch (ev.type) {
      case "choice":
        await sm.choose(policy.choice(ev));
        break;
      case "trigger_minigame":
        await sm.resumeFromMiniGame(policy.mini(ev.gameMode, ev) || { success: true });
        break;
      case "spawn_collectibles":
        (ev.positions || []).forEach((p) => sm.collect(ev.groupId, p.id));
        await tick();
        // 収集完了で自走しなかった場合の保険
        if (sm.currentSequenceId === cur && ev.next) await sm.goNext(ev.next);
        break;
      case "dialogue":
        await sm.goNext(ev.next);
        break;
      case "ending":
        return snap(sm);
      default:
        // set_scene/effect/flag_branch/ending_check/set_flag/require_collectibles は
        // 通常 goNext で自走するため待機点にならない。保険として次へ送る。
        if (ev.next) await sm.goNext(ev.next);
        else { await sm.runCurrent(); }
        break;
    }
    await tick();
    if (sm.state.endingId) return snap(sm);
    if (sm.currentSequenceId === cur && ev.type !== "choice") {
      throw new Error("stuck at " + cur + " (" + ev.type + ")");
    }
  }
  throw new Error("maxSteps exceeded (route did not terminate)");
}

/* 選択方針。target で choice のスコアリングを変え、nameChoice で最終問(名づけ)を固定。
   acceptDefeat=true のとき、敗北後の再挑戦(seq_412c_retry 等)で「受け入れる」を選ぶ。 */
function makePolicy(target, opts = {}) {
  const scoreOption = (o) => {
    const e = o.effects || {};
    const r = e.realityEgo || 0, y = e.fantasySynchro || 0, b = e.brainErosion || 0;
    if (target === "reality") return r - y - b;
    if (target === "fantasy") return y - r - b * 0.2;
    if (target === "erosion") return b;
    return r + y - b * 2; // balanced
  };
  return {
    choice(ev) {
      const options = ev.options || [];
      // 最終問(名づけ): calledYou を立てる選択肢を含む choice
      const hasName = options.some((o) => o.setFlag && (o.setFlag.calledYou || o.setFlag.calledKohagi || o.setFlag.calledShiori));
      if (hasName && typeof opts.nameChoice === "number") return Math.min(opts.nameChoice, options.length - 1);
      // 敗北後の再挑戦: acceptDefeat なら最終オプション(受け入れる)、そうでなければ再挑戦(先頭)
      if (/_retry$/.test(ev.id) || options.some((o) => /目を閉じる|受け入れ|このまま/.test(o.text || ""))) {
        return opts.acceptDefeat ? options.length - 1 : 0;
      }
      let best = 0, bestScore = -Infinity;
      options.forEach((o, i) => { const s = scoreOption(o); if (s > bestScore) { bestScore = s; best = i; } });
      return best;
    },
    mini(gameMode) {
      if (opts.lose && opts.lose[gameMode]) return { success: false };
      if (gameMode === "utakai_story") return { success: true, flags: opts.perfect ? { utakaiPerfect: true } : undefined };
      if (gameMode === "taiji_oni_story_final") return { success: true, flags: opts.perfect ? { oniPerfect: true } : undefined };
      return { success: true };
    },
  };
}

(async () => {
  const embed = loadEmbed();
  const { StoryManager, memStore } = loadStoryManagerCtx(embed);
  if (!StoryManager) { console.error("verify-story-routes: StoryManager not found"); process.exit(1); }

  const routes = [
    { name: "ideal-true-end", policy: makePolicy("balanced", { perfect: true, nameChoice: 2 }), expect: "ED1_TRUE" },
    { name: "fantasy-heavy-name-kohagi", policy: makePolicy("fantasy", { perfect: false, nameChoice: 0 }), expect: "ED4_SYNC" },
    { name: "lose-utakai-accept", policy: makePolicy("balanced", { lose: { utakai_story: true }, acceptDefeat: true }), expect: "ED3_GAMEOVER" },
    { name: "erosion-heavy", policy: makePolicy("erosion", { nameChoice: 2 }), expect: null },
  ];

  const results = [];
  const failures = [];
  for (const route of routes) {
    try {
      const out = await runRoute(StoryManager, memStore, route.policy);
      results.push({ route: route.name, endingId: out.endingId, params: out.params, expect: route.expect });
      if (route.expect && out.endingId !== route.expect) {
        failures.push(`route "${route.name}" reached ${out.endingId}, expected ${route.expect} (params ${JSON.stringify(out.params)})`);
      }
    } catch (e) {
      results.push({ route: route.name, error: String((e && e.message) || e) });
      failures.push(`route "${route.name}" threw: ${(e && e.message) || e}`);
    }
  }

  const ideal = results.find((r) => r.route === "ideal-true-end");
  if (ideal && ideal.params) {
    const p = ideal.params;
    if (!(p.realityEgo >= 60 && p.fantasySynchro >= 60 && p.brainErosion <= 20)) {
      failures.push(`ideal route did not satisfy True End thresholds: ${JSON.stringify(p)} (現>=60,雅>=60,蝕<=20)`);
    }
  }

  if (failures.length) {
    console.error(JSON.stringify({ status: "fail", failures, results }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ status: "ok", results }, null, 2));
})().catch((e) => { console.error(e.stack || e); process.exit(1); });
