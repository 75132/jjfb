import { _decorator, Component, Node, UITransform, input, Input, EventKeyboard, KeyCode, misc, Animation, v3, TiledLayer, UIOpacity, Sprite } from 'cc';
import { PlayerAnimRuntime } from './PlayerAnimRuntime';
import { PlayerStateSync } from './PlayerStateSync';

const { ccclass, property } = _decorator;

/** 单格像素（硬性 48×48） */
const CELL = 48;
/** RPG Maker MV 的速度基准帧率（引擎内部默认按 60fps 公式定义） */
const MV_BASE_FPS = 60;
type MoveDir = 'left' | 'right' | 'up' | 'down';

@ccclass('PlayerGridMove')
export class PlayerGridMove extends Component {
    @property({ type: Node, tooltip: '地图瓦片父节点（MapRoot / TiledMap），用于边界与格子原点' })
    mapRoot: Node | null = null;

    @property({ tooltip: 'RPG Maker MV：moveSpeed 1～6（默认 4），对应 Game_CharacterBase.prototype.moveSpeed' })
    moveSpeed = 4;

    @property({
        tooltip: '启用后按住 Shift 等同 MV 奔跑：realMoveSpeed = moveSpeed + 1（不超过 7）',
    })
    dashLikeMV = true;

    @property({
        tooltip:
            '动画名前缀（例如 player1）。将自动播放：${prefix}_walk_right/left/up/down 与 ${prefix}_idle_...；idle 缺失时回退用 walk',
    })
    animPrefix = 'player1';

    @property({ tooltip: '严格按 animPrefix 播放。开启后不会回退到 walk_right/idle_right 这类通用名，避免串到别的角色动画。' })
    strictAnimPrefix = true;

    @property({ tooltip: '地图锚点作为格子坐标原点(0,0)。左上锚点(0,1)时，首格中心位于锚点右下半格。' })
    useAnchorAsGridOrigin = true;

    @property({ tooltip: '初始格子列（默认 0）' })
    startGridCol = 0;

    @property({ tooltip: '初始格子行（默认 0，左上锚点模式下向下递增）' })
    startGridRow = 0;

    @property({
        tooltip:
            '若节点上挂了 PlayerStateSync（服务器权威坐标恢复），则 start() 阶段不强制 placeAtGrid(startGridCol/startGridRow)，避免偶发拿不到 player_info 时被丢到(0,0)看起来像左上角。',
    })
    deferInitialPlaceToServerRestore = true;

    @property({
        tooltip:
            '等待服务器坐标恢复的超时（秒）。超时仍未恢复时，将使用 fallbackSpawnX/Y 作为兜底，避免角色卡在(0,0)。',
    })
    serverRestoreTimeoutSec = 0.8;

    @property({ tooltip: '服务器坐标恢复超时后的兜底出生点 X（像素）' })
    fallbackSpawnX = 120.0;

    @property({ tooltip: '服务器坐标恢复超时后的兜底出生点 Y（像素）' })
    fallbackSpawnY = -24.0;

    @property({ tooltip: '不可通行图层名（逗号分隔，默认 Wall,items）' })
    blockedLayerNames = 'Wall,items';

    @property({ tooltip: '可通行但可触发效果图层名（逗号分隔，默认 plant）' })
    passableEffectLayerNames = 'plant';

    @property({ tooltip: 'Tiled 行号是否以上方为 0（默认 true，Tiled 编辑器常用）' })
    tiledRowFromTop = true;

    @property({ tooltip: '处于 plant 草丛时角色透明度（0-255）' })
    grassOpacity = 170;

    @property({ tooltip: '透明度过渡速度（每秒变化量）' })
    grassOpacityLerpSpeed = 720;

    @property({
        tooltip:
            '关闭 Sprite 逐帧裁剪框、使用 RAW 尺寸，避免行走帧切换时 UITransform/锚点随 trim 变化造成的像素抖动与形变（像素风推荐开启）',
    })
    pixelPerfectSprite = true;

    private _ut: UITransform | null = null;
    private _anim: Animation | null = null;
    private _uiOpacity: UIOpacity | null = null;
    private _animRt: PlayerAnimRuntime | null = null;
    private _serverRestored = false;
    private _restoreTimeoutScheduled = false;

    private _axis: 'x' | 'y' | null = null;
    private _targetX = 0;
    private _targetY = 0;
    private _moving = false;
    private _facing: MoveDir = 'down';
    private _snapToPixel = true;
    /** 每走完一格到达终点后回调（用于网络上报 world_step） */
    private _stepCb: ((dir: MoveDir, destX: number, destY: number) => void) | null = null;

    /** 本段移动的目的格中心（抵达时用于精确对齐） */
    private _destCx = 0;
    private _destCy = 0;

    /** 当前按下的方向键（MV 式按住连走；引擎无 isKeyPress 时用 DOWN/UP 维护） */
    private readonly _heldCodes = new Set<number>();

    /** 剧情对白/选项/战斗等由 StoryManager 锁定，对齐 RMV $gamePlayer._locked */
    private _inputLocked = false;

    onLoad() {
        this._ut = this.getComponent(UITransform);
        this._anim = this.getComponent(Animation);
        this._animRt = this.getComponent(PlayerAnimRuntime);
        if (this._anim) {
            this._anim.playOnLoad = false;
        }
        this._uiOpacity = this.getComponent(UIOpacity) || this.addComponent(UIOpacity);
        this._uiOpacity.opacity = 255;
        this._applyPixelPerfectSpriteIfNeeded();
        this._refreshLayerNameSets();
        input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this._onKeyUp, this);
    }

    onDestroy() {
        input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this._onKeyUp, this);
    }

    start() {
        const hasPlayerStateSync = this._hasDeferredServerRestore();

        if (!hasPlayerStateSync) {
            if (this.startGridCol === 0 && this.startGridRow === 0) {
                this.setPixelPosition(this.fallbackSpawnX, this.fallbackSpawnY, true);
            } else if (this.useAnchorAsGridOrigin) {
                this.placeAtGrid(this.startGridCol, this.startGridRow);
            } else {
                this._snapToGridFromCurrentPos();
            }
        } else {
            this._scheduleRestoreTimeoutOnce();
            this._nudgeFromUninitializedSpawn();
        }
        this._playIdleAnim(this._facing);
    }

    /** PlayerStateSync 可能挂在 GameArea 等父节点，而非 Player 自身。 */
    private _hasDeferredServerRestore(): boolean {
        if (!this.deferInitialPlaceToServerRestore) return false;
        let n: Node | null = this.node;
        while (n) {
            if (n.getComponent(PlayerStateSync)) return true;
            n = n.parent;
        }
        return false;
    }

    private _nudgeFromUninitializedSpawn(): void {
        const p = this.node.position;
        if (!this.isLikelyUninitializedPosition(p.x, p.y)) return;
        this.scheduleOnce(() => {
            if (this._serverRestored) return;
            const q = this.node.position;
            if (this.isLikelyUninitializedPosition(q.x, q.y)) {
                this.setPixelPosition(this.fallbackSpawnX, this.fallbackSpawnY, true);
            }
        }, 0);
    }

    /** PlayerStateSync 首次应用服务器坐标后调用，避免超时兜底覆盖。 */
    public markServerRestored(): void {
        this._serverRestored = true;
    }

    /** 未初始化坐标（常见于 prefab 默认点或进图竞态），不应作为权威落点。 */
    public isLikelyUninitializedPosition(x: number, y: number): boolean {
        return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) < 0.5 && Math.abs(y) < 0.5;
    }

    public getFallbackSpawn(): { x: number; y: number } {
        return { x: this.fallbackSpawnX, y: this.fallbackSpawnY };
    }

    private _scheduleRestoreTimeoutOnce(): void {
        if (this._restoreTimeoutScheduled) return;
        this._restoreTimeoutScheduled = true;
        const sec = Math.max(0.1, Number(this.serverRestoreTimeoutSec) || 2.0);
        this.scheduleOnce(() => {
            if (this._serverRestored) return;
            // 兜底：避免偶发拿不到 player_info 时停在(0,0)（左上角观感）
            this.setPixelPosition(this.fallbackSpawnX, this.fallbackSpawnY, true);
        }, sec);
    }

    /** 由 StoryManager 在对白/选项/剧情战/事件链激活时调用 */
    public setInputLocked(locked: boolean): void {
        if (this._inputLocked === locked) return;
        this._inputLocked = locked;
        if (locked) {
            this._heldCodes.clear();
            this._moving = false;
            this._axis = null;
            this._playIdleAnim(this._facing);
        }
    }

    public get inputLocked(): boolean {
        return this._inputLocked;
    }

    update(dt: number) {
        if (this._inputLocked) {
            this._updatePlantVisual(dt);
            return;
        }

        const dashing =
            this.dashLikeMV &&
            (this._heldCodes.has(KeyCode.SHIFT_LEFT) || this._heldCodes.has(KeyCode.SHIFT_RIGHT));
        const ms = misc.clampf(this.moveSpeed, 1, 6);
        const realSpeed = misc.clampf(ms + (dashing ? 1 : 0), 1, 7);
        const distTiles = (Math.pow(2, realSpeed) / 256) * MV_BASE_FPS * dt;
        const distPx = distTiles * CELL;

        if (this._moving && this._axis !== null) {
            this._advanceAlongAxis(distPx);
        }

        if (!this._moving) {
            const dir = this._readDesiredDir();
            if (dir) {
                this._tryBeginStep(dir.dc, dir.dr);
            }
        }
        this._updatePlantVisual(dt);
    }

    private _onKeyDown(e: EventKeyboard) {
        if (this._inputLocked) return;
        this._heldCodes.add(e.keyCode);
    }

    private _onKeyUp(e: EventKeyboard) {
        this._heldCodes.delete(e.keyCode);
    }

    private _readDesiredDir(): { dc: number; dr: number } | null {
        const r = this._heldCodes.has(KeyCode.KEY_D) || this._heldCodes.has(KeyCode.ARROW_RIGHT);
        const l = this._heldCodes.has(KeyCode.KEY_A) || this._heldCodes.has(KeyCode.ARROW_LEFT);
        const u = this._heldCodes.has(KeyCode.KEY_W) || this._heldCodes.has(KeyCode.ARROW_UP);
        const d = this._heldCodes.has(KeyCode.KEY_S) || this._heldCodes.has(KeyCode.ARROW_DOWN);
        if (r && !l) {
            return { dc: 1, dr: 0 };
        }
        if (l && !r) {
            return { dc: -1, dr: 0 };
        }
        if (u && !d) {
            return { dc: 0, dr: this.useAnchorAsGridOrigin ? -1 : 1 };
        }
        if (d && !u) {
            return { dc: 0, dr: this.useAnchorAsGridOrigin ? 1 : -1 };
        }
        return null;
    }

    private _advanceAlongAxis(distPx: number) {
        const ut = this._ut;
        if (!ut) {
            return;
        }
        const cur = this.node.position;
        const rest = 1e-4;
        if (this._axis === 'x') {
            const dx = this._targetX - cur.x;
            if (Math.abs(dx) <= distPx + rest) {
                this._setPos(this._destCx, cur.y, cur.z);
                this._endStep();
            } else {
                this._setPos(cur.x + Math.sign(dx) * distPx, cur.y, cur.z);
            }
        } else {
            const dy = this._targetY - cur.y;
            if (Math.abs(dy) <= distPx + rest) {
                this._setPos(cur.x, this._destCy, cur.z);
                this._endStep();
            } else {
                this._setPos(cur.x, cur.y + Math.sign(dy) * distPx, cur.z);
            }
        }
    }

    private _endStep() {
        this._moving = false;
        this._axis = null;
        const cur = this.node.position;
        this._setPos(this._destCx, this._destCy, cur.z);
        this._playIdleAnim(this._facing);
        if (this._stepCb) {
            this._stepCb(this._facing, this._destCx, this._destCy);
        }
    }

    private _tryBeginStep(deltaCol: number, deltaRow: number): boolean {
        const map = this.mapRoot;
        const ut = this._ut;
        if (!map || !ut || this._moving) {
            return false;
        }
        const mapUt = map.getComponent(UITransform);
        if (!mapUt) {
            return false;
        }

        const { originX, originY, cols, rows } = this._mapGridMetrics(map, mapUt);
        if (cols <= 0 || rows <= 0) {
            return false;
        }

        const cur = this.node.position;
        const cc = Math.floor((cur.x - originX) / CELL);
        const rr = this.useAnchorAsGridOrigin
            ? Math.floor((originY - cur.y) / CELL)
            : Math.floor((cur.y - originY) / CELL);
        const ncol = cc + deltaCol;
        const nrow = rr + deltaRow;

        if (ncol < 0 || ncol > cols - 1 || nrow < 0 || nrow > rows - 1) {
            return false;
        }

        this._destCx = originX + (ncol + 0.5) * CELL;
        this._destCy = this.useAnchorAsGridOrigin
            ? originY - (nrow + 0.5) * CELL
            : originY + (nrow + 0.5) * CELL;
        if (!this._canPassByTiledLayers(this._destCx, this._destCy)) {
            return false;
        }

        if (deltaCol !== 0) {
            this._facing = deltaCol > 0 ? 'right' : 'left';
            this._axis = 'x';
            this._targetX = this._destCx;
            this._targetY = cur.y;
        } else {
            // y 轴方向与 row 递增方向无关，按目标点相对当前位置决定朝向
            this._facing = this._destCy > cur.y ? 'up' : 'down';
            this._axis = 'y';
            this._targetY = this._destCy;
            this._targetX = cur.x;
        }
        this._moving = true;
        this._playMoveAnim(this._facing);
        return true;
    }

    /**
     * 尝试开始平滑走一格（MV 速率）；已开始移动则返回 true。
     */
    public tryStep(deltaCol: number, deltaRow: number): boolean {
        return this._tryBeginStep(deltaCol, deltaRow);
    }

    /** 订阅“开始走一格”事件（用于上报 world_step）。 */
    public onStep(cb: ((dir: MoveDir, destX: number, destY: number) => void) | null): void {
        this._stepCb = cb;
    }

    /** 将当前位置吸附到最近合法格子中心（会取消未完成的移动） */
    public snapToGrid(): void {
        this._moving = false;
        this._axis = null;
        this._snapToGridFromCurrentPos();
        this._updatePlantVisual(0);
    }

    /** 按格子坐标直接放置角色到格子中心（用于出生点/传送点）。 */
    public placeAtGrid(col: number, row: number): void {
        const map = this.mapRoot;
        const ut = this._ut;
        if (!map || !ut) return;
        const mapUt = map.getComponent(UITransform);
        if (!mapUt) return;
        const m = this._mapGridMetrics(map, mapUt);
        if (m.cols <= 0 || m.rows <= 0) return;
        const c = Math.min(m.cols - 1, Math.max(0, Math.floor(col)));
        const r = Math.min(m.rows - 1, Math.max(0, Math.floor(row)));
        const x = m.originX + (c + 0.5) * CELL;
        const y = this.useAnchorAsGridOrigin
            ? m.originY - (r + 0.5) * CELL
            : m.originY + (r + 0.5) * CELL;
        const z = this.node.position.z;
        this._setPos(x, y, z);
        this._destCx = x;
        this._destCy = y;
        this._updatePlantVisual(0);
    }

    /** 返回当前像素坐标（与节点实际坐标一致，不做 48 格换算）。 */
    public getPixelPosition(): { x: number; y: number } {
        if (!this.node || !this.node.isValid) {
            return { x: Number.NaN, y: Number.NaN };
        }
        const p = this.node.position;
        return { x: p.x, y: p.y };
    }

    /** 当前是否处于一步移动中（用于网络状态同步） */
    public isMovingNow(): boolean {
        return this._moving;
    }

    /** 当前朝向（用于网络状态同步） */
    public getFacingDir(): MoveDir {
        return this._facing;
    }

    /** 剧情交互：面向目标世界坐标（RMV 式转向） */
    public faceToward(worldX: number, worldY: number): void {
        const p = this.node.worldPosition;
        const dx = worldX - p.x;
        const dy = worldY - p.y;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        if (Math.abs(dx) > Math.abs(dy)) {
            this._facing = dx > 0 ? 'right' : 'left';
        } else {
            this._facing = dy > 0 ? 'up' : 'down';
        }
        this._playIdleAnim(this._facing);
    }

    /** 外部设置角色动画前缀（例如 player7），并立即刷新到当前朝向待机动画。 */
    public setAnimPrefix(prefix: string, refreshNow = true): boolean {
        const p = (prefix || '').trim();
        if (!p) return false;
        if (this.strictAnimPrefix && !this._hasRequiredPrefixClips(p)) {
            this._logAnimPrefixMissing(p);
            return false;
        }
        this.animPrefix = p;
        if (refreshNow) {
            this._playIdleAnim(this._facing);
        }
        return true;
    }

    /** 按服务器 Sprite 应用前缀（Sprite=7 => player7） */
    public applyServerSprite(spriteIndex: number, refreshNow = true): boolean {
        if (this._animRt) {
            const ok = this._animRt.applyServerSprite(spriteIndex);
            if (ok) {
                this.animPrefix = this._animRt.prefix;
            }
            return ok;
        }
        if (!Number.isFinite(spriteIndex) || spriteIndex <= 0) return false;
        return this.setAnimPrefix(`player${Math.floor(spriteIndex)}`, refreshNow);
    }

    /** 直接设置到像素坐标；可选吸附到格子中心。 */
    public setPixelPosition(x: number, y: number, snapToGrid = false): void {
        const z = this.node.position.z;
        this._setPos(x, y, z);
        if (snapToGrid) {
            this._snapToGridFromCurrentPos();
        }
        this._updatePlantVisual(0);
    }

    private _snapToGridFromCurrentPos() {
        const map = this.mapRoot;
        const ut = this._ut;
        if (!map || !ut) {
            return;
        }
        const mapUt = map.getComponent(UITransform);
        if (!mapUt) {
            return;
        }
        const { originX, originY, cols, rows } = this._mapGridMetrics(map, mapUt);
        if (cols <= 0 || rows <= 0) {
            return;
        }
        const cur = this.node.position;
        let cc = Math.floor((cur.x - originX) / CELL);
        let rr = this.useAnchorAsGridOrigin
            ? Math.floor((originY - cur.y) / CELL)
            : Math.floor((cur.y - originY) / CELL);
        cc = Math.min(cols - 1, Math.max(0, cc));
        rr = Math.min(rows - 1, Math.max(0, rr));
        const cx = originX + (cc + 0.5) * CELL;
        const cy = this.useAnchorAsGridOrigin
            ? originY - (rr + 0.5) * CELL
            : originY + (rr + 0.5) * CELL;
        this._setPos(cx, cy, cur.z);
    }

    private _setPos(x: number, y: number, z: number) {
        if (this._snapToPixel) {
            x = Math.round(x);
            y = Math.round(y);
        }
        this.node.setPosition(x, y, z);
    }

    /** 逐帧 spriteFrame 若带 trim，会改变内容框与视觉中心；关 trim + RAW 与整像素位移一致时最稳 */
    private _applyPixelPerfectSpriteIfNeeded() {
        if (!this.pixelPerfectSprite) {
            return;
        }
        const sp = this.getComponent(Sprite);
        if (!sp) {
            return;
        }
        sp.trim = false;
        sp.sizeMode = Sprite.SizeMode.RAW;
    }

    private _mapGridMetrics(map: Node, mapUt: UITransform) {
        const b = this._mapBoundsInParentSpace(map, mapUt);
        const originX = this.useAnchorAsGridOrigin ? map.position.x : b.minX;
        const originY = this.useAnchorAsGridOrigin ? map.position.y : b.minY;
        const cols = this.useAnchorAsGridOrigin
            ? Math.floor((b.maxX - originX) / CELL)
            : Math.floor((b.maxX - b.minX) / CELL);
        const rows = this.useAnchorAsGridOrigin
            ? Math.floor((originY - b.minY) / CELL)
            : Math.floor((b.maxY - b.minY) / CELL);
        return { originX, originY, cols, rows };
    }

    /**
     * 取地图“实际内容”在 Player 同父坐标系中的包围盒。
     * 兼容 MapRoot 左上锚点(0,1) 与多块拼接地图（子节点尺寸参与计算）。
     */
    private _mapBoundsInParentSpace(map: Node, mapUt: UITransform) {
        const parentUt = map.parent?.getComponent(UITransform);
        if (!parentUt) {
            // 无法换坐标时回退到 MapRoot 自身尺寸
            const w = mapUt.width;
            const h = mapUt.height;
            const left = map.position.x - mapUt.anchorX * w;
            const right = left + w;
            const bottom = map.position.y - mapUt.anchorY * h;
            const top = bottom + h;
            return { minX: left, maxX: right, minY: bottom, maxY: top };
        }

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        const tmp = this._tmpV3;
        const updateByNode = (n: Node) => {
            const ut = n.getComponent(UITransform);
            if (!ut) return;
            const w = ut.width;
            const h = ut.height;
            const l = -ut.anchorX * w;
            const r = (1 - ut.anchorX) * w;
            const b = -ut.anchorY * h;
            const t = (1 - ut.anchorY) * h;
            const corners = [
                { x: l, y: b },
                { x: r, y: b },
                { x: l, y: t },
                { x: r, y: t },
            ];
            for (let i = 0; i < corners.length; i++) {
                tmp.set(corners[i].x, corners[i].y, 0);
                ut.convertToWorldSpaceAR(tmp, tmp);
                parentUt.convertToNodeSpaceAR(tmp, tmp);
                minX = Math.min(minX, tmp.x);
                maxX = Math.max(maxX, tmp.x);
                minY = Math.min(minY, tmp.y);
                maxY = Math.max(maxY, tmp.y);
            }
        };
        const stack: Node[] = [map];
        while (stack.length > 0) {
            const n = stack.pop()!;
            updateByNode(n);
            for (let i = 0; i < n.children.length; i++) {
                stack.push(n.children[i]);
            }
        }

        if (!isFinite(minX) || !isFinite(minY)) {
            const w = mapUt.width;
            const h = mapUt.height;
            const left = map.position.x - mapUt.anchorX * w;
            const right = left + w;
            const bottom = map.position.y - mapUt.anchorY * h;
            const top = bottom + h;
            return { minX: left, maxX: right, minY: bottom, maxY: top };
        }
        return { minX, maxX, minY, maxY };
    }

    private _tmpV3 = v3();
    private _blockedNameSet: Set<string> = new Set();
    private _effectNameSet: Set<string> = new Set();
    private _inPlant = false;

    private _refreshLayerNameSets() {
        const toSet = (raw: string) =>
            new Set(
                raw
                    .split(',')
                    .map((s) => s.trim().toLowerCase())
                    .filter((s) => s.length > 0)
            );
        this._blockedNameSet = toSet(this.blockedLayerNames);
        this._effectNameSet = toSet(this.passableEffectLayerNames);
    }

    private _canPassByTiledLayers(targetX: number, targetY: number): boolean {
        const flags = this._queryTileFlagsAtPoint(targetX, targetY);
        return !flags.blocked;
    }

    private _queryTileFlagsAtPoint(targetX: number, targetY: number): { blocked: boolean; effect: boolean } {
        const map = this.mapRoot;
        if (!map) return { blocked: false, effect: false };
        const layers = this._collectTiledLayers(map);
        if (layers.length === 0) return { blocked: false, effect: false };

        let touchedEffect = false;
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            const lname = (layer.node.name || '').trim().toLowerCase();
            const gid = this._getLayerGidAtPoint(layer, targetX, targetY);
            if (gid <= 0) continue;
            if (this._blockedNameSet.has(lname)) {
                return { blocked: true, effect: touchedEffect };
            }
            if (this._effectNameSet.has(lname)) {
                touchedEffect = true;
            }
        }
        return { blocked: false, effect: touchedEffect };
    }

    private _collectTiledLayers(root: Node): TiledLayer[] {
        const out: TiledLayer[] = [];
        const stack: Node[] = [root];
        while (stack.length > 0) {
            const n = stack.pop()!;
            const layer = n.getComponent(TiledLayer);
            if (layer) out.push(layer);
            for (let i = 0; i < n.children.length; i++) {
                stack.push(n.children[i]);
            }
        }
        return out;
    }

    private _getLayerGidAtPoint(layer: TiledLayer, parentX: number, parentY: number): number {
        const mapParentUt = this.mapRoot?.parent?.getComponent(UITransform);
        const ut = layer.getComponent(UITransform);
        if (!mapParentUt || !ut) return 0;
        const tileSize = layer.getMapTileSize();
        const layerSize = layer.getLayerSize();
        if (!tileSize || !layerSize) return 0;

        const p = this._tmpV3;
        p.set(parentX, parentY, 0);
        mapParentUt.convertToWorldSpaceAR(p, p);
        ut.convertToNodeSpaceAR(p, p);

        const left = -ut.anchorX * ut.width;
        const bottom = -ut.anchorY * ut.height;
        const tx = Math.floor((p.x - left) / tileSize.width);
        const tyBottom = Math.floor((p.y - bottom) / tileSize.height);
        if (tx < 0 || tx >= layerSize.width || tyBottom < 0 || tyBottom >= layerSize.height) {
            return 0;
        }

        const ty = this.tiledRowFromTop ? (layerSize.height - 1 - tyBottom) : tyBottom;
        return layer.getTileGIDAt(tx, ty);
    }

    private _updatePlantVisual(dt: number) {
        const o = this._uiOpacity;
        if (!o) return;

        const p = this.node.position;
        const flags = this._queryTileFlagsAtPoint(p.x, p.y);
        this._inPlant = flags.effect;

        const target = this._inPlant ? misc.clampf(this.grassOpacity, 0, 255) : 255;
        if (dt <= 0) {
            o.opacity = target;
            return;
        }

        const cur = o.opacity;
        const step = Math.max(1, this.grassOpacityLerpSpeed * dt);
        if (Math.abs(target - cur) <= step) {
            o.opacity = target;
        } else {
            o.opacity = cur + Math.sign(target - cur) * step;
        }
    }

    private _playMoveAnim(dir: MoveDir) {
        if (!this._animRt) return;
        this._animRt.playMove(dir);
    }

    private _playIdleAnim(dir: MoveDir) {
        if (!this._animRt) return;
        this._animRt.playIdle(dir, true);
    }

    private _getMoveAnimName(dir: MoveDir): string {
        const p = (this.animPrefix || '').trim();
        if (!p) return '';
        return `${p}_walk_${dir}`;
    }

    private _getIdleAnimName(dir: MoveDir): string {
        const p = (this.animPrefix || '').trim();
        if (!p) return '';
        return `${p}_idle_${dir}`;
    }

    private _getMoveAnimCandidates(dir: MoveDir): string[] {
        const p = (this.animPrefix || '').trim();
        const out: string[] = [];
        if (p) out.push(`${p}_walk_${dir}`);
        if (!this.strictAnimPrefix) {
            out.push(`walk_${dir}`);
        }
        return out;
    }

    private _getIdleAnimCandidates(dir: MoveDir): string[] {
        const p = (this.animPrefix || '').trim();
        const out: string[] = [];
        if (p) out.push(`${p}_idle_${dir}`);
        if (!this.strictAnimPrefix) {
            out.push(`idle_${dir}`);
        }
        return out;
    }

    private _resolvePlayableClip(candidates: string[]): string {
        const anim = this._anim;
        if (!anim) return '';
        for (let i = 0; i < candidates.length; i++) {
            const name = candidates[i];
            if (!name) continue;
            if (anim.getState(name)) return name;
        }
        return '';
    }

    private _hasRequiredPrefixClips(prefix: string): boolean {
        const anim = this._anim;
        if (!anim) return false;
        const required = [
            `${prefix}_idle_down`,
            `${prefix}_idle_left`,
            `${prefix}_idle_right`,
            `${prefix}_idle_up`,
            `${prefix}_walk_down`,
            `${prefix}_walk_left`,
            `${prefix}_walk_right`,
            `${prefix}_walk_up`,
        ];
        for (let i = 0; i < required.length; i++) {
            if (!anim.getState(required[i])) return false;
        }
        return true;
    }

    private _logAnimPrefixMissing(prefix: string): void {
        const anim = this._anim;
        if (!anim) return;
        const names = (anim.clips || []).map((c) => c && c.name).filter((n) => !!n);
        console.warn(`[PlayerGridMove] strictAnimPrefix=ON，但缺少 ${prefix}_* 的完整8个clip。当前已挂载:`, names);
    }
}
