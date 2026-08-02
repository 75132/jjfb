System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, director, WebSocketManager, GameConfig, _dec, _class, _crd, ccclass, property, CharacterSelectControl;

  function _reportPossibleCrUseOfWebSocketManager(extras) {
    _reporterNs.report("WebSocketManager", "../global/WebSocketManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfGameConfig(extras) {
    _reporterNs.report("GameConfig", "../global/GameConfig", _context.meta, extras);
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

      _cclegacy._RF.push({}, "51f15IM0J1GXo+eW64J2nVV", "CharacterSelectControl", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'director']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("CharacterSelectControl", CharacterSelectControl = (_dec = ccclass('CharacterSelectControl'), _dec(_class = class CharacterSelectControl extends Component {
        constructor() {
          super(...arguments);
          this.wsManager = null;
        }

        start() {
          this.wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();
          var token = this.wsManager.getToken();
        } // 新增：添加物品事件示例


        onAddItemClick() {
          // 示例：添加物品id为1，数量为32
          this.wsManager.send({
            type: (_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.ADD_ITEM,
            itemId: '1',
            quantity: 32,
            character_id: this.wsManager.getCharacterId() || undefined
          });
        }

        update(deltaTime) {
          if (this.wsManager && !this.wsManager.isConnected()) {
            console.warn('WebSocket已断开，返回登录场景');
            director.loadScene('Login');
          }
        }

      }) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=fc45ad05c68394003b518d9e696d7f6f072da0f1.js.map