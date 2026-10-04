# 开屏世界观动画方案（Cocos 可落地）

> 对应剧本：`JJFB机甲风暴_主线剧情短剧剧本_v2.md` 序章场 1（约 11–33 行）  
> 目标：玩家进游戏前的**开屏/世界观交代**（不是郊外实机剧情）  
> 原则：**少素材、少特效、时间轴驱动**，方便其他 AI 直接写 Cocos  
> 工程锚点：`D:\jjfbol-cocos\jjfbol-cocos\jjfb\`（已有 Login / LoadingPanel / StoryManager / Robot 帧图）

---

## 1. 一句话方案

做成 **4 幕时间轴幻灯（IntroTimeline）**，每幕 = 静态层叠背景 + 少量精灵平移/闪烁 + 底部旁白打字机。  
总时长 **28–35 秒**，全程可 **点击跳过**。  
不做视频、不做 Spine 大片、不做 3D。

插入点建议：

```
登录成功 / 点「开始」 → 【新】世界观开屏 IntroScene
                    → 选角 CharacterSelect
                    → 进图（郊外）
```

本地标记：`localStorage.jjfb_intro_seen = 1`（或账号字段），第二次进可跳过；设置里可「重看开场」。

---

## 2. 剧本 → 4 幕拆解（只做场 1）

| 幕 | 时长 | 画面（给玩家看的） | 旁白文案（可直接用） |
|---|---|---|---|
| **A 虫潮压境** | 8s | 星空裂开，虫群如潮淹没殖民卫星/城市灯火熄灭 | 「星耀星系的灾难，先从虫族入侵开始。它们从宇宙暗域涌来，城市一座接一座失守。」 |
| **B 防线放宠** | 7s | 城门前，召唤师腕环发光，机甲宠物挡在人前，虫潮压上 | 「机甲本是召唤师的伙伴——叫得出名字，它就替你上场。」 |
| **C 反叛驱虫** | 8s | 同战场，蚀纹腕环亮起，改造虫/寄生机甲被驱上前线 | 「可这场仗还夹着另一刀：有人叛了。反叛军改造虫族、利用虫潮，虫是刀，人也是刀。」 |
| **D 征召你** | 6–8s | 征召处门外，空白腕环微亮，远处警报/虫鸣感 | 「而你——是还在征召处报名的新手召唤师，准备签下第一份契约，上前线。」 |

切幕方式：黑场 0.25s 或快速淡入淡出（`UIOpacity` tween）。  
幕 C 可短暂叠字幕条：`反叛军 · 黑蚀`（用 Label，不要烧进图）。

---

## 3. Cocos「好做」的动画手法（推荐全用这些）

只允许这些技术栈，别升级成大片：

| 手法 | 用途 | 实现 |
|---|---|---|
| `tween` 位移动画 | 虫群横移、卫星缓漂、宠物冲一步 | `tween(node).by(t,{position})` |
| `tween` 透明度 | 切幕、腕环闪、裂隙吞吐 | `UIOpacity.opacity` |
| 精灵池重复 | 虫潮「很多」的感觉 | 同 1–2 张虫图实例化 12–20 个，错开速度 |
| 帧动画（已有） | 机甲待机/走 | 已有 `amc_L1-0..3`，2–4 帧循环即可 |
| 打字机 Label | 旁白 | 每 40–60ms 加一字；点击一次播完当前句 |
| 全屏色块 | 暗角/裂隙红/蚀纹紫 | 纯 `Sprite` 纯色 + 低透明 |
| 音效卡点 | 切幕、虫鸣、警报 | 1 条 BGM + 3 个 SFX，没有就静音也能跑 |

明确不做：粒子海、流体、骨骼绑定、Live2D、视频 mp4、实时光照。

---

## 4. 素材清单（现成优先 + 最少新导）

### 4.1 工程里已有（直接用）

路径根：`jjfb/assets/`

| 用途 | 素材 | 路径 |
|---|---|---|
| 己方机甲宠物（幕 B/D） | `amc_L1` 四帧 | `Image/Robot/pic/amc_L1/` 或 `resources/Robot/amc_L1-*.png` |
| 备选机甲 | `bl_L1` | `Image/Robot/pic/bl_L1/` |
| 召唤师小人（幕 B/D） | `Npc_01`~`06` | `resources/Npc/Npc_*.png` |
| 加载/遮罩可参考 | Loading | `Image/Loading/` |
| 旁白 UI 风格 | 可对齐 StoryLayer 字体/底板 | 现有 `StoryManager` / Story UI |

### 4.2 必须新导入（工程里目前没有虫族）

从解包图鉴拷 **单帧 PNG** 进例如：  
`assets/resources/Intro/`（新建）

| 文件建议名 | 来源（已有备份也可） | 用在哪 |
|---|---|---|
| `intro_bug_queen.png` | `生图参考_轮播/轮播01_虫族入侵/虫族女王.png` | 幕 A 远景巨影（缩小半透） |
| `intro_bug_hunter.png` | `致命猎杀者.png` | 幕 A/B 虫潮单体 |
| `intro_bug_guard.png` | `女王护卫.png` | 幕 A 虫潮单体 |
| `intro_bug_parasite.png` | `轮播02/寄生机甲.png` | 幕 C 改虫主力 |
| `intro_wrist_empty.png` | **新做极简**：圆环 UI 图标即可（32–64px） | 幕 D 空白腕环 |
| `intro_wrist_etch.png` | 同上，加暗红蚀纹 | 幕 C |

可选背景（没有也能用纯色+星点代替）：

| 文件 | 说明 |
|---|---|
| `intro_bg_space.png` | 一张暗星空静图（可用纯黑+随机小白点程序生成，**更推荐程序生成省素材**） |
| `intro_bg_gate.png` | 城门剪影（可程序：深灰矩形+门洞，不必美宣图） |

> 不要依赖「全家福/图鉴立绘大图」做开屏——在 Cocos 里难控风格，且和现有像素机甲不统一。开屏跟**局内精灵**一条审美线。

### 4.3 音频（没有可后期补）

- `intro_bgm.mp3`：低沉循环 30s  
- `sfx_rift.wav`：裂隙  
- `sfx_bug.wav`：虫鸣短音  
- `sfx_alarm.wav`：幕 D 警报  

---

## 5. 场景节点树（给实现 AI 的结构）

建议新建场景：`IntroWorldview.scene`  
挂脚本：`IntroWorldviewController.ts`

```
Canvas
├─ BlackBarrier          // 切幕黑场
├─ StageRoot
│  ├─ LayerFar           // 星空 / 城市剪影（慢漂）
│  ├─ LayerMid           // 主视觉：虫潮 / 城门 / 宠物
│  ├─ LayerFore          // 腕环特写、字幕条
│  └─ FxTint             // 全屏色罩（紫/红/暗）
├─ Narration
│  ├─ Panel（半透黑底）
│  └─ LabelNarration
├─ UI
│  ├─ BtnSkip「跳过」
│  └─ Hint「点击继续」
└─ AudioSource
```

每幕激活时：只 `active` 该幕相关子节点，其它关掉，避免同屏过乱。

---

## 6. 分幕排演（实现规格）

### 幕 A｜虫潮压境
- LayerFar：黑底 + 80 个 2×2 白点星空缓慢左移  
- LayerMid：`intro_bug_*` ×15，从右向左不同速度（80–220 px/s）  
- 远处一张半透 `intro_bug_queen` 缓慢放大 1.0→1.08  
- FxTint：深蓝  
- 旁白打字机播完后停 1s → 切 B  

### 幕 B｜防线放宠
- 城门：两个深灰方块夹一条门缝即可  
- 左：`Npc_01` 小（人）+ 手腕位置挂发光小环（色块闪）  
- 前：`amc_L1` 待机帧循环，再 `by` 向前冲 40px  
- 右：虫潮继续压来但速度减半（被挡住的感觉）  
- 旁白第二句  

### 幕 C｜反叛驱虫
- 复用幕 B 布局，换色：FxTint 变暗红  
- 己方宠淡出；换上 `intro_bug_parasite` ×6 从「己方侧」冲向镜头/虫潮  
- 前景 Label 弹出：`反叛军 · 黑蚀`（0.3s 放大淡入）  
- 旁白第三句（可拆两段打字）  

### 幕 D｜征召你
- 清场；中央大号 `intro_wrist_empty` 呼吸闪（opacity 120↔255）  
- 背景极远虫群小剪影慢移 + 偶尔警报闪红（全屏红 0.1s）  
- 旁白第四句 → 显示「点击进入」→ 进选角  

---

## 7. 时间轴数据（建议 JSON，方便改文案不改代码）

放到：`assets/resources/Intro/intro_timeline.json`

```json
{
  "skipEnabled": true,
  "autoPlay": true,
  "beats": [
    {
      "id": "A_invasion",
      "duration": 8,
      "tint": "#0a1a33",
      "lines": ["星耀星系的灾难，先从虫族入侵开始。它们从宇宙暗域涌来，城市一座接一座失守。"],
      "spawn": { "bugs": ["hunter", "guard"], "count": 16, "queen": true }
    },
    {
      "id": "B_defense",
      "duration": 7,
      "tint": "#101820",
      "lines": ["机甲本是召唤师的伙伴——叫得出名字，它就替你上场。"],
      "spawn": { "allyMech": "amc_L1", "npc": "Npc_01", "bugs": ["hunter"], "count": 10 }
    },
    {
      "id": "C_rebel",
      "duration": 8,
      "tint": "#2a0a12",
      "title": "反叛军 · 黑蚀",
      "lines": ["可这场仗还夹着另一刀：有人叛了。", "反叛军改造虫族、利用虫潮。虫是刀，人也是刀。"],
      "spawn": { "parasite": true, "count": 6 }
    },
    {
      "id": "D_recruit",
      "duration": 7,
      "tint": "#0c0c10",
      "lines": ["而你——是还在征召处报名的新手召唤师，准备签下第一份契约，上前线。"],
      "spawn": { "wristEmpty": true, "alarm": true }
    }
  ]
}
```

---

## 8. 脚本职责（交给写 Cocos 的 AI）

新建：`assets/Script/Intro/IntroWorldviewController.ts`

职责清单：

1. `onLoad`：读 `intro_timeline.json`，预加载 Intro 图与 `amc_L1`/`Npc_01`  
2. `startIntro()`：按 beats 顺序播；每 beat 清 LayerMid 再按 spawn 规则生成  
3. `playLine(text)`：打字机；点击 = 若未打完则瞬间打完，若已打完则进入下一 beat  
4. `skipAll()`：停 tween、写 `intro_seen`、`director.loadScene('CharacterSelect')`（场景名按工程实际改）  
5. 与 Login 的衔接：在「开始游戏」成功回调里先判断是否看过 Intro  

不要改 `StoryManager` 大战逻辑；开屏是独立薄模块。

---

## 9. 验收标准（给 QA / 你自己）

- [ ] 竖屏/横屏都能看（以工程设计分辨率为准），旁白不溢出  
- [ ] 4 幕信息齐全：虫侵 → 召唤宠 → 反叛 → 你是新人  
- [ ] 全程 ≤ 40s；跳过 < 0.5s 进选角  
- [ ] 无虫族素材时至少能用色块+机甲跑通（graceful degrade）  
- [ ] 不引入圣城神光类美宣大图，视觉跟局内 Robot/NPC 一致  

---

## 10. 给「下一个 AI」的开场提示词（可直接粘贴）

```
请在 Cocos 工程 D:\jjfbol-cocos\jjfbol-cocos\jjfb 实现世界观开屏动画。
严格按文档《开屏世界观动画方案_Cocos.md》实现：
- 新场景 IntroWorldview + IntroWorldviewController.ts
- 4 幕时间轴 + intro_timeline.json
- 只用 tween / 精灵池 / 打字机 Label / 跳过
- 素材：现有 amc_L1、Npc_01；虫族 PNG 放到 resources/Intro/
- 从 Login 开始流程切入，带 intro_seen 本地标记
不要做视频、Spine、粒子海；不要改 StoryManager 主逻辑。
剧本文案以短剧场1旁白为准。
```

---

## 11. 和「生图轮播」的关系

| | 生图轮播 | 本方案 |
|---|---|---|
| 用途 | 外部 AI 出美宣图 | **游戏内真正播放** |
| 依赖 | 大图 + 提示词 | **局内精灵 + tween** |
| 建议 | 可作商店/PV，不进主流程 | **主流程采用本方案** |

若以后美宣图质量达标，可把某幕 LayerFar 换成一张静图；第一版不要等生图。
