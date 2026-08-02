System.register(["__unresolved_0", "cc"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, sys, StoryLocalTaskState, _crd, STORAGE_PREFIX;

  function _reportPossibleCrUseOfStoryEffect(extras) {
    _reporterNs.report("StoryEffect", "./StoryMapTypes", _context.meta, extras);
  }

  _export("StoryLocalTaskState", void 0);

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      sys = _cc.sys;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "d9c135AbaVxPK5Arm2MS1Ni", "StoryLocalTaskState", undefined);

      __checkObsolete__(['sys']);

      STORAGE_PREFIX = 'story_mvp_state_v1';

      /**
       * 本地剧情进度（任务接取/完成、已完成事件 ID）。
       * 将来应由服务器权威存档接管；当前仅用于 MVP 跑通主线。
       */
      _export("StoryLocalTaskState", StoryLocalTaskState = class StoryLocalTaskState {
        constructor(mapCode, persistToStorage) {
          this._accepted = new Set();
          this._completed = new Set();
          this._completedEvents = new Set();
          this.mapCode = mapCode;
          this.persistToStorage = persistToStorage;
          if (this.persistToStorage) this.load();
        }

        storageKey() {
          return STORAGE_PREFIX + "_" + this.mapCode;
        }

        isTaskAccepted(taskId) {
          return this._accepted.has(taskId);
        }

        isTaskCompleted(taskId) {
          return this._completed.has(taskId);
        }

        isEventCompleted(eventId) {
          return this._completedEvents.has(eventId);
        }

        acceptTask(taskId) {
          this._accepted.add(taskId);

          this.save();
        }

        completeTask(taskId) {
          this._completed.add(taskId);

          this._accepted.delete(taskId);

          this.save();
        }

        markEventCompleted(eventId) {
          this._completedEvents.add(eventId);

          this.save();
        }
        /** MVP：按 Json 的 server.effects 应用本地任务变更（不含 teleport 真实跳转）。 */


        applyServerEffects(effects) {
          if (!(effects != null && effects.length)) return;

          for (var i = 0; i < effects.length; i++) {
            var e = effects[i];

            if (e.action === 'task_accept' && e.taskId !== undefined) {
              this.acceptTask(e.taskId);
            } else if (e.action === 'task_submit' && e.taskId !== undefined) {
              this.completeTask(e.taskId);
            }
          }
        }

        load() {
          if (!sys.localStorage) return;
          var raw = sys.localStorage.getItem(this.storageKey());
          if (!raw) return;

          try {
            var _blob$accepted, _blob$completed, _blob$completedEvents;

            var blob = JSON.parse(raw);

            this._accepted.clear();

            this._completed.clear();

            this._completedEvents.clear();

            ((_blob$accepted = blob.accepted) != null ? _blob$accepted : []).forEach(id => this._accepted.add(id));
            ((_blob$completed = blob.completed) != null ? _blob$completed : []).forEach(id => this._completed.add(id));
            ((_blob$completedEvents = blob.completedEvents) != null ? _blob$completedEvents : []).forEach(id => this._completedEvents.add(id));
          } catch (_unused) {// ignore corrupt storage
          }
        }

        save() {
          if (!this.persistToStorage || !sys.localStorage) return;
          var blob = {
            accepted: [...this._accepted],
            completed: [...this._completed],
            completedEvents: [...this._completedEvents]
          };
          sys.localStorage.setItem(this.storageKey(), JSON.stringify(blob));
        }

        resetProgress() {
          this._accepted.clear();

          this._completed.clear();

          this._completedEvents.clear();

          if (sys.localStorage) sys.localStorage.removeItem(this.storageKey());
        }

      });

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=309c98ac247252315d1d7a66e654b56cf0f26d45.js.map