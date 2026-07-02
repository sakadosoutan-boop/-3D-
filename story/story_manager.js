/*
 * StoryManager scaffold for 寝殿造り3D探訪.
 *
 * This file is intentionally standalone. During the final integration, either
 * inline this class into 寝殿造り3D探訪_統合版.html or load it before starting
 * story mode. Scenario prose stays in story/chapters/*.json.
 */
(function(global){
  "use strict";

  const STORY_SAVE_KEY = "shinden3d-story-save-v1";
  const STORY_DEFAULT_PARAMS = Object.freeze({
    realityEgo: 0,
    fantasySynchro: 0,
    brainErosion: 0
  });

  const STORY_ENDINGS = Object.freeze({
    TRUE: "ED1_TRUE",
    NORMAL: "ED2_NORMAL",
    BAD_GAMEOVER: "ED3_GAMEOVER",
    BAD_SYNC: "ED4_SYNC",
    SPOOKY: "ED5_SPOOKY"
  });

  function clamp(value, min, max){
    return Math.max(min, Math.min(max, value));
  }

  function clonePlain(value){
    return JSON.parse(JSON.stringify(value));
  }

  class StoryManager {
    constructor(options = {}){
      this.basePath = options.basePath || "story/chapters/";
      this.saveKey = options.saveKey || STORY_SAVE_KEY;
      this.fetchImpl = options.fetchImpl || (global.fetch ? global.fetch.bind(global) : null);
      this.hooks = Object.assign({}, StoryManager.defaultHooks(), options.hooks || {});
      this.resetRuntime();
    }

    static defaultHooks(){
      return {
        onChapterLoaded: () => {},
        onStateChanged: () => {},
        onDialogue: () => {},
        onChoice: () => {},
        onScene: () => {},
        onCamera: () => {},
        onEffect: () => {},
        onCollectibles: () => {},
        onRequireCollectibles: () => {},
        onMiniGameStart: () => {},
        onEnding: () => {},
        onError: error => { console.error("[StoryManager]", error); }
      };
    }

    resetRuntime(){
      this.chapter = null;
      this.sequenceMap = new Map();
      this.currentSequenceId = null;
      this.state = {
        chapterId: null,
        chapterTitle: "",
        routeFlags: {},
        collected: {},
        completedChapters: {},
        params: Object.assign({}, STORY_DEFAULT_PARAMS),
        lastMiniGame: null,
        endingId: null,
        history: []
      };
    }

    async loadManifest(manifestPath = `${this.basePath}chapter_manifest.json`){
      if(!this.fetchImpl)throw new Error("StoryManager requires fetch() or options.fetchImpl");
      const response = await this.fetchImpl(manifestPath, { cache: "no-store" });
      if(!response.ok)throw new Error(`Story manifest fetch failed: ${response.status}`);
      return response.json();
    }

    async loadChapter(chapterId){
      if(!this.fetchImpl)throw new Error("StoryManager requires fetch() or options.fetchImpl");
      const url = `${this.basePath}chapter${chapterId}.json`;
      const response = await this.fetchImpl(url, { cache: "no-store" });
      if(!response.ok)throw new Error(`Story chapter fetch failed: ${url} (${response.status})`);
      const chapter = await response.json();
      this.validateChapter(chapter);
      this.chapter = chapter;
      this.sequenceMap = new Map(chapter.startSequence.map(step => [step.id, step]));
      this.state.chapterId = chapter.chapterId;
      this.state.chapterTitle = chapter.chapterTitle;
      this.currentSequenceId = chapter.startSequence[0] && chapter.startSequence[0].id;
      this.hooks.onChapterLoaded(chapter, this.snapshot());
      this.save();
      return chapter;
    }

    validateChapter(chapter){
      if(!chapter || !Array.isArray(chapter.startSequence)){
        throw new Error("Invalid story chapter: startSequence is required");
      }
      const ids = new Set();
      chapter.startSequence.forEach(step => {
        if(!step.id || !step.type)throw new Error("Invalid story event: id and type are required");
        if(ids.has(step.id))throw new Error(`Duplicate story sequence id: ${step.id}`);
        ids.add(step.id);
      });
    }

    async startChapter(chapterId){
      await this.loadChapter(chapterId);
      return this.runCurrent();
    }

    async runCurrent(){
      if(this.state.endingId)return { type: "ending", endingId: this.state.endingId };
      if(!this.currentSequenceId)return null;
      if(this.currentSequenceId === "chapter_complete"){
        return this.completeChapter();
      }
      const event = this.sequenceMap.get(this.currentSequenceId);
      if(!event)throw new Error(`Story sequence not found: ${this.currentSequenceId}`);
      this.state.history.push({ chapterId: this.state.chapterId, sequenceId: event.id, type: event.type });
      this.applyEffects(event.effects);
      this.applyFlag(event.setFlag);

      switch(event.type){
        case "set_scene":
          return this.handleSetScene(event);
        case "camera":
          return this.handleCamera(event);
        case "dialogue":
          return this.handleDialogue(event);
        case "choice":
          return this.handleChoice(event);
        case "spawn_collectibles":
          return this.handleSpawnCollectibles(event);
        case "require_collectibles":
          return this.handleRequireCollectibles(event);
        case "trigger_minigame":
          return this.handleMiniGame(event);
        case "effect":
          return this.handleEffect(event);
        case "set_flag":
          return this.goNext(event.next);
        case "ending_check":
          return this.handleEndingCheck(event);
        case "ending":
          return this.triggerEnding(event.endingId);
        default:
          throw new Error(`Unsupported story event type: ${event.type}`);
      }
    }

    handleSetScene(event){
      this.hooks.onScene({
        season: event.season || this.chapter.season,
        timeOfDay: event.timeOfDay || this.chapter.timeOfDay,
        playerStart: event.playerStart || null
      }, this.snapshot());
      if(event.cameraAngleId)this.hooks.onCamera(event.cameraAngleId, event, this.snapshot());
      return this.goNext(event.next);
    }

    handleCamera(event){
      this.hooks.onCamera(event.cameraAngleId, event, this.snapshot());
      return this.goNext(event.next);
    }

    handleDialogue(event){
      this.hooks.onDialogue({
        speaker: event.speaker || "",
        text: event.text || "",
        event
      }, this.snapshot());
      this.save();
      return event;
    }

    handleChoice(event){
      this.hooks.onChoice({
        text: event.text || "",
        options: event.options || [],
        choose: optionIndex => this.choose(optionIndex)
      }, this.snapshot());
      this.save();
      return event;
    }

    handleSpawnCollectibles(event){
      this.hooks.onCollectibles({
        groupId: event.groupId,
        kind: event.kind,
        count: event.count || 0,
        positions: event.positions || [],
        onCollect: itemId => this.collect(event.groupId, itemId)
      }, this.snapshot());
      this.save();
      return event;
    }

    handleRequireCollectibles(event){
      const group = this.state.collected[event.groupId] || {};
      const count = Object.keys(group).length;
      const ok = count >= (event.count || 0);
      this.hooks.onRequireCollectibles({ event, count, ok }, this.snapshot());
      return this.goNext(ok ? event.successNext : event.failNext);
    }

    handleMiniGame(event){
      this.state.lastMiniGame = {
        gameMode: event.gameMode,
        eventId: event.id,
        successNext: event.successNext,
        failNext: event.failNext,
        successEffects: event.successEffects || null,
        failEffects: event.failEffects || null
      };
      this.hooks.onMiniGameStart({
        gameMode: event.gameMode,
        payload: event.payload || {},
        complete: result => this.resumeFromMiniGame(result)
      }, this.snapshot());
      this.save();
      return event;
    }

    handleEffect(event){
      this.hooks.onEffect({
        effectId: event.effectId,
        payload: event.payload || {},
        event
      }, this.snapshot());
      return this.goNext(event.next);
    }

    handleEndingCheck(event){
      const endingId = this.determineEnding(event.requirements || {});
      return this.triggerEnding(endingId);
    }

    choose(optionIndex){
      if(this.state.endingId)return { type: "ending", endingId: this.state.endingId };
      const event = this.sequenceMap.get(this.currentSequenceId);
      if(!event || event.type !== "choice")throw new Error("No active choice event");
      const option = (event.options || [])[optionIndex];
      if(!option)throw new Error(`Choice option not found: ${optionIndex}`);
      this.applyEffects(option.effects);
      if(this.state.endingId)return { type: "ending", endingId: this.state.endingId };
      this.applyFlag(option.setFlag);
      return this.goNext(option.next);
    }

    async resumeFromMiniGame(result = {}){
      const mini = this.state.lastMiniGame;
      if(!mini)throw new Error("No pending story mini game");
      const success = !!result.success;
      this.state.lastMiniGame = Object.assign({}, mini, { result });
      this.applyEffects(success ? mini.successEffects : mini.failEffects);
      if(this.state.endingId)return { type: "ending", endingId: this.state.endingId };
      if(result.effects)this.applyEffects(result.effects);
      if(this.state.endingId)return { type: "ending", endingId: this.state.endingId };
      if(result.flags)this.applyFlag(result.flags);
      return this.goNext(success ? mini.successNext : mini.failNext);
    }

    collect(groupId, itemId){
      if(!groupId || !itemId)return;
      if(!this.state.collected[groupId])this.state.collected[groupId] = {};
      this.state.collected[groupId][itemId] = true;
      this.save();
      this.hooks.onStateChanged(this.snapshot());
      const event = this.sequenceMap.get(this.currentSequenceId);
      if(event && event.type === "spawn_collectibles" && event.groupId === groupId){
        const count = Object.keys(this.state.collected[groupId]).length;
        if(count >= (event.count || 0) && event.next){
          return this.goNext(event.next);
        }
      }
      return this.snapshot();
    }

    applyEffects(effects){
      if(!effects)return;
      Object.keys(effects).forEach(key => {
        if(key in STORY_DEFAULT_PARAMS){
          const max = key === "brainErosion" ? 100 : 999;
          this.state.params[key] = clamp((this.state.params[key] || 0) + Number(effects[key] || 0), 0, max);
        }else{
          this.state.routeFlags[key] = effects[key];
        }
      });
      if(this.state.params.brainErosion >= 100){
        this.triggerEnding(STORY_ENDINGS.SPOOKY);
        return;
      }
      this.hooks.onStateChanged(this.snapshot());
      this.save();
    }

    applyFlag(flag){
      if(!flag)return;
      Object.assign(this.state.routeFlags, flag);
      this.hooks.onStateChanged(this.snapshot());
      this.save();
    }

    async goNext(nextId){
      if(this.state.endingId)return { type: "ending", endingId: this.state.endingId };
      if(!nextId)return null;
      this.currentSequenceId = nextId;
      this.save();
      return this.runCurrent();
    }

    completeChapter(){
      this.state.completedChapters[this.state.chapterId] = true;
      this.save();
      this.hooks.onStateChanged(this.snapshot());
      return { type: "chapter_complete", chapterId: this.state.chapterId };
    }

    determineEnding(requirements = {}){
      const p = this.state.params;
      const f = this.state.routeFlags;
      if(p.brainErosion >= 100)return STORY_ENDINGS.SPOOKY;
      if(f.chapter4Lost || f.chapter5Lost)return STORY_ENDINGS.BAD_GAMEOVER;

      const realityHigh = p.realityEgo >= (requirements.trueReality || 60);
      const fantasyHigh = p.fantasySynchro >= (requirements.trueFantasy || 60);
      const erosionLow = p.brainErosion <= (requirements.trueMaxErosion || 20);
      if(realityHigh && fantasyHigh && erosionLow && f.utakaiPerfect && f.oniPerfect){
        return STORY_ENDINGS.TRUE;
      }

      if(p.fantasySynchro >= p.realityEgo + (requirements.syncGap || 25)){
        return STORY_ENDINGS.BAD_SYNC;
      }

      return STORY_ENDINGS.NORMAL;
    }

    triggerEnding(endingId){
      if(this.state.endingId)return { type: "ending", endingId: this.state.endingId };
      this.state.endingId = endingId;
      this.save();
      this.hooks.onEnding(endingId, this.snapshot());
      return { type: "ending", endingId };
    }

    serialize(){
      return JSON.stringify({
        version: 1,
        currentSequenceId: this.currentSequenceId,
        state: this.state
      });
    }

    deserialize(raw){
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      if(!data || !data.state)throw new Error("Invalid story save data");
      this.state = Object.assign({}, data.state);
      this.currentSequenceId = data.currentSequenceId || null;
      return this.snapshot();
    }

    save(){
      try{
        global.localStorage.setItem(this.saveKey, this.serialize());
      }catch(error){
        this.hooks.onError(error);
      }
    }

    load(){
      try{
        const raw = global.localStorage.getItem(this.saveKey);
        if(!raw)return null;
        return this.deserialize(raw);
      }catch(error){
        this.hooks.onError(error);
        return null;
      }
    }

    clearSave(){
      try{ global.localStorage.removeItem(this.saveKey); }
      catch(error){ this.hooks.onError(error); }
    }

    snapshot(){
      return {
        chapter: this.chapter ? {
          chapterId: this.chapter.chapterId,
          chapterTitle: this.chapter.chapterTitle,
          season: this.chapter.season,
          timeOfDay: this.chapter.timeOfDay
        } : null,
        currentSequenceId: this.currentSequenceId,
        state: clonePlain(this.state)
      };
    }
  }

  StoryManager.SAVE_KEY = STORY_SAVE_KEY;
  StoryManager.DEFAULT_PARAMS = STORY_DEFAULT_PARAMS;
  StoryManager.ENDINGS = STORY_ENDINGS;

  global.StoryManager = StoryManager;
})(typeof window !== "undefined" ? window : globalThis);
