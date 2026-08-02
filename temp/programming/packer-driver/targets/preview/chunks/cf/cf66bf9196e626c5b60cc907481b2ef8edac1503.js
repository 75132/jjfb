System.register(["__unresolved_0", "cc"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, StoryMapModel, _crd;

  function _reportPossibleCrUseOfStoryChoiceScript(extras) {
    _reporterNs.report("StoryChoiceScript", "./StoryMapTypes", _context.meta, extras);
  }

  function _reportPossibleCrUseOfStoryDialogueScript(extras) {
    _reporterNs.report("StoryDialogueScript", "./StoryMapTypes", _context.meta, extras);
  }

  function _reportPossibleCrUseOfStoryMapJson(extras) {
    _reporterNs.report("StoryMapJson", "./StoryMapTypes", _context.meta, extras);
  }

  function _reportPossibleCrUseOfStoryNpcDef(extras) {
    _reporterNs.report("StoryNpcDef", "./StoryMapTypes", _context.meta, extras);
  }

  function _reportPossibleCrUseOfStoryNpcEvent(extras) {
    _reporterNs.report("StoryNpcEvent", "./StoryMapTypes", _context.meta, extras);
  }

  function _reportPossibleCrUseOfStoryRequirement(extras) {
    _reporterNs.report("StoryRequirement", "./StoryMapTypes", _context.meta, extras);
  }

  function _reportPossibleCrUseOfStoryLocalTaskState(extras) {
    _reporterNs.report("StoryLocalTaskState", "./StoryLocalTaskState", _context.meta, extras);
  }

  _export("StoryMapModel", void 0);

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "e8b020/XJRgK64/nVx7LzFB", "StoryMapModel", undefined);

      __checkObsolete__(['JsonAsset']);

      /**
       * 解析地图 JsonAsset，提供 NPC / 脚本索引与事件筛选。
       */
      _export("StoryMapModel", StoryMapModel = class StoryMapModel {
        constructor(jsonAsset) {
          var _jsonAsset$json, _raw$server$antiCheat, _raw$server, _raw$npcs, _raw$client$dialogueS, _raw$client, _raw$client$choiceScr, _raw$client2;

          this.raw = void 0;
          this.npcsByUid = new Map();
          this.dialogueScripts = new Map();
          this.choiceScripts = new Map();
          this.maxInteractDistance = void 0;
          var raw = (_jsonAsset$json = jsonAsset == null ? void 0 : jsonAsset.json) != null ? _jsonAsset$json : {};
          this.raw = raw;
          this.maxInteractDistance = (_raw$server$antiCheat = (_raw$server = raw.server) == null || (_raw$server = _raw$server.antiCheat) == null ? void 0 : _raw$server.maxInteractDistance) != null ? _raw$server$antiCheat : 120;
          var npcs = (_raw$npcs = raw.npcs) != null ? _raw$npcs : [];

          for (var i = 0; i < npcs.length; i++) {
            var n = npcs[i];
            if (n != null && n.npcUid) this.npcsByUid.set(n.npcUid, n);
          }

          var dc = (_raw$client$dialogueS = (_raw$client = raw.client) == null ? void 0 : _raw$client.dialogueScripts) != null ? _raw$client$dialogueS : {};
          Object.keys(dc).forEach(k => this.dialogueScripts.set(k, dc[k]));
          var cc = (_raw$client$choiceScr = (_raw$client2 = raw.client) == null ? void 0 : _raw$client2.choiceScripts) != null ? _raw$client$choiceScr : {};
          Object.keys(cc).forEach(k => this.choiceScripts.set(k, cc[k]));
        }

        requirementsMet(reqs, state) {
          for (var i = 0; i < reqs.length; i++) {
            var r = reqs[i];
            var tid = r.taskId;
            if (tid === undefined) continue;

            if (r.type === 'task_accepted') {
              if (!state.isTaskAccepted(tid)) return false;
            } else if (r.type === 'task_completed') {
              if (!state.isTaskCompleted(tid)) return false;
            }
          }

          return true;
        }
        /**
         * 按 order 取第一条：未完成 + 满足 requirements。
         */


        getFirstEligibleEvent(npcUid, state) {
          var _npc$events;

          var npc = this.npcsByUid.get(npcUid);
          if (!(npc != null && (_npc$events = npc.events) != null && _npc$events.length)) return null;
          var sorted = [...npc.events].sort((a, b) => a.order - b.order);

          for (var i = 0; i < sorted.length; i++) {
            var _ev$server$requiremen, _ev$server;

            var ev = sorted[i];
            if (state.isEventCompleted(ev.eventId)) continue;
            if (!this.requirementsMet((_ev$server$requiremen = (_ev$server = ev.server) == null ? void 0 : _ev$server.requirements) != null ? _ev$server$requiremen : [], state)) continue;
            return ev;
          }

          return null;
        }

        getDialogue(id) {
          var _this$dialogueScripts;

          if (!id) return null;
          return (_this$dialogueScripts = this.dialogueScripts.get(id)) != null ? _this$dialogueScripts : null;
        }

        getChoice(id) {
          var _this$choiceScripts$g;

          if (!id) return null;
          return (_this$choiceScripts$g = this.choiceScripts.get(id)) != null ? _this$choiceScripts$g : null;
        }

      });

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=cf66bf9196e626c5b60cc907481b2ef8edac1503.js.map