System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, _crd, PLANNED_REQUIREMENT_TYPES;

  function reqType(raw) {
    var _ref, _raw$type;

    return String((_ref = (_raw$type = raw.type) != null ? _raw$type : raw.action) != null ? _ref : '');
  }

  function isPlannedRequirementType(rtype) {
    return PLANNED_REQUIREMENT_TYPES.has(rtype);
  }

  function unknownRequirementResult(rtype, ctx) {
    ctx.onUnknownRequirement == null || ctx.onUnknownRequirement(rtype);
    return ctx.unknownRequirementPasses === true;
  }
  /** 单条 requirement；未知/planned 在 strict 模式下返回 false */


  function evaluateSingleRequirement(raw, ctx) {
    if (!raw || typeof raw !== 'object') return true;
    var req = raw;
    var rtype = reqType(req);

    if (rtype === 'event_done' || rtype === 'event_completed') {
      var _req$eventId;

      var eid = String((_req$eventId = req.eventId) != null ? _req$eventId : '');
      return !eid || ctx.isEventQuestStepComplete(eid);
    }

    if (rtype === 'task_completed' || rtype === 'task_done') {
      var _req$taskId;

      var tid = Number((_req$taskId = req.taskId) != null ? _req$taskId : 0);
      return ctx.completedTaskIds.has(tid);
    }

    if (rtype === 'task_active' || rtype === 'task_accepted') {
      var _req$taskId2;

      var _tid = Number((_req$taskId2 = req.taskId) != null ? _req$taskId2 : 0);

      if (ctx.completedTaskIds.has(_tid)) return true;
      return ctx.activeTaskIds.has(_tid) || ctx.acceptedTaskIds.has(_tid);
    }

    if (rtype === 'task_not_started') {
      var _req$taskId3;

      var _tid2 = Number((_req$taskId3 = req.taskId) != null ? _req$taskId3 : 0);

      if (ctx.completedTaskIds.has(_tid2)) return false;
      return !ctx.activeTaskIds.has(_tid2) && !ctx.acceptedTaskIds.has(_tid2);
    }

    if (rtype === 'task_failed') {
      return false;
    }

    if (rtype === 'mainline_step') {
      var _req$value;

      var need = Number((_req$value = req.value) != null ? _req$value : 0);
      return ctx.mainlineStep >= need;
    }

    if (rtype === 'level') {
      var _ref2, _req$value2;

      var _need = Number((_ref2 = (_req$value2 = req.value) != null ? _req$value2 : req.min) != null ? _ref2 : 1);

      if (ctx.playerLevel <= 0) return false;
      return ctx.playerLevel >= _need;
    }

    if (rtype === 'item_owned') {
      var _req$itemId;

      var iid = Number((_req$itemId = req.itemId) != null ? _req$itemId : 0);
      return ctx.ownedItemIds.has(iid);
    }

    if (isPlannedRequirementType(rtype)) {
      return unknownRequirementResult(rtype, ctx);
    }

    if (rtype) {
      return unknownRequirementResult(rtype, ctx);
    }

    return true;
  }

  function evaluateRequirements(reqs, ctx) {
    if (!(reqs != null && reqs.length)) return true;

    for (var raw of reqs) {
      if (!evaluateSingleRequirement(raw, ctx)) return false;
    }

    return true;
  }
  /** appear.requirements 支持 ANY 模式 */


  function evaluateAppearRequirements(reqs, matchMode, ctx) {
    if (!(reqs != null && reqs.length)) return false;

    if (matchMode === 'ANY') {
      for (var req of reqs) {
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
       *
       * 契约：仅 manifest capabilities.requirements.supported 内的 type 有完整客户端求值。
       * 未知 / planned type 在 strict 模式下返回 false（默认）；local-preview 可设 unknownPasses=true。
       */


      /** manifest v2 planned — 客户端不实现，strict 下恒 false */
      PLANNED_REQUIREMENT_TYPES = new Set(['story_var_equals', 'var_equals', 'server_var_equals', 'has_pet', 'bag_space_at_least', 'activity_switch_on']);

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=cc0e7a7b8d11e664162f3dc6ab131e9ad1d41d10.js.map