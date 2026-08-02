System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, _crd;

  function coalesceEvents(events) {
    return events != null ? events : [];
  }

  function sortedEvents(events) {
    return [...coalesceEvents(events)].sort((a, b) => {
      var _a$order, _b$order;

      return ((_a$order = a.order) != null ? _a$order : 0) - ((_b$order = b.order) != null ? _b$order : 0);
    });
  }
  /** 线性任务链：多页同时满足时取 order 最低；互斥 gating 下与 RM-MV 一致 */


  function resolveActiveEventPage(npcUid, events, ctx) {
    if (!coalesceEvents(events).length) return null;
    var best = null;
    var bestOrder = Number.MAX_SAFE_INTEGER;

    for (var _ev of sortedEvents(events)) {
      var _ev$server, _ev$order;

      if (ctx.isStepComplete(npcUid, _ev)) continue;
      if (!ctx.requirementsMet((_ev$server = _ev.server) == null ? void 0 : _ev$server.requirements)) continue;
      var ord = (_ev$order = _ev.order) != null ? _ev$order : 0;

      if (ord < bestOrder) {
        best = _ev;
        bestOrder = ord;
      }
    }

    return best;
  }

  function pickInteractEvent(npcUid, events, ctx) {
    return resolveActiveEventPage(npcUid, events, ctx);
  }

  function npcAppearRequirementsMet(appear, initialHidden, requirementsMet) {
    var _appear$mode, _appear$requirements;

    if ((appear == null ? void 0 : appear.mode) === 'always') return true;
    if (!appear && initialHidden === false) return true;
    if (!appear && initialHidden !== true) return true;
    var mode = (_appear$mode = appear == null ? void 0 : appear.mode) != null ? _appear$mode : initialHidden ? 'conditional' : 'always';
    if (mode !== 'conditional') return mode === 'always';
    var reqs = (_appear$requirements = appear == null ? void 0 : appear.requirements) != null ? _appear$requirements : [];
    if (!reqs.length) return false;
    var matchAny = (appear == null ? void 0 : appear.matchMode) === 'ANY';

    if (matchAny) {
      return reqs.some(r => requirementsMet([r]));
    }

    return reqs.every(r => requirementsMet([r]));
  }

  function shouldNpcBeVisibleOnMap(row, requirementsMet) {
    if (!row) return false;
    return npcAppearRequirementsMet(row.appear, row.initialHidden, requirementsMet);
  }

  function isBattleEnemyNpcUid(npcUid) {
    return npcUid.endsWith('_enemy') || /_enemy_\d+$/.test(npcUid);
  }

  function npcHasActiveStoryPage(npcUid, events, ctx) {
    return resolveActiveEventPage(npcUid, events, ctx) !== null;
  }

  _export({
    coalesceEvents: coalesceEvents,
    resolveActiveEventPage: resolveActiveEventPage,
    pickInteractEvent: pickInteractEvent,
    npcAppearRequirementsMet: npcAppearRequirementsMet,
    shouldNpcBeVisibleOnMap: shouldNpcBeVisibleOnMap,
    isBattleEnemyNpcUid: isBattleEnemyNpcUid,
    npcHasActiveStoryPage: npcHasActiveStoryPage
  });

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "cc784pGMjJPcIFbdvG1WIoE", "story-event-page-resolver", undefined);
      /**
       * RM-MV Event Page 解析（与 Juben/src/editor/story-event-page-resolver.ts 保持逻辑一致）
       */


      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=802b07c7d1881ac4bbbccb2f0aa5dcaf92b4eca2.js.map