System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, _crd;

  function reqType(raw) {
    var _ref, _raw$type;

    return String((_ref = (_raw$type = raw.type) != null ? _raw$type : raw.action) != null ? _ref : '');
  }
  /** 单条 requirement；未知 type 在 debug 下 warn 且视为通过（避免卡死整条链） */


  function evaluateSingleRequirement(raw, ctx) {
    if (!raw || typeof raw !== 'object') return true;
    const req = raw;
    const rtype = reqType(req);

    if (rtype === 'event_done' || rtype === 'event_completed') {
      var _req$eventId;

      const eid = String((_req$eventId = req.eventId) != null ? _req$eventId : '');
      return !eid || ctx.isEventQuestStepComplete(eid);
    }

    if (rtype === 'task_completed' || rtype === 'task_done') {
      var _req$taskId;

      const tid = Number((_req$taskId = req.taskId) != null ? _req$taskId : 0);
      return ctx.completedTaskIds.has(tid);
    }

    if (rtype === 'task_active' || rtype === 'task_accepted') {
      var _req$taskId2;

      const tid = Number((_req$taskId2 = req.taskId) != null ? _req$taskId2 : 0);
      if (ctx.completedTaskIds.has(tid)) return true;
      return ctx.activeTaskIds.has(tid) || ctx.acceptedTaskIds.has(tid);
    }

    if (rtype === 'task_not_started') {
      var _req$taskId3;

      const tid = Number((_req$taskId3 = req.taskId) != null ? _req$taskId3 : 0);
      if (ctx.completedTaskIds.has(tid)) return false;
      return !ctx.activeTaskIds.has(tid) && !ctx.acceptedTaskIds.has(tid);
    }

    if (rtype === 'task_failed') {
      return false;
    }

    if (rtype === 'mainline_step') {
      var _req$value;

      const need = Number((_req$value = req.value) != null ? _req$value : 0);
      return ctx.mainlineStep >= need;
    }

    if (rtype === 'level') {
      var _ref2, _req$value2;

      const need = Number((_ref2 = (_req$value2 = req.value) != null ? _req$value2 : req.min) != null ? _ref2 : 1);
      if (ctx.playerLevel <= 0) return false;
      return ctx.playerLevel >= need;
    }

    if (rtype === 'item_owned') {
      var _req$itemId;

      const iid = Number((_req$itemId = req.itemId) != null ? _req$itemId : 0);
      return ctx.ownedItemIds.has(iid);
    }

    if (rtype === 'story_var_equals' || rtype === 'var_equals') {
      if (ctx.debugLog) ctx.onUnknownRequirement == null || ctx.onUnknownRequirement(rtype);
      return true;
    }

    if (rtype) {
      ctx.onUnknownRequirement == null || ctx.onUnknownRequirement(rtype);
    }

    return true;
  }

  function evaluateRequirements(reqs, ctx) {
    if (!(reqs != null && reqs.length)) return true;

    for (const raw of reqs) {
      if (!evaluateSingleRequirement(raw, ctx)) return false;
    }

    return true;
  }
  /** appear.requirements 支持 ANY 模式 */


  function evaluateAppearRequirements(reqs, matchMode, ctx) {
    if (!(reqs != null && reqs.length)) return false;

    if (matchMode === 'ANY') {
      for (const req of reqs) {
        if (evaluateSingleRequirement(req, ctx)) return true;
      }

      return false;
    }

    return evaluateRequirements(reqs, ctx);
  }

  _export({
    evaluateSingleRequirement: evaluateSingleRequirement,
    evaluateRequirements: evaluateRequirements,
    evaluateAppearRequirements: evaluateAppearRequirements
  });

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "f57d9wwjoNGKZWvR3dub6rV", "story-requirements", undefined);
      /**
       * 剧情 requirement 求值（对齐 server/services/story_service.py check_requirements）。
       */


      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=cc0e7a7b8d11e664162f3dc6ab131e9ad1d41d10.js.map