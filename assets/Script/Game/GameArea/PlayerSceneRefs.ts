import { _decorator, Component, Node, TiledLayer } from 'cc';
import { PlayerAnimBank } from './PlayerAnimBank';
import { PlayerAnimRuntime } from './PlayerAnimRuntime';
import { PlayerGridMove } from './PlayerGridMove';

const { ccclass, property, executionOrder } = _decorator;

/**
 * 挂在 Player 预制体上：进入场景后若 Map Root / Anim Bank 未拖引用，则按常见层级自动补齐。
 * 层级约定：Canvas/.../GameArea/WorldRoot/Player（与 WorldRoot 平级的地图节点含 TiledLayer）。
 */
@ccclass('PlayerSceneRefs')
@executionOrder(-50)
export class PlayerSceneRefs extends Component {
    @property({ tooltip: '关闭后不在运行时解析，完全依赖预制体/场景里手拖引用' })
    autoResolve = true;

    onLoad() {
        if (!this.autoResolve) {
            return;
        }
        const pgm = this.getComponent(PlayerGridMove);
        const animRt = this.getComponent(PlayerAnimRuntime);
        if (pgm && !pgm.mapRoot) {
            const root = this._resolveMapRoot();
            if (root) {
                pgm.mapRoot = root;
            }
        }
        if (animRt && !animRt.bank) {
            const bank = this._resolveAnimBank();
            if (bank) {
                animRt.bank = bank;
            }
        }
    }

    private _resolveMapRoot(): Node | null {
        const worldRoot = this.node.parent;
        if (!worldRoot) {
            return null;
        }
        const tryNames = ['TiledMap', 'Tilemap', 'MapRoot', 'mapRoot'];
        for (let i = 0; i < tryNames.length; i++) {
            const n = worldRoot.getChildByName(tryNames[i]);
            if (n && this._hasTiledLayerInSubtree(n)) {
                return n;
            }
        }
        for (let c = 0; c < worldRoot.children.length; c++) {
            const ch = worldRoot.children[c];
            if (ch === this.node) {
                continue;
            }
            if (this._hasTiledLayerInSubtree(ch)) {
                return ch;
            }
        }
        return null;
    }

    private _hasTiledLayerInSubtree(root: Node): boolean {
        const stack: Node[] = [root];
        while (stack.length > 0) {
            const n = stack.pop()!;
            if (n.getComponent(TiledLayer)) {
                return true;
            }
            for (let i = 0; i < n.children.length; i++) {
                stack.push(n.children[i]);
            }
        }
        return false;
    }

    private _resolveAnimBank(): PlayerAnimBank | null {
        let cur: Node | null = this.node;
        while (cur) {
            const bank = cur.getComponentInChildren(PlayerAnimBank);
            if (bank) {
                return bank;
            }
            cur = cur.parent;
        }
        return null;
    }
}
