System.register(["__unresolved_0", "cc"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, _crd;

  function evaluateStoryRequirements(reqs, progress, isEventIdComplete) {
    if (!(reqs != null && reqs.length)) return true;

    var _loop = function _loop() {
      var _ref, _req$type;

      var req = raw;
      var rtype = String((_ref = (_req$type = req.type) != null ? _req$type : req.action) != null ? _ref : '');

      if (rtype === 'event_done' || rtype === 'event_completed') {
        var _req$eventId;

        var eid = String((_req$eventId = req.eventId) != null ? _req$eventId : '');
        if (eid && !isEventIdComplete(eid)) return {
          v: false
        };
      } else if (rtype === 'task_completed' || rtype === 'task_done') {
        var _req$taskId;

        var tid = Number((_req$taskId = req.taskId) != null ? _req$taskId : 0);
        if (!progress.completedTaskIds.has(tid)) return {
          v: false
        };
      } else if (rtype === 'task_active' || rtype === 'task_accepted') {
        var _req$taskId2;

        var _tid = Number((_req$taskId2 = req.taskId) != null ? _req$taskId2 : 0);

        if (progress.completedTaskIds.has(_tid)) return {
          v: false
        };
        var active = progress.activeTasks.some(t => Number(t.taskId) === _tid);
        if (active || progress.acceptedTaskIds.has(_tid)) return 0; // continue

        return {
          v: false
        };
      } else if (rtype === 'task_not_started') {
        var _req$taskId3;

        var _tid2 = Number((_req$taskId3 = req.taskId) != null ? _req$taskId3 : 0);

        if (progress.completedTaskIds.has(_tid2)) return {
          v: false
        };

        var _active = progress.activeTasks.some(t => Number(t.taskId) === _tid2);

        if (_active) return {
          v: false
        };
      } else if (rtype === 'task_failed') {
        return {
          v: false
        };
      } else if (rtype === 'mainline_step') {
        var _req$value;

        var need = Number((_req$value = req.value) != null ? _req$value : 0);
        if (progress.mainlineStep < need) return {
          v: false
        };
      } else if (rtype === 'story_var_equals' || rtype === 'var_equals') {
        return {
          v: false
        };
      }
    },
        _ret;

    for (var raw of reqs) {
      _ret = _loop();
      if (_ret === 0) continue;
      if (_ret) return _ret.v;
    }

    return true;
  }

  function buildStoryEventPageContext(progress, deps) {
    return {
      stableEventId: deps.stableEventId,
      isStepComplete: deps.isQuestStepComplete,
      requirementsMet: reqs => evaluateStoryRequirements(reqs, progress, deps.isEventIdQuestStepComplete)
    };
  }

  function isEventDoneInProgress(eventId, progress) {
    return progress.localCompletedEventIds.has(eventId) || progress.serverCompletedEventIds.has(eventId);
  }

  function _reportPossibleCrUseOfStoryEventLike(extras) {
    _reporterNs.report("StoryEventLike", "./story-event-page-resolver", _context.meta, extras);
  }

  function _reportPossibleCrUseOfStoryEventPageContext(extras) {
    _reporterNs.report("StoryEventPageContext", "./story-event-page-resolver", _context.meta, extras);
  }

  _export({
    evaluateStoryRequirements: evaluateStoryRequirements,
    buildStoryEventPageContext: buildStoryEventPageContext,
    isEventDoneInProgress: isEventDoneInProgress
  });

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "491d19ZZqNPk6yanMOpJIoo", "story-progress-store", undefined);
      /**
       * 剧情进度镜像（与 story_get_state payload 同形），供 Event Page 解析与 requirements 判定。
       */


      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=8064b2077a400f8cad1b3d82f425ef90fc49be64.js.map