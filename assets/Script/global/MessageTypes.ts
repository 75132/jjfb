/**
 * 消息类型定义
 * 提供完整的TypeScript接口，确保类型安全
 */

import { GameConfig } from './GameConfig';

// 基础消息接口
export interface BaseMessage {
    type: string;
    token?: string;
}

// 连接相关消息
export interface ConnectionInitMessage extends BaseMessage {
    type: typeof GameConfig.MESSAGE_TYPES.CONNECTION_INIT;
    data?: string;
}

export interface AuthRequestMessage extends BaseMessage {
    type: typeof GameConfig.MESSAGE_TYPES.AUTH_REQUEST;
    token: string;
}

// 心跳消息
export interface PongMessage extends BaseMessage {
    type: 'pong';
}

// 认证相关消息
export interface LoginMessage extends BaseMessage {
    type: typeof GameConfig.MESSAGE_TYPES.LOGIN;
    account: string;
    password: string;
}

export interface RegisterMessage extends BaseMessage {
    type: typeof GameConfig.MESSAGE_TYPES.REGISTER;
    account: string;
    password: string;
}

export interface LogoutMessage extends BaseMessage {
    type: typeof GameConfig.MESSAGE_TYPES.LOGOUT;
}

export interface ChangePasswordMessage extends BaseMessage {
    type: typeof GameConfig.MESSAGE_TYPES.CHANGE_PASSWORD;
    old_password: string;  // 注意：使用下划线命名，与服务器一致
    new_password: string;  // 注意：使用下划线命名，与服务器一致
}

// 用户相关消息
export interface GetCharacterInfoMessage extends BaseMessage {
    type: typeof GameConfig.MESSAGE_TYPES.GET_CHARACTER_INFO;
    slot_index?: number;
}

export interface GetAllCharactersMessage extends BaseMessage {
    type: typeof GameConfig.MESSAGE_TYPES.GET_ALL_CHARACTERS;
}

export interface DeleteCharacterMessage extends BaseMessage {
    type: typeof GameConfig.MESSAGE_TYPES.DELETE_CHARACTER;
    character_id?: string;
    characterId?: string; // 兼容旧字段
    slot_index?: number;
}

// 角色相关消息
export interface CreateCharacterMessage extends BaseMessage {
    type: typeof GameConfig.MESSAGE_TYPES.CREATE_CHARACTER;
    name?: string;          // 文档字段
    role_name?: string;     // 服务器字段
    class?: number;
    sprite?: number;        // 文档字段
    character_index?: number; // 兼容旧字段
    slot_index?: number;
}

export interface SelectCharacterMessage extends BaseMessage {
    type: typeof GameConfig.MESSAGE_TYPES.SELECT_CHARACTER;
    character_id?: string;
    slot_index?: number;
}

// 物品相关消息
export interface AddItemMessage extends BaseMessage {
    type: typeof GameConfig.MESSAGE_TYPES.ADD_ITEM;
    itemId: string;
    quantity?: number;
}

// 响应消息接口
export interface BaseResponse {
    success: boolean;
    message?: string;
    type?: string;
    request_id?: string;  // ✅ 添加 request_id 字段（用于精确匹配响应）
    code?: number;        // ✅ 添加 code 字段（HTTP状态码）
    timestamp?: number;    // ✅ 添加 timestamp 字段（时间戳）
    data?: any;          // ✅ 添加 data 字段（标准响应格式）
}

export interface AuthResponse extends BaseResponse {
    token?: string;
    user_id?: string;
    character_id?: string;  // ✅ 添加 character_id 字段
}

export interface CharacterInfoResponse extends BaseResponse {
    characters?: any[];
    currentCharacter?: any;
    // 标准格式：数据在 data 字段中
    data?: {
        slot_index: number;
        role_name: string;
        Sprite: number;
        gold?: number;
        level?: number;
        exp?: number;
        energy_blocks?: number;
        alliance?: string;
        record?: string;
        robotcount?: number;
        position?: any;
        rank?: string;
        user_id?: string;
        character_id?: string;
        friend_id?: string;
    };
}

// 所有角色响应
export interface AllCharactersResponse extends BaseResponse {
    // 注意：characters 是对象，key 为 slot_index (0, 1, 2)，不是数组
    characters?: {
        [slot_index: number]: {
            slot_index: number;
            character_id?: string;
            role_name?: string;
            Sprite?: number;
            gold?: number;
            level?: number;
            exp?: number;
            energy_blocks?: number;
            alliance?: string;
            record?: string;
            robotcount?: number;
            position?: any;
            rank?: string;
            friend_id?: string;
            user_id?: string;
        };
    };
}

export interface CharacterCreateResponse extends BaseResponse {
    characterId?: string;
    character_id?: string;  // ✅ 添加（服务器使用下划线命名）
    character?: any;
    slot_index?: number;    // ✅ 添加槽位索引
}

// 选择角色响应
export interface SelectCharacterResponse extends BaseResponse {
    character_id?: string;
}

// 删除角色响应
export interface DeleteCharacterResponse extends BaseResponse {
    // 无额外字段
}

// 联合类型
export type ClientMessage = 
    | ConnectionInitMessage
    | AuthRequestMessage
    | PongMessage
    | LoginMessage
    | RegisterMessage
    | LogoutMessage
    | ChangePasswordMessage
    | GetCharacterInfoMessage
    | GetAllCharactersMessage
    | DeleteCharacterMessage
    | CreateCharacterMessage
    | SelectCharacterMessage
    | AddItemMessage
    | BagWriteRandomMessage
    | BagGetMessage
    | GetRobotPetsMessage
    | GetRobotPetInfoMessage;

export type ServerResponse = 
    | AuthResponse
    | LoginResponse
    | RegisterResponse
    | CharacterInfoResponse
    | AllCharactersResponse
    | CharacterCreateResponse
    | SelectCharacterResponse
    | DeleteCharacterResponse
    | PlayerInfoResponse
    | BagItemsResponse
    | BagUseItemResponse
    | BagDiscardItemResponse
    | BagItemsUpdate
    | RobotPetsResponse
    | RobotPetsUpdate
    | RobotCountUpdate
    | RobotPetInfoResponse
    | GetChatHistoryResponse
    | PostChatResponse
    | GetAnnouncementsHistoryResponse
    | PostAnnouncementResponse
    | AnnouncementPush
    | ChatMessagePush
    | BaseResponse;
export interface BagWriteRandomMessage extends BaseMessage {
    type: typeof GameConfig.MESSAGE_TYPES.BAG_WRITE_RANDOM;
    character_id?: string;
}

export interface BagGetMessage extends BaseMessage {
    type: typeof GameConfig.MESSAGE_TYPES.BAG_GET;
    character_id?: string;
}

export interface BagItemsResponse extends BaseResponse {
    type: typeof GameConfig.MESSAGE_TYPES.BAG_ITEMS;
    items?: Array<{ item_id: number; quantity: number; category: number }>;
    // 标准格式：数据在 data 字段中
    data?: {
        items: Array<{ item_id: number; quantity: number; category: number }>;
    };
}

// 背包使用物品响应
export interface BagUseItemResponse extends BaseResponse {
    type: typeof GameConfig.MESSAGE_TYPES.BAG_USE_ITEM_RESPONSE;
    data?: {
        item_id: number;
        target_type: string;
        remaining_quantity: number;    // 剩余数量（如果为0则已消耗完）
        pet_id?: string;               // 如果target_type是'Pet'
        effect_result?: {              // 物品效果结果（如果物品有效果配置）
            success: boolean;
            message?: string;
            // ... 其他效果相关字段
            [key: string]: any;
        };
    };
}

// 背包丢弃物品响应
export interface BagDiscardItemResponse extends BaseResponse {
    type: typeof GameConfig.MESSAGE_TYPES.BAG_DISCARD_ITEM_RESPONSE;
    data?: {
        item_id: number;
        discarded_quantity: number;    // 已丢弃的数量
    };
}

// 背包更新推送
export interface BagItemsUpdate extends BaseResponse {
    type: typeof GameConfig.MESSAGE_TYPES.BAG_ITEMS_UPDATE;
    character_id: string;
    items: Array<{ item_id: number; quantity: number; category: number }>;
}

// 机甲宠物相关消息
export interface GetRobotPetsMessage extends BaseMessage {
    type: typeof GameConfig.MESSAGE_TYPES.GET_ROBOT_PETS;
    character_id?: string;
    page?: number;            // 可选：页码（从0开始，默认0）
    page_size?: number;       // 可选：每页数量（默认50）
}

export interface RobotPetsResponse extends BaseResponse {
    type: typeof GameConfig.MESSAGE_TYPES.ROBOT_PETS_RESPONSE;
    pets?: Array<{
        pet_id: string;
        robot_base_id: string;
        RobotID?: string;
        RobotName: string;
        Growth: number;
        Comprehension: number;
        Level: number;
        StarLevel: number;
        Form?: number;
        Class?: number;
        AniID?: string;
        EXP?: number;
        total_exp?: number;
        MaxEXP?: number;
        CurrentEXP?: number;
        current_level_exp?: number;
        next_level_need_exp?: number;
        // 属性字段
        HP?: number;
        MaxHP?: number;
        CurrentHP?: number;
        MP?: number;
        MaxMP?: number;
        CurrentMP?: number;
        Melee?: number;
        Accuracy?: number;
        Armor?: number;
        // ... 其他属性字段
        [key: string]: any;
    }>;
    pagination?: {
        page: number;
        page_size: number;
        total: number;
        has_more: boolean;
    };
}

// 机甲宠物更新推送
export interface RobotPetsUpdate extends BaseResponse {
    type: typeof GameConfig.MESSAGE_TYPES.ROBOT_PETS_UPDATE;
    character_id: string;
    pets: Array<{
        pet_id: string;
        robot_base_id: string;
        RobotID?: string;
        RobotName: string;
        Growth: number;
        Comprehension: number;
        Level: number;
        StarLevel: number;
        [key: string]: any;
    }>;
}

// 机甲数量更新推送
export interface RobotCountUpdate extends BaseMessage {
    type: typeof GameConfig.MESSAGE_TYPES.ROBOTCOUNT_UPDATE;
    character_id: string;
    robotcount: number;
}

export interface GetRobotPetInfoMessage extends BaseMessage {
    type: typeof GameConfig.MESSAGE_TYPES.GET_ROBOT_PET_INFO;
    pet_id: string;
}

export interface RobotPetInfoResponse extends BaseResponse {
    type: typeof GameConfig.MESSAGE_TYPES.ROBOT_PET_INFO_RESPONSE;
    pet_id?: string;
    [key: string]: any; // 机甲的所有属性
}

// 玩家信息响应
export interface PlayerInfoResponse extends BaseResponse {
    type: 'player_info' | 'player_info_response';
    // 直接发送格式（字段在根级别）- 保持向后兼容
    role_name?: string;
    level?: number;
    exp?: number;
    total_exp?: number;
    current_level_exp?: number;  // ✅ 当前等级内的经验
    next_level_need_exp?: number; // ✅ 升到下一级所需经验
    gold?: number;
    energy_blocks?: number; // ✅ 能量块（第二货币）
    alliance?: string;     // ✅ 联盟
    record?: string;       // ✅ 战绩
    robotcount?: number;
    position?: any;        // ✅ 位置信息
    rank?: string;         // ✅ 排名
    character_id?: string;
    friend_id?: string;
    user_id?: string;
    Sprite?: number;      // ✅ 头像索引
    class?: number;       // ✅ 职业
    is_self?: boolean;
    is_friend?: boolean;  // ✅ 是否是好友
    online?: boolean;
    status?: string;      // ✅ 状态机状态
    items?: any;
    // 标准格式（数据在 data 字段中）- 新格式
    data?: {
        // 基础信息
        role_name: string;
        level: number;
        exp: number;
        total_exp: number;
        current_level_exp: number;
        next_level_need_exp: number;
        friend_id: string;
        character_id: string;
        user_id: string;
        Sprite: number;
        class: number;
        // 游戏数据
        gold: number;
        energy_blocks: number;
        alliance: string;
        record: string;
        rank: string;
        robotcount: number;
        position: any;
        // 状态标识
        is_self: boolean;
        is_friend?: boolean;
        online?: boolean;
        status?: string;
        // 私有数据
        items?: any;
    };
}

// 登录响应
export interface LoginResponse extends BaseResponse {
    type: 'login_response';
    token?: string;
    refresh_token?: string;
    token_expires_at?: number;
    refresh_token_expires_at?: number;
    user_id?: string;
}

// 注册响应
export interface RegisterResponse extends BaseResponse {
    type: 'register_response';
    token?: string;                    // 初始Token（注册时生成）
    user_id?: string;                  // 用户ID
    // 注意：注册时不会返回 refresh_token 和过期时间，需要登录后获取
}

// 聊天历史响应
export interface GetChatHistoryResponse extends BaseResponse {
    type: 'get_chat_history_response';
    messages?: Array<{
        character_id: string;
        sender: string;       // 发送者角色名（注意：字段名是sender，不是role_name）
        text: string;
        created_at: string;   // ISO格式时间字符串（注意：字段名是created_at，不是timestamp）
    }>;
}

// 发送聊天响应
export interface PostChatResponse extends BaseResponse {
    type: 'post_chat_response';
}

// 公告历史响应
export interface GetAnnouncementsHistoryResponse extends BaseResponse {
    type: 'get_announcements_history_response';
    announcements?: Array<{
        text: string;         // 公告内容
        created_at: string;   // ISO格式时间字符串
        // 注意：公告不包含character_id和role_name字段
    }>;
}

// 发送公告响应
export interface PostAnnouncementResponse extends BaseResponse {
    type: 'post_announcement_response';
}

// 公告推送
export interface AnnouncementPush extends BaseMessage {
    type: typeof GameConfig.MESSAGE_TYPES.ANNOUNCEMENT;
    text: string;
    // 注意：公告推送不包含character_id和role_name字段
}

// 聊天消息推送
export interface ChatMessagePush extends BaseMessage {
    type: 'chat_message';
    text: string;
    sender: string;           // 发送者角色名
    character_id: string;     // 发送者角色ID
}

/** 第二货币「能量块」；兼容旧字段 points（字符串/数字） */
export function getEnergyBlocksFromPayload(payload: any): number {
    const raw = payload?.energy_blocks ?? payload?.points;
    if (raw === null || raw === undefined || raw === '') return 0;
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.floor(n));
}
