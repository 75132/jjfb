System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context2) {
  "use strict";

  var _reporterNs, _cclegacy, Logger, PerformanceMonitor, _crd;

  function _reportPossibleCrUseOfLogger(extras) {
    _reporterNs.report("Logger", "./Logger", _context2.meta, extras);
  }

  _export("PerformanceMonitor", void 0);

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
    }, function (_unresolved_2) {
      Logger = _unresolved_2.Logger;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "a023ckNJixGkLkAg4tId3mx", "PerformanceMonitor", undefined);

      /**
       * 轻量耗时埋点。超过阈值才打一条 warn，避免刷屏。
       */
      _export("PerformanceMonitor", PerformanceMonitor = class PerformanceMonitor {
        constructor() {
          this.timers = new Map();
        }

        static getInstance() {
          if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
          }

          return PerformanceMonitor.instance;
        }

        startTimer(name) {
          this.timers.set(name, Date.now());
        }

        endTimer(name) {
          var startTime = this.timers.get(name);

          if (!startTime) {
            return 0;
          }

          var duration = Date.now() - startTime;
          this.timers.delete(name);

          if (duration >= PerformanceMonitor.SLOW_MS) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn("[Perf] " + name + " " + duration + "ms");
          }

          return duration;
        }

        logSceneTransition(fromScene, toScene, duration) {
          if (duration >= PerformanceMonitor.SLOW_MS) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn("[Perf] scene " + fromScene + " -> " + toScene + " " + duration + "ms");
          }
        }

        logMemoryUsage(_context) {}

      });

      PerformanceMonitor.instance = null;
      PerformanceMonitor.SLOW_MS = 200;

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=74b1ac78148f8623d4bf329839642e2f86a6dbd0.js.map