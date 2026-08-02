System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, director, WebSocketManager, GameConfig, _dec, _class, _class2, _crd, ccclass, BaseSceneController;

  function _reportPossibleCrUseOfWebSocketManager(extras) {
    _reporterNs.report("WebSocketManager", "./WebSocketManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfGameConfig(extras) {
    _reporterNs.report("GameConfig", "./GameConfig", _context.meta, extras);
  }

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      Component = _cc.Component;
      director = _cc.director;
    }, function (_unresolved_2) {
      WebSocketManager = _unresolved_2.WebSocketManager;
    }, function (_unresolved_3) {
      GameConfig = _unresolved_3.GameConfig;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "35232+XOaBKZ6LPwht6NIBe", "BaseSceneController", undefined);

      __checkObsolete__(['_decorator', 'Component', 'director']);

      ({
        ccclass
      } = _decorator);

      _export("BaseSceneController", BaseSceneController = (_dec = ccclass('BaseSceneController'), _dec(_class = (_class2 = class BaseSceneController extends Component {
        constructor() {
          super(...arguments);
          this.tokenCheckInterval = (_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).TOKEN_CHECK_INTERVAL;
          this.tokenCheckTimer = -1;
          this.lastToken = null;
          this.isMonitoring = false;
          this.currentSceneName = '';
        }

        start() {
          this.currentSceneName = director.getScene().name;
          this.scheduleOnce(() => {
            this.startMonitoring();
          }, 2.0);
        }

        startMonitoring() {
          if (this.isMonitoring) {
            return;
          }

          this.isMonitoring = true;
          this.lastToken = this.getCurrentToken(); // 网游级优化：事件驱动替代频繁轮询
          // 监听WebSocket连接状态变化事件

          var wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();
          wsManager.on('network_connect', this.onNetworkConnect, this);
          wsManager.on('network_disconnect', this.onNetworkDisconnect, this);
          wsManager.on('data_changed', this.onDataChanged, this); // 减少轮询频率，使用更长的间隔（事件驱动为主，轮询为辅）

          this.tokenCheckTimer = setInterval(() => {
            this.checkStatus();
          }, this.tokenCheckInterval);
          setTimeout(() => {
            this.checkStatus();
          }, 1000);
        }
        /**
         * 网游级优化：事件驱动处理网络连接
         * 修复：改为方法而不是箭头函数字段，允许子类正确重写
         */


        onNetworkConnect() {
          // 连接恢复时立即检查状态
          this.checkStatus();
        }
        /**
         * 网游级优化：事件驱动处理网络断开
         * 修复：改为方法而不是箭头函数字段，允许子类正确重写
         */


        onNetworkDisconnect() {
          // 断开时立即处理
          this.handleConnectionLost();
        }
        /**
         * 网游级优化：事件驱动处理数据变化
         * 修复：改为方法而不是箭头函数字段，允许子类正确重写
         */


        onDataChanged(data) {
          // 数据变化时立即检查
          this.checkStatus();
        }

        stopMonitoring() {
          if (this.tokenCheckTimer !== -1) {
            clearInterval(this.tokenCheckTimer);
            this.tokenCheckTimer = -1;
          } // 网游级优化：取消事件监听
          // 修复：使用箭头函数包装，确保 this 绑定正确


          var wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();
          wsManager.off('network_connect', this.onNetworkConnect, this);
          wsManager.off('network_disconnect', this.onNetworkDisconnect, this);
          wsManager.off('data_changed', this.onDataChanged, this);
          this.isMonitoring = false;
        }

        sendClearTokenCommand() {
          try {
            var wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance();
            wsManager.send({
              type: (_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
                error: Error()
              }), GameConfig) : GameConfig).MESSAGE_TYPES.LOGOUT,
              token: wsManager.getToken()
            }, false);
            wsManager.clearToken();
          } catch (_unused) {}
        }

        jumpToLoginScene() {
          if (BaseSceneController.navigating) {
            return;
          }

          BaseSceneController.navigating = true;

          try {
            director.loadScene((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).SCENE_NAMES.LOGIN, () => {
              BaseSceneController.navigating = false;
            });
          } catch (_unused2) {
            BaseSceneController.navigating = false;
          }
        }

        jumpToCharacterSelectScene() {
          if (BaseSceneController.navigating) {
            return;
          }

          BaseSceneController.navigating = true;

          try {
            director.loadScene((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).SCENE_NAMES.CHARACTER_SELECT, () => {
              BaseSceneController.navigating = false;
            });
          } catch (_unused3) {
            BaseSceneController.navigating = false;
          }
        }

        getCurrentToken() {
          try {
            return (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance().getToken();
          } catch (_unused4) {
            return null;
          }
        }

        isTokenValid(token) {
          return token !== null && token.length > 0;
        }

        manualStatusCheck() {
          this.checkStatus();
        }

        getCurrentSceneName() {
          return this.currentSceneName;
        }

        getMonitoringStatus() {
          return this.isMonitoring;
        }

        logDetails() {
          try {
            var wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance();
            var token = this.getCurrentToken();
          } catch (_unused5) {}
        }

        onDestroy() {
          this.stopMonitoring();
        }

      }, _class2.navigating = false, _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=794146977ec97da22510256e7d115342141a3ac3.js.map