import { _decorator, Component, Node, Label, Button, UITransform, Animation, Vec3, tween } from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';
import { GameConfig } from '../global/GameConfig';
import { RobotShow } from './RobotShow';
import { DataCacheManager } from '../global/DataCacheManager';
import { MechEquipment } from './MechEquipment';
const { ccclass, property } = _decorator;

@ccclass('MechAttributeTEST')
export class MechAttributeTEST extends Component {
    static SERVER_IP: string = '192.168.2.7';
    static SERVER_PORT: number = 8001;

    // 悬浮效果相关属性
    @property({ tooltip: "悬浮高度" })
    floatAmplitude: number = 10;

    @property({ tooltip: "悬浮动画周期时长" })
    floatDuration: number = 2;

    @property({ tooltip: "启用悬浮效果" })
    enableFloat: boolean = false;
    @property({ tooltip: "悬浮时进行像素对齐，减少锯齿" })
    pixelSnap: boolean = true;
    private originalPosMap: Map<Node, Vec3> = new Map();
    private floatPhaseMap: Map<Node, number> = new Map();
    private floatTime: number = 0;

    @property({ type: [Node], tooltip: "拖拽绑定需要悬浮的节点" })
    floatNodes: Node[] = [];

    @property(Node) Growth: Node = null;
    @property(Node) Comprehension: Node = null;
    @property(Node) StarLevel: Node = null;
    @property(Node) Star: Node = null;
    @property(Node) Melee: Node = null;
    @property(Node) Armor: Node = null;
    @property(Node) Accuracy: Node = null;
    @property(Node) Corrosion: Node = null;
    @property(Node) Initiative: Node = null;
    @property(Node) Block: Node = null;
    @property(Node) ParticleShield: Node = null;
    @property(Node) ArmorPenetration: Node = null;
    @property(Node) Shooting: Node = null;
    @property(Node) Evasion: Node = null;
    @property(Node) Lethality: Node = null;
    @property(Node) Resistance: Node = null;
    @property(Node) Counterattack: Node = null;
    @property(Node) HP: Node = null;
    @property(Node) MP: Node = null;
    @property(Node) EXP: Node = null;
    @property(Button) FetchButton: Button = null;
    @property(Node) RobotName: Node = null;
    @property(Node) Level: Node = null;
    @property(Node) Class: Node = null;
    // 旧：直接绑定 Robot 节点
    @property(Node) Robot: Node = null;

    // 新：独立的机甲展示组件（推荐在预制体上挂 RobotShow，并在这里拖引用）
    @property({ type: RobotShow, tooltip: '机甲展示组件（新的 RobotShow 预制体脚本）' })
    robotShow: RobotShow | null = null;

    private nodeMap: { [key: string]: { left: Label, right: Label, slash: Node } } = {};
    private textMap: { [key: string]: Label } = {};
    private barMap: { [key: string]: { bar: Node, label: Label } } = {};
    private wsManager: WebSocketManager = null!;

    // 初始化状态标记
    private isInitialized: boolean = false;
    private initializationPromise: Promise<void> | null = null;
    
    // 是否已注册消息监听
    private isListenerRegistered: boolean = false;
    
    // 关键修复：跟踪当前应该显示的机甲ID，防止显示错误的机甲
    private currentPetId: string | null = null;

    /** 统一 pet_id 比较（避免大小写/空白导致误判为「另一只」） */
    private normPetId(pid: string | null | undefined): string | null {
        if (pid === null || pid === undefined) return null;
        const s = String(pid).trim();
        return s.length ? s.toLowerCase() : null;
    }

    start() {
        // 性能优化：立即初始化，不延迟
        // 延迟会导致第一次打开面板时等待初始化
        this.initializationPromise = this.initializeAsync();
    }

    /**
     * 异步初始化组件
     */
    private async initializeAsync(): Promise<void> {
        try {
            // 分步初始化，避免一次性处理太多
            await this.initializeTextComponents();
            await this.initializeNodeComponents();
            await this.initializeBarComponents();
            await this.initializeButton();

            // 标记初始化完成
            this.isInitialized = true;

            // 最后启动悬浮效果
            if (this.enableFloat) {
                this.startFloatEffect();
            }
        } catch (error) {
        }
    }

    /**
     * 初始化文本组件
     */
    private async initializeTextComponents(): Promise<void> {
        return new Promise((resolve) => {
            // 普通文本型
            const textKeys = ['Growth', 'Comprehension', 'StarLevel', 'Star', 'RobotName', 'Level', 'Class'];
            for (const key of textKeys) {
                const parent = this[key];
                if (parent) {
                    const labelNode = parent.getChildByName('NumericalValue');
                    if (labelNode) {
                        this.textMap[key] = labelNode.getComponent(Label) || null;
                    }
                }
            }
            resolve();
        });
    }
    /**
     * 初始化节点组件
     */
    private async initializeNodeComponents(): Promise<void> {
        return new Promise((resolve) => {
            // 分割型
            const keys = [
                'Melee', 'Armor', 'Accuracy', 'Corrosion', 'Initiative',
                'Block', 'ParticleShield', 'ArmorPenetration', 'Shooting', 'Evasion', 'Lethality', 'Resistance', 'Counterattack'
            ];
            for (const key of keys) {
                const parent = this[key];
                if (parent) {
                    const layoutNode = parent.getChildByName('Node');
                    if (layoutNode) {
                        this.nodeMap[key] = {
                            left: layoutNode.getChildByName('LeftLabel')?.getComponent(Label) || null,
                            right: layoutNode.getChildByName('RightLabel')?.getComponent(Label) || null,
                            slash: layoutNode.getChildByName('SlashSprite') || null,
                        };
                    }
                }
            }
            resolve();
        });
    }

    /**
     * 初始化进度条组件
     */
    private async initializeBarComponents(): Promise<void> {
        return new Promise((resolve) => {
            // HP/MP/EXP 进度条和数值（panel名称分别为HPpanel、MPpanel、EXPpanel）
            const barKeys = [
                { key: 'HP', max: 'MaxHP', cur: 'CurrentHP', panel: 'HPpanel' },
                { key: 'MP', max: 'MaxMP', cur: 'CurrentMP', panel: 'MPpanel' },
                { key: 'EXP', max: 'MaxEXP', cur: 'CurrentEXP', panel: 'EXPpanel' },
            ];
            for (const item of barKeys) {
                const parent = this[item.key];
                if (parent) {
                    const panel = parent.getChildByName(item.panel);
                    const barNode = panel?.getChildByName(item.cur); // CurrentHP/CurrentMP/CurrentEXP
                    const labelNode = panel?.getChildByName('NumericalValue');
                    if (barNode && labelNode) {
                        this.barMap[item.key] = {
                            bar: barNode,
                            label: labelNode.getComponent(Label) || null,
                        };
                    }
                }
            }
            resolve();
        });
    }

    /**
     * 初始化按钮
     */
    private async initializeButton(): Promise<void> {
        return new Promise((resolve) => {
            if (this.FetchButton) {
                this.FetchButton.node.on('click', this.onFetchClick, this);
            }
            resolve();
        });
    }

    // 启动悬浮效果
    startFloatEffect() {
        if (!this.enableFloat || this.floatNodes.length === 0) return;
        this.originalPosMap.clear();
        this.floatPhaseMap.clear();
        this.floatTime = 0;
        this.floatNodes.forEach((node, index) => {
            if (!node) return;
            this.originalPosMap.set(node, node.position.clone());
            this.floatPhaseMap.set(node, index * 0.35);
        });
    }

    // 为单个节点启动悬浮效果
    startNodeFloat(node: Node, index: number) {}

    // 创建悬浮tween动画
    createFloatTween(node: Node, originalPos: Vec3, offset: number, duration: number, index: number) {}

    // 停止悬浮效果
    stopFloatEffect() {
        this.floatNodes.forEach(node => {
            if (!node) return;
            const orig = this.originalPosMap.get(node);
            if (orig) node.setPosition(orig);
        });
        this.originalPosMap.clear();
        this.floatPhaseMap.clear();
        this.floatTime = 0;
    }

    // 重新启动悬浮效果
    restartFloatEffect() {
        this.stopFloatEffect();
        if (this.enableFloat) {
            this.startFloatEffect();
        }
    }

    // 动态添加悬浮节点
    addFloatNode(node: Node) {
        if (node && this.floatNodes.indexOf(node) === -1) {
            this.floatNodes.push(node);
            if (this.enableFloat) {
                this.startNodeFloat(node, this.floatNodes.length - 1);
            }
        }
    }

    // 移除悬浮节点
    removeFloatNode(node: Node) {
        const index = this.floatNodes.indexOf(node);
        if (index !== -1) {
            // 停止该节点的悬浮动画
            if (node) {
                tween(node).stop();
            }
            this.floatNodes.splice(index, 1);
            // 重新启动所有节点的悬浮效果
            this.restartFloatEffect();
        }
    }

    // 清空所有悬浮节点
    clearFloatNodes() {
        this.stopFloatEffect();
        this.floatNodes = [];
    }

    // 设置悬浮参数
    setFloatParams(amplitude: number, duration: number) {
        this.floatAmplitude = amplitude;
        this.floatDuration = duration;
        if (this.enableFloat) {
            this.restartFloatEffect();
        }
    }

    // 切换悬浮效果开关
    toggleFloatEffect() {
        this.enableFloat = !this.enableFloat;
        if (this.enableFloat) {
            this.startFloatEffect();
        } else {
            this.stopFloatEffect();
        }
    }

    update(dt: number) {
        if (!this.enableFloat || this.floatNodes.length === 0) return;
        this.floatTime += dt;
        const omega = (Math.PI * 2) / Math.max(0.0001, this.floatDuration);
        for (const node of this.floatNodes) {
            if (!node) continue;
            const orig = this.originalPosMap.get(node);
            if (!orig) continue;
            const phase = this.floatPhaseMap.get(node) || 0;
            const y = orig.y + Math.sin(this.floatTime * omega + phase) * this.floatAmplitude;
            const x = orig.x;
            const z = orig.z;
            if (this.pixelSnap) {
                node.setPosition(Math.round(x), Math.round(y), Math.round(z));
            } else {
                node.setPosition(x, y, z);
            }
        }
    }

    /**
     * 格式化经验值显示（仅用于经验条）
     * 超过1万显示为"X万"（四舍五入），不超过显示阿拉伯数字
     */
    formatExpValue(val: number): string {
        if (val >= 10000) {
            const wanValue = Math.round(val / 10000);
            return `${wanValue}万`;
        }
        return String(val);
    }

    setBarWidth(barNode: Node, cur: number, max: number) {
        if (!barNode) return;
        const percent = Math.max(0, Math.min(1, max > 0 ? cur / max : 0));
        const width = Math.max(1, 147 * percent);
        const uiTrans = barNode.getComponent(UITransform);
        if (uiTrans) {
            uiTrans.setContentSize(width, uiTrans.height);
        }
    }

    async onFetchClick() {
        try {
            // 检查初始化状态
            if (!this.isInitialized) {
                if (this.initializationPromise) {
                    await this.initializationPromise;
                } else {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            // 再次检查初始化状态
            if (!this.isInitialized) {
                return;
            }

            this.wsManager = WebSocketManager.getInstance();
            
            // 注册消息监听（只注册一次）
            if (!this.isListenerRegistered) {
                this.wsManager.on(GameConfig.MESSAGE_TYPES.ROBOT_INFO, this.onRobotInfo, this);
                this.wsManager.on(GameConfig.MESSAGE_TYPES.ROBOT_PET_INFO_RESPONSE, this.onRobotInfo, this);
                this.isListenerRegistered = true;
            }
            
            this.wsManager.send({ type: GameConfig.MESSAGE_TYPES.GET_RANDOM_ROBOT } as any, false);
            return;
        
        } catch (err) {
        }
    }

    private onRobotInfo = (data: any) => {
        try {
            // 关键修复：即使 success 为 false，也尝试使用数据（可能是部分数据）
            // 但如果没有数据对象本身，则返回
            if (!data) { 
                return; 
            }
            
            // 关键修复：提取 petId 并验证是否匹配当前显示的机甲
            const rawPetId = data.pet_id ?? data.data?.pet_id ?? null;
            const petId = rawPetId !== null && rawPetId !== undefined ? String(rawPetId) : null;
            const normIncoming = this.normPetId(petId);
            const normCurrent = this.normPetId(this.currentPetId);

            // 如果界面已有目标机甲ID，而本次消息没有 petId 或者与当前不一致，则跳过
            if (normCurrent !== null) {
                if (!normIncoming) {
                    return;
                }
                if (normIncoming !== normCurrent) {
                    return;
                }
            }
            
            // 如果 success 为 false，继续处理（可能是部分数据或缓存数据）
            if (data.success === false) {
                // 不直接返回，继续处理，因为可能包含部分有效数据
            }
            
            // 关键修复：更新 currentPetId（如果数据中有 petId）
            if (petId) {
                this.currentPetId = String(petId).trim();
            }
            
            for (const key in this.textMap) {
                if (this.textMap[key]) {
                    if (key === 'Star') {
                        this.textMap[key].string = String(data['StarLevel'] ?? '');
                    } else if (key === 'RobotName') {
                        const name = data['RobotName'] ?? '';
                        // 优先使用Form字段，如果没有则使用Fo字段（兼容性）
                        const formNum = data['Form'] !== undefined ? data['Form'] : (data['Fo'] !== undefined ? data['Fo'] : 0);
                        let formSuffix = '';
                        if (formNum === 1) formSuffix = '|初';
                        else if (formNum === 2) formSuffix = '|中';
                        else if (formNum === 3) formSuffix = '|终';
                        this.textMap[key].string = name + formSuffix;
                    } else if (key === 'Class') {
                        const classNum = data['Class'];
                        let classStr = '';
                        if (classNum === 1) classStr = '格斗型';
                        else if (classNum === 2) classStr = '射击型';
                        else if (classNum === 3) classStr = '全能型';
                        this.textMap[key].string = classStr;
                    } else if (key === 'Level') {
                        this.textMap[key].string = String(data['Level'] ?? '');
                    } else {
                        this.textMap[key].string = String(data[key] ?? '');
                    }
                }
            }
            for (const key in this.nodeMap) {
                const group = this.nodeMap[key];
                if (group.left && group.right && group.slash) {
                    const currentKey = 'Current' + key;
                    const baseValue = data[key] ?? 0;
                    const currentValue = data[currentKey];
                    // 如果存在 Current 字段（包括值为 0 的情况），显示基础值/当前值
                    if (Object.prototype.hasOwnProperty.call(data, currentKey)) {
                        group.left.string = String(baseValue);
                        group.right.string = String(currentValue ?? 0);
                        group.slash.active = true;
                    } else {
                        // 如果不存在 Current 字段，只显示基础值
                        group.left.string = String(baseValue);
                        group.right.string = '';
                        group.slash.active = false;
                    }
                }
            }
            const barKeys = [
                { key: 'HP', max: 'MaxHP', cur: 'CurrentHP', panel: 'HPpanel' },
                { key: 'MP', max: 'MaxMP', cur: 'CurrentMP', panel: 'MPpanel' },
                { key: 'EXP', max: 'MaxEXP', cur: 'CurrentEXP', panel: 'EXPpanel' },
            ];
            for (const item of barKeys) {
                const bar = this.barMap[item.key];
                if (bar && bar.label && bar.bar) {
                    const cur = data[item.cur] ?? 0;
                    const max = data[item.max] ?? 0;
                    // 只有经验条显示"万"格式，其他属性直接显示数字
                    if (item.key === 'EXP') {
                        bar.label.string = `${this.formatExpValue(cur)}/${this.formatExpValue(max)}`;
                    } else {
                        bar.label.string = `${cur}/${max}`;
                    }
                    this.setBarWidth(bar.bar, cur, max);
                }
            }

            // —— 机甲形象展示 —— //
            // 关键修复：即使 success 为 false，也尝试更新 RobotShow（可能包含装备数据）
            if (this.robotShow) {
                // 优先走新的 RobotShow 组件（包含动画 + 装备图标）
                try {
                    // 关键修复：确保 data 中包含 petId，以便 RobotShow 可以验证数据匹配
                    const dataWithPetId = {
                        ...data,
                        pet_id: this.currentPetId || petId || data.pet_id || data.data?.pet_id || null
                    };
                    this.robotShow.updateFromRobotData(dataWithPetId);
                } catch (error) {
                }
            } else if (this.Robot) {
                // 兼容旧逻辑：直接在 Robot 节点上播放动画
                const anim = this.Robot.getComponent(Animation);
                if (anim && Array.isArray((anim as any).clips) && (anim as any).clips.length > 0) {
                    const clips: any[] = (anim as any).clips;
                    const aniID = data['AniID'] || '';
                    
                    if (aniID && typeof aniID === 'string') {
                        const targetClip = clips.find((clip: any) => clip && clip.name === aniID);
                        if (targetClip) {
                            anim.play(aniID);
                        } else {
                            const idx = Math.floor(Math.random() * clips.length);
                            const clip = clips[idx];
                            if (clip && clip.name) {
                                anim.play(clip.name);
                            }
                        }
                    } else {
                        const idx = Math.floor(Math.random() * clips.length);
                        const clip = clips[idx];
                        if (clip && clip.name) {
                            anim.play(clip.name);
                        }
                    }
                }
            }
            
            // 关键修复：缓存数据到 DataCacheManager，供其他组件使用
            // 注意：使用 this.currentPetId 或已提取的 petId，因为已经在前面提取并更新了
            const cacheManager = DataCacheManager.getInstance();
            // 使用已更新的 currentPetId 或之前提取的 petId
            const cachePetId = this.currentPetId || petId;
            if (cachePetId) {
                // 确保缓存的数据格式正确（包含 success 字段和 equipment 字段）
                const cacheData = {
                    success: true,
                    pet_id: cachePetId,
                    equipment: data.data?.equipment || data.equipment || {},
                    ...data  // 保留其他字段
                };
                cacheManager.setRobotPetInfoCache(cachePetId, cacheData);
            }
        } catch (e) {
        }
    }
    
    /**
     * 根据pet_id获取并显示指定的机甲信息
     * @param petId 机甲宠物的_id
     */
    public async showSelectedRobot(petId: string): Promise<void> {
        try {
            // 关键修复：设置当前应该显示的机甲ID
            const wantedId = petId ? String(petId).trim() : null;
            this.currentPetId = wantedId;

            // 关键修复：先尝试使用缓存数据，解决首次打开不显示的问题
            const cacheManager = DataCacheManager.getInstance();
            const cachedData = wantedId ? cacheManager.getRobotPetInfoCache(wantedId) : null;
            
            // 关键修复：通知 MechEquipment 组件设置 currentPetId
            // 这样 MechEquipment 可以在 onEnable 时使用缓存
            let mechEquipment: MechEquipment | null = null;
            if (this.node && this.node.parent) {
                mechEquipment = this.node.parent.getComponentInChildren(MechEquipment);
            }
            if (!mechEquipment && this.node && this.node.scene) {
                mechEquipment = this.node.scene.getComponentInChildren(MechEquipment);
            }
            if (mechEquipment && typeof mechEquipment.setCurrentPetId === 'function') {
                mechEquipment.setCurrentPetId(wantedId || '');
            }

            // 若缓存条目内的 pet_id 与当前选择不一致，不要用（避免错键或脏数据）
            if (cachedData && wantedId) {
                const cRaw = cachedData.pet_id ?? cachedData.data?.pet_id;
                const cStr = cRaw !== undefined && cRaw !== null ? String(cRaw).trim() : '';
                const cachePetOk = !cStr || this.normPetId(cRaw) === this.normPetId(wantedId);
                if (cachePetOk) {
                    this.onRobotInfo(cachedData);
                }
            }
            
            // 性能优化：立即发送请求，不阻塞等待初始化
            // 这样可以先发送请求，然后在后台等待初始化完成
            this.wsManager = WebSocketManager.getInstance();
            if (!this.wsManager) {
                return;
            }
            
            // 注册消息监听（只注册一次）
            if (!this.isListenerRegistered) {
                this.wsManager.on(GameConfig.MESSAGE_TYPES.ROBOT_INFO, this.onRobotInfo, this);
                this.wsManager.on(GameConfig.MESSAGE_TYPES.ROBOT_PET_INFO_RESPONSE, this.onRobotInfo, this);
                this.isListenerRegistered = true;
            }
            
            // 优化：使用request方法，自动生成request_id并匹配响应
            // 即使有缓存，也请求最新数据以确保数据实时性
            this.wsManager.request(
                GameConfig.MESSAGE_TYPES.GET_ROBOT_PET_INFO,
                {
                    pet_id: wantedId || petId
                },
                (response: any) => {
                    // 快速切换机甲时丢弃晚到的响应，避免详情页刷成上一只
                    if (wantedId && this.normPetId(this.currentPetId) !== this.normPetId(wantedId)) {
                        return;
                    }
                    this.onRobotInfo(response);
                },
                true, // 需要认证
                10000 // 10秒超时
            );
            
            // 如果还没初始化完成，在后台等待（不阻塞请求）
            if (!this.isInitialized) {
                if (this.initializationPromise) {
                    // 后台等待初始化完成（响应会被缓存并在初始化完成后处理）
                    this.initializationPromise.catch(() => {});
                } else {
                    // 如果初始化还没开始，启动它
                    this.initializationPromise = this.initializeAsync();
                }
            }
            
        } catch (err) {
        }
    }
    
    onDestroy() {
        // 清理事件监听
        if (this.wsManager && this.isListenerRegistered) {
            this.wsManager.off(GameConfig.MESSAGE_TYPES.ROBOT_INFO, this.onRobotInfo, this);
            this.wsManager.off(GameConfig.MESSAGE_TYPES.ROBOT_PET_INFO_RESPONSE, this.onRobotInfo, this);
            this.isListenerRegistered = false;
        }
    }
}
