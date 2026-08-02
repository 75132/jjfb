System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, isBattleEnemyNpcUid, _crd;

  function eventHasTaskAccept(ev) {
    var _ev$server;

    return Boolean((_ev$server = ev.server) == null || (_ev$server = _ev$server.effects) == null ? void 0 : _ev$server.some(e => e.action === 'task_accept'));
  }

  function eventHasTaskComplete(ev) {
    var _ev$server2;

    return Boolean((_ev$server2 = ev.server) == null || (_ev$server2 = _ev$server2.effects) == null ? void 0 : _ev$server2.some(e => e.action === 'task_complete'));
  }

  function eventDoneCount(reqs) {
    return reqs.filter(r => {
      var _type;

      const t = (_type = r.type) != null ? _type : '';
      return t === 'event_done' || t === 'event_completed';
    }).length;
  }

  function hasEventDoneFor(reqs, eventId) {
    return reqs.some(r => {
      var _x$type;

      const x = r;
      const t = (_x$type = x.type) != null ? _x$type : '';
      return (t === 'event_done' || t === 'event_completed') && x.eventId === eventId;
    });
  }

  function shouldSkipSequentialInject(ev) {
    var _ev$server$requiremen, _ev$server3;

    const reqs = (_ev$server$requiremen = (_ev$server3 = ev.server) == null ? void 0 : _ev$server3.requirements) != null ? _ev$server$requiremen : [];
    const edCount = eventDoneCount(reqs);
    if (edCount >= 2) return true;
    if (eventHasTaskComplete(ev) && edCount >= 1) return true;
    return false;
  }
  /** 为线性链补「上一步 event_done」，避免多页空 requirements 时跳页 */


  function injectSequentialEventRequirements(events) {
    const list = events != null ? events : [];
    if (list.length < 2) return 0;
    const sorted = [...list].sort((a, b) => {
      var _a$order, _b$order;

      return ((_a$order = a.order) != null ? _a$order : 0) - ((_b$order = b.order) != null ? _b$order : 0);
    });
    let fixed = 0;
    let prevId = null;

    for (const ev of sorted) {
      var _ev$eventId;

      const curId = (_ev$eventId = ev.eventId) != null ? _ev$eventId : null;

      if (!prevId) {
        prevId = curId;
        continue;
      }

      if (!shouldSkipSequentialInject(ev)) {
        var _ev$server$requiremen2, _ev$server4;

        const reqs = [...((_ev$server$requiremen2 = (_ev$server4 = ev.server) == null ? void 0 : _ev$server4.requirements) != null ? _ev$server$requiremen2 : [])];

        if (!hasEventDoneFor(reqs, prevId)) {
          var _ev$server5;

          ev.server = (_ev$server5 = ev.server) != null ? _ev$server5 : {};
          ev.server.requirements = [{
            type: 'event_done',
            eventId: prevId
          }, ...reqs];
          fixed += 1;
        }
      }

      if (curId) prevId = curId;
    }

    return fixed;
  }

  function resolveTurnInEventId(events) {
    var _sort$0$eventId, _sort$;

    const turnIns = events.filter(e => eventHasTaskComplete(e));
    if (!turnIns.length) return null;
    return (_sort$0$eventId = (_sort$ = [...turnIns].sort((a, b) => {
      var _a$server$requirement, _a$server, _b$server$requirement, _b$server;

      const ca = ((_a$server$requirement = (_a$server = a.server) == null ? void 0 : _a$server.requirements) != null ? _a$server$requirement : []).filter(r => r.type === 'event_done').length;
      const cb = ((_b$server$requirement = (_b$server = b.server) == null ? void 0 : _b$server.requirements) != null ? _b$server$requirement : []).filter(r => r.type === 'event_done').length;
      return cb - ca;
    })[0]) == null ? void 0 : _sort$.eventId) != null ? _sort$0$eventId : null;
  }

  function chainIndex(uid) {
    const m = uid.match(/chain_(\d+)/);
    return m ? Number(m[1]) : null;
  }

  function stripDuplicateGiverEventPages(events) {
    const list = events != null ? events : [];
    if (list.length < 2) return list;
    const sorted = [...list].sort((a, b) => {
      var _a$order2, _b$order2;

      return ((_a$order2 = a.order) != null ? _a$order2 : 0) - ((_b$order2 = b.order) != null ? _b$order2 : 0);
    });
    const firstAccept = sorted.find(e => eventHasTaskAccept(e));
    const turnIns = sorted.filter(e => eventHasTaskComplete(e));
    const canonicalTurnIn = turnIns.length > 0 ? [...turnIns].sort((a, b) => {
      var _a$server$requirement2, _a$server2, _b$server$requirement2, _b$server2;

      const ca = ((_a$server$requirement2 = (_a$server2 = a.server) == null ? void 0 : _a$server2.requirements) != null ? _a$server$requirement2 : []).filter(r => r.type === 'event_done').length;
      const cb = ((_b$server$requirement2 = (_b$server2 = b.server) == null ? void 0 : _b$server2.requirements) != null ? _b$server$requirement2 : []).filter(r => r.type === 'event_done').length;
      return cb - ca;
    })[0] : null;
    const drop = new Set();

    if (firstAccept != null && firstAccept.eventId) {
      for (const e of sorted) {
        if (e.eventId === firstAccept.eventId) continue;
        if (eventHasTaskAccept(e) && e.eventId) drop.add(e.eventId);
      }
    }

    if (canonicalTurnIn != null && canonicalTurnIn.eventId) {
      for (const e of turnIns) {
        if (e.eventId && e.eventId !== canonicalTurnIn.eventId) drop.add(e.eventId);
      }
    }

    if (!drop.size) return list;
    return list.filter(e => !e.eventId || !drop.has(e.eventId));
  }

  function patchTrailingDialogRequirements(events) {
    var _sorted$find$order, _sorted$find;

    const sorted = [...events].sort((a, b) => {
      var _a$order3, _b$order3;

      return ((_a$order3 = a.order) != null ? _a$order3 : 0) - ((_b$order3 = b.order) != null ? _b$order3 : 0);
    });
    const turnInId = resolveTurnInEventId(sorted);
    if (!turnInId) return 0;
    const turnInOrder = (_sorted$find$order = (_sorted$find = sorted.find(e => e.eventId === turnInId)) == null ? void 0 : _sorted$find.order) != null ? _sorted$find$order : 0;
    let fixed = 0;

    for (const ev of sorted) {
      var _ev$server6, _ev$order, _ev$server7;

      if (ev.eventType !== 'dialog') continue;
      if ((_ev$server6 = ev.server) != null && (_ev$server6 = _ev$server6.requirements) != null && _ev$server6.length) continue;
      if (((_ev$order = ev.order) != null ? _ev$order : 0) <= turnInOrder) continue;
      ev.server = (_ev$server7 = ev.server) != null ? _ev$server7 : {};
      ev.server.requirements = [{
        type: 'event_done',
        eventId: turnInId
      }];
      fixed += 1;
    }

    return fixed;
  }

  function sanitizeStoryNpcRows(npcs) {
    const report = {
      duplicatePagesRemoved: 0,
      appearRefsFixed: 0,
      trailingDialogReqsFixed: 0,
      sequentialReqsInjected: 0
    };
    const knownEventIds = new Set();

    for (const npc of npcs) {
      var _npc$npcUid, _npc$events$length, _npc$events;

      const uid = (_npc$npcUid = npc.npcUid) != null ? _npc$npcUid : '';
      if (!uid || (_crd && isBattleEnemyNpcUid === void 0 ? (_reportPossibleCrUseOfisBattleEnemyNpcUid({
        error: Error()
      }), isBattleEnemyNpcUid) : isBattleEnemyNpcUid)(uid)) continue;
      const before = (_npc$events$length = (_npc$events = npc.events) == null ? void 0 : _npc$events.length) != null ? _npc$events$length : 0;
      let events = stripDuplicateGiverEventPages(npc.events);
      report.sequentialReqsInjected += injectSequentialEventRequirements(events);
      report.trailingDialogReqsFixed += patchTrailingDialogRequirements(events);

      if (events.length < before) {
        report.duplicatePagesRemoved += before - events.length;
      }

      npc.events = events;
    }

    for (const npc of npcs) {
      for (const ev of (_npc$events2 = npc.events) != null ? _npc$events2 : []) {
        var _npc$events2;

        if (ev.eventId) knownEventIds.add(ev.eventId);
      }
    }

    for (const npc of npcs) {
      var _npc$appear, _prev$events;

      const reqs = (_npc$appear = npc.appear) == null ? void 0 : _npc$appear.requirements;
      if (!(reqs != null && reqs.length) || !npc.npcUid) continue;
      const idx = chainIndex(npc.npcUid);
      if (!idx || idx <= 1) continue;
      const prev = npcs.find(n => {
        var _n$npcUid, _n$npcUid2;

        return ((_n$npcUid = n.npcUid) == null ? void 0 : _n$npcUid.includes(`chain_${idx - 1}`)) && !(_crd && isBattleEnemyNpcUid === void 0 ? (_reportPossibleCrUseOfisBattleEnemyNpcUid({
          error: Error()
        }), isBattleEnemyNpcUid) : isBattleEnemyNpcUid)((_n$npcUid2 = n.npcUid) != null ? _n$npcUid2 : '');
      });
      const fallback = prev ? resolveTurnInEventId((_prev$events = prev.events) != null ? _prev$events : []) : null;
      if (!fallback) continue;

      for (const req of reqs) {
        if (req.type !== 'event_done' || !req.eventId) continue;
        if (knownEventIds.has(req.eventId)) continue;
        req.eventId = fallback;
        report.appearRefsFixed += 1;
        knownEventIds.add(fallback);
      }
    }

    return report;
  }

  function _reportPossibleCrUseOfisBattleEnemyNpcUid(extras) {
    _reporterNs.report("isBattleEnemyNpcUid", "./story-event-page-resolver", _context.meta, extras);
  }

  function _reportPossibleCrUseOfStoryEventLike(extras) {
    _reporterNs.report("StoryEventLike", "./story-event-page-resolver", _context.meta, extras);
  }

  _export({
    injectSequentialEventRequirements: injectSequentialEventRequirements,
    stripDuplicateGiverEventPages: stripDuplicateGiverEventPages,
    sanitizeStoryNpcRows: sanitizeStoryNpcRows
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

      _cclegacy._RF.push({}, "c6470sofOtP1oU5mwGNJA9B", "story-map-sanitize", undefined);
      /**
       * 运行时 map JSON 清洗：剥离重复接取/交任务页，修正无效的 appear event_done 引用。
       */


      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=80e12748b41268eb86b3c9a1f9938172d13afe96.js.map