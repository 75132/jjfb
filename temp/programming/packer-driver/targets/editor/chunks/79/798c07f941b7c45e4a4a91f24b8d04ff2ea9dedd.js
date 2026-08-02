System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, BoxCollider2D, isBattleEnemyNpcUid, npcAppearRequirementsMet, pickInteractEvent, _crd;

  function pickEnemyInteractEvent(npcUid, events, pageCtx) {
    const list = events != null ? events : [];
    const active = (_crd && pickInteractEvent === void 0 ? (_reportPossibleCrUseOfpickInteractEvent({
      error: Error()
    }), pickInteractEvent) : pickInteractEvent)(npcUid, list, pageCtx);
    if (active) return active;
    const sorted = [...list].sort((a, b) => {
      var _a$order, _b$order;

      return ((_a$order = a.order) != null ? _a$order : 0) - ((_b$order = b.order) != null ? _b$order : 0);
    });

    for (const ev of sorted) {
      var _ev$server;

      if (pageCtx.isStepComplete(npcUid, ev)) continue;
      if (pageCtx.requirementsMet((_ev$server = ev.server) == null ? void 0 : _ev$server.requirements)) return ev;
    }

    return null;
  }

  function isNpcHiddenUntilReveal(row, revealed, requirementsMet) {
    if (!row) return false;
    if (revealed) return false;
    if ((_crd && npcAppearRequirementsMet === void 0 ? (_reportPossibleCrUseOfnpcAppearRequirementsMet({
      error: Error()
    }), npcAppearRequirementsMet) : npcAppearRequirementsMet)(row.appear, row.initialHidden, requirementsMet)) return false;
    if (!row.appear && !row.initialHidden) return false;
    return true;
  }

  function syncStoryNpcDisplay(opts) {
    const {
      rows,
      pageCtx,
      sequentialGate,
      activationNpcUid,
      resolveFocusUid,
      isNpcHidden
    } = opts;
    const focusUid = sequentialGate ? resolveFocusUid() : null;

    for (const row of rows) {
      var _row$node;

      if (!((_row$node = row.node) != null && _row$node.isValid)) continue;
      row.node.active = !isNpcHidden(row.npcUid);
    }

    for (const row of rows) {
      var _row$node2;

      if (!((_row$node2 = row.node) != null && _row$node2.isValid)) continue;
      const bc = row.node.getComponent(BoxCollider2D);
      if (!bc) continue;

      if (!row.node.active) {
        bc.enabled = false;
        continue;
      }

      if ((_crd && isBattleEnemyNpcUid === void 0 ? (_reportPossibleCrUseOfisBattleEnemyNpcUid({
        error: Error()
      }), isBattleEnemyNpcUid) : isBattleEnemyNpcUid)(row.npcUid)) {
        bc.enabled = true;
        continue;
      }

      if (!sequentialGate) {
        var _row$events;

        const page = (_crd && pickInteractEvent === void 0 ? (_reportPossibleCrUseOfpickInteractEvent({
          error: Error()
        }), pickInteractEvent) : pickInteractEvent)(row.npcUid, (_row$events = row.events) != null ? _row$events : [], pageCtx);
        bc.enabled = page !== null || activationNpcUid === row.npcUid;
        continue;
      }

      if (activationNpcUid === row.npcUid) {
        bc.enabled = true;
        continue;
      }

      if ((_crd && isBattleEnemyNpcUid === void 0 ? (_reportPossibleCrUseOfisBattleEnemyNpcUid({
        error: Error()
      }), isBattleEnemyNpcUid) : isBattleEnemyNpcUid)(row.npcUid)) {
        bc.enabled = (_crd && pickInteractEvent === void 0 ? (_reportPossibleCrUseOfpickInteractEvent({
          error: Error()
        }), pickInteractEvent) : pickInteractEvent)(row.npcUid, row.events, pageCtx) !== null;
        continue;
      }

      bc.enabled = focusUid !== null && row.npcUid === focusUid;
    }
  }

  function canPlayerInteractWithNpc(npcUid, rows, pageCtx, sequentialGate, activationNpcUid, resolveFocusUid) {
    const evs = row => {
      var _row$events2;

      return (_row$events2 = row == null ? void 0 : row.events) != null ? _row$events2 : [];
    };

    if (!sequentialGate) {
      var _row$node3;

      const row = rows.find(r => r.npcUid === npcUid);
      if (!(row != null && (_row$node3 = row.node) != null && _row$node3.active)) return false;

      if ((_crd && isBattleEnemyNpcUid === void 0 ? (_reportPossibleCrUseOfisBattleEnemyNpcUid({
        error: Error()
      }), isBattleEnemyNpcUid) : isBattleEnemyNpcUid)(npcUid)) {
        if (activationNpcUid === npcUid) return true;
        return evs(row).some(ev => !pageCtx.isStepComplete(npcUid, ev));
      }

      return (_crd && pickInteractEvent === void 0 ? (_reportPossibleCrUseOfpickInteractEvent({
        error: Error()
      }), pickInteractEvent) : pickInteractEvent)(npcUid, evs(row), pageCtx) !== null || activationNpcUid === npcUid;
    }

    if (activationNpcUid === npcUid) return true;

    if ((_crd && isBattleEnemyNpcUid === void 0 ? (_reportPossibleCrUseOfisBattleEnemyNpcUid({
      error: Error()
    }), isBattleEnemyNpcUid) : isBattleEnemyNpcUid)(npcUid)) {
      var _row$node4;

      const row = rows.find(r => r.npcUid === npcUid);
      if (!(row != null && (_row$node4 = row.node) != null && _row$node4.active)) return false;
      return evs(row).some(ev => !pageCtx.isStepComplete(npcUid, ev));
    }

    return resolveFocusUid() === npcUid;
  }

  function _reportPossibleCrUseOfisBattleEnemyNpcUid(extras) {
    _reporterNs.report("isBattleEnemyNpcUid", "./story-event-page-resolver", _context.meta, extras);
  }

  function _reportPossibleCrUseOfnpcAppearRequirementsMet(extras) {
    _reporterNs.report("npcAppearRequirementsMet", "./story-event-page-resolver", _context.meta, extras);
  }

  function _reportPossibleCrUseOfpickInteractEvent(extras) {
    _reporterNs.report("pickInteractEvent", "./story-event-page-resolver", _context.meta, extras);
  }

  function _reportPossibleCrUseOfStoryEventLike(extras) {
    _reporterNs.report("StoryEventLike", "./story-event-page-resolver", _context.meta, extras);
  }

  function _reportPossibleCrUseOfStoryEventPageContext(extras) {
    _reporterNs.report("StoryEventPageContext", "./story-event-page-resolver", _context.meta, extras);
  }

  function _reportPossibleCrUseOfStoryNpcAppear(extras) {
    _reporterNs.report("StoryNpcAppear", "./story-event-page-resolver", _context.meta, extras);
  }

  _export({
    pickEnemyInteractEvent: pickEnemyInteractEvent,
    isNpcHiddenUntilReveal: isNpcHiddenUntilReveal,
    syncStoryNpcDisplay: syncStoryNpcDisplay,
    canPlayerInteractWithNpc: canPlayerInteractWithNpc
  });

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      BoxCollider2D = _cc.BoxCollider2D;
    }, function (_unresolved_2) {
      isBattleEnemyNpcUid = _unresolved_2.isBattleEnemyNpcUid;
      npcAppearRequirementsMet = _unresolved_2.npcAppearRequirementsMet;
      pickInteractEvent = _unresolved_2.pickInteractEvent;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "1116cUsjJNLLbXa+wKgLgMf", "story-npc-display", undefined);
      /**
       * NPC 地图显隐与碰撞：appear 管 sprite；可选 sequential 仅限制碰撞体。
       */


      __checkObsolete__(['BoxCollider2D', 'Node']);

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=798c07f941b7c45e4a4a91f24b8d04ff2ea9dedd.js.map