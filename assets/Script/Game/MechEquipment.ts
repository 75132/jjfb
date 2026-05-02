import { _decorator, Component, Node, Label, Button } from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';
import { GameConfig } from '../global/GameConfig';
import { DataCacheManager } from '../global/DataCacheManager';
const { ccclass, property } = _decorator;

/**
 * 机甲装备组件
 * 管理10个装备槽位：Weapon, Gun, Dun, Wing, Xinpian, Toukai, Jianjia, Xiongkai, Tuikai, Shoukai
 */
@ccclass('MechEquipment')
export class MechEquipment extends Component {
    // 槽位节点映射（通过属性面板绑定）
    @property({ type: Node, tooltip: "武器槽位节点（Weapon）" })
    weaponSlot: Node = null!;
    
    @property({ type: Node, tooltip: "枪械槽位节点（Gun）" })
    gunSlot: Node = null!;
    
    @property({ type: Node, tooltip: "盾牌槽位节点（Dun）" })
    dunSlot: Node = null!;
    
    @property({ type: Node, tooltip: "机翼槽位节点（Wing）" })
    wingSlot: Node = null!;
    
    @property({ type: Node, tooltip: "芯片槽位节点（Xinpian）" })
    xinpianSlot: Node = null!;
    
    @property({ type: Node, tooltip: "头凯槽位节点（Toukai）" })
    toukaiSlot: Node = null!;
    
    @property({ type: Node, tooltip: "肩甲槽位节点（Jianjia）" })
    jianjiaSlot: Node = null!;
    
    @property({ type: Node, tooltip: "胸铠槽位节点（Xiongkai）" })
    xiongkaiSlot: Node = null!;
    
    @property({ type: Node, tooltip: "腿铠槽位节点（Tuikai）" })
    tuikaiSlot: Node = null!;
    
    @property({ type: Node, tooltip: "手铠槽位节点（Shoukai）" })
    shoukaiSlot: Node = null!;
    
    private ws: WebSocketManager = null!;
    private currentPetId: string = '';  // 当前显示的机甲ID
    private slotMap: Map<string, Node> = new Map();  // 槽位名称到节点的映射
    private slotLabelMap: Map<string, Label> = new Map();  // 槽位名称到Label的映射
    private slotRemoveButtonMap: Map<string, Button> = new Map();  // 槽位名称到Remove按钮的映射
    private lastEquipment: any = null; // 缓存最近一次的装备数据（防止面板初次打开时为空）
    
    // 槽位名称列表（按顺序）
    private readonly SLOT_NAMES = [
        'Weapon', 'Gun', 'Dun', 'Wing', 'Xinpian',
        'Toukai', 'Jianjia', 'Xiongkai', 'Tuikai', 'Shoukai'
    ];
    
    onLoad() {
        this.ws = WebSocketManager.getInstance();
        
        // 关键修复：确保 ws 已初始化
        if (!this.ws) {
            return;
        }
        
        // 初始化槽位映射
        this.initSlotMaps();
        
        // 注册事件监听
        this.ws.on(GameConfig.MESSAGE_TYPES.ROBOT_PET_INFO_RESPONSE, this.onRobotPetInfo, this);
        // 有些服务端可能推送 robot_info（无 _response），一起兼容
        this.ws.on(GameConfig.MESSAGE_TYPES.ROBOT_INFO as any, this.onRobotPetInfo, this);
        this.ws.on('unequip_item_response', this.onUnequipItemResponse, this);
    }

    onEnable() {
        // 关键修复：优先使用数据缓存管理器的缓存，解决首次打开不显示的问题
        // 策略：
        // 1. 如果 currentPetId 已设置，使用它
        // 2. 如果 currentPetId 未设置，尝试从 MechAttributeTEST 获取
        // 3. 使用 lastEquipment（组件内部缓存）
        // 4. 使用 DataCacheManager 缓存
        // 5. 请求最新数据
        
        // 注意：如果 currentPetId 未设置，我们依赖 MechAttributeTEST.showSelectedRobot()
        // 来调用 setCurrentPetId() 设置 petId，或者通过事件来获取数据
        
        // 优先使用组件内部缓存
        if (this.lastEquipment) {
            this.updateEquipmentDisplay(this.lastEquipment);
        } else if (this.currentPetId) {
            // 尝试使用数据缓存管理器的缓存
            const cacheManager = DataCacheManager.getInstance();
            const cachedData = cacheManager.getRobotPetInfoCache(this.currentPetId);
            if (cachedData && (cachedData.success !== false)) {
                // 使用缓存数据更新显示
                const equipment = cachedData.data?.equipment || cachedData.equipment || {};
                if (Object.keys(equipment).length > 0 || this.hasEquipment(equipment)) {
                    this.lastEquipment = equipment;
                    this.updateEquipmentDisplay(equipment);
                } else {
                    // 缓存中没有装备数据，请求最新数据
                    this.requestRobotPetInfo(this.currentPetId);
                }
            } else {
                // 没有缓存，请求最新数据
                this.requestRobotPetInfo(this.currentPetId);
            }
        } else {
            // 如果 currentPetId 也没有，等待 setCurrentPetId 被调用或事件触发
        }
    }
    
    /**
     * 检查装备数据是否为空（辅助方法）
     */
    private hasEquipment(equipment: any): boolean {
        if (!equipment || typeof equipment !== 'object') {
            return false;
        }
        // 检查是否有任何槽位有装备
        for (const slotName of this.SLOT_NAMES) {
            if (equipment[slotName] && equipment[slotName].item_id) {
                return true;
            }
        }
        return false;
    }
    
    onDestroy() {
        // 移除事件监听
        if (this.ws) {
            this.ws.off(GameConfig.MESSAGE_TYPES.ROBOT_PET_INFO_RESPONSE, this.onRobotPetInfo, this);
            this.ws.off(GameConfig.MESSAGE_TYPES.ROBOT_INFO as any, this.onRobotPetInfo, this);
            this.ws.off('unequip_item_response', this.onUnequipItemResponse, this);
        }
    }
    
    /**
     * 初始化槽位映射
     */
    private initSlotMaps(): void {
        // 槽位节点数组（按顺序对应SLOT_NAMES）
        const slotNodes = [
            this.weaponSlot, this.gunSlot, this.dunSlot, this.wingSlot, this.xinpianSlot,
            this.toukaiSlot, this.jianjiaSlot, this.xiongkaiSlot, this.tuikaiSlot, this.shoukaiSlot
        ];
        
        for (let i = 0; i < this.SLOT_NAMES.length; i++) {
            const slotName = this.SLOT_NAMES[i];
            const slotNode = slotNodes[i];
            
            if (!slotNode) {
                continue;
            }
            
            // 存储槽位节点
            this.slotMap.set(slotName, slotNode);
            
            // 查找Label组件（用于显示装备名）
            const labelNode = slotNode.getChildByName('Label');
            if (labelNode) {
                const label = labelNode.getComponent(Label);
                if (label) {
                    this.slotLabelMap.set(slotName, label);
                    // 初始化为空并隐藏
                    label.string = '';
                    labelNode.active = false;
                }
            }
            
            // 查找Remove按钮
            const removeNode = slotNode.getChildByName('Remove');
            if (removeNode) {
                const removeButton = removeNode.getComponent(Button);
                if (removeButton) {
                    this.slotRemoveButtonMap.set(slotName, removeButton);
                    // 绑定点击事件
                    removeButton.node.on(Button.EventType.CLICK, () => {
                        this.onRemoveButtonClick(slotName);
                    }, this);
                    // 初始隐藏
                    removeButton.node.active = false;
                }
            }
        }
    }
    
    /**
     * 处理机甲信息响应（更新装备显示）
     */
    private onRobotPetInfo = (data: any): void => {
        try {
            // 关键修复：兼容不同的响应格式
            // 支持格式：{ success: true, data: { ... } } 或 { success: true, ... }
            const success = data?.success !== false;
            
            if (!data || !success) {
                return;
            }
            
            // 提取 pet_id（支持多种格式）
            const petId = data.pet_id || data.data?.pet_id;
            if (!petId) {
                return;
            }
            
            // 保存当前机甲ID（关键：确保在收到数据时设置）
            this.currentPetId = petId;
            
            // 获取装备数据（支持多种格式）
            const equipment = data.data?.equipment || data.equipment || {};

            // 缓存一份，面板再次打开时可直接显示
            this.lastEquipment = equipment;
            
            // 关键修复：同时更新到数据缓存管理器，供其他组件使用
            const cacheManager = DataCacheManager.getInstance();
            // 确保缓存的数据格式正确（包含 success 字段）
            const cacheData = {
                success: true,
                pet_id: petId,
                equipment: equipment,
                ...data  // 保留其他字段
            };
            cacheManager.setRobotPetInfoCache(petId, cacheData);
            
            // 更新所有槽位显示
            this.updateEquipmentDisplay(equipment);
            
        } catch (error) {
        }
    }
    
    /**
     * 更新装备显示
     */
    private updateEquipmentDisplay(equipment: any): void {
        for (const slotName of this.SLOT_NAMES) {
            const equippedItem = equipment[slotName];
            const label = this.slotLabelMap.get(slotName);
            const removeButton = this.slotRemoveButtonMap.get(slotName);
            
            if (equippedItem && equippedItem.item_id) {
                // 有装备，显示装备名和Remove按钮
                const itemName = equippedItem.name || `物品${equippedItem.item_id}`;
                if (label) {
                    label.string = itemName;
                    label.node.active = true;  // 显示Label节点
                }
                // 显示Remove按钮
                if (removeButton) {
                    removeButton.node.active = true;
                }
            } else {
                // 无装备，隐藏Label和Remove按钮
                if (label) {
                    label.string = '';
                    label.node.active = false;  // 隐藏Label节点
                }
                // 隐藏Remove按钮
                if (removeButton) {
                    removeButton.node.active = false;
                }
            }
        }
    }
    
    /**
     * Remove按钮点击事件
     */
    private onRemoveButtonClick(slotName: string): void {
        if (!this.currentPetId) {
            return;
        }
        
        // 关键修复：确保 ws 已初始化
        if (!this.ws) {
            this.ws = WebSocketManager.getInstance();
        }
        
        if (!this.ws) {
            return;
        }
        
        // 获取当前角色ID和Token（使用WebSocketManager）
        const characterId = this.ws.getCharacterId();
        const token = this.ws.getToken();
        
        if (!characterId) {
            return;
        }
        
        if (!token) {
            return;
        }
        
        // 发送卸下装备请求
        const requestData = {
            type: 'unequip_item',
            token: token,
            character_id: characterId,
            pet_id: this.currentPetId,
            slot_name: slotName
        };
        
        // 修复：直接传递对象，不要使用 JSON.stringify()
        // WebSocketManager.send() 内部会处理 JSON 序列化
        this.ws.send(requestData as any);
    }
    
    /**
     * 处理卸下装备响应
     */
    private onUnequipItemResponse = (data: any): void => {
        try {
            // 支持两种响应格式：data.success 或 data.data.success
            const success = data?.success ?? data?.data?.success ?? false;
            if (!success) {
                return;
            }
            
            // 关键修复：装备变更后清除缓存，确保下次打开时获取最新数据
            if (this.currentPetId) {
                const cacheManager = DataCacheManager.getInstance();
                cacheManager.clearRobotPetInfoCache(this.currentPetId);
            }
            
            // 延迟一小段时间后重新请求机甲信息，确保服务器端数据已更新
            setTimeout(() => {
                if (this.currentPetId) {
                    this.requestRobotPetInfo(this.currentPetId);
                }
            }, 100);  // 延迟100ms
            
        } catch (error) {
        }
    }
    
    /**
     * 请求机甲信息（用于刷新装备显示）
     */
    public requestRobotPetInfo(petId: string): void {
        if (!petId) {
            return;
        }
        
        // 关键修复：确保 ws 已初始化
        if (!this.ws) {
            this.ws = WebSocketManager.getInstance();
        }
        
        if (!this.ws) {
            return;
        }
        
        const characterId = this.ws.getCharacterId();
        const token = this.ws.getToken();
        
        if (!characterId) {
            return;
        }
        
        if (!token) {
            return;
        }
        
        // 优化：使用request方法，自动生成request_id并匹配响应
        this.ws.request(
            'get_robot_pet_info',
            {
                character_id: characterId,
                pet_id: petId
            },
            (response: any) => {
                // 通过request_id匹配的响应回调
            },
            true, // 需要认证
            10000 // 10秒超时
        );
    }
    
    /**
     * 设置当前机甲ID（外部调用，用于切换显示的机甲）
     */
    public setCurrentPetId(petId: string): void {
        const previousPetId = this.currentPetId;
        this.currentPetId = petId;
        
        // 如果是相同的 petId，不需要清缓存
        if (previousPetId === petId && this.lastEquipment) {
            // 相同的机甲，直接使用缓存显示
            this.updateEquipmentDisplay(this.lastEquipment);
            return;
        }
        
        // 切换机甲时清掉旧缓存，保证显示的是新机甲的装备
        this.lastEquipment = null;
        
        if (petId) {
            // 关键修复：先尝试使用 DataCacheManager 的缓存
            const cacheManager = DataCacheManager.getInstance();
            const cachedData = cacheManager.getRobotPetInfoCache(petId);
            if (cachedData && (cachedData.success !== false)) {
                const equipment = cachedData.data?.equipment || cachedData.equipment || {};
                if (this.hasEquipment(equipment)) {
                    this.lastEquipment = equipment;
                    this.updateEquipmentDisplay(equipment);
                } else {
                    // 缓存中没有装备数据，请求最新数据
                    this.requestRobotPetInfo(petId);
                }
            } else {
                // 没有缓存，请求最新数据
                this.requestRobotPetInfo(petId);
            }
        } else {
            // 清空所有槽位显示
            this.updateEquipmentDisplay({});
        }
    }
}

