System.register(["__unresolved_0", "cc"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, _crd;

  /** 第二货币「能量块」；兼容旧字段 points（字符串/数字） */
  function getEnergyBlocksFromPayload(payload) {
    var _payload$energy_block;

    const raw = (_payload$energy_block = payload == null ? void 0 : payload.energy_blocks) != null ? _payload$energy_block : payload == null ? void 0 : payload.points;
    if (raw === null || raw === undefined || raw === '') return 0;
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.floor(n));
  }

  function _reportPossibleCrUseOfGameConfig(extras) {
    _reporterNs.report("GameConfig", "./GameConfig", _context.meta, extras);
  }

  _export("getEnergyBlocksFromPayload", getEnergyBlocksFromPayload);

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "3714dEAJ7xFXrczm90OmcVA", "MessageTypes", undefined);
      /**
       * 消息类型定义
       * 提供完整的TypeScript接口，确保类型安全
       */
      // 基础消息接口
      // 连接相关消息
      // 心跳消息
      // 认证相关消息
      // 用户相关消息
      // 角色相关消息
      // 物品相关消息
      // 响应消息接口
      // 所有角色响应
      // 选择角色响应
      // 删除角色响应
      // 联合类型
      // 背包使用物品响应
      // 背包丢弃物品响应
      // 背包更新推送
      // 机甲宠物相关消息
      // 机甲宠物更新推送
      // 机甲数量更新推送
      // 玩家信息响应
      // 登录响应
      // 注册响应
      // 聊天历史响应
      // 发送聊天响应
      // 公告历史响应
      // 发送公告响应
      // 公告推送
      // 聊天消息推送


      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=c4407afdb9a8e3b4911fb55fd5cc26f674ef87a6.js.map