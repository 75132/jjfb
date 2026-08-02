System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, _crd, STORAGE_PREFIX;

  function localStoryStorageKey(mapCode, characterId) {
    const cid = characterId == null ? void 0 : characterId.trim();
    return `${STORAGE_PREFIX}${mapCode}${cid ? `_${cid}` : ''}`;
  }

  function loadLocalStoryPersist(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  function saveLocalStoryPersist(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      /* ignore quota / private mode */
    }
  }

  function clearLocalStoryPersist(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  /** 从 map JSON 的 server.effects 构造与 story_event_complete 同形的 applied_effects */


  function buildLocalCompletePayload(ev, choiceId) {
    const applied = [];

    for (const raw of (_ev$server$effects = (_ev$server = ev.server) == null ? void 0 : _ev$server.effects) != null ? _ev$server$effects : []) {
      var _ev$server$effects, _ev$server, _eff$choiceId;

      if (!raw || typeof raw !== 'object') continue;
      const eff = raw;
      const effChoice = String((_eff$choiceId = eff.choiceId) != null ? _eff$choiceId : '').trim();
      if (effChoice && choiceId && effChoice !== choiceId) continue;
      applied.push({ ...eff
      });
    }

    return {
      applied_effects: applied
    };
  }

  _export({
    localStoryStorageKey: localStoryStorageKey,
    loadLocalStoryPersist: loadLocalStoryPersist,
    saveLocalStoryPersist: saveLocalStoryPersist,
    clearLocalStoryPersist: clearLocalStoryPersist,
    buildLocalCompletePayload: buildLocalCompletePayload
  });

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "f9668cBS/pKn70LY2QupytQ", "story-local-mode", undefined);
      /** 本地剧情模式：不依赖 story_get_state / story_interact / story_event_complete。
       * resetLocalStoryOnEnter（StoryManager 默认 true）：每次进场景清进度，方便测试。
       */


      STORAGE_PREFIX = 'jjfb_story_local_';

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=c7ae45a84322816fb2e6568892b601d7cef42659.js.map