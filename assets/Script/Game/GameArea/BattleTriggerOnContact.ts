import {
    _decorator,
    Component,
    Node,
    Collider2D,
    BoxCollider2D,
    Contact2DType,
    director,
    input,
    Input,
    EventKeyboard,
    KeyCode,
} from 'cc';
import { PlayerGridMove } from './PlayerGridMove';
import { BattleScene } from '../BattleScene';

const { ccclass, property } = _decorator;

/**
 * 说明：
 * - 挂在 npc/敌人节点（带 BoxCollider2D + 配好 2D physics 的碰撞体系）
 * - 玩家碰到：若当前未在战斗中 => 自动打开 BattleScene 面板
 * - 战斗结束后：若玩家仍在碰撞框内 => 不自动再触发，需要按 Enter
 * - 玩家离开碰撞框 => 清掉等待 Enter 状态；下次再次碰到又会自动触发
 */
@ccclass('BattleTriggerOnContact')
export class BattleTriggerOnContact extends Component {
    @property({ type: Node, tooltip: 'BattleScene 根节点（挂 BattleScene 脚本的那个 Node）' })
    battleRoot: Node | null = null;

    @property({ tooltip: '调试：在碰撞/触发时打印日志（建议仅用于排查一次）' })
    debugLog = false;

    @property({
        tooltip: '兜底：用 AABB 重叠轮询触发（即使物理 BEGIN/END_CONTACT 没触发，也能工作）',
    })
    pollingEnabled = true;

    /** 用于判断“按 Enter 才能再次开战”的玩家仍处于碰撞状态 */
    private _playerTouching = false;
    private _pendingEnter = false;

    /** 战斗面板是否激活，用于检测“战斗刚结束”的边沿 */
    private _battleWasActive = false;

    /** 本次战斗触发前玩家是否确实处于碰撞中（战斗结束后才需要 Enter） */
    private _wasTouchingWhenBattleStarted = false;

    private _battleScene: BattleScene | null = null;
    private _collider: Collider2D | null = null;

    private _triggerBox: BoxCollider2D | null = null;
    private _playerMove: PlayerGridMove | null = null;
    private _playerBox: BoxCollider2D | null = null;
    private _lastPlayerResolveAt = 0;
    private _touchBeganThisFrame = false;

    onLoad() {
        if (this.battleRoot) {
            this._battleScene = this.battleRoot.getComponent(BattleScene);
        }
        // 重要：优先拿 BoxCollider2D（getComponent(Collider2D) 在某些情况下可能拿不到具体子类）
        const box = this.getComponent(BoxCollider2D);
        this._triggerBox = box;
        this._collider = (box as unknown as Collider2D) || this.getComponent(Collider2D);
        if (this.debugLog) {
            console.log(
                `[BattleTriggerOnContact] onLoad trigger=${this.node?.name} collider=${this._collider?.constructor?.name || 'null'} battleRootActive=${Boolean(this.battleRoot?.active)}`
            );
        }
        if (this._collider) {
            this._collider.on(Contact2DType.BEGIN_CONTACT, this._onBeginContact, this);
            this._collider.on(Contact2DType.END_CONTACT, this._onEndContact, this);
        } else if (this.debugLog) {
            console.warn(`[BattleTriggerOnContact] collider not found on node=${this.node?.name}`);
        }

        input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        // 初始化战斗边沿状态
        this._battleWasActive = Boolean(this.battleRoot?.active);

        // 兜底：解析本地玩家组件（用于 AABB 轮询）
        this._resolveLocalPlayerOnce();
    }

    onDestroy() {
        if (this._collider) {
            this._collider.off(Contact2DType.BEGIN_CONTACT, this._onBeginContact, this);
            this._collider.off(Contact2DType.END_CONTACT, this._onEndContact, this);
        }
        input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
    }

    update() {
        this._touchBeganThisFrame = false;

        if (this.pollingEnabled) {
            this._pollTouchOverlap();
        }

        const battleActive = Boolean(this.battleRoot?.active);

        // 战斗从 active -> inactive：如果玩家当时还在碰撞框里，则进入“等待 Enter 才能再次开战”
        if (this._battleWasActive && !battleActive) {
            if (this._wasTouchingWhenBattleStarted && this._playerTouching) {
                this._pendingEnter = true;
            }
            this._wasTouchingWhenBattleStarted = false;
        }

        // 触碰“开始这一帧”且当前不在战斗、不处于 pendingEnter：自动开战
        if (this.pollingEnabled && this._touchBeganThisFrame && !battleActive && !this._pendingEnter) {
            if (this.debugLog) {
                console.log(`[BattleTriggerOnContact] >>> POLL START BATTLE (trigger=${this.node.name})`);
            }
            this._tryStartBattle();
        }

        this._battleWasActive = battleActive;
    }

    private _onKeyDown = (e: EventKeyboard) => {
        if (e.keyCode !== KeyCode.KEY_ENTER) return;
        if (!this._pendingEnter) return;
        if (!this._playerTouching) return;
        this._pendingEnter = false;
        this._tryStartBattle();
    };

    private _findPlayerGridMoveComponent(node: Node): PlayerGridMove | null {
        // 触发回调里的 otherNode 未必就是脚本挂载节点（可能是碰撞子节点）
        // 所以向父节点逐级查找，确保判定可靠。
        let cur: Node | null = node;
        let guard = 0;
        while (cur && guard++ < 8) {
            const comp = cur.getComponent(PlayerGridMove);
            if (comp) return comp;
            cur = cur.parent;
        }
        return null;
    }

    private _onBeginContact = (_self: Collider2D, other: Collider2D) => {
        const otherNode = other?.node;
        if (!otherNode) return;
        const playerMove = this._findPlayerGridMoveComponent(otherNode);
        if (!playerMove) return;

        this._playerTouching = true;

        if (this.debugLog) {
            console.log(
                `[BattleTriggerOnContact] BEGIN (player=${playerMove.node.name}, trigger=${this.node.name}, pendingEnter=${this._pendingEnter}, battleActive=${Boolean(this.battleRoot?.active)})`
            );
        }

        // 战斗进行中：不允许重复触发
        if (this.battleRoot?.active) return;

        // 战斗结束后若仍触碰，会进入 pendingEnter 状态，此时不自动触发
        if (this._pendingEnter) return;

        // 正常路径：自动开战
        this._tryStartBattle();
    };

    private _onEndContact = (_self: Collider2D, other: Collider2D) => {
        const otherNode = other?.node;
        if (!otherNode) return;
        const playerMove = this._findPlayerGridMoveComponent(otherNode);
        if (!playerMove) return;

        this._playerTouching = false;
        // 离开碰撞框后，下次再次碰到就恢复自动触发
        this._pendingEnter = false;
        this._wasTouchingWhenBattleStarted = false;

        if (this.debugLog) {
            console.log(
                `[BattleTriggerOnContact] END (player=${playerMove.node.name}, trigger=${this.node.name})`
            );
        }
    };

    private _resolveLocalPlayerOnce() {
        // 防止每个触发器每帧都去遍历节点树
        const now = Date.now();
        if (this._lastPlayerResolveAt > 0 && now - this._lastPlayerResolveAt < 2000) return;
        this._lastPlayerResolveAt = now;

        try {
            const scene = director.getScene?.();
            this._playerMove = scene?.getComponentInChildren(PlayerGridMove) ?? null;
            this._playerBox = this._playerMove?.node?.getComponentInChildren(BoxCollider2D) ?? null;
        } catch {
            this._playerMove = null;
            this._playerBox = null;
        }
    }

    private _pollTouchOverlap() {
        this._resolveLocalPlayerOnce();
        if (!this._triggerBox || !this._playerBox) return;

        const a = this._triggerBox.worldAABB;
        const b = this._playerBox.worldAABB;
        if (!a || !b) return;

        const hit =
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y;

        if (hit) {
            if (!this._playerTouching) {
                this._playerTouching = true;
                this._touchBeganThisFrame = true;
            }
        } else {
            if (this._playerTouching) {
                this._playerTouching = false;
                // 离开碰撞框后，下次再次碰到就恢复自动触发
                this._pendingEnter = false;
                this._wasTouchingWhenBattleStarted = false;
            }
        }
    }

    private _tryStartBattle() {
        if (!this.battleRoot) return;
        if (this.battleRoot.active) return;

        if (this.debugLog) {
            console.log(`[BattleTriggerOnContact] >>> START BATTLE (trigger=${this.node.name})`);
        }

        // 关键：记录战斗开始时玩家是否仍在碰撞框内
        this._wasTouchingWhenBattleStarted = this._playerTouching;
        this._pendingEnter = false;

        // BattleScene.onEnable 里会自动发起/恢复战斗
        this.battleRoot.active = true;
    }
}

