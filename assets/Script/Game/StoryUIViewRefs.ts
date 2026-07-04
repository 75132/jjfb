import { _decorator, Component, Node } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 剧情 UI 节点引用。
 * - 对白/选项：StoryLayer
 * - 剧情反馈 Tips：GameArea/Tips（完成任务、选项 systemTip 等）
 * - ToastItem：NPC 范围内「按 E 交谈」交互提示
 */
@ccclass('StoryUIViewRefs')
export class StoryUIViewRefs extends Component {
    @property(Node)
    dialoguePanel: Node | null = null;

    @property(Node)
    dialogueSpeakerLabel: Node | null = null;

    @property(Node)
    dialogueTextLabel: Node | null = null;

    @property(Node)
    nextButton: Node | null = null;

    @property(Node)
    choiceModal: Node | null = null;

    @property(Node)
    choiceTitleLabel: Node | null = null;

    @property([Node])
    choiceButtons: Node[] = [];

    @property(Node)
    toastItem: Node | null = null;

    @property(Node)
    toastTextLabel: Node | null = null;

    /** 剧情反馈（完成任务、选项 systemTip 等）；对应 GameArea/Tips */
    @property(Node)
    storyTipsPanel: Node | null = null;

    @property(Node)
    storyTipsLabel: Node | null = null;
}
