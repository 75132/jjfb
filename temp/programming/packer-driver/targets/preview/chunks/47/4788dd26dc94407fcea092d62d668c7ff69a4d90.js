System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, BagEventHub, _crd;

  _export("BagEventHub", void 0);

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "2d8707lTyFM74kmzir9augG", "BagEvent", undefined);
      /**
       * 背包领域事件（任务/成就等可订阅）。保持轻量，避免与具体 UI 耦合。
       */


      _export("BagEventHub", BagEventHub = class BagEventHub {
        static on(evt, fn) {
          var set = this._subs.get(evt);

          if (!set) {
            set = new Set();

            this._subs.set(evt, set);
          }

          set.add(fn);
        }

        static off(evt, fn) {
          var set = this._subs.get(evt);

          if (!set) return;
          set.delete(fn);
          if (set.size === 0) this._subs.delete(evt);
        }

        static emit(evt, payload) {
          var set = this._subs.get(evt);

          if (!set) return;

          for (var fn of set) {
            try {
              fn(payload);
            } catch (e) {
              console.warn('[BagEvent]', evt, e);
            }
          }
        }

      });

      BagEventHub._subs = new Map();

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=4788dd26dc94407fcea092d62d668c7ff69a4d90.js.map