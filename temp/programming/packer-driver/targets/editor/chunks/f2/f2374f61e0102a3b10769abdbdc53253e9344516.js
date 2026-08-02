System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, _crd, PREFIX, storyLogVerbose, _onceKeys;

  function setStoryLogVerbose(enabled) {
    _export("storyLogVerbose", storyLogVerbose = enabled);
  }

  /** 每个 key 进程内只打一次（适合 AABB 一次性说明等） */
  function storyLogOnce(key, level, message, context) {
    if (_onceKeys.has(key)) return;

    _onceKeys.add(key);

    storyLog(level, message, context);
  }

  function storyLogVerboseMsg(message, context) {
    if (!storyLogVerbose) return;
    storyLog('info', message, context);
  }

  function storyLog(level, message, context) {
    const tail = context && Object.keys(context).length ? ` ${JSON.stringify(context)}` : '';
    const line = `${PREFIX} ${message}${tail}`;

    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  _export({
    setStoryLogVerbose: setStoryLogVerbose,
    storyLogOnce: storyLogOnce,
    storyLogVerboseMsg: storyLogVerboseMsg,
    storyLog: storyLog
  });

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "e2e3fSltsdJAbI05WeJq83g", "storyLogger", undefined);

      /**
       * 剧情模块统一日志前缀，便于控制台过滤：输入 Story 过滤。
       */
      PREFIX = '[Story]';

      /** 为 true 时输出 storyLogVerboseMsg（高频诊断，默认关） */
      _export("storyLogVerbose", storyLogVerbose = false);

      _onceKeys = new Set();

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=f2374f61e0102a3b10769abdbdc53253e9344516.js.map