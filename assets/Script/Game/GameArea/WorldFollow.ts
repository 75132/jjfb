import { _decorator, Component, Node, UITransform, misc, v3 } from 'cc';
import { PlayerGridMove } from './PlayerGridMove';

const { ccclass, property } = _decorator;

@ccclass('WorldFollow')
export class WorldFollow extends Component {
    @property({ type: Node, tooltip: 'Player 节点' })
    player: Node | null = null;

    @property({ type: Node, tooltip: 'GameArea（480×540 + Mask）' })
    gameArea: Node | null = null;

    @property({ type: Node, tooltip: 'MapRoot 地图根节点' })
    mapRoot: Node | null = null;

    @property({ tooltip: '将 WorldRoot 最终坐标四舍五入到整像素，减少 48 格对齐时的次像素抖动' })
    pixelAlign = true;

    @property({
        tooltip: 'Player 未拖引用时，在运行时从本节点（WorldRoot）子级按名称 Player 或 PlayerGridMove 自动查找',
    })
    autoResolvePlayer = true;

    private _tmp = v3();

    onLoad() {
        if (!this.autoResolvePlayer || this.player) {
            return;
        }
        const wr = this.node;
        let n = wr.getChildByName('Player');
        if (!n) {
            for (let i = 0; i < wr.children.length; i++) {
                const ch = wr.children[i];
                if (ch.getComponent(PlayerGridMove)) {
                    n = ch;
                    break;
                }
            }
        }
        this.player = n;
    }

    lateUpdate() {
        const player = this.player;
        const gameArea = this.gameArea;
        const mapRoot = this.mapRoot;
        if (!player || !gameArea || !mapRoot) {
            return;
        }

        const gaUt = gameArea.getComponent(UITransform);
        const pUt = player.getComponent(UITransform);
        if (!gaUt || !pUt) {
            return;
        }

        const v = this._viewportLocal(gaUt);
        const playerGa = gaUt.convertToNodeSpaceAR(player.worldPosition, this._tmp);

        const centerX = (v.left + v.right) * 0.5;
        const centerY = (v.bottom + v.top) * 0.5;

        const wr = this.node.position;
        const idealX = wr.x + (centerX - playerGa.x);
        const idealY = wr.y + (centerY - playerGa.y);

        const C = this._mapEdgeConstants(mapRoot, gameArea);

        const xMin = v.right - C.maxX;
        const xMax = v.left - C.minX;
        const yMin = v.top - C.maxY;
        const yMax = v.bottom - C.minY;

        let nx = idealX;
        let ny = idealY;

        if (xMin <= xMax) {
            nx = misc.clampf(idealX, xMin, xMax);
        } else {
            nx = (xMin + xMax) * 0.5;
        }

        if (yMin <= yMax) {
            ny = misc.clampf(idealY, yMin, yMax);
        } else {
            ny = (yMin + yMax) * 0.5;
        }

        if (this.pixelAlign) {
            nx = Math.round(nx);
            ny = Math.round(ny);
        }

        this.node.setPosition(nx, ny, wr.z);
    }

    private _viewportLocal(gaUt: UITransform) {
        const w = gaUt.width;
        const h = gaUt.height;
        const ax = gaUt.anchorX;
        const ay = gaUt.anchorY;
        const left = -ax * w;
        const right = (1 - ax) * w;
        const bottom = -ay * h;
        const top = (1 - ay) * h;
        return { left, right, bottom, top };
    }

    /**
     * 在当前 WorldRoot 位移下，地图包络在 GameArea 本地座标中的 min/max，
     * 并分解为「与 wr 无关的常数项 + wr」：edges = wr + C
     */
    /**
     * 在 wr.x=0 / wr.y=0 的基准下取得地图在 GameArea 内的包络，
     * 使得 mapMinX = C.minX + wr.x、mapMaxX = C.maxX + wr.x（y 固定为当前 wr.y），
     * mapMinY / mapMaxY 同理随 wr.y 平移。
     */
    private _mapEdgeConstants(mapRoot: Node, gameArea: Node) {
        const wr = this.node.position;
        const wx = wr.x;
        const wy = wr.y;
        try {
            this.node.setPosition(0, wy, wr.z);
            const ex = this._mapAabbInGameArea(mapRoot, gameArea);
            this.node.setPosition(wx, 0, wr.z);
            const ey = this._mapAabbInGameArea(mapRoot, gameArea);
            return {
                minX: ex.minX,
                maxX: ex.maxX,
                minY: ey.minY,
                maxY: ey.maxY,
            };
        } finally {
            this.node.setPosition(wx, wy, wr.z);
        }
    }

    private _mapAabbInGameArea(mapRoot: Node, gameArea: Node) {
        const gaUt = gameArea.getComponent(UITransform)!;
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        const tmp = v3();
        const stack: Node[] = [mapRoot];

        while (stack.length > 0) {
            const n = stack.pop()!;
            const ut = n.getComponent(UITransform);
            if (ut) {
                const w = ut.width;
                const h = ut.height;
                const left = -ut.anchorX * w;
                const right = (1 - ut.anchorX) * w;
                const bottom = -ut.anchorY * h;
                const top = (1 - ut.anchorY) * h;
                const corners = [
                    v3(left, bottom),
                    v3(right, bottom),
                    v3(left, top),
                    v3(right, top),
                ];
                for (let i = 0; i < corners.length; i++) {
                    ut.convertToWorldSpaceAR(corners[i], tmp);
                    gaUt.convertToNodeSpaceAR(tmp, tmp);
                    minX = Math.min(minX, tmp.x);
                    maxX = Math.max(maxX, tmp.x);
                    minY = Math.min(minY, tmp.y);
                    maxY = Math.max(maxY, tmp.y);
                }
            }
            for (let i = 0; i < n.children.length; i++) {
                stack.push(n.children[i]);
            }
        }

        if (!isFinite(minX) || !isFinite(minY)) {
            const mUt = mapRoot.getComponent(UITransform)!;
            const w = mUt.width;
            const h = mUt.height;
            const left = -mUt.anchorX * w;
            const right = (1 - mUt.anchorX) * w;
            const bottom = -mUt.anchorY * h;
            const top = (1 - mUt.anchorY) * h;
            const corners = [
                v3(left, bottom),
                v3(right, bottom),
                v3(left, top),
                v3(right, top),
            ];
            for (let i = 0; i < corners.length; i++) {
                mUt.convertToWorldSpaceAR(corners[i], tmp);
                gaUt.convertToNodeSpaceAR(tmp, tmp);
                minX = Math.min(minX, tmp.x);
                maxX = Math.max(maxX, tmp.x);
                minY = Math.min(minY, tmp.y);
                maxY = Math.max(maxY, tmp.y);
            }
        }
        return { minX, maxX, minY, maxY };
    }
}
