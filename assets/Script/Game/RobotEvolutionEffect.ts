import { _decorator, Component, Node, find, Sprite, SpriteAtlas, SpriteFrame, tween, Vec3, math, resources } from 'cc';
import { ResourceManager } from './ResourceManager';

const { ccclass, property } = _decorator;

/**
 * RobotEvolutionEffect
 * 负责在 Game 场景中控制 RobotJinHua 面板的进化动画。
 * 通过名字查找 `Canvas/RobotJinHua`，无需在编辑器绑定。
 */
@ccclass('RobotEvolutionEffect')
export class RobotEvolutionEffect extends Component {
    private static _instance: RobotEvolutionEffect | null = null;

    @property({ type: Node, tooltip: '根节点，留空则使用当前节点' })
    rootNode: Node | null = null;

    @property({ type: Node, tooltip: '用于显示闪烁的 Sprite 节点，留空则自动查找 Jin/Robot' })
    spriteNode: Node | null = null;

    @property({ type: SpriteAtlas, tooltip: '进化图集，命名规则 AniID-0' })
    atlas: SpriteAtlas | null = null;

    private primarySprite: Sprite | null = null;
    private isPlaying = false;
    private frameCache: Map<string, SpriteFrame> = new Map();
    private currentOldFrameName = '';
    private currentNewFrameName = '';
    private tipNode: Node | null = null;
    private switchCallback: (() => void) | null = null; // 切换回调函数引用
    private closeCallback: (() => void) | null = null; // 关闭回调函数引用
    private useNewFrame = false; // 当前使用的帧（false=旧形态，true=新形态）
    private startTime = 0; // 动画开始时间（毫秒）
    private switchTotal = 3; // 总时长（秒）
    private minInterval = 0.02; // 最快间隔（剧烈切换）
    private maxInterval = 0.15; // 最慢间隔（缓慢切换）
    private loadingFrames: Set<string> = new Set(); // 正在加载的帧名称集合

    public static getInstance(): RobotEvolutionEffect | null {
        if (this._instance && this._instance.node && this._instance.node.isValid) {
            return this._instance;
        }
        // 默认查找 Canvas/RobotJinHua
        const panel = find('Canvas/RobotJinHua');
        if (!panel) {
            console.warn('[RobotEvolutionEffect] 未找到 RobotJinHua 节点');
            return null;
        }
        let comp = panel.getComponent(RobotEvolutionEffect);
        if (!comp) {
            comp = panel.addComponent(RobotEvolutionEffect);
        }
        comp.init();
        this._instance = comp;
        return comp;
    }

    private init() {
        const root = this.spriteNode || this.rootNode || this.node;
        if (!this.spriteNode) {
            // 兼容美术层级：RobotJinHua -> Jin -> Robot
            this.spriteNode = root.getChildByName('Jin')?.getChildByName('Robot') || root.getChildByName('Robot') || root;
        }
        this.primarySprite = this.spriteNode?.getComponent(Sprite) || null;
        // 查找Tip节点（显示"进化成功!"）
        this.tipNode = this.node.getChildByName('Tip') || null;
        if (this.tipNode) {
            this.tipNode.active = false;
        }
    }

    /**
     * 播放进化动画
     * @param oldAniId 旧形态 AniID（如 bl_L1）
     * @param newAniId 新形态 AniID（如 bl_L2 或 bl_L3）
     */
    public playEvolution(oldAniId: string, newAniId: string): void {
        // 停止之前的动画
        this.stopEvolution();
        
        this.init();
        const root = this.rootNode || this.node;
        if (!this.primarySprite) {
            console.warn('[RobotEvolutionEffect] 缺少 Sprite 组件');
            return;
        }

        this.currentOldFrameName = `${oldAniId}-0`;
        this.currentNewFrameName = `${newAniId}-0`;

        console.log('[RobotEvolutionEffect] 请求进化动画', {
            oldAniId,
            newAniId,
            oldFrameName: this.currentOldFrameName,
            newFrameName: this.currentNewFrameName,
        });
        
        // 清空正在加载的帧集合
        this.loadingFrames.clear();
        
        // 注意：不清空缓存，因为帧可能被复用
        // 如果需要强制重新加载，可以删除缓存
        // this.frameCache.delete(this.currentOldFrameName);
        // this.frameCache.delete(this.currentNewFrameName);

        // 显示面板和Robot节点
        this.node.active = true;
        root.active = true;
        root.setScale(new Vec3(1, 1, 1));
        root.setPosition(new Vec3(0, 0, 0));

        // 重置状态
        this.useNewFrame = false;
        this.startTime = Date.now();

        // 尝试获取帧
        const oldFrame = this.getFrameImmediate(this.currentOldFrameName);
        const newFrame = this.getFrameImmediate(this.currentNewFrameName);
        
        // 如果有旧形态的帧，立即显示
        if (oldFrame) {
            this.primarySprite.spriteFrame = oldFrame;
        }
        
        this.isPlaying = true;

        // 如果两个帧都已经加载完成，立即开始动画
        if (oldFrame && newFrame) {
            console.log('[RobotEvolutionEffect] 帧已缓存，立即开始切换动画');
            this.startSwitchAnimation();
        } else {
            // 异步加载帧（如果还没有）
            if (!oldFrame) {
                this.loadFrameAsync(this.currentOldFrameName);
            }
            if (!newFrame) {
                this.loadFrameAsync(this.currentNewFrameName);
            }
            // 如果至少有一个帧已加载，先启动动画（动画会等待另一个帧加载完成）
            if (oldFrame || newFrame) {
                this.startSwitchAnimation();
            }
        }
    }

    /**
     * 停止进化动画
     */
    private stopEvolution(): void {
        this.isPlaying = false;
        if (this.switchCallback) {
            this.unschedule(this.switchCallback);
            this.switchCallback = null;
        }
        if (this.closeCallback) {
            this.unschedule(this.closeCallback);
            this.closeCallback = null;
        }
        tween(this.node).stop();
        if (this.tipNode) {
            tween(this.tipNode).stop();
        }
        // 清空正在加载的帧集合
        this.loadingFrames.clear();
    }

    /**
     * 开始切换动画
     */
    private startSwitchAnimation(): void {
        // 停止之前的调度
        if (this.switchCallback) {
            this.unschedule(this.switchCallback);
            this.switchCallback = null;
        }
        
        const doSwitch = () => {
            if (!this.isPlaying || !this.primarySprite) {
                if (this.switchCallback) {
                    this.unschedule(this.switchCallback);
                    this.switchCallback = null;
                }
                return;
            }
            
            const now = Date.now();
            const elapsed = (now - this.startTime) / 1000; // 已过时间（秒）
            
            // 获取当前帧
            const oldF = this.getFrameImmediate(this.currentOldFrameName);
            const newF = this.getFrameImmediate(this.currentNewFrameName);
            
            // 如果两个帧都加载了，进行切换
            if (oldF && newF) {
                // 切换帧
                this.useNewFrame = !this.useNewFrame;
                const targetFrame = this.useNewFrame ? newF : oldF;
                this.primarySprite!.spriteFrame = targetFrame;
                
                console.log('[RobotEvolutionEffect] ✅ 切换帧', { 
                    elapsed: elapsed.toFixed(2), 
                    useNew: this.useNewFrame, 
                    frameName: targetFrame.name 
                });
                
                // 检查是否应该结束
                if (elapsed >= this.switchTotal) {
                    // 结束时定格在新形态
                    this.primarySprite!.spriteFrame = newF;
                    this.isPlaying = false;
                    if (this.switchCallback) {
                        this.unschedule(this.switchCallback);
                        this.switchCallback = null;
                    }
                    console.log('[RobotEvolutionEffect] 切换完成，定格新形态', { frameName: newF.name });
                    this.showTipAndClose();
                    return;
                }
                
                // 计算当前应该使用的间隔（从快到慢）
                const progress = Math.min(elapsed / this.switchTotal, 1);
                const easeOutProgress = 1 - (1 - progress) * (1 - progress); // easeOutQuad
                const currentInterval = this.minInterval + (this.maxInterval - this.minInterval) * easeOutProgress;
                
                // 取消之前的调度，用新间隔重新调度
                if (this.switchCallback) {
                    this.unschedule(this.switchCallback);
                }
                this.switchCallback = doSwitch;
                this.schedule(this.switchCallback, currentInterval);
            } else {
                // 如果帧还没加载完，等待一下再试
                if (oldF || newF) {
                    // 至少有一个帧加载了，先显示它
                    const availableFrame = newF || oldF;
                    if (availableFrame) {
                        this.primarySprite!.spriteFrame = availableFrame;
                    }
                }
                // 继续等待（短间隔，确保加载完成后立即切换）
                if (this.switchCallback) {
                    this.unschedule(this.switchCallback);
                }
                this.switchCallback = doSwitch;
                this.schedule(this.switchCallback, 0.05);
            }
        };
        
        // 保存回调引用并开始调度
        this.switchCallback = doSwitch;
        this.schedule(this.switchCallback, this.minInterval);
    }

    private getFrameImmediate(frameName: string): SpriteFrame | null {
        if (!frameName) return null;
        if (this.frameCache.has(frameName)) {
            return this.frameCache.get(frameName) || null;
        }
        const atlas = this.atlas;
        if (atlas) {
            const frame = atlas.getSpriteFrame(frameName);
            if (frame) {
                this.frameCache.set(frameName, frame);
                return frame;
            }
        }
        if (this.primarySprite?.spriteFrame && this.primarySprite.spriteFrame.name === frameName) {
            return this.primarySprite.spriteFrame;
        }
        return null;
    }

    private loadFrameAsync(frameName: string) {
        if (!frameName) {
            return;
        }
        
        // 如果已经在缓存中，直接返回
        if (this.frameCache.has(frameName)) {
            // 如果正在播放动画且帧已加载，立即检查是否可以开始切换
            if (this.isPlaying && this.primarySprite) {
                const oldF = this.getFrameImmediate(this.currentOldFrameName);
                const newF = this.getFrameImmediate(this.currentNewFrameName);
                if (oldF && newF && !this.switchCallback) {
                    // 如果调度器意外停止，重新启动
                    this.startSwitchAnimation();
                }
            }
            return;
        }
        
        // 如果正在加载中，避免重复加载
        if (this.loadingFrames.has(frameName)) {
            return;
        }
        
        // 标记为正在加载
        this.loadingFrames.add(frameName);
        
        // 资源已移动到 assets/resources/Robot 目录，文件直接放在 Robot 下
        // Cocos Creator 3.x 中，单张图片会生成 Texture2D + SpriteFrame 子资源：
        //  - 图片导入路径：assets/resources/Robot/xh_L1-0.png
        //  - 对应 SpriteFrame 资源路径：Robot/xh_L1-0/spriteFrame
        // resources.load 的路径不包含 "resources" 前缀，这里直接加载 SpriteFrame 子资源
        const path = `Robot/${frameName}/spriteFrame`;
        console.log('[RobotEvolutionEffect] 开始加载帧', { frameName, path });
        
        // 使用 ResourceManager 统一管理资源缓存
        ResourceManager.getInstance().loadAsset<SpriteFrame>(path, SpriteFrame, (err, sf) => {
            // 移除加载标记
            this.loadingFrames.delete(frameName);
            
            if (err || !sf) {
                console.warn('[RobotEvolutionEffect] 加载帧失败', { frameName, path, err });
                return;
            }
            
            // 检查是否还在播放动画（可能在加载过程中动画已停止）
            if (!this.isPlaying) {
                console.log('[RobotEvolutionEffect] 帧加载完成但动画已停止', { frameName });
                return;
            }
            
            this.frameCache.set(frameName, sf);
            console.log('[RobotEvolutionEffect] 加载帧成功', { frameName, path });
            
            // 图片加载完成后，如果正在播放动画，立即应用
            if (this.isPlaying && this.primarySprite) {
                // 如果是旧形态帧且当前没有显示任何帧，立即显示
                if (frameName === this.currentOldFrameName && !this.primarySprite.spriteFrame) {
                    this.primarySprite.spriteFrame = sf;
                    console.log('[RobotEvolutionEffect] 应用旧形态帧', { frameName });
                }
                // 如果两个帧都加载完成，确保动画已经开始切换
                const oldF = this.getFrameImmediate(this.currentOldFrameName);
                const newF = this.getFrameImmediate(this.currentNewFrameName);
                if (oldF && newF) {
                    if (!this.switchCallback) {
                        // 如果调度器意外停止，重新启动
                        console.log('[RobotEvolutionEffect] 帧加载完成，重新启动切换动画');
                        this.startSwitchAnimation();
                    }
                }
            }
        });
    }

    private showTipAndClose() {
        // 清理之前的关闭回调
        if (this.closeCallback) {
            this.unschedule(this.closeCallback);
            this.closeCallback = null;
        }
        
        // 显示Tip面板（"进化成功!"）
        if (this.tipNode) {
            this.tipNode.active = true;
            // Tip面板可以添加淡入动画（可选）
            this.tipNode.setScale(new Vec3(0, 0, 1));
            tween(this.tipNode)
                .to(0.3, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                .start();
        }
        
        // 2 秒后关闭整個面板（RobotJinHua）
        this.closeCallback = () => {
            this.stopEvolution();
            if (this.tipNode) {
                this.tipNode.active = false;
            }
            this.node.active = false;
            this.closeCallback = null;
        };
        this.scheduleOnce(this.closeCallback, 2);
    }
}

