System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, EventTarget, _crd, RobotGameEvent, robotGameEvents;

  function emitRobotDataUpdated(detail = {}) {
    robotGameEvents.emit(RobotGameEvent.RobotDataUpdated, detail);
  }

  function emitBattleTeamUpdated(detail = {}) {
    robotGameEvents.emit(RobotGameEvent.BattleTeamUpdated, detail);
  }

  _export({
    emitRobotDataUpdated: emitRobotDataUpdated,
    emitBattleTeamUpdated: emitBattleTeamUpdated
  });

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      EventTarget = _cc.EventTarget;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "119568rqrRJpoeJQQwk/X/F", "RobotGameEvents", undefined);

      /** 机甲列表 / 属性面板 / 背包等跨模块联动事件名 */
      __checkObsolete__(['EventTarget']);

      _export("RobotGameEvent", RobotGameEvent = {
        RobotDataUpdated: 'robot_game_robot_data_updated',
        BattleTeamUpdated: 'robot_game_battle_team_updated'
      });

      _export("robotGameEvents", robotGameEvents = new EventTarget());

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=32ca5a1e8a6472756acf8b4eedf090bb66278ff2.js.map