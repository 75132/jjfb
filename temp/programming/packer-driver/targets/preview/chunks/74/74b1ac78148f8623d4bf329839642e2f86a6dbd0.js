System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, PerformanceMonitor, _crd;

  _export("PerformanceMonitor", void 0);

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "a023ckNJixGkLkAg4tId3mx", "PerformanceMonitor", undefined);

      /**
       * 性能监控工具
       * 用于监控场景跳转和加载性能
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
          return duration;
        }

        logSceneTransition(fromScene, toScene, duration) {}

        logMemoryUsage(context) {}

      });

      PerformanceMonitor.instance = null;

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=74b1ac78148f8623d4bf329839642e2f86a6dbd0.js.map