System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, _crd, PSEUDO_WIN_TEXT, PSEUDO_LOSE_TEXT;

  function isPseudoBattleResultScript(script) {
    var _script$options;

    const opts = (_script$options = script == null ? void 0 : script.options) != null ? _script$options : [];
    if (opts.length === 0) return false;
    const hasPseudoWin = opts.some(o => {
      var _o$text;

      return PSEUDO_WIN_TEXT.test(String((_o$text = o.text) != null ? _o$text : '').trim());
    });
    const hasPseudoLose = opts.some(o => {
      var _o$text2;

      return PSEUDO_LOSE_TEXT.test(String((_o$text2 = o.text) != null ? _o$text2 : '').trim());
    });
    return hasPseudoWin && hasPseudoLose;
  }

  /** 移除 battle 事件上的「胜利/失败」伪选项，保留独立战前 choice 环 */
  function sanitizeBattlePseudoChoicesInRuntime(map) {
    var _map$client$choiceScr, _map$client;

    const scripts = (_map$client$choiceScr = (_map$client = map.client) == null ? void 0 : _map$client.choiceScripts) != null ? _map$client$choiceScr : {};
    const removedScriptIds = new Set();
    let battleEventsFixed = 0;

    for (const npc of (_map$npcs = map.npcs) != null ? _map$npcs : []) {
      var _map$npcs;

      for (const ev of (_npc$events = npc.events) != null ? _npc$events : []) {
        var _npc$events, _ev$client, _ev$server;

        if (ev.eventType !== 'battle') continue;
        const sid = (_ev$client = ev.client) == null ? void 0 : _ev$client.choiceScriptId;
        if (!sid) continue;
        const script = scripts[sid];
        if (!isPseudoBattleResultScript(script)) continue;

        if (ev.client) {
          delete ev.client.choiceScriptId;
        }

        if ((_ev$server = ev.server) != null && _ev$server.allowedChoiceIds) {
          delete ev.server.allowedChoiceIds;
        }

        removedScriptIds.add(sid);
        battleEventsFixed += 1;
      }
    }

    for (const sid of removedScriptIds) {
      delete scripts[sid];
    }

    return {
      battleEventsFixed,
      scriptsRemoved: removedScriptIds.size
    };
  }

  _export({
    isPseudoBattleResultScript: isPseudoBattleResultScript,
    sanitizeBattlePseudoChoicesInRuntime: sanitizeBattlePseudoChoicesInRuntime
  });

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "84a49sWrSVEIofkuVXOX3Tr", "story-runtime-sanitize", undefined);
      /**
       * 运行时 JSON 清洗：battle 环不得带「胜利/失败」伪选项，战斗结果由对战验证。
       * Juben 导出管线与 Cocos StoryManager 加载时共用。
       */


      PSEUDO_WIN_TEXT = /^(胜利|成功)$/;
      PSEUDO_LOSE_TEXT = /^失败$/;

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=3e72296b2cebc1416b24ba247742f0004c7dcbb5.js.map