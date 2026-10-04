/**
 * 开屏世界观（Game / StartMovie）
 * 纯字幕模式：全黑底 + 居中旁白打字机，交代宏大世界观。
 */
import {
    _decorator,
    BlockInputEvents,
    Button,
    Color,
    Component,
    director,
    EventTouch,
    Graphics,
    JsonAsset,
    Label,
    Node,
    Tween,
    UIOpacity,
    UITransform,
    tween,
    view,
} from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';
import { ResourceManager } from '../Game/ResourceManager';
import { PlayerGridMove } from '../Game/GameArea/PlayerGridMove';
import { clearIntroPending, shouldPlayIntro } from './IntroFlags';

const { ccclass } = _decorator;

type IntroBeat = {
    id: string;
    duration: number;
    lines: string[];
};

type IntroTimeline = {
    skipEnabled?: boolean;
    autoPlay?: boolean;
    mode?: string;
    beats: IntroBeat[];
};

/** 约 300 字世界观旁白（分段播出） */
const FALLBACK_TIMELINE: IntroTimeline = {
    skipEnabled: true,
    autoPlay: true,
    mode: 'subtitle',
    beats: [
        {
            id: 'P1',
            duration: 14,
            lines: [
                '在星耀星系的边缘，人类曾以机甲为伴，开拓荒星、守护城邦。机甲最初被设计为协助生产与探索的智慧造物，却在漫长的边境冲突中逐渐被改造成战争工具。旧日的和平因此碎裂，整片殖民圈陷入长久的动荡。',
            ],
        },
        {
            id: 'P2',
            duration: 14,
            lines: [
                '暗域裂隙打开之后，虫族潮水般涌入星区。城市与卫星一座接一座熄灭，防线在虫鸣与甲壳的重压下节节后退。与此同时，部分人类势力背叛既有秩序，改造并驱使虫族，将灾变当作扩张的筹码。前线与后方之间，信任比资源更稀缺。',
            ],
        },
        {
            id: 'P3',
            duration: 13,
            lines: [
                '仍有人选择站在火线之前。机甲召唤师以契约唤出伙伴，指挥它们投身战场，以换取城市多撑一夜的时间。战争仍在继续，征召仍未停止。而你，正站在征召处的门外，准备签下属于自己的第一份契约。',
            ],
        },
    ],
};

@ccclass('IntroWorldviewController')
export class IntroWorldviewController extends Component {
    private static _instance: IntroWorldviewController | null = null;
    private static _blocking = false;

    private _built = false;
    private _playing = false;
    private _disposed = false;
    private _loadGen = 0;
    private _tryPlayRetries = 0;
    private _characterId = '';
    private _onDone: (() => void) | null = null;

    private _timeline: IntroTimeline = FALLBACK_TIMELINE;
    private _beatIndex = 0;
    private _lineIndex = 0;
    private _typing = false;
    private _waitingNext = false;
    private _finishing = false;

    private _rootBg: Node | null = null;
    private _blackBarrier: Node | null = null;
    private _subtitleLabel: Label | null = null;
    private _hintLabel: Label | null = null;
    private _btnSkip: Node | null = null;
    private _subtitlePanel: Node | null = null;

    private _viewW = 480;
    private _viewH = 800;
    private _currentLineText = '';
    private _typedCount = 0;

    public static isBlocking(): boolean {
        return IntroWorldviewController._blocking;
    }

    public static ensure(): IntroWorldviewController {
        if (IntroWorldviewController._instance?.isValid) {
            return IntroWorldviewController._instance;
        }
        const scene = director.getScene();
        const canvas = scene?.getChildByName('Canvas');
        let host = canvas?.getChildByName('StartMovie') ?? null;
        if (!host) {
            host = new Node('StartMovie');
            (canvas ?? scene)?.addChild(host);
            host.addComponent(UITransform).setContentSize(480, 800);
        }
        let comp = host.getComponent(IntroWorldviewController);
        if (!comp) comp = host.addComponent(IntroWorldviewController);
        IntroWorldviewController._instance = comp;
        return comp;
    }

    onLoad(): void {
        if (IntroWorldviewController._instance && IntroWorldviewController._instance !== this) {
            this.destroy();
            return;
        }
        IntroWorldviewController._instance = this;
        this.node.active = false;
    }

    onDestroy(): void {
        this._disposed = true;
        this._loadGen += 1;
        this._onDone = null;
        try {
            this.stopAllMotion();
        } catch {
            /* ignore */
        }
        this.unscheduleAllCallbacks();
        this._rootBg = null;
        this._blackBarrier = null;
        this._subtitleLabel = null;
        this._hintLabel = null;
        this._btnSkip = null;
        this._subtitlePanel = null;
        if (IntroWorldviewController._instance === this) {
            IntroWorldviewController._instance = null;
        }
        IntroWorldviewController._blocking = false;
    }

    public tryPlay(onDone?: () => void): void {
        const characterId = WebSocketManager.getInstance()?.getCharacterId?.() || '';
        if (!characterId) {
            if (this._tryPlayRetries < 25) {
                this._tryPlayRetries += 1;
                this.scheduleOnce(() => this.tryPlay(onDone), 0.12);
                return;
            }
            this._tryPlayRetries = 0;
            this.node.active = false;
            IntroWorldviewController._blocking = false;
            onDone?.();
            return;
        }
        this._tryPlayRetries = 0;
        if (!shouldPlayIntro(characterId)) {
            this.node.active = false;
            IntroWorldviewController._blocking = false;
            onDone?.();
            return;
        }
        this._onDone = onDone ?? null;
        this.beginIntro(characterId);
    }

    private beginIntro(characterId: string): void {
        if (this._playing || this._disposed) return;
        this._playing = true;
        this._finishing = false;
        this._characterId = characterId;
        const loadGen = ++this._loadGen;
        IntroWorldviewController._blocking = true;

        this.node.active = true;
        this.ensureTopMost();
        this.lockPlayer(true);
        this.buildUIIfNeeded();
        this.fitFullScreen();

        this.loadTimeline(loadGen, () => {
            if (!this.isAlive(loadGen)) return;
            this._beatIndex = 0;
            this.playBeat(0);
        });
    }

    private isAlive(loadGen?: number): boolean {
        if (this._disposed || !this.isValid) return false;
        if (loadGen !== undefined && loadGen !== this._loadGen) return false;
        return true;
    }

    private ensureTopMost(): void {
        const parent = this.node.parent;
        if (parent) this.node.setSiblingIndex(parent.children.length - 1);
    }

    private fitFullScreen(): void {
        const vs = view.getVisibleSize();
        this._viewW = Math.max(480, Math.round(vs.width));
        this._viewH = Math.max(800, Math.round(vs.height));
        const ut = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        ut.setContentSize(this._viewW, this._viewH);
        ut.setAnchorPoint(0.5, 0.5);
        this.node.setPosition(0, 0, 0);
        this.resizeBuiltLayers();
    }

    private resizeBuiltLayers(): void {
        const w = this._viewW;
        const h = this._viewH;
        for (const n of [this._rootBg, this._blackBarrier, this._subtitlePanel]) {
            if (!n?.isValid) continue;
            if (n === this._subtitlePanel) {
                n.getComponent(UITransform)?.setContentSize(Math.min(w - 48, 420), 320);
                n.setPosition(0, 16, 0);
            } else {
                n.getComponent(UITransform)?.setContentSize(w, h);
            }
        }
        if (this._rootBg) this.fillRect(this._rootBg, new Color(0, 0, 0, 255));
        if (this._btnSkip) this._btnSkip.setPosition(w * 0.5 - 64, h * 0.5 - 36, 0);
        if (this._hintLabel) this._hintLabel.node.setPosition(0, -h * 0.5 + 48, 0);
        if (this._subtitleLabel?.node) {
            this._subtitleLabel.node.getComponent(UITransform)?.setContentSize(Math.min(w - 72, 396), 300);
        }
    }

    private buildUIIfNeeded(): void {
        if (this._built) return;
        this._built = true;
        const w = this._viewW;
        const h = this._viewH;

        if (!this.node.getComponent(BlockInputEvents)) this.node.addComponent(BlockInputEvents);
        this.node.on(Node.EventType.TOUCH_END, this.onRootTap, this);

        this._rootBg = this.makeLayer('RootBlack', w, h);
        this.fillRect(this._rootBg, new Color(0, 0, 0, 255));

        // 字幕区：居中偏上，无底板花纹
        this._subtitlePanel = this.makeLayer('SubtitlePanel', Math.min(w - 48, 420), 320);
        this._subtitlePanel.setPosition(0, 16, 0);

        const labelNode = new Node('LabelSubtitle');
        this._subtitlePanel.addChild(labelNode);
        labelNode.addComponent(UITransform).setContentSize(Math.min(w - 72, 396), 300);
        labelNode.setPosition(0, 0, 0);
        this._subtitleLabel = labelNode.addComponent(Label);
        this._subtitleLabel.fontSize = 20;
        this._subtitleLabel.lineHeight = 34;
        this._subtitleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this._subtitleLabel.verticalAlign = Label.VerticalAlign.CENTER;
        this._subtitleLabel.overflow = Label.Overflow.RESIZE_HEIGHT;
        this._subtitleLabel.color = new Color(230, 230, 224, 255);
        this._subtitleLabel.string = '';
        this._subtitleLabel.enableWrapText = true;

        this._blackBarrier = this.makeLayer('BlackBarrier', w, h);
        this.fillRect(this._blackBarrier, new Color(0, 0, 0, 255));
        this.setOpacity(this._blackBarrier, 0);

        const ui = this.makeLayer('UI', w, h);
        this._btnSkip = new Node('BtnSkip');
        ui.addChild(this._btnSkip);
        this._btnSkip.addComponent(UITransform).setContentSize(88, 36);
        this.fillRect(this._btnSkip, new Color(0, 0, 0, 90));
        const skipL = new Node('L');
        this._btnSkip.addChild(skipL);
        skipL.addComponent(UITransform).setContentSize(88, 36);
        const sl = skipL.addComponent(Label);
        sl.string = '跳过';
        sl.fontSize = 16;
        sl.horizontalAlign = Label.HorizontalAlign.CENTER;
        sl.verticalAlign = Label.VerticalAlign.CENTER;
        sl.color = new Color(180, 180, 180, 200);
        this._btnSkip.setPosition(w * 0.5 - 64, h * 0.5 - 36, 0);
        this._btnSkip.addComponent(Button).transition = Button.Transition.NONE;
        this._btnSkip.on(Button.EventType.CLICK, this.skipAll, this);

        const hintN = new Node('Hint');
        ui.addChild(hintN);
        hintN.addComponent(UITransform).setContentSize(220, 28);
        this._hintLabel = hintN.addComponent(Label);
        this._hintLabel.string = '点击继续';
        this._hintLabel.fontSize = 15;
        this._hintLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this._hintLabel.color = new Color(140, 140, 140, 160);
        hintN.setPosition(0, -h * 0.5 + 48, 0);
        hintN.active = false;
    }

    private makeLayer(name: string, w: number, h: number): Node {
        const n = new Node(name);
        this.node.addChild(n);
        const ut = n.addComponent(UITransform);
        ut.setContentSize(w, h);
        ut.setAnchorPoint(0.5, 0.5);
        n.setPosition(0, 0, 0);
        return n;
    }

    private fillRect(node: Node, color: Color): Graphics {
        let g = node.getComponent(Graphics);
        if (!g) g = node.addComponent(Graphics);
        const ut = node.getComponent(UITransform)!;
        const w = ut.contentSize.width;
        const h = ut.contentSize.height;
        g.clear();
        g.fillColor = color;
        g.rect(-w * 0.5, -h * 0.5, w, h);
        g.fill();
        return g;
    }

    private setOpacity(node: Node, opacity: number): UIOpacity {
        let op = node.getComponent(UIOpacity);
        if (!op) op = node.addComponent(UIOpacity);
        op.opacity = opacity;
        return op;
    }

    private loadTimeline(loadGen: number, done: () => void): void {
        ResourceManager.getInstance().loadAsset<JsonAsset>('Intro/intro_timeline', JsonAsset, (err, asset) => {
            if (!this.isAlive(loadGen)) return;
            if (!err && asset?.json) {
                const raw = asset.json as IntroTimeline;
                if (raw?.beats?.length) this._timeline = raw;
            } else {
                this._timeline = FALLBACK_TIMELINE;
            }
            done();
        });
    }

    private playBeat(index: number): void {
        const beats = this._timeline.beats;
        if (index >= beats.length) {
            this.finishIntro();
            return;
        }
        this._beatIndex = index;
        this._lineIndex = 0;
        this._waitingNext = false;
        if (this._hintLabel) this._hintLabel.node.active = false;

        const beat = beats[index];
        // 段间短黑场，像电影字幕切页
        this.fadeBlack(true, 0.22, () => {
            if (this._subtitleLabel) this._subtitleLabel.string = '';
            this.fadeBlack(false, 0.28, () => {
                this.startTypingLines(beat);
                this.armBeatTimeout(beat.duration);
            });
        });
    }

    private startTypingLines(beat: IntroBeat): void {
        this._lineIndex = 0;
        this.playLine(beat.lines[0] || '');
    }

    private playLine(text: string): void {
        this._typing = true;
        this._waitingNext = false;
        if (this._subtitleLabel) this._subtitleLabel.string = '';
        this._currentLineText = text;
        this._typedCount = 0;
        this.unschedule(this.tickTypewriter);
        // 稍慢，方便读完约百字段落
        this.schedule(this.tickTypewriter, 0.055);
    }

    private tickTypewriter = (): void => {
        const text = this._currentLineText || '';
        this._typedCount += 1;
        if (!this._subtitleLabel) return;
        if (this._typedCount >= text.length) {
            this._subtitleLabel.string = text;
            this.finishCurrentLine();
            return;
        }
        this._subtitleLabel.string = text.slice(0, this._typedCount);
    };

    private finishCurrentLine(): void {
        this.unschedule(this.tickTypewriter);
        this._typing = false;
        this._waitingNext = true;
        const beat = this._timeline.beats[this._beatIndex];
        const lastBeat = this._beatIndex >= this._timeline.beats.length - 1;
        const lastLine = this._lineIndex >= (beat?.lines?.length || 1) - 1;
        if (this._hintLabel) {
            this._hintLabel.string = lastBeat && lastLine ? '点击进入' : '点击继续';
            this._hintLabel.node.active = true;
        }
    }

    private armBeatTimeout(duration: number): void {
        this.unschedule(this.onBeatTimeout);
        this.scheduleOnce(this.onBeatTimeout, Math.max(8, duration));
    }

    private onBeatTimeout = (): void => {
        if (!this._playing || this._finishing) return;
        if (this._typing) {
            this.completeTypingNow();
            this.scheduleOnce(() => this.advanceFromTap(), 1.2);
            return;
        }
        this.advanceFromTap();
    };

    private completeTypingNow(): void {
        if (this._subtitleLabel) this._subtitleLabel.string = this._currentLineText || '';
        this.finishCurrentLine();
    }

    private onRootTap = (_e?: EventTouch): void => {
        if (!this._playing || this._finishing) return;
        if (this._typing) {
            this.completeTypingNow();
            return;
        }
        if (this._waitingNext) this.advanceFromTap();
    };

    private advanceFromTap(): void {
        if (!this._playing || this._finishing) return;
        const beat = this._timeline.beats[this._beatIndex];
        if (!beat) {
            this.finishIntro();
            return;
        }
        this._waitingNext = false;
        if (this._hintLabel) this._hintLabel.node.active = false;
        if (this._lineIndex < beat.lines.length - 1) {
            this._lineIndex += 1;
            this.playLine(beat.lines[this._lineIndex]);
            return;
        }
        this.unschedule(this.onBeatTimeout);
        this.playBeat(this._beatIndex + 1);
    }

    private skipAll = (): void => {
        if (!this._playing || this._finishing) return;
        if (this._timeline.skipEnabled === false) return;
        this.finishIntro();
    };

    private finishIntro(): void {
        if (this._finishing) return;
        this._finishing = true;
        this.stopAllMotion();
        clearIntroPending(this._characterId);
        this.fadeBlack(true, 0.3, () => {
            this._playing = false;
            IntroWorldviewController._blocking = false;
            this.lockPlayer(false);
            this.node.active = false;
            const cb = this._onDone;
            this._onDone = null;
            cb?.();
        });
    }

    private fadeBlack(toBlack: boolean, dur: number, done?: () => void): void {
        if (!this._blackBarrier?.isValid) {
            done?.();
            return;
        }
        try {
            this._blackBarrier.setSiblingIndex(Math.max(0, this.node.children.length - 1));
        } catch {
            /* ignore */
        }
        const op = this.setOpacity(this._blackBarrier, toBlack ? 0 : 255);
        const gen = this._loadGen;
        tween(op)
            .to(dur, { opacity: toBlack ? 255 : 0 })
            .call(() => {
                if (!this.isAlive(gen)) return;
                done?.();
            })
            .start();
    }

    private stopAllMotion(): void {
        try {
            this.unschedule(this.tickTypewriter);
            this.unschedule(this.onBeatTimeout);
            if (this._blackBarrier?.isValid) {
                const op = this._blackBarrier.getComponent(UIOpacity);
                Tween.stopAllByTarget(op || this._blackBarrier);
            }
        } catch {
            /* ignore */
        }
    }

    private lockPlayer(locked: boolean): void {
        director.getScene()?.getComponentInChildren(PlayerGridMove)?.setInputLocked(locked);
    }
}

export function ensureIntroWorldview(): IntroWorldviewController {
    return IntroWorldviewController.ensure();
}
