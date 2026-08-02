System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, _crd;

  /** defer / allowedChoiceIds 判定：是否应调用 story_event_complete */
  function shouldCompleteChoice(opt, ev) {
    var _ev$server;

    if (opt.completesEvent === false) return false;
    if (opt.forcedResult === 'block' || opt.forcedResult === 'none') return false;
    const allowed = ev == null || (_ev$server = ev.server) == null ? void 0 : _ev$server.allowedChoiceIds;

    if (Array.isArray(allowed) && allowed.length > 0 && !allowed.includes(opt.id)) {
      return false;
    }

    return true;
  }
  /** 战前选项是否应进入战斗 */


  function shouldStartBattleFromChoice(opt, ev) {
    var _ev$client;

    if (!shouldCompleteChoice(opt, ev)) return false;
    if (opt.forcedResult === 'block' || opt.forcedResult === 'none') return false;
    if (opt.forcedResult === 'start_battle') return true;
    if ((ev == null ? void 0 : ev.eventType) === 'battle' && (_ev$client = ev.client) != null && _ev$client.choiceScriptId) return false;
    return false;
  }

  function isBattleInteractAction(payload, ev) {
    const action = (payload == null ? void 0 : payload.action) || ev.eventType;
    return action === 'battle' || action === 'choice_then_battle' || ev.eventType === 'battle';
  }

  function isChoiceBlockedMessage(message) {
    return message === 'choice_blocked';
  }
  /** 将 WebSocketManager.request 回调包装为 Promise */


  function promisifyWsRequest(request, route, payload, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      request(route, payload, resp => {
        if (!(resp != null && resp.success)) {
          reject(new Error((resp == null ? void 0 : resp.message) || `${route} failed`));
          return;
        }

        resolve(resp);
      }, true, timeoutMs);
    });
  }

  _export({
    shouldCompleteChoice: shouldCompleteChoice,
    shouldStartBattleFromChoice: shouldStartBattleFromChoice,
    isBattleInteractAction: isBattleInteractAction,
    isChoiceBlockedMessage: isChoiceBlockedMessage,
    promisifyWsRequest: promisifyWsRequest
  });

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "e134cMi3ppGfJMtRQhR8aHx", "story-event-flow", undefined);
      /**
       * 剧情事件流纯逻辑（可单测，不依赖 Cocos 运行时）。
       * 对标 RMV：一次确认 → 授权 → 展示 → 完成 → 续链。
       */


      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=10b499ed93d8968d3670e261a107e4ed2b6d2089.js.map