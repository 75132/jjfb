import { _decorator, Component, Node } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 剧情 UI 节点引用（对白、选项、Toast）。
 * 在编辑器将 DialoguePanel / ChoiceModal 等子节点拖到对应槽位，由 StoryDialoguePlayer 运行时驱动。
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
}
