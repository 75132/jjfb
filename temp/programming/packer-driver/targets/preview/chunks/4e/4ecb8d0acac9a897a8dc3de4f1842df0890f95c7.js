System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, UILockManager, _crd;

  _export("UILockManager", void 0);

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "50b11LRsOtCc6MLzJI6kVbO", "UILockManager", undefined);

      /**
       * 全局 UI / 请求互斥锁：超时自动释放，防止连点卡住。
       */
      _export("UILockManager", UILockManager = class UILockManager {
        constructor() {
          this._timers = new Map();
        }

        static get instance() {
          if (!this._instance) this._instance = new UILockManager();
          return this._instance;
        }

        tryLock(key, ttlMs) {
          if (this._timers.has(key)) return false;
          var t = setTimeout(() => this.unlock(key), ttlMs);

          this._timers.set(key, t);

          return true;
        }

        unlock(key) {
          var t = this._timers.get(key);

          if (t) clearTimeout(t);

          this._timers.delete(key);
        }

        forceUnlockAll() {
          for (var t of this._timers.values()) clearTimeout(t);

          this._timers.clear();
        }

      });

      UILockManager._instance = null;

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=4ecb8d0acac9a897a8dc3de4f1842df0890f95c7.js.map