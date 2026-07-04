/**
 * 主线任务追踪面板（数据来自 StoryManager / story_get_state）
 */
import { _decorator, Component, Label, Node } from 'cc';
import { StoryManager } from './StoryManager';

const { ccclass, property } = _decorator;

@ccclass('TaskTracker')
export class TaskTracker extends Component {
    @property(Label)
    mainlineLabel: Label | null = null;

    @property(Label)
    taskListLabel: Label | null = null;

    @property({ type: Node, tooltip: '挂有 StoryManager 的节点' })
    storyHost: Node | null = null;

    private _story: StoryManager | null = null;

    onLoad() {
        const host = this.storyHost || this.node.parent;
        this._story = host?.getComponent(StoryManager) ?? host?.getComponentInChildren(StoryManager) ?? null;
        if (this._story) {
            this._story.node.on('story_state_updated', this.refresh, this);
        }
        this.schedule(this.refresh, 2);
        this.refresh();
    }

    onDestroy() {
        if (this._story?.node?.isValid) {
            this._story.node.off('story_state_updated', this.refresh, this);
        }
        this.unschedule(this.refresh);
    }

    private refresh = () => {
        if (!this._story?.isValid) return;
        const snap = this._story.getStoryTaskSnapshot();
        if (this.mainlineLabel) {
            this.mainlineLabel.string = `主线步骤：${snap.mainlineStep}`;
        }
        if (this.taskListLabel) {
            const lines = (snap.tasks || []).map(
                (t) => `· ${t.taskName || `任务${t.taskId}`} [${t.status}]`,
            );
            this.taskListLabel.string = lines.length ? lines.join('\n') : '暂无进行中任务';
        }
    };
}
