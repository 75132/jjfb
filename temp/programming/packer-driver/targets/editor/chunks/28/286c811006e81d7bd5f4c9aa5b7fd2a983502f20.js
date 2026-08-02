System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, GameConfig, _crd;

  _export("GameConfig", void 0);

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "08c7dbQI9RKSrBt1Gv6P1ZO", "GameConfig", undefined);

      /**
       * 游戏全局配置文件
       * 统一管理所有配置常量，避免硬编码
       */
      _export("GameConfig", GameConfig = class GameConfig {
        static getWsUrl() {
          try {
            const win = typeof window !== 'undefined' ? window : {};
            const override = win.__WS_URL__ || (win.localStorage ? win.localStorage.getItem('WS_URL') : null);

            if (override && typeof override === 'string' && override.length > 0) {
              return override;
            } // 默认固定到公网地址


            return GameConfig.WEBSOCKET_URL;
          } catch {
            return GameConfig.WEBSOCKET_URL;
          }
        }

        static setWsUrl(url) {
          try {
            const win = typeof window !== 'undefined' ? window : {};
            win.__WS_URL__ = url;

            if (win.localStorage) {
              win.localStorage.setItem('WS_URL', url);
            }
          } catch {}
        }

      });

      // 网络配置
      // 固定后端地址（公网）
      // 旧直连地址（保留注释仅供排查）
      // static readonly WEBSOCKET_URL = 'ws://8.140.236.16:8001';
      // 生产环境：通过域名反向代理访问 WS
      // static readonly WEBSOCKET_URL = 'ws://www.jjfbol.cn/ws'; 
      // 本地测试地址
      GameConfig.WEBSOCKET_URL = 'ws://localhost:8001';
      GameConfig.RECONNECT_DELAY = 3000;
      GameConfig.MAX_RECONNECT_ATTEMPTS = 5;
      GameConfig.CONNECTION_TIMEOUT = 10000;
      // 安全阀：离线/未鉴权超过该时长后，不允许直接用本地 token 自动重连，
      // 而是强制回登录并清除本地会话数据（防止“久没上线后直接被当在线”）。
      // 单位：毫秒；离线超过该时间窗就必须重登。
      // 10分钟策略（方便你在编辑器预览/离线测试时验证）。
      GameConfig.AUTH_INACTIVITY_RELOGIN_MS = 1000 * 60 * 10;
      // 10m
      // 监控配置（优化：减少检查频率，提高性能）
      GameConfig.TOKEN_CHECK_INTERVAL = 10000;
      // 增加到10秒，减少检查频率
      GameConfig.TOKEN_CHECK_INTERVAL_FAST = 5000;
      // 增加到5秒
      GameConfig.TOKEN_CHECK_INTERVAL_GAME = 15000;
      // 游戏场景中使用15秒，进一步减少性能消耗
      // 场景配置
      GameConfig.SCENE_NAMES = {
        LOGIN: 'Login',
        CHARACTER_SELECT: 'CharacterSelect',
        GAME: 'Game'
      };
      // 消息类型
      GameConfig.MESSAGE_TYPES = {
        // 连接相关
        CONNECTION_INIT: 'connection_init',
        AUTH_REQUEST: 'auth_request',
        // 认证相关
        LOGIN: 'login',
        REGISTER: 'register',
        LOGOUT: 'logout',
        CHANGE_PASSWORD: 'change_password',
        // 用户相关
        GET_CHARACTER_INFO: 'get_character_info',
        DELETE_CHARACTER: 'delete_character',
        // 角色相关
        CREATE_CHARACTER: 'create_character',
        SELECT_CHARACTER: 'select_character',
        // 物品相关
        ADD_ITEM: 'add',
        GET_ANNOUNCEMENTS_HISTORY: 'get_announcements_history',
        POST_ANNOUNCEMENT: 'post_announcement',
        GET_CHAT_HISTORY: 'get_chat_history',
        POST_CHAT: 'post_chat',
        ANNOUNCEMENT: 'announcement',
        GET_RANDOM_ROBOT: 'get_random_robot',
        ROBOT_INFO: 'robot_info',
        BAG_WRITE_RANDOM: 'bag_write_random',
        BAG_WRITE_RESPONSE: 'bag_write_response',
        BAG_GET: 'bag_get',
        BAG_HAS_ITEMS: 'bag_has_items',
        BAG_ITEMS: 'bag_items',
        BAG_HAS_ITEMS_RESPONSE: 'bag_has_items_response',
        BAG_ITEMS_UPDATE: 'bag_items_update',
        BAG_USE_ITEM: 'bag_use_item',
        BAG_USE_ITEM_RESPONSE: 'bag_use_item_response',
        BAG_DISCARD_ITEM: 'bag_discard_item',
        BAG_DISCARD_ITEM_RESPONSE: 'bag_discard_item_response',
        BAG_MOVE_ITEM: 'bag_move_item',
        BAG_MOVE_ITEM_RESPONSE: 'bag_move_item_response',
        BAG_SORT: 'bag_sort',
        BAG_SORT_RESPONSE: 'bag_sort_response',
        // 机甲宠物相关
        GET_ROBOT_PETS: 'get_robot_pets',
        ROBOT_PETS_RESPONSE: 'robot_pets_response',
        ROBOT_PETS_UPDATE: 'robot_pets_update',
        GET_ROBOT_PET_INFO: 'get_robot_pet_info',
        ROBOT_PET_INFO_RESPONSE: 'robot_pet_info_response',
        ROBOT_RELEASE_PET: 'robot_release_pet',
        ROBOT_RELEASE_PET_RESPONSE: 'robot_release_pet_response',
        // 出战队伍（服务器权威）
        GET_BATTLE_TEAM: 'get_battle_team',
        GET_BATTLE_TEAM_RESPONSE: 'get_battle_team_response',
        SET_BATTLE_TEAM: 'set_battle_team',
        SET_BATTLE_TEAM_RESPONSE: 'set_battle_team_response',
        BATTLE_TEAM_UPDATE: 'battle_team_update',
        // 战斗相关（第一版：敌人生成 + 房间制 PVE）
        BATTLE_GENERATE_ENEMY: 'battle_generate_enemy',
        BATTLE_GENERATE_ENEMY_RESPONSE: 'battle_generate_enemy_response',
        BATTLE_ROOM_CREATE: 'battle_room_create',
        BATTLE_ROOM_CREATE_RESPONSE: 'battle_room_create_response',
        BATTLE_ROOM_ACTION: 'battle_room_action',
        BATTLE_ROOM_ACTION_RESPONSE: 'battle_room_action_response',
        BATTLE_ROOM_RESUME: 'battle_room_resume',
        BATTLE_ROOM_RESUME_RESPONSE: 'battle_room_resume_response',
        // PVP 匹配（平匹配）
        PVP_FLAT_MATCH: 'pvp_flat_match',
        ROBOTCOUNT_UPDATE: 'robotcount_update',
        REFRESH_TOKEN: 'refresh_token',
        STORY_GET_STATE: 'story_get_state',
        STORY_INTERACT: 'story_interact',
        STORY_EVENT_COMPLETE: 'story_event_complete',
        STORY_BATTLE_FINALIZE: 'story_battle_finalize',
        STORY_BATTLE_START: 'story_battle_start',
        MAIL_LIST: 'mail_list',
        MAIL_READ: 'mail_read',
        MAIL_CLAIM: 'mail_claim',
        MAIL_DELETE: 'mail_delete',
        EQUIP_ENHANCE: 'equip_enhance',
        EQUIP_SOCKET: 'equip_socket'
      };
      // 事件名称
      GameConfig.EVENTS = {
        // 网络事件
        NETWORK_CONNECT: 'network_connect',
        NETWORK_DISCONNECT: 'network_disconnect',
        NETWORK_ERROR: 'network_error',
        // 认证事件
        LOGIN_RESPONSE: 'login_response',
        REGISTER_RESPONSE: 'register_response',
        AUTH_SUCCESS: 'auth_success',
        AUTH_FAILURE: 'auth_failure',
        LOGOUT_SUCCESS: 'logout_success',
        LOGOUT_FAILURE: 'logout_failure',
        LOGOUT_RESPONSE: 'logout_response'
      };
      // 调试模式
      GameConfig.DEBUG_MODE = true;
      // 开发环境设为true，生产环境设为false
      // 错误码常量
      GameConfig.ERROR_CODES = {
        SUCCESS: 200,
        BAD_REQUEST: 400,
        UNAUTHORIZED: 401,
        TOO_MANY_REQUESTS: 429,
        // 限流
        INTERNAL_ERROR: 500,
        SERVICE_UNAVAILABLE: 503 // 服务器繁忙

      };

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=286c811006e81d7bd5f4c9aa5b7fd2a983502f20.js.map