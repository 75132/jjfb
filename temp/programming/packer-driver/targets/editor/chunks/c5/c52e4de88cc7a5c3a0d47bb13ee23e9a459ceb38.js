System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, _crd, TASK_STATUS_FRAME_UUIDS;

  function npcTaskIndicatorKindToIndex(kind) {
    switch (kind) {
      case 'available':
        return 0;
      // TaskStatu1 橙 !

      case 'in_progress':
        return 1;
      // TaskStatu2 灰 ?

      case 'turn_in':
        return 2;
      // TaskStatu3 橙 ?

      case 'locked':
        return 3;
      // TaskStatu4 灰 !

      default:
        return 0;
    }
  }

  function getNpcTaskStatusFrameUuids() {
    return TASK_STATUS_FRAME_UUIDS;
  }

  function eventHasEffect(ev, action, taskId) {
    var _ev$server$effects, _ev$server;

    const effects = (_ev$server$effects = (_ev$server = ev.server) == null ? void 0 : _ev$server.effects) != null ? _ev$server$effects : [];
    return effects.some(eff => {
      var _eff$action;

      if (String((_eff$action = eff.action) != null ? _eff$action : '') !== action) return false;
      if (taskId != null && Number(eff.taskId) !== taskId) return false;
      return true;
    });
  }

  function eventIsTaskAccept(ev) {
    return (ev.eventType === 'task' || ev.eventType === 'choice') && eventHasEffect(ev, 'task_accept');
  }

  function eventIsTaskTurnIn(ev) {
    return ev.eventType === 'task' && eventHasEffect(ev, 'task_complete');
  }
  /** 本链段是否已完成接取（task_accept 环）；task_complete 完成会重置段 */


  function isCurrentSegmentAccepted(sorted, npcUid, ctx) {
    let segmentAcceptEv = null;

    for (const ev of sorted) {
      if (eventIsTaskTurnIn(ev) && ctx.isStepComplete(npcUid, ev)) {
        segmentAcceptEv = null;
        continue;
      }

      if (!ctx.isStepComplete(npcUid, ev)) {
        if (eventIsTaskAccept(ev)) return false;
        return segmentAcceptEv != null;
      }

      if (eventIsTaskAccept(ev)) {
        segmentAcceptEv = ev;
      }
    }

    return false;
  }
  /** 当前链段内第一个未完成的交付环 */


  function findCurrentSegmentTurnIn(sorted, npcUid, ctx) {
    let segmentStartOrder = 0;

    for (const ev of sorted) {
      if (eventIsTaskTurnIn(ev) && ctx.isStepComplete(npcUid, ev)) {
        var _ev$order;

        segmentStartOrder = ((_ev$order = ev.order) != null ? _ev$order : 0) + 1;
      }
    }

    for (const ev of sorted) {
      var _ev$order2;

      if (((_ev$order2 = ev.order) != null ? _ev$order2 : 0) < segmentStartOrder) continue;
      if (!eventIsTaskTurnIn(ev)) continue;
      if (!ctx.isStepComplete(npcUid, ev)) return ev;
    }

    return null;
  }

  function hasPendingTurnInRequirements(turnInEv, ctx) {
    var _turnInEv$server;

    const reqs = (_turnInEv$server = turnInEv.server) == null ? void 0 : _turnInEv$server.requirements;
    if (!(reqs != null && reqs.length)) return false;
    return !ctx.requirementsMet(reqs);
  }

  function hasIncompleteBattleBeforeTurnIn(sorted, npcUid, turnInEv, ctx) {
    var _turnInEv$order;

    const turnOrder = (_turnInEv$order = turnInEv.order) != null ? _turnInEv$order : Number.MAX_SAFE_INTEGER;

    for (const ev of sorted) {
      var _ev$order3;

      if (((_ev$order3 = ev.order) != null ? _ev$order3 : 0) >= turnOrder) break;
      if (ev.eventType !== 'battle') continue;
      if (!ctx.isStepComplete(npcUid, ev)) return true;
    }

    return false;
  }

  function isTurnInReady(sorted, npcUid, turnInEv, ctx) {
    var _turnInEv$order2;

    if (hasIncompleteBattleBeforeTurnIn(sorted, npcUid, turnInEv, ctx)) return false;
    if (hasPendingTurnInRequirements(turnInEv, ctx)) return false;
    const turnOrder = (_turnInEv$order2 = turnInEv.order) != null ? _turnInEv$order2 : Number.MAX_SAFE_INTEGER;

    for (const ev of sorted) {
      var _ev$order4;

      if (((_ev$order4 = ev.order) != null ? _ev$order4 : 0) >= turnOrder) continue;
      if (eventIsTaskTurnIn(ev)) continue;
      if (!ctx.isStepComplete(npcUid, ev)) return false;
    }

    return true;
  }

  function extractPrimaryTaskId(events) {
    for (const ev of events) {
      for (const eff of (_ev$server$effects2 = (_ev$server2 = ev.server) == null ? void 0 : _ev$server2.effects) != null ? _ev$server$effects2 : []) {
        var _ev$server$effects2, _ev$server2, _eff$action2;

        const action = String((_eff$action2 = eff.action) != null ? _eff$action2 : '');

        if (action === 'task_accept' || action === 'task_complete') {
          var _eff$taskId;

          const tid = Number((_eff$taskId = eff.taskId) != null ? _eff$taskId : 0);
          if (tid > 0) return tid;
        }
      }
    }

    return null;
  }

  function resolveNpcTaskIndicatorKind(npcUid, events, ctx) {
    var _firstIncomplete$serv;

    const list = events != null ? events : [];
    if (!list.length) return null;
    const sorted = [...list].sort((a, b) => {
      var _a$order, _b$order;

      return ((_a$order = a.order) != null ? _a$order : 0) - ((_b$order = b.order) != null ? _b$order : 0);
    });
    let firstIncomplete = null;

    for (const ev of sorted) {
      if (!ctx.isStepComplete(npcUid, ev)) {
        firstIncomplete = ev;
        break;
      }
    }

    if (!firstIncomplete) return null;
    const segmentAccepted = isCurrentSegmentAccepted(sorted, npcUid, ctx);
    const reqs = (_firstIncomplete$serv = firstIncomplete.server) == null ? void 0 : _firstIncomplete$serv.requirements;

    if (!ctx.requirementsMet(reqs)) {
      // 已接取段的交付环：战斗/前置未满足 → 灰 ?，不是灰 !
      if (segmentAccepted && eventIsTaskTurnIn(firstIncomplete)) {
        return 'in_progress';
      }

      return 'locked';
    }

    if (!segmentAccepted) {
      return 'available';
    }

    if (ctx.hasOutstandingBattlesForChain != null && ctx.hasOutstandingBattlesForChain(npcUid, list)) {
      return 'in_progress';
    }

    const turnInEv = findCurrentSegmentTurnIn(sorted, npcUid, ctx);

    if (turnInEv && isTurnInReady(sorted, npcUid, turnInEv, ctx)) {
      return 'turn_in';
    }

    return 'in_progress';
  }

  _export({
    npcTaskIndicatorKindToIndex: npcTaskIndicatorKindToIndex,
    getNpcTaskStatusFrameUuids: getNpcTaskStatusFrameUuids,
    isCurrentSegmentAccepted: isCurrentSegmentAccepted,
    extractPrimaryTaskId: extractPrimaryTaskId,
    resolveNpcTaskIndicatorKind: resolveNpcTaskIndicatorKind
  });

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "9b6f3G/jkRFSKYLPBBzbX/6", "npc-task-indicator", undefined);
      /**
       * NPC 头顶任务状态图标（TaskStatu1~4）判定逻辑
       *
       * 1 橙色 ! — 当前链段尚未接取（含对话中、已至接取选项但未点接受）
       * TaskStatu2 灰色 ? — 本链段已接取，目标/战斗未完成
       * TaskStatu3 橙色 ? — 本链段可交付（战斗与前置均已满足）
       * 4 灰色 ! — 暂不可接（前置/等级/道具等条件未满足）
       *
       * 整条链完成后返回 null → Name/Statu 隐藏（随 NPC 一起消失）
       *
       * map 内多 NPC 链共享同一 taskId 时，按「NPC 链段（segment）」判定，不用全局 active_tasks。
       */


      TASK_STATUS_FRAME_UUIDS = ['eae5753a-2ad0-41e1-a821-2701ad59fc76@f9941', 'b7957c8e-d4fa-41a3-8b9f-4f1425f75426@f9941', '515f0c27-1a6b-4a17-8ab4-8e603a6b8698@f9941', '54dde559-12b9-4ecf-80a8-f79e67e414a9@f9941'];

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=c52e4de88cc7a5c3a0d47bb13ee23e9a459ceb38.js.map