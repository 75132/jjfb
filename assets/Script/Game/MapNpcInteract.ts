import { _decorator, Component, JsonAsset, Node } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 地图 NPC 交互占位：读取共享地图 Json（含 npcUid 事件），由 uiRoot 下的 UI 展示剧情。
 * 场景里已绑定 mapConfig / uiRoot / npcUid，具体对话与任务逻辑可在此扩展。
 */
@ccclass('MapNpcInteract')
export class MapNpcInteract extends Component {
    @property(JsonAsset)
    mapConfig: JsonAsset | null = null;

    @property(Node)
    uiRoot: Node | null = null;

    @property
    npcUid = '';
}
