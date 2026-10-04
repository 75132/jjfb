import { _decorator, Component, Node, Sprite, Animation, AnimationClip, UITransform } from 'cc';
import { ResourceManager } from '../ResourceManager';
import { Logger } from '../../global/Logger';

const { ccclass, property } = _decorator;

type MoveDir = 'left' | 'right' | 'up' | 'down';
type MountSide = 'ul' | 'dr';

const CLIP_SUFFIXES = ['walk_ul', 'idle_ul', 'walk_dr', 'idle_dr'] as const;

/**
 * 座驾节点控制器：挂在 Player/ZuoJia（或由 PlayerGridMove 运行时 addComponent）。
 * - 仅开启后显示并播放动画
 * - 朝向与人物一致：left|up → 左上侧(ul)，right|down → 右下侧(dr)（原 GIF 分段）
 * - 换向时强制切 clip，避免卡在上一侧动画
 * - 动画：resources/ZuoJia/ani/{id}_{walk|idle}_{ul|dr}（GIF 120ms/帧）
 */
@ccclass('MountController')
export class MountController extends Component {
    @property({ tooltip: '座驾资源 id（car4 / zuojia4~9）' })
    mountId = 'zuojia7';

    @property({ tooltip: '进场景时是否直接开启座驾（调试用；正式 UI 做好后改为 false）' })
    startEnabled = true;

    private _anim: Animation | null = null;
    private _sprite: Sprite | null = null;
    private _enabledMount = false;
    private _loadedId = '';
    private _facing: MoveDir = 'down';
    private _moving = false;
    private _loading = false;
    private _playingClip = '';

    onLoad() {
        this._sprite = this.getComponent(Sprite) || this.addComponent(Sprite);
        this._sprite.trim = false;
        this._sprite.sizeMode = Sprite.SizeMode.RAW;
        this._anim = this.getComponent(Animation) || this.addComponent(Animation);
        if (this._anim) this._anim.playOnLoad = false;
        if (!this.getComponent(UITransform)) this.addComponent(UITransform);
        if (!this.startEnabled) {
            this.node.active = false;
        }
    }

    start() {
        if (this.startEnabled) {
            this.setEnabled(true);
        }
    }

    public get enabledMount(): boolean {
        return this._enabledMount;
    }

    public get currentMountId(): string {
        return this.mountId;
    }

    public setEnabled(on: boolean): void {
        this._enabledMount = !!on;
        if (!on) {
            this.node.active = false;
            this._playingClip = '';
            try { this._anim?.stop(); } catch { /* ignore */ }
            return;
        }
        this.node.active = true;
        this._ensureClipsThenPlay();
    }

    public setMountId(id: string): void {
        const next = (id || '').trim();
        if (!next || next === this.mountId) return;
        this.mountId = next;
        this._loadedId = '';
        this._playingClip = '';
        if (this._enabledMount) {
            this._ensureClipsThenPlay();
        }
    }

    /** 与 PlayerGridMove 同步：移动中播 walk，停下播 idle */
    public syncMoveState(dir: MoveDir, moving: boolean): void {
        if (!this._enabledMount) {
            this._facing = dir;
            this._moving = moving;
            return;
        }
        if (!this.node.active) this.node.active = true;
        if (this._loadedId !== this.mountId) {
            this._facing = dir;
            this._moving = moving;
            this._ensureClipsThenPlay();
            return;
        }
        if (moving) this.playMove(dir);
        else this.playIdle(dir);
    }

    public playMove(dir: MoveDir, force = false): void {
        const side = this._sideOf(dir);
        const next = this._clipName('walk', side);
        const needSwitch = force || this._playingClip !== next;
        this._facing = dir;
        this._moving = true;
        this._play(next, needSwitch);
    }

    public playIdle(dir: MoveDir, force = false): void {
        const side = this._sideOf(dir);
        const next = this._clipName('idle', side);
        const needSwitch = force || this._playingClip !== next;
        this._facing = dir;
        this._moving = false;
        this._play(next, needSwitch);
    }

    /** 与人物四向对齐：左/上→左上侧，右/下→右下侧（同原 GIF：左走上走 / 下走右走） */
    private _sideOf(dir: MoveDir): MountSide {
        return dir === 'left' || dir === 'up' ? 'ul' : 'dr';
    }

    private _clipName(kind: 'walk' | 'idle', side: MountSide): string {
        return `${this.mountId}_${kind}_${side}`;
    }

    private _play(name: string, force: boolean): void {
        const anim = this._anim;
        if (!anim || !this._enabledMount) return;
        const st = anim.getState(name);
        if (!st) {
            Logger.warn(`[MountController] 缺少动画 state: ${name}`);
            return;
        }
        if (!force && this._playingClip === name && st.isPlaying) return;
        anim.play(name);
        this._playingClip = name;
    }

    private _ensureClipsThenPlay(): void {
        const id = (this.mountId || '').trim();
        if (!id) return;
        if (this._loadedId === id && this._anim?.getState(`${id}_idle_dr`)) {
            if (this._moving) this.playMove(this._facing, true);
            else this.playIdle(this._facing, true);
            return;
        }
        if (this._loading) return;
        this._loading = true;
        const names = CLIP_SUFFIXES.map((s) => `${id}_${s}`);
        const clips: AnimationClip[] = [];
        let pending = names.length;
        let failed = false;

        const finishOne = (clip: AnimationClip | null) => {
            if (clip) clips.push(clip);
            else failed = true;
            pending--;
            if (pending > 0) return;
            this._loading = false;
            if (failed || clips.length !== names.length) {
                Logger.warn(`[MountController] 座驾动画加载失败: ${id}`);
                return;
            }
            const anim = this._anim;
            if (!anim) return;
            anim.clips = clips;
            this._loadedId = id;
            this._playingClip = '';
            if (this._enabledMount) {
                if (this._moving) this.playMove(this._facing, true);
                else this.playIdle(this._facing, true);
            }
        };

        const rm = ResourceManager.getInstance();
        for (let i = 0; i < names.length; i++) {
            const name = names[i];
            rm.loadAsset<AnimationClip>(`ZuoJia/ani/${name}`, AnimationClip, (err, clip) => {
                if (err || !clip) {
                    Logger.warn(`[MountController] 加载失败: ZuoJia/ani/${name}`, err);
                    finishOne(null);
                    return;
                }
                try {
                    if (clip.name !== name) (clip as any).name = name;
                } catch { /* ignore */ }
                finishOne(clip);
            });
        }
    }

    public static ensureOnPlayer(player: Node): MountController | null {
        if (!player?.isValid) return null;
        let n = player.getChildByName('ZuoJia');
        if (!n) {
            n = new Node('ZuoJia');
            n.layer = player.layer;
            n.setParent(player);
            n.setPosition(0, -28, 0);
            n.addComponent(UITransform).setContentSize(96, 96);
            const sp = n.addComponent(Sprite);
            sp.trim = false;
            sp.sizeMode = Sprite.SizeMode.RAW;
            n.active = false;
        }
        n.setSiblingIndex(0);
        return n.getComponent(MountController) || n.addComponent(MountController);
    }
}
