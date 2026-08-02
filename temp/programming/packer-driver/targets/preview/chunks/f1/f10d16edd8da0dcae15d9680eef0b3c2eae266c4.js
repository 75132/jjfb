System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, isBattleEnemyNpcUid, _crd, STORY_RUNTIME_VERSION;

  function chainIndexFromNpcUid(npcUid) {
    var m = npcUid.match(/chain_(\d+)/);
    return m ? Number(m[1]) : null;
  }

  function findPriorMainlineGiverUid(npcUid, rows) {
    var _prior$npcUid;

    var idx = chainIndexFromNpcUid(npcUid);
    if (!idx || idx <= 1) return null;
    var want = "chain_" + (idx - 1);
    var prior = rows.find(r => r.npcUid && !(_crd && isBattleEnemyNpcUid === void 0 ? (_reportPossibleCrUseOfisBattleEnemyNpcUid({
      error: Error()
    }), isBattleEnemyNpcUid) : isBattleEnemyNpcUid)(r.npcUid) && r.npcUid.includes(want) && !r.npcUid.includes('_enemy'));
    return (_prior$npcUid = prior == null ? void 0 : prior.npcUid) != null ? _prior$npcUid : null;
  }

  function isGiverChainFullyComplete(npcUid, events, isStepComplete) {
    var list = events != null ? events : [];
    if (!list.length) return true;
    return list.every(ev => isStepComplete(npcUid, ev));
  }
  /** true = 仍应隐藏（上一幕主线未清完） */


  function isBlockedByPriorMainlineGiver(npcUid, rows, isStepComplete) {
    var _prior$events;

    if ((_crd && isBattleEnemyNpcUid === void 0 ? (_reportPossibleCrUseOfisBattleEnemyNpcUid({
      error: Error()
    }), isBattleEnemyNpcUid) : isBattleEnemyNpcUid)(npcUid)) return false;
    var priorUid = findPriorMainlineGiverUid(npcUid, rows);
    if (!priorUid) return false;
    var prior = rows.find(r => r.npcUid === priorUid);
    if (!prior) return false;
    return !isGiverChainFullyComplete(priorUid, (_prior$events = prior.events) != null ? _prior$events : [], isStepComplete);
  }

  function _reportPossibleCrUseOfisBattleEnemyNpcUid(extras) {
    _reporterNs.report("isBattleEnemyNpcUid", "./story-event-page-resolver", _context.meta, extras);
  }

  function _reportPossibleCrUseOfStoryEventLike(extras) {
    _reporterNs.report("StoryEventLike", "./story-event-page-resolver", _context.meta, extras);
  }

  _export({
    chainIndexFromNpcUid: chainIndexFromNpcUid,
    findPriorMainlineGiverUid: findPriorMainlineGiverUid,
    isGiverChainFullyComplete: isGiverChainFullyComplete,
    isBlockedByPriorMainlineGiver: isBlockedByPriorMainlineGiver
  });

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
    }, function (_unresolved_2) {
      isBattleEnemyNpcUid = _unresolved_2.isBattleEnemyNpcUid;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "a8f3eLRS1xtfo+QobLD1OX2", "story-mainline-gate", undefined);
      /**
       * 主线任务官出现门禁：第 N 幕任务官必须等第 N-1 幕 **全部事件完成** 后才可出现在地图上。
       * 仅约束 giver（非 _enemy）；与 JSON appear 条件 AND 生效。
       */


      _export("STORY_RUNTIME_VERSION", STORY_RUNTIME_VERSION = '2026-07-04-audit-v4');

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=f10d16edd8da0dcae15d9680eef0b3c2eae266c4.js.map