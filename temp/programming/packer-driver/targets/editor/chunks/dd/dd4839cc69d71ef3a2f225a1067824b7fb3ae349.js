System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, evaluateAppearRequirements, _crd;

  /** NPC 是否因 mainline_step 未达标而隐藏（读 tasks[].mainlineStep） */
  function isHiddenByMainlineStep(row, state) {
    var _row$events;

    if (!(row != null && (_row$events = row.events) != null && _row$events.length)) return false;
    let minStep = Number.POSITIVE_INFINITY;
    let hasStep = false;

    for (const raw of row.events) {
      const ev = raw;

      for (const req of (_ev$server$requiremen = (_ev$server = ev.server) == null ? void 0 : _ev$server.requirements) != null ? _ev$server$requiremen : []) {
        var _ev$server$requiremen, _ev$server, _ref, _r$type;

        const r = req;
        const t = String((_ref = (_r$type = r.type) != null ? _r$type : r.action) != null ? _ref : '');

        if (t === 'mainline_step') {
          var _r$value;

          hasStep = true;
          minStep = Math.min(minStep, Number((_r$value = r.value) != null ? _r$value : 0));
        }
      }
    }

    if (!hasStep) return false;
    return state.mainlineStep < minStep;
  }

  function resolveCurrentMainlineNpcUid(state) {
    for (const uid of state.storyNpcOrder) {
      if (state.isBattleEnemyNpcUid(uid)) continue;
      if (state.isNpcHiddenByAppear(uid, undefined)) continue;
      const row = {
        npcUid: uid
      };
      if (isHiddenByMainlineStep(row, state)) continue;
      if (state.hasActiveInteractEvent(uid, [])) return uid;
    }

    return null;
  }

  function isStaleMainlineGiver(npcUid, storyNpcOrder, isBattleEnemy, isHiddenByAppear, hasIncomplete, hasInteract) {
    // 仍有未完成环（含战斗交付等暂不可对话的环）时，不得被后续链挤掉
    if (hasIncomplete(npcUid)) return false;
    if (hasInteract(npcUid)) return false;
    const myIdx = storyNpcOrder.indexOf(npcUid);
    if (myIdx < 0) return false;

    for (let i = myIdx + 1; i < storyNpcOrder.length; i++) {
      const later = storyNpcOrder[i];
      if (isBattleEnemy(later)) continue;
      if (isHiddenByAppear(later)) continue;
      if (hasIncomplete(later)) return true;
    }

    return false;
  }

  function parseEnemyGiverUid(npcUid) {
    var _m$;

    const m = npcUid.match(/^(.+?)_enemy(?:_\d+)?$/);
    return (_m$ = m == null ? void 0 : m[1]) != null ? _m$ : null;
  }

  function decideNpcVisibility(npcUid, row, events, state, currentMainlineUid, isAncestorOfCurrent) {
    if (state.isBattleEnemyNpcUid(npcUid)) {
      const show = state.hasActiveInteractEvent(npcUid, events);
      return {
        visible: show,
        colliderEnabled: show,
        isCurrentMainline: false
      };
    }

    if (state.isNpcHiddenByAppear(npcUid, row)) {
      return {
        visible: false,
        colliderEnabled: false,
        isCurrentMainline: false
      };
    }

    if (isHiddenByMainlineStep(row, state)) {
      return {
        visible: false,
        colliderEnabled: false,
        isCurrentMainline: false
      };
    }

    if (!state.sequentialReveal) {
      var _events$length;

      const active = state.hasActiveInteractEvent(npcUid, events);
      return {
        visible: active || ((_events$length = events == null ? void 0 : events.length) != null ? _events$length : 0) > 0,
        colliderEnabled: active,
        isCurrentMainline: false
      };
    }

    if (currentMainlineUid === null) {
      const active = state.hasActiveInteractEvent(npcUid, events);

      if (active) {
        return {
          visible: true,
          colliderEnabled: true,
          isCurrentMainline: false
        };
      }

      return {
        visible: false,
        colliderEnabled: false,
        isCurrentMainline: false
      };
    }

    const isCurrent = npcUid === currentMainlineUid;
    const show = isCurrent || isAncestorOfCurrent;
    return {
      visible: show,
      colliderEnabled: isCurrent,
      isCurrentMainline: isCurrent
    };
  }
  /** appear 条件是否满足（不含 reveal_npc 与 initialHidden） */


  function npcAppearRequirementsMet(row, ctx) {
    const appear = row == null ? void 0 : row.appear;
    if (!appear || appear.mode !== 'conditional') return (appear == null ? void 0 : appear.mode) === 'always';
    return (_crd && evaluateAppearRequirements === void 0 ? (_reportPossibleCrUseOfevaluateAppearRequirements({
      error: Error()
    }), evaluateAppearRequirements) : evaluateAppearRequirements)(appear.requirements, appear.matchMode, ctx);
  }

  function isNpcHiddenUntilReveal(npcUid, row, revealedNpcUids, ctx) {
    var _row$appear;

    if (!row) return false;
    if (revealedNpcUids.has(npcUid)) return false;
    if (((_row$appear = row.appear) == null ? void 0 : _row$appear.mode) === 'always') return false;
    if (npcAppearRequirementsMet(row, ctx)) return false;
    if (!row.appear && !row.initialHidden) return false;
    return true;
  }

  function _reportPossibleCrUseOfevaluateAppearRequirements(extras) {
    _reporterNs.report("evaluateAppearRequirements", "./story-requirements", _context.meta, extras);
  }

  function _reportPossibleCrUseOfStoryRequirementContext(extras) {
    _reporterNs.report("StoryRequirementContext", "./story-requirements", _context.meta, extras);
  }

  _export({
    isHiddenByMainlineStep: isHiddenByMainlineStep,
    resolveCurrentMainlineNpcUid: resolveCurrentMainlineNpcUid,
    isStaleMainlineGiver: isStaleMainlineGiver,
    parseEnemyGiverUid: parseEnemyGiverUid,
    decideNpcVisibility: decideNpcVisibility,
    npcAppearRequirementsMet: npcAppearRequirementsMet,
    isNpcHiddenUntilReveal: isNpcHiddenUntilReveal
  });

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
    }, function (_unresolved_2) {
      evaluateAppearRequirements = _unresolved_2.evaluateAppearRequirements;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "879begT1BNNepyfHbRZL+j/", "story-npc-visibility", undefined);
      /**
       * NPC 可见性统一判定：appear + mainline_step + 顺序显现（RMV 条件事件页）。
       */


      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=dd4839cc69d71ef3a2f225a1067824b7fb3ae349.js.map