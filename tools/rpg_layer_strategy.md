# 给 RPG Maker MV 地图「加图层」—— 可行性结论与替代方案

> 起因：Map025 用 B/C/D/E 四个页签当四层（地面/墙壁/路面/植物），用户问
> 「**可以魔改 RPG Maker MV 客户端，让后面的图层一直往下加吗？这个只到 E 完全不够用**」
> 追加：「**不能强加吗？只有这个最方便了，其他的不好做剧情**」
>
> 结论先行：**页签真的加不了（三处独立实锤，见 §2）；id 段天花板也只有约 8 层（§3）。
> 但你真正要的两件事——「同一个画布上叠很多层」和「剧情好写」——用「层 = 地图」都能拿到，
> 而且剧情工作流一个字不用改（§4.5）。**
> 全程只读，未改动 RPG 工程 / 游戏资产 / Juben。

---

## 1. 四个结论

| # | 问题 | 结论 |
|---|---|---|
| ① | 魔改 MV 编辑器，加 F/G/H… 页签？ | **不可行。** 页签与调色板逻辑是 **C++ 编译后的机器码**，不是配置、也不在 QML 里（§2） |
| ② | 手改 Tilesets.json 把槽位扩到 11 个呢？ | **也不行。** 页签数不是从 `tilesetNames` 长度算的；模板里所有图块集**永远固定 9 槽**，官方帮助文档写死「5 types of tiles for **A through E**」（§2.1） |
| ③ | 就算加上页签，能"一直往下加"吗？ | **不能。** 图块 id 上限 8192，B/C/D/E 只占 1024，**空白只剩 896 个 id ≈ 3.5 页**，天花板约 8 层（§3） |
| ④ | 那怎么做到无限层 + 剧情好写？ | **层 = 地图。** 一张地图承载一层，用地图树组织；**事件/剧情全挂"主图"，其他层是纯画布**（§4、§4.5） |

---

## 2. 编辑器为什么改不了（实测证据）

编辑器本体 `D:\Program Files (x86)\KADOKAWA\RPGMV\RPGMV.exe`（19,595,264 字节，PE32 i386，7 节）。

**它是个 Qt(QML) 应用，不是 HTML/JS 应用**（所以 `nwjs-win/` 只是跑游戏的运行时，与编辑器无关）：

```
RPGMV.exe 内的明文串：
  QQmlApplicationEngine failed to load component
  qrc:/qml/Main/MainWindow.qml          ← UI 从 Qt 资源加载
  TilemapHelper / MapEditorBody / TilePaletteBody / AnimationScreenBody ...
  TilePaletteBody.tilesetModeChanged.regionModeChanged.pageIndexChanged
                .maxPagesChanged.maxColumnsChanged.maxRowsChanged
    ...getPaletteTiles.x.y...tileId.representative.isTilePixelTransparent
  MapEditorBody....maxAllLayers.tilesetFlags....backImagePath...
```

- `TilePaletteBody`（**图块调色板**，就是那个 A/B/C/D/E 页签条）暴露的属性是
  `tilesetMode` / `regionMode` / `pageIndex` / **`maxPages`** / `maxColumns` / `maxRows` / `getPaletteTiles(x,y)` / `tileId` / `representative`。
  → **页签数量、每页行列、图块 id 计算全在这个 C++ 类里**。
- `MapEditorBody` 暴露 `maxAllLayers` / `tilesetFlags` / `backImagePath`。
- 这些串是 **Qt 元对象（QMetaObject）里的属性/方法/信号名**，真正的实现是 `.text` 段里的**原生机器码**。
- exe 里全量扫过：**明文 QML 只出现在"事件命令"这类动态加载的界面**
  （`source: "EventCommands/EventCommand" + eventCode + ".qml"`），图块对话框/调色板**没有任何"页签列表"可改**。

**要加页签，等于：改 C++ 机器码 + 重打 Qt 资源段 + 重签 PE** → 实质是重写编辑器；
且 MV 一升级/重装全废，还要动 `Program Files`。

> 顺带：**升级到 MZ 也没用** —— MZ 官方帮助文档写的就是「点击 **[A] 到 [E]** 页签切换显示」，同样是 9 个槽。

### 2.1 二次取证（2026-10-01 03:40，针对"能不能强加"）

在"改编辑器"之外，还有一条看起来更轻的路：**不改程序，只改数据 —— 把 `Tilesets.json` 的槽位数组从 9 项扩到 11 项**。逐一验证后**同样不通**：

**（a）官方帮助文档写死了页签种类**
`Help/page/01_07.html` 原文：

> "It is possible to include **5 types of tiles for A through E in one tileset**."
> "A tileset ... can consist of **up to nine tilesheets** designated A1, A2, A3, A4, A5, B, C, D, and E.
> **Each map can use only one tileset.**"

**（b）页签不是 QML 生成的，QML 里根本没这个东西**

| 扫描项 | 命中 | 含义 |
|---|---|---|
| `TabView` | **1** | 整个 exe 的 QML 里只有一处 TabView |
| `Tab {` | **1** | 且只声明了**一个** Tab |
| `TabBar` / `TabButton` | **0** | 压根没有 |
| `"A1"` / `"A2"` / … / `"E"`（含引号的页签标签） | **0 / 0 / 0 / 0 / 0** | **页签标签字符串不存在于 exe 里** → 是 C++ 现算的，改配置无从下手 |
| `"A"` `"B"` `"C"` `"D"`（两处命中） | — | 查证后是**别处的组合框**：`model: [ "A", "B", "C", "D" ]`（通行/方向那一类的下拉），**不是页签** |

**（c）模板工程里，槽位数组永远固定 9 项**

`D:\Program Files (x86)\KADOKAWA\RPGMV\NewData\data\Tilesets.json`（MV 自带空工程）：

```
1 Overworld    names=['World_A1','World_A2','','','','World_B','World_C','','']  mode=0 flags=8192
2 Outside      names=['Outside_A1','Outside_A2','Outside_A3','Outside_A4','Outside_A5','Outside_B','Outside_C','','']  mode=1
```

注意 **Overworld 的 A3/A4/A5/D/E 是空字符串** —— 它不是靠"数组长度"决定页签，
而是**按 `mode`（世界地图 / 区域）拿出一组固定页签**（`TilePaletteBody.tilesetMode` / `regionMode` 两个开关就是这个）。
**所以即使把数组写到 11 项，编辑器的页签集合也不会变。**

### 2.2 你可以花 10 秒自己验证

上面是静态取证。要眼见为实，我用 MV 自带的空工程模板复制了一个**独立测试工程** `D:\_mv_tabtest`，
并把 `Outside` 图块集从 **9 槽扩到 11 槽**（多出 `Test_F` / `Test_G`，各配一张纯红 / 纯蓝 768×768 图）。

双击 **`D:\_mv_tabtest\RUN_TEST.bat`**，看图块面板上方：

- 只有 **A B C D E** 五个页签 → 证实"改数据也加不了页签"（预期结果）
- 出现 **F / G** → 那这条路走得通，**告诉我，我立刻改方案**

看完直接关掉，`D:\_mv_tabtest` 整个目录删掉即可，**不影响正式工程、不影响 Juben**。

---

## 3. 就算能加页签，id 段的天花板也摆在那

`js/rpg_core.js` 的硬常量（一字不能改）：

```js
Tilemap.TILE_ID_B   = 0;      Tilemap.TILE_ID_C   = 256;
Tilemap.TILE_ID_D   = 512;    Tilemap.TILE_ID_E   = 768;
Tilemap.TILE_ID_A5  = 1536;   Tilemap.TILE_ID_A1  = 2048;
Tilemap.TILE_ID_A2  = 2816;   Tilemap.TILE_ID_A3  = 4352;
Tilemap.TILE_ID_A4  = 5888;   Tilemap.TILE_ID_MAX = 8192;
```

| 段 | id 区间 | id 数 | 编辑器页签 | 能否当"平铺层" |
|---|---|---|---|---|
| B | 0–255 | 256 | **B** ✅ | 能 |
| C | 256–511 | 256 | **C** ✅ | 能 |
| D | 512–767 | 256 | **D** ✅ | 能 |
| E | 768–1023 | 256 | **E** ✅ | 能 |
| *空白* | **1024–1535** | **512** | ❌ 无页签 | 不能（`_drawNormalTile` 里 `setNumber=5+t//256=9`，第 10 张图不存在 → 静默不画） |
| A5 | 1536–1663 | 128 | **A5** ✅ | 能（图片任意，128 格） |
| *空白* | **1664–2047** | 384 | ❌ 无页签 | 不能（`isTileA5` 认它，但已越出 A5 图宽） |
| A1 | 2048–2815 | 768 | A1 | 自动图块专用 |
| A2 | 2816–4351 | 1536 | A2 | 自动图块专用 |
| A3 | 4352–5887 | 1536 | A3 | 自动图块专用 |
| A4 | 5888–8191 | 2304 | A4 | 自动图块专用 |

**能直接画普通图块的页签 = 5 个（A5 + B + C + D + E）**；空白 id 共 **896 个 ≈ 3.5 页**。

→ 靠 id 段"加层"的天花板 ≈ **8 层**，且第 6 层起编辑器根本没入口。**永远不可能"一直往下加"。**

---

## 4. 正解：把「层」换个维度 —— 层 = 地图

### 4.1 核心洞察

分层身份 **= tile id 段** —— 这是你 Map025 那套做法成立的原因，也是它**卡死在 4 层**的原因。
但 id 段只是"分层的一种编码方式"。**如果把每层写进独立的地图文件，每层就能用满 0–8191 的全部图块，层数不再有任何上限。**

### 4.2 怎么组织

```
Map025  ★主图        ← 剧情 / 事件 / 玩家所在（见 §4.5）
├─ L1_地面           ← Map026.json
├─ L2_墙壁           ← Map027.json
├─ L3_路面           ← Map028.json
├─ L4_植物           ← Map029.json
├─ L5_屋顶           ← Map030.json   ← 想加多少加多少
└─ L6_装饰           ← …
```

- 每张子图**同宽高、同一个 tileset**（甚至可以就用现在的 `18 测试`）
- **每张子图可以用完整调色板随便画** —— 不再被迫"一层只放 1 个图块"
- **层的前后顺序**就是地图树里的排序（`MapInfos[i].order`），你拖动调整
- 导出器把 N 张子图烘焙成 **N 层 PNG** / **N 个 TMX `<layer>`**

**"页签"和"地图"的手感对比**（你在编辑器里做的事完全一样，都是点一下）：

| | 页签方案（现状） | 地图方案 |
|---|---|---|
| 切层操作 | 点面板上方 `A B C D E` | 点左侧地图列表 |
| 层名可见 | ❌ 只有字母 | ✅ 你写的中文名 |
| 层数上限 | 4 | 无限 |
| 每层可用图块 | 256 格（你实际只用了 1 格） | 全部 |
| 会不会画错层 | **会**（B/C/D 同挂 MAP1，已抓到你误画 2 格） | 不会（一眼看清） |

### 4.3 编辑时怎么看到"合成后"的效果

MV 原生有「**远景图（Parallax）**」，而且有个关键开关：

```js
// js/rpg_managers.js:915
ImageManager.isZeroParallax = function(filename) { return filename.charAt(0) === '!'; };
// js/rpg_objects.js:5625
Game_Map.prototype.parallaxOx = function() {
    if (this._parallaxZero)      return this._parallaxX * this.tileWidth();   // ← 跟地图 1:1 滚动
    else if (this._parallaxLoopX) return this._parallaxX * this.tileWidth() / 2;
    else                          return 0;
};
```

**名字以 `!` 开头的远景图 = 零视差 = 跟地图一像素不差地一起滚** —— 行为和"真正的一层"完全一样。

用法：把已导出的**下层合成图**丢进 `img/parallax/`，命名 `!ref_Map025_L3`，给下一层地图设成远景图 →
**编辑 L3 时，L1+L2 就铺在底下当参考底图**。
（编辑器侧有 `MapEditorBody.backImagePath` 属性，说明它会渲染背景图；建议花 1 分钟实测确认。）

### 4.4 这个方案顺带解决的问题

| 现在（页签=层） | 改后（地图=层） |
|---|---|
| 每层被迫只用 1 个图块（其余 255 个空着） | 每层可用全部图块 |
| 硬上限 4 层 | 无限 |
| B/C/D/E 三页签同图 → 靠记忆选，**已抓到你误画的 2 格** | 每层一张地图，看一眼地图树就知道在画哪层 |
| `flags` 长度 1 → 通行性读不到 | 与层数无关（仍需单独补 flags） |

### 4.5 ⭐「那剧情怎么办？」—— 剧情跟着**地图**走，不跟着**层**走

这是你唯一的顾虑，正面回答：

> **MV 的事件（对话 101/选项 102/条件 111/传送 201/战斗 301/开关）全部挂在「地图」上，和「页签」没有任何关系。**

所以把页签换成地图之后，**剧情工作流一个字不用改**，反而更清楚：

```
Map025  ★主图         ← 对话、NPC、传送门、开关、剧情全部写在这里（== 你现在写剧情的地方）
├─ L1 地面            ← 纯画布，一个事件都不放
├─ L2 墙壁            ← 纯画布
├─ L3 路面            ← 纯画布
└─ L4 植物            ← 纯画布
```

- **事件 100% 挂在主图上**：你打开 `Map025` 写对话、放 NPC、设传送 —— 跟现在一模一样
- 子图（L1…Ln）**不挂任何事件**，它们只是"这一层画了什么"
- **导出器：图层从所有子图取，事件从主图取**，两者在 Cocos 侧重新合到同一个场景

> 如果你更想"层和事件同图"，另一种口径同样支持：**把主图当成 L1（地面层），事件就写在地面层上** ——
> 层序取 `[地图树 order]`，主图天然排第一。**两种口径导出器都吃，你随便选。**

---

## 5. 迁移建议（不推翻你现在的习惯）

**不用重做 Map025。** 建议口径：

1. **保持现状**：一张地图内继续用 B/C/D/E 四层做"就近分层"（地面 / 墙 / 路 / 植物）。
2. **层不够时开兄弟地图**：比如要加"屋顶 / 阴影 / 光效"，新建同尺寸的 `Map025_上层`，在里面继续画。
3. **导出器两种分层同时支持**：
   `总层序 = [地图树 order] × [id 段序 B→C→D→E]`
   即 **一张地图 4 层 × N 张地图 = 4N 层**，且以后你想改成"一张地图只画一层"也照样支持。

这样你现在的工作流一个字都不用改，只是"装不下 → 再开一张图"。

### 5.1 可选：把主图当"编译产物"，让 MV 测试看到成品

如果你希望按「**测试游戏**」时看到的是**含所有层的完整效果**（否则玩家进的是主图，子图不会自动叠上去），
导出器可以顺手生成一张 **合成主图**：

```
· 把 L1..Ln 的 tileId 按层序压进合成主图的 z0..z3
    （z0/z1 = 角色之下那一档，z2/z3 = 盖住角色那一档 —— 由你指定"第几层起遮挡"）
· 事件数组原样带过去（不覆盖你在主图上写的剧情）
```

这样在 MV 里按测试，看到的就是 Cocos 里的最终效果。**也是可选项**，不做的话用 §4.3 的远景图也能看。

---

## 6. 导出器契约（待实现）

```
输入：MV 工程 data/（MapXXX.json + MapInfos.json + Tilesets.json）+ img/tilesets/
分组：MapInfos 的 parentId（主图 + 子图）或命名约定 <父名>_L{n}
排序：MapInfos.order 升序 → 子图顺序；子图内再按 id 段 B,C,D,E 排
输出：
  A) 分层 PNG：<图名>_L{序}_{层名}.png + manifest.json（z 序 / 格数 / md5 / 坐标锚点）
  B) TMX：每层一个 <layer>，共用同一批 tileset PNG（客户端 TiledMap 零改动）
事件：只从主图取（NPC / 传送 / 对话 / 开关），输出点位表 + 剧情 JSON
校验：N 层叠加 == MV 原生渲染，逐像素比对（md5 一致）
```

---

## 7. 一句话总结

> **页签加不了 —— 它在编译好的 C++ 里，官方文档也写死 A–E；光有数据没有入口，id 段还只有 896 个空位。
> 但"层 = 地图"这条路是 0 改动、无限层、还更自由：剧情/事件全挂主图（工作流不变），
> 其他层是纯画布；编辑器左侧点一下就切层，手感跟页签一样。
> 而且你现在这套 B/C/D/E 的用法可以原样保留，只在装不下时多开一张同尺寸的地图。**
