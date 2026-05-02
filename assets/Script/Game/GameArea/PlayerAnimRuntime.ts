import { _decorator, Component, Animation, AnimationClip } from 'cc';
import { PlayerAnimBank } from './PlayerAnimBank';

const { ccclass, property } = _decorator;

type MoveDir = 'left' | 'right' | 'up' | 'down';

@ccclass('PlayerAnimRuntime')
export class PlayerAnimRuntime extends Component {
    @property({ type: PlayerAnimBank, tooltip: '动画库（全局一个节点挂一次即可）' })
    bank: PlayerAnimBank | null = null;

    @property({ tooltip: '是否在切换Sprite时强制停止并切到待机' })
    resetOnApply = true;

    private anim: Animation | null = null;
    private _prefix = 'player1';
    private _facing: MoveDir = 'down';

    onLoad() {
        this.anim = this.getComponent(Animation);
        if (this.anim) {
            this.anim.playOnLoad = false;
        }
    }

    public get prefix(): string {
        return this._prefix;
    }

    public setFacing(dir: MoveDir) {
        this._facing = dir;
    }

    /** 服务器Sprite=7 => player7，并注入8个clip到本节点 Animation */
    public applyServerSprite(spriteIndex: number): boolean {
        const idx = Math.floor(Number(spriteIndex));
        if (!Number.isFinite(idx) || idx <= 0) return false;
        return this.applyPrefix(`player${idx}`);
    }

    public applyPrefix(prefix: string): boolean {
        const anim = this.anim;
        const bank = this.bank;
        const p = (prefix || '').trim();
        if (!anim || !bank || !p) return false;

        const neededNames = this._neededClipNames(p);
        const clips: AnimationClip[] = [];
        const missing: string[] = [];
        for (let i = 0; i < neededNames.length; i++) {
            const name = neededNames[i];
            const clip = bank.getClip(name);
            if (!clip) missing.push(name);
            else clips.push(clip);
        }
        if (missing.length) {
            console.warn(`[PlayerAnimRuntime] 动画库缺少clip: ${missing.join(', ')}`);
            return false;
        }

        // 注入：只保留当前角色8个，避免串号
        anim.clips = clips;
        this._prefix = p;

        if (this.resetOnApply) {
            try { anim.stop(); } catch {}
            this.playIdle(this._facing, true);
        }
        return true;
    }

    public playMove(dir: MoveDir, force = false): void {
        this._facing = dir;
        this._play(`${this._prefix}_walk_${dir}`, force);
    }

    public playIdle(dir: MoveDir, force = false): void {
        this._facing = dir;
        this._play(`${this._prefix}_idle_${dir}`, force);
    }

    private _play(name: string, force: boolean) {
        const anim = this.anim;
        if (!anim) return;
        const st = anim.getState(name);
        if (!st) {
            console.warn(`[PlayerAnimRuntime] Animation缺少state: ${name}（请先applyPrefix/applyServerSprite注入8个clip）`);
            return;
        }
        if (!force && st.isPlaying) return;
        anim.play(name);
    }

    private _neededClipNames(prefix: string): string[] {
        const dirs: MoveDir[] = ['down', 'left', 'right', 'up'];
        const out: string[] = [];
        for (let i = 0; i < dirs.length; i++) out.push(`${prefix}_idle_${dirs[i]}`);
        for (let i = 0; i < dirs.length; i++) out.push(`${prefix}_walk_${dirs[i]}`);
        return out;
    }
}

