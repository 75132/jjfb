import { _decorator, Component, Node, ScrollView, Label, Button, UITransform } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Log')
export class Log extends Component {
    @property(ScrollView) scrollView: ScrollView = null!;
    @property(Node) content: Node = null!;
    @property(Label) text: Label = null!;
    @property(Button) openButton: Button = null!;
    @property({ tooltip: '追加时自动滚动到底部' }) autoScroll: boolean = true;
    @property({ tooltip: '自动调整内容高度以显示全部文本' }) autoResize: boolean = true;

    private lines: string[] = [];
    private origLog: any;
    private origWarn: any;
    private origError: any;
    private static readonly MAX_LINES = 300;
    private dirty = false;
    private flushScheduled = false;
    private flushTimer = -1;

    onLoad() {
        this.origLog = console.log.bind(console);
        this.origWarn = console.warn.bind(console);
        this.origError = console.error.bind(console);
        console.log = (...args: any[]) => { this.origLog(...args); this.append('INFO', args); };
        console.warn = (...args: any[]) => { this.origWarn(...args); this.append('WARN', args); };
        console.error = (...args: any[]) => { this.origError(...args); this.append('ERROR', args); };
        if (this.openButton) this.openButton.node.on(Button.EventType.CLICK, this.togglePanel, this);
        if (!this.content && this.scrollView) this.content = this.scrollView.content;
        if (!this.text && this.content) this.text = this.content.getComponent(Label);
        if (this.text) this.text.overflow = Label.Overflow.RESIZE_HEIGHT;
    }

    onDestroy() {
        if (this.flushTimer !== -1) {
            clearTimeout(this.flushTimer);
            this.flushTimer = -1;
        }
        if (this.origLog) console.log = this.origLog;
        if (this.origWarn) console.warn = this.origWarn;
        if (this.origError) console.error = this.origError;
        if (this.openButton && this.openButton.node && this.openButton.node.isValid) {
            this.openButton.node.off(Button.EventType.CLICK, this.togglePanel, this);
        }
    }

    public openPanel() {
        if (this.scrollView && this.scrollView.node) this.scrollView.node.active = true;
        this.dirty = false;
        this.render();
    }

    public togglePanel() {
        if (this.scrollView && this.scrollView.node) {
            const n = this.scrollView.node;
            n.active = !n.active;
            if (n.active) {
                this.dirty = false;
                this.render();
            }
        }
    }

    private append(level: string, args: any[]) {
        try {
            const msg = args.map(v => {
                try { return typeof v === 'string' ? v : JSON.stringify(v); } catch { return String(v); }
            }).join(' ');
            this.lines.push(`[${level}] ${msg}`);
            if (this.lines.length > Log.MAX_LINES) {
                this.lines.splice(0, this.lines.length - Log.MAX_LINES);
            }
            this.dirty = true;
            this.scheduleFlush();
        } catch {}
    }

    private scheduleFlush() {
        if (this.flushScheduled) return;
        this.flushScheduled = true;
        this.flushTimer = setTimeout(() => {
            this.flushTimer = -1;
            this.flushScheduled = false;
            if (!this.isValid || !this.dirty) return;
            this.dirty = false;
            this.render();
        }, 100) as unknown as number;
    }

    private render() {
        if (this.scrollView && this.scrollView.node && !this.scrollView.node.activeInHierarchy) return;
        if (this.text) this.text.string = this.lines.join('\n');
        if (this.autoResize && this.text && this.content) {
            const lt = this.text.node.getComponent(UITransform);
            const ct = this.content.getComponent(UITransform);
            if (lt && ct) {
                const h = lt.contentSize.height;
                const w = ct.contentSize.width;
                ct.setContentSize(w, h);
            }
        }
        if (this.autoScroll && this.scrollView) this.scrollView.scrollToBottom(0.2, true);
    }

    public clear() {
        this.lines = [];
        if (this.text) this.text.string = '';
    }
}
