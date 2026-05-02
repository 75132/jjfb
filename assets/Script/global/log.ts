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

    onLoad() {
        this.origLog = console.log.bind(console);
        this.origWarn = console.warn.bind(console);
        this.origError = console.error.bind(console);
        const append = (level: string, args: any[]) => {
            try {
                const msg = args.map(v => {
                    try { return typeof v === 'string' ? v : JSON.stringify(v); } catch { return String(v); }
                }).join(' ');
                const line = `[${level}] ${msg}`;
                this.lines.push(line);
                this.render();
            } catch {}
        };
        console.log = (...args: any[]) => { this.origLog(...args); append('INFO', args); };
        console.warn = (...args: any[]) => { this.origWarn(...args); append('WARN', args); };
        console.error = (...args: any[]) => { this.origError(...args); append('ERROR', args); };
        if (this.openButton) this.openButton.node.on(Button.EventType.CLICK, this.togglePanel, this);
        if (!this.content && this.scrollView) this.content = this.scrollView.content;
        if (!this.text && this.content) this.text = this.content.getComponent(Label);
        if (this.text) this.text.overflow = Label.Overflow.RESIZE_HEIGHT;
    }

    onDestroy() {
        if (this.origLog) console.log = this.origLog;
        if (this.origWarn) console.warn = this.origWarn;
        if (this.origError) console.error = this.origError;
        if (this.openButton && this.openButton.node && this.openButton.node.isValid) {
            this.openButton.node.off(Button.EventType.CLICK, this.togglePanel, this);
        }
    }

    public openPanel() {
        if (this.scrollView && this.scrollView.node) this.scrollView.node.active = true;
    }

    public togglePanel() {
        if (this.scrollView && this.scrollView.node) {
            const n = this.scrollView.node;
            n.active = !n.active;
            if (n.active && this.autoScroll) this.scrollView.scrollToBottom(0.2, true);
        }
    }

    private render() {
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
