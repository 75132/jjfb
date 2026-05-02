import { _decorator, Animation, Component, Vec3 } from 'cc';
import { PlayerAnimRuntime } from './PlayerAnimRuntime';

const { ccclass, property } = _decorator;

type MoveDir = 'left' | 'right' | 'up' | 'down';

/**
 * 挂在大世界「他人」实例上：以恒定像素速度追网络目标点，避免指数插值「先快后慢」；
 * 到达目标当帧立即切 idle，避免停步后动画还拖半拍。
 */
@ccclass('RemoteAvatarController')
export class RemoteAvatarController extends Component {
    public characterId = '';

    @property({
        tooltip:
            '追坐标速度（像素/秒）。本地 MV 速度 4 时约一格 48px 用时 ~0.27s，折合约 180px/s；可按手感微调',
    })
    moveSpeedPxPerSec = 195;

    private _target = new Vec3();
    private _anim: PlayerAnimRuntime | null = null;
    private _lastFacing: MoveDir = 'down';
    private _playingWalk = false;
    private _firstSnap = true;

    onLoad() {
        this._anim = this.getComponent(PlayerAnimRuntime);
        const legacy = this.getComponent(Animation);
        if (legacy) {
            legacy.playOnLoad = false;
        }
    }

    /**
     * 只更新目标点与朝向；位移与 walk/idle 全在 update 里按匀速处理，避免动画与位置不同步。
     */
    public applySnapshot(x: number, y: number, facing: string, _moving: boolean) {
        const f = (facing || 'down') as MoveDir;
        if (f === 'left' || f === 'right' || f === 'up' || f === 'down') {
            this._lastFacing = f;
        }
        this._target.set(x, y, this.node.position.z);

        if (this._firstSnap) {
            const cur = this.node.position;
            this.node.setPosition(Math.round(x), Math.round(y), cur.z);
            this._firstSnap = false;
            this._playingWalk = false;
            this._anim?.playIdle(this._lastFacing, true);
        }
    }

    update(dt: number) {
        if (this._firstSnap) {
            return;
        }
        const cur = this.node.position;
        const t = this._target;
        let dx = t.x - cur.x;
        let dy = t.y - cur.y;
        const dist = Math.hypot(dx, dy);

        // 已到格点：立刻 idle，避免「停住后动画还播一会」
        if (dist < 0.05) {
            this.node.setPosition(Math.round(t.x), Math.round(t.y), cur.z);
            if (this._playingWalk) {
                this._playingWalk = false;
                this._anim?.playIdle(this._lastFacing, true);
            }
            return;
        }

        const speed = Math.max(60, this.moveSpeedPxPerSec);
        const maxStep = speed * dt;
        if (dist <= maxStep) {
            this.node.setPosition(Math.round(t.x), Math.round(t.y), cur.z);
            if (this._playingWalk) {
                this._playingWalk = false;
                this._anim?.playIdle(this._lastFacing, true);
            }
            return;
        }

        dx /= dist;
        dy /= dist;
        const nx = cur.x + dx * maxStep;
        const ny = cur.y + dy * maxStep;
        this.node.setPosition(Math.round(nx), Math.round(ny), cur.z);

        if (!this._playingWalk) {
            this._playingWalk = true;
            this._anim?.playMove(this._lastFacing);
        }
    }
}
