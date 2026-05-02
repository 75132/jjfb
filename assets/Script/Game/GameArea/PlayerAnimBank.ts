import { _decorator, Component, AnimationClip } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('PlayerAnimBank')
export class PlayerAnimBank extends Component {
    @property({ type: [AnimationClip], tooltip: '把所有 player1~player7 的 idle/walk 四方向 .anim 一次性拖进来（共56个）' })
    clips: AnimationClip[] = [];

    private _map: Map<string, AnimationClip> = new Map();

    onLoad() {
        this._rebuildMap();
    }

    public rebuild(): void {
        this._rebuildMap();
    }

    public getClip(name: string): AnimationClip | null {
        return this._map.get(name) || null;
    }

    private _rebuildMap() {
        this._map.clear();
        for (let i = 0; i < this.clips.length; i++) {
            const c = this.clips[i];
            if (!c || !c.name) continue;
            this._map.set(c.name, c);
        }
    }
}

