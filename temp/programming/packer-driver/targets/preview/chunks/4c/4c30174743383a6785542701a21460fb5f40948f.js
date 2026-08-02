System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, RouteDictionary, _crd;

  _export("RouteDictionary", void 0);

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "21b01+w299Er6XDItYfTldb", "RouteDictionary", undefined);

      /**
       * 路由字典 - 与服务器端 Dictionary 服务对应
       * 用于压缩路由字符串，减少网络传输
       * 参考 PomeloServer 的 Dictionary 组件
       */
      _export("RouteDictionary", RouteDictionary = class RouteDictionary {
        constructor() {
          this.routeToId = new Map();
          this.idToRoute = new Map();
          this.version = '';
          this.enabled = false;
        }

        static getInstance() {
          if (!this.instance) {
            this.instance = new RouteDictionary();
          }

          return this.instance;
        }
        /**
         * 加载字典（从服务器或本地文件）
         */


        loadDictionary(dict) {
          this.version = dict.version;
          this.routeToId.clear();
          this.idToRoute.clear(); // 加载 route_to_id

          for (var [route, id] of Object.entries(dict.route_to_id)) {
            this.routeToId.set(route, id);
          } // 加载 id_to_route（注意：JSON 的 key 是字符串，需要转换）


          for (var [idStr, _route] of Object.entries(dict.id_to_route)) {
            var _id = parseInt(idStr, 10);

            if (!isNaN(_id)) {
              this.idToRoute.set(_id, _route);
            }
          }

          this.enabled = true;
          console.log("\u2705 [RouteDictionary] \u5B57\u5178\u52A0\u8F7D\u6210\u529F\uFF0C\u7248\u672C: " + this.version + "\uFF0C\u8DEF\u7531\u6570: " + this.routeToId.size);
        }
        /**
         * 编码路由（字符串 -> 数字）
         */


        encodeRoute(route) {
          return this.routeToId.get(route) || null;
        }
        /**
         * 解码路由（数字 -> 字符串）
         */


        decodeRoute(routeId) {
          return this.idToRoute.get(routeId) || null;
        }
        /**
         * 获取字典版本
         */


        getVersion() {
          return this.version;
        }
        /**
         * 是否启用字典压缩
         */


        isEnabled() {
          return this.enabled;
        }
        /**
         * 启用/禁用字典压缩
         */


        setEnabled(enabled) {
          this.enabled = enabled;
        }

      });

      RouteDictionary.instance = null;

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=4c30174743383a6785542701a21460fb5f40948f.js.map