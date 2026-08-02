System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, RequestRetryManager, _crd, ccclass;

  _export("RequestRetryManager", void 0);

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "6b230D/QAVLWr6ldJkfK/pF", "RequestRetryManager", undefined);
      /**
       * 请求重试管理器 - 实现自动重试和幂等性检查
       * 参考游戏开发最佳实践，提升网络请求的可靠性
       */


      __checkObsolete__(['_decorator', 'Component']);

      ({
        ccclass
      } = _decorator);

      _export("RequestRetryManager", RequestRetryManager = class RequestRetryManager {
        /**
         * 生成请求ID（用于幂等性检查）
         * 使用计数器+随机数确保唯一性
         */
        static generateRequestId(route, data) {
          // 使用计数器确保唯一性（即使在同一毫秒内）
          this.requestCounter = (this.requestCounter + 1) % 1000000; // 使用路由、数据、时间戳、计数器和随机数生成唯一ID

          var key = JSON.stringify({
            route,
            data,
            timestamp: Date.now(),
            counter: this.requestCounter,
            random: Math.random()
          }); // 简单的哈希函数

          var hash = 0;

          for (var i = 0; i < key.length; i++) {
            var char = key.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32bit integer
          }

          return Math.abs(hash).toString(16).substring(0, 16);
        }
        /**
         * 判断是否应该重试
         * 网络错误可重试，业务错误不重试
         */


        static shouldRetry(response, config) {
          if (config === void 0) {
            config = {};
          }

          if (!response || response.success) {
            return false; // 成功不重试
          }

          var code = response.code || 500; // 网络相关错误可重试

          if (code === 408 || code === 503 || code === 504) {
            return true;
          } // 服务器错误可重试（5xx）


          if (code >= 500 && code < 600) {
            return true;
          } // 客户端错误不重试（4xx，除了408）


          if (code >= 400 && code < 500) {
            return false;
          } // 其他错误默认不重试


          return false;
        }
        /**
         * 计算退避延迟时间
         */


        static calculateBackoffDelay(attempt, config) {
          if (config === void 0) {
            config = {};
          }

          var baseDelay = config.baseDelay || 1000;
          var maxDelay = config.maxDelay || 10000;
          var strategy = config.backoffStrategy || 'exponential';
          var delay;

          switch (strategy) {
            case 'exponential':
              // 指数退避：1s, 2s, 4s, 8s, ...
              delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
              break;

            case 'linear':
              // 线性退避：1s, 2s, 3s, 4s, ...
              delay = Math.min(baseDelay * (attempt + 1), maxDelay);
              break;

            case 'fixed':
              // 固定延迟
              delay = baseDelay;
              break;

            default:
              delay = baseDelay;
          }

          return delay;
        }
        /**
         * 判断路由是否幂等
         * 查询操作通常是幂等的，修改操作通常不是幂等的
         */


        static isIdempotentRoute(route) {
          // 查询操作通常是幂等的
          if (route.startsWith('get_') || route.startsWith('search_') || route === 'get_player' || route === 'get_character_info' || route === 'get_all_characters' || route === 'get_robot_pets' || route === 'get_robot_pet_info' || route === 'bag_get' || route === 'get_chat_history' || route === 'get_announcements_history' || route === 'get_friend_list' || route === 'get_friend_requests') {
            return true;
          } // 修改操作通常不是幂等的


          if (route === 'upgrade_robot' || route === 'upgrade_all_robots' || route === 'bag_use_item' || route === 'bag_discard_item' || route === 'add_exp' || route === 'add' || route === 'create_character' || route === 'delete_character' || route === 'add_friend' || route === 'approve_friend' || route === 'reject_friend' || route === 'delete_friend' || route === 'post_chat' || route === 'post_announcement' || route === 'change_password' || route === 'delete_account') {
            return false;
          } // 默认：查询操作幂等，修改操作不幂等


          return route.startsWith('get_') || route.startsWith('search_');
        }

      });

      RequestRetryManager.requestCounter = 0;

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=9cc7bf7ffe516e1806f4d401b474b4190a699a67.js.map