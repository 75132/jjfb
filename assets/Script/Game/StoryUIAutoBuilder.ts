import { _decorator, Component, Node, Label, Button, Sprite, UITransform, Layout, Vec3, v2 } from 'cc';

const { ccclass, property, executeInEditMode } = _decorator;

@ccclass('StoryUIAutoBuilder')
@executeInEditMode(true)
export class StoryUIAutoBuilder extends Component {
    @property({ tooltip: '编辑器/运行时自动创建与重排 UI' })
    autoBuildOnStart: boolean = true;

    @property({ tooltip: '重建 StoryLayer/HUDLayer/OverlayLayer（会清空这三层）' })
    rebuildIfExists: boolean = false;

    @property({ tooltip: 'GameArea 视口宽度' })
    viewWidth: number = 480;

    @property({ tooltip: 'GameArea 视口高度' })
    viewHeight: number = 540;

    private _built = false;

    start() {
        if (this._built || !this.autoBuildOnStart) return;
        this._built = true;
        this.build();
    }

    public build(): void {
        const root = this.node;
        this.ensureUITransform(root, this.viewWidth, this.viewHeight, 0.5, 0.5);

        if (this.rebuildIfExists) {
            ['StoryLayer', 'HUDLayer', 'OverlayLayer'].forEach((n) => {
                const old = root.getChildByName(n);
                if (old) old.destroy();
            });
        }

        const storyLayer = this.getOrCreateChild(root, 'StoryLayer');
        const hudLayer = this.getOrCreateChild(root, 'HUDLayer');
        const overlayLayer = this.getOrCreateChild(root, 'OverlayLayer');
        this.ensureUITransform(storyLayer, this.viewWidth, this.viewHeight, 0.5, 0.5);
        this.ensureUITransform(hudLayer, this.viewWidth, this.viewHeight, 0.5, 0.5);
        this.ensureUITransform(overlayLayer, this.viewWidth, this.viewHeight, 0.5, 0.5);

        this.layoutStoryLayer(storyLayer);
        this.layoutHUDLayer(hudLayer);
        this.layoutOverlayLayer(overlayLayer);
    }

    private layoutStoryLayer(storyLayer: Node): void {
        const halfW = this.viewWidth / 2;
        const halfH = this.viewHeight / 2;

        const dialogue = this.getOrCreateChild(storyLayer, 'DialoguePanel');
        this.ensureUITransform(dialogue, this.viewWidth - 16, 188, 0.5, 0.5);
        dialogue.setPosition(new Vec3(0, -halfH + 100, 0));
        dialogue.active = false;

        const speaker = this.getOrCreateChild(dialogue, 'SpeakerNameLabel');
        this.ensureUITransform(speaker, 170, 34, 0, 1);
        speaker.setPosition(new Vec3(-halfW + 14, 82, 0));
        this.ensureLabel(speaker, 24, Label.HorizontalAlign.LEFT, Label.VerticalAlign.CENTER, '说话人');

        const portrait = this.getOrCreateChild(dialogue, 'PortraitSlot');
        this.ensureUITransform(portrait, 92, 92, 0, 0.5);
        portrait.setPosition(new Vec3(-halfW + 16, -4, 0));
        this.ensureSprite(portrait);
        portrait.active = false;

        const linesContainer = this.getOrCreateChild(dialogue, 'LinesContainer');
        this.ensureUITransform(linesContainer, this.viewWidth - 148, 110, 0, 0.5);
        linesContainer.setPosition(new Vec3(-halfW + 118, 0, 0));

        const lineTextNode = this.getOrCreateChild(linesContainer, 'Text');
        this.ensureUITransform(lineTextNode, this.viewWidth - 160, 110, 0, 1);
        lineTextNode.setPosition(new Vec3(0, 52, 0));
        const linesLabel = this.ensureLabel(lineTextNode, 22, Label.HorizontalAlign.LEFT, Label.VerticalAlign.TOP, '');
        linesLabel.overflow = Label.Overflow.CLAMP;

        const nextBtn = this.getOrCreateChild(dialogue, 'NextBtn');
        this.ensureUITransform(nextBtn, 138, 42, 1, 0);
        nextBtn.setPosition(new Vec3(halfW - 12, -halfH + 18, 0));
        this.ensureButton(nextBtn);
        const nextText = this.getOrCreateChild(nextBtn, 'Text');
        this.ensureUITransform(nextText, 138, 42, 0.5, 0.5);
        nextText.setPosition(new Vec3(0, 0, 0));
        this.ensureLabel(nextText, 20, Label.HorizontalAlign.CENTER, Label.VerticalAlign.CENTER, '下一句');

        const closeBtn = this.getOrCreateChild(dialogue, 'CloseBtn');
        this.ensureUITransform(closeBtn, 110, 40, 0, 0);
        closeBtn.setPosition(new Vec3(-halfW + 12, -halfH + 18, 0));
        this.ensureButton(closeBtn);
        const closeText = this.getOrCreateChild(closeBtn, 'Text');
        this.ensureUITransform(closeText, 110, 40, 0.5, 0.5);
        closeText.setPosition(new Vec3(0, 0, 0));
        this.ensureLabel(closeText, 20, Label.HorizontalAlign.CENTER, Label.VerticalAlign.CENTER, '关闭');
        closeBtn.active = false;

        const choice = this.getOrCreateChild(storyLayer, 'ChoiceModal');
        this.ensureUITransform(choice, this.viewWidth - 30, 290, 0.5, 0.5);
        choice.setPosition(new Vec3(0, 10, 0));
        choice.active = false;

        const title = this.getOrCreateChild(choice, 'TitleLabel');
        this.ensureUITransform(title, this.viewWidth - 60, 36, 0.5, 1);
        title.setPosition(new Vec3(0, 132, 0));
        this.ensureLabel(title, 26, Label.HorizontalAlign.CENTER, Label.VerticalAlign.CENTER, '请选择');

        const options = this.getOrCreateChild(choice, 'OptionsContainer');
        this.ensureUITransform(options, this.viewWidth - 80, 158, 0.5, 0.5);
        options.setPosition(new Vec3(0, 18, 0));
        const layout = options.getComponent(Layout) ?? options.addComponent(Layout);
        layout.type = Layout.Type.VERTICAL;
        layout.verticalDirection = Layout.VerticalDirection.TOP_TO_BOTTOM;
        layout.resizeMode = Layout.ResizeMode.CONTAINER;
        layout.spacingY = 12;
        layout.paddingTop = 2;
        layout.paddingBottom = 2;

        this.layoutOption(options, 'OptionButton_0', '选项A');
        this.layoutOption(options, 'OptionButton_1', '选项B');

        const replyArea = this.getOrCreateChild(choice, 'SubReplyArea');
        this.ensureUITransform(replyArea, this.viewWidth - 80, 62, 0.5, 0);
        replyArea.setPosition(new Vec3(0, -136, 0));
        replyArea.active = false;
        const replyText = this.getOrCreateChild(replyArea, 'Text');
        this.ensureUITransform(replyText, this.viewWidth - 80, 62, 0, 1);
        replyText.setPosition(new Vec3(-(this.viewWidth - 80) / 2, 30, 0));
        this.ensureLabel(replyText, 20, Label.HorizontalAlign.LEFT, Label.VerticalAlign.TOP, '');

        const tipLayer = this.getOrCreateChild(storyLayer, 'SystemTipLayer');
        this.ensureUITransform(tipLayer, this.viewWidth, this.viewHeight, 0.5, 0.5);
        const toast = this.getOrCreateChild(tipLayer, 'ToastItem');
        this.ensureUITransform(toast, this.viewWidth - 60, 46, 0.5, 0);
        toast.setPosition(new Vec3(0, -halfH + 12, 0));
        this.ensureSprite(toast);
        const toastText = this.getOrCreateChild(toast, 'Text');
        this.ensureUITransform(toastText, this.viewWidth - 70, 40, 0.5, 0.5);
        toastText.setPosition(new Vec3(0, 23, 0));
        this.ensureLabel(toastText, 20, Label.HorizontalAlign.CENTER, Label.VerticalAlign.CENTER, '');
        toast.active = false;

        const taskBar = this.getOrCreateChild(storyLayer, 'TaskHintBar');
        this.ensureUITransform(taskBar, this.viewWidth - 24, 34, 0.5, 1);
        taskBar.setPosition(new Vec3(0, halfH - 10, 0));
        const taskText = this.getOrCreateChild(taskBar, 'TaskHintText');
        this.ensureUITransform(taskText, this.viewWidth - 36, 30, 0, 0.5);
        taskText.setPosition(new Vec3(-(this.viewWidth - 36) / 2, 0, 0));
        this.ensureLabel(taskText, 19, Label.HorizontalAlign.LEFT, Label.VerticalAlign.CENTER, '');
    }

    private layoutHUDLayer(hudLayer: Node): void {
        const prompt = this.getOrCreateChild(hudLayer, 'InteractPrompt');
        this.ensureUITransform(prompt, this.viewWidth - 80, 38, 0.5, 0);
        prompt.setPosition(new Vec3(0, -this.viewHeight / 2 + 64, 0));
        const promptText = this.getOrCreateChild(prompt, 'PromptText');
        this.ensureUITransform(promptText, this.viewWidth - 96, 34, 0.5, 0.5);
        promptText.setPosition(new Vec3(0, 19, 0));
        this.ensureLabel(promptText, 19, Label.HorizontalAlign.CENTER, Label.VerticalAlign.CENTER, '按 E 对话');
        prompt.active = false;
    }

    private layoutOverlayLayer(overlayLayer: Node): void {
        const loading = this.getOrCreateChild(overlayLayer, 'LoadingOverlay');
        this.ensureUITransform(loading, this.viewWidth, this.viewHeight, 0.5, 0.5);
        loading.setPosition(new Vec3(0, 0, 0));
        this.ensureSprite(loading);
        const text = this.getOrCreateChild(loading, 'Text');
        this.ensureUITransform(text, this.viewWidth, 36, 0.5, 0.5);
        text.setPosition(new Vec3(0, 0, 0));
        this.ensureLabel(text, 26, Label.HorizontalAlign.CENTER, Label.VerticalAlign.CENTER, '加载中...');
        loading.active = false;
    }

    private layoutOption(parent: Node, name: string, title: string): void {
        const btnNode = this.getOrCreateChild(parent, name);
        this.ensureUITransform(btnNode, this.viewWidth - 80, 48, 0.5, 0.5);
        this.ensureButton(btnNode);
        const textNode = this.getOrCreateChild(btnNode, 'Text');
        this.ensureUITransform(textNode, this.viewWidth - 96, 42, 0.5, 0.5);
        textNode.setPosition(new Vec3(0, 0, 0));
        this.ensureLabel(textNode, 21, Label.HorizontalAlign.CENTER, Label.VerticalAlign.CENTER, title);
    }

    private getOrCreateChild(parent: Node, name: string): Node {
        const existed = parent.getChildByName(name);
        if (existed) return existed;
        const node = new Node(name);
        parent.addChild(node);
        return node;
    }

    private ensureUITransform(node: Node, width: number, height: number, ax: number, ay: number): UITransform {
        const ut = node.getComponent(UITransform) ?? node.addComponent(UITransform);
        ut.setContentSize(width, height);
        ut.setAnchorPoint(v2(ax, ay));
        return ut;
    }

    private ensureLabel(
        node: Node,
        fontSize: number,
        hAlign: Label.HorizontalAlign,
        vAlign: Label.VerticalAlign,
        text: string
    ): Label {
        const label = node.getComponent(Label) ?? node.addComponent(Label);
        label.fontSize = fontSize;
        label.horizontalAlign = hAlign;
        label.verticalAlign = vAlign;
        label.string = text;
        return label;
    }

    private ensureButton(node: Node): Button {
        return node.getComponent(Button) ?? node.addComponent(Button);
    }

    private ensureSprite(node: Node): Sprite {
        return node.getComponent(Sprite) ?? node.addComponent(Sprite);
    }
}

