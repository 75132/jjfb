# 图块工坊 Tileset Studio · 技术交接文档

> **给接手的人看。**
> 用户使用说明在 [`README.md`](./README.md)；本文只讲**代码结构、数据契约、改法、坑**。
> 文档基线：2026-10-02（对应全量回归 **531 项全绿**）。

---

## 0. 30 秒速览

| 项 | 值 |
|---|---|
| 它是什么 | 把 RPG Maker MV 的**原始地图素材图集**加工成**带语义 + 通行表**的新图集，并导回工程 |
| 技术栈 | 后端 **Python 3 标准库** HTTP（零第三方依赖，PIL 可选）；前端 **原生 JS 单页**（无框架、无构建） |
| 入口 | `start.bat` → `python server.py` → `http://127.0.0.1:19850/` |
| 只监听 | `127.0.0.1`（本机），端口被占自动 +1 找 20 个 |
| 唯一产物去向 | `桌面\图块工坊导出\<工程名>\`（每工程一个文件夹） |
| 唯一例外 | 「写进工程 img/tilesets/」直接写 RPG 工程目录，**前缀命名 + 覆盖** |
| 一键验证 | `python _regress.py`（自起服务 → 跑页面 → 复算 → 打总表） |
| 当前基线 | **531 项全绿**（详见 §5.3） |

**它不做什么**（边界，别越界）：
- 不改游戏运行时逻辑、不动 `Tilesets.json`（只产出 `flags.json` 供人工/后续管线合并）
- 不联网、不上传、不写注册表
- 不做地图本身的拼接（那是「地图管线」的事，见 §9）

---

## 1. 架构

### 1.1 三层

```
┌──────────────────────────────────────────────────────────────┐
│  浏览器（单页）  web/index.html + app.js(2629 行) + style.css  │
│  · 素材区：切格 / 框选 / 语义标注                              │
│  · 输出区：5 个槽（A5 B C D E），整块贴 / 刷块 / 框选 / 橡皮    │
│  · 全程状态放在一个全局对象 S，改动后 reqSrc()/reqOut() 重绘     │
└───────────────┬──────────────────────────────────────────────┘
                │  fetch  JSON  /  b64 图片
┌───────────────▼──────────────────────────────────────────────┐
│  本地服务  server.py（ThreadingHTTPServer，标准库）           │
│  · 静态托管 web/                                              │
│  · /api/* 文件读写（白名单根校验）                             │
│  · 工程包 .tsproj 打包 / 解包（zipfile）                       │
│  · 不保存任何全局业务状态 —— 状态全在前端                     │
└──────────────────────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────┐
│  磁盘   素材库(只读) / 导出目录(桌面) / RPG 工程 img\tilesets  │
└──────────────────────────────────────────────────────────────┘
```

**关键约定：后端无状态。** 所有编辑状态（选中、槽内容、语义、历史栈）都在前端内存里；
后端只做「把字节写到你给的路径」和「把路径上的字节读回来」。重启服务不会丢任何东西
（丢的是没存工程的编辑，这是设计如此）。

### 1.2 数据流

```
源图集 PNG
   │  ① 切格（TILE=48）
   ▼
cellCache：每格一个 48×48 的 <canvas>（★全透明像素 RGB 归零，见 §3.4）
   │  ② 框选 → 语义标签 TAGS → 块 blk
   ▼
输出槽 S.out[slotId]：Array<cell|null>，长度 = cols×rows（A5=128，其余 256）
   │  ③ 变换（h/v/hv 异或叠加）、整块镜像、删除、复制
   ▼
slotToCanvas()  ──canvas──▶ PNG（base64）──▶ POST /api/savePng
buildManifest() ──json───▶ 清单           ──▶ POST /api/saveText
computeFlags()  ──json───▶ 8192 通行表     ──▶ POST /api/saveText
projState()     ──json───▶ 工程包 zip       ──▶ POST /api/proj/save
```

### 1.3 为什么这么设计（接手前先接受这三条）

1. **零依赖、零构建**：用户机器上没有 node/npm 环境，工具要能拷到任何 Windows 上双击就跑。
   所以前端不用框架（不用打包步骤），后端只用标准库。**新增功能请继续保持零依赖**——
   引入 `Pillow` 之外的第三方包会让「拷走即用」失效。
2. **状态在前端**：编辑是高频交互，放后端会引入同步问题和延迟。代价是「刷新页面 = 丢失未存编辑」，
   用 `.tsproj` 兜底。
3. **产品口径优先于「正确性直觉」**：比如「整块镜像 = 格子换位 + 每格翻转」（§3.4），
   这是用户明确拍板的，别按「镜像就该只翻内容」去"修"它。

---

## 2. 后端 `server.py`

### 2.1 启动与端口

```bash
python server.py                 # 默认 19850，自动开浏览器
python server.py --port 9090
python server.py --no-browser    # 自测/CI 用
```

- `pick_port(start, tries=20)`：从 `start` 起逐个试探 bind，占用就 +1。**端口可能不是 19850**，
  以窗口打印的地址为准（回归脚本也必须先探测）。
- `ThreadingHTTPServer` + `daemon_threads = True`：并发请求不互相阻塞。
- `log_message()` 被重写为**静音**（否则每个请求刷一行）。

### 2.2 安全模型（有测试守着，别拆）

服务只监听回环地址，且**所有路径必须落在白名单根内**：

```python
ROOTS      = [m["path"] for m in MOUNTS]      # 见 build_mounts()
ROOTS_N    = [_norm(r) for r in ROOTS]
is_allowed(p)   # normcase + realpath + abspath 后做前缀比对
safe_path(p)    # 不合法 → PermissionError → HTTP 403
```

- `_norm()` 用 `os.path.realpath` **解掉符号链接**再比对，防 `/根/../etc` 类逃逸。
- 前缀比对带 `os.sep`（`r + os.sep`），防「`C:\a` 前缀匹配到 `C:\ab`」。
- 允许的根（`build_mounts()`，同时也是前端「素材目录」下拉的内容）：
  制作进行素材/地图素材、制作进行素材、RPG `img/tilesets`、RPG 工程、素材总目录、
  Cocos 工程、工坊目录、桌面导出目录、工具 `out/`、`D:\_mv_tabtest`、`D:\_mv_capacity_test`、
  桌面、下载。
- **不存在且不会创建**的目录会被 `build_mounts()` 跳过（`os.path.isdir` 为假就不进白名单）。

> 改白名单 = 改 `build_mounts()` 的 `cand` 列表。**不要**为了图省事把整个 `D:\` 加进去。

### 2.3 目录常量

| 常量 | 值 |
|---|---|
| `TILE`（前端） | **48** |
| `HERE` / `WEB_DIR` / `OUT_DIR` | 工具目录 / `web/` / `out/` |
| `RPG_ROOT` | `D:\机甲风暴开发素材合集\机甲风暴2` |
| `COCOS_ROOT` | `D:\jjfbol-cocos\jjfbol-cocos\jjfb` |
| `ASSETS_ROOT` | `D:\机甲风暴开发素材合集` |
| `MAPSRC_ROOT` | `…\制作进行素材\地图素材` |
| `DESKTOP_DIR` | `find_desktop()`：兼容 OneDrive 重定向 / 中文「桌面」 |
| `EXPORT_DIR` | `DESKTOP_DIR\图块工坊导出`（建不出来时退回 `OUT_DIR`） |
| `PROJ_EXT` / `PROJ_VERSION` | `.tsproj` / `1` |

### 2.4 HTTP 接口全表

**GET**

| 路径 | 参数 | 返回 |
|---|---|---|
| `/`、`/index.html` | — | `web/index.html` |
| `/web/<file>` | — | 静态文件（js/css 强制 utf-8） |
| `/api/roots` | — | `{roots, mounts, outDir, exportDir, toolOut, desktop, mapSrc, rpgTilesets}` |
| `/api/list` | `dir`、`sizes=0\|1` | `{dir, parent, items:[{type,name,path}]}`；`sizes=1` 时图片额外带 `w,h,mode,cols,rows` |
| `/api/img` | `path` | 图片字节（直接给 `<img src>` 用） |
| `/api/info` | `path` | `{info:{path,name,bytes,w,h,mode,cols,rows}}`（**任何文件**都能查，不限图片） |
| `/api/proj/list` | `dir`（默认 `EXPORT_DIR`） | `{dir, items:[工程包摘要]}` |
| `/api/proj/file` | `path`、`entry` | 包内成员字节（**成员名白名单**，见 §2.6） |

**POST**（body 一律 JSON）

| 路径 | body | 说明 |
|---|---|---|
| `/api/savePng` | `{path, b64, noClobber?}` | 写 PNG；返回 `{path, bytes, renamed}` |
| `/api/saveText` | `{path, text, noClobber?}` | 写文本（UTF-8、`newline="\n"`）；返回 `{path, chars, renamed}` |
| `/api/mkdir` | `{path}` | `os.makedirs(exist_ok=True)` |
| `/api/reveal` | `{path}` | `os.startfile` 打开资源管理器（仅 Windows） |
| `/api/proj/save` | 见 §2.5 | 打 `.tsproj` |
| `/api/proj/load` | `{path}` | 读 `project.json` → `{meta, state, entries}` |
| `/api/proj/upload` | `{name, b64}` | 浏览器**拖入**的包（拿不到磁盘路径）→ 落到 `out/_drop/` 再当普通包读 |
| `/api/quit` | — | 新线程优雅关服（自测收尾用） |

**错误约定**：统一 `{ok:false, error:"..."}` + HTTP 码。
`PermissionError → 403`，其余异常 `→ 500`（并 `traceback.print_exc()` 到服务窗口）。

### 2.5 关键函数

| 函数 | 职责 | 要点 |
|---|---|---|
| `_uniq_path(p)` | **导出绝不覆盖** | 存在就 `stem-2.ext`、`-3`…（上限 999）；只加序号，不删不改旧文件 |
| `_b64(s)` | dataURL/base64 → bytes | 自动吃掉 `data:image/png;base64,` 前缀 |
| `_safe_name(name)` | 工程名净化 | 去 `\/:*?"<>|` 与换行、补 `.tsproj` 后缀、空则 `map` |
| `proj_save(data)` | 打包 | `subdir=True` 时落到 `<dir>\<工程名>\<工程名>.tsproj`；源图优先本地路径，其次从 `fromProj` 包内 `source.png` 继承 |
| `proj_list(d)` | 列包 | **递归一层**：同时在 `<d>\*.tsproj`（老包裸放）和 `<d>\<工程文件夹>\*.tsproj` 里找；每项带 `folder` |
| `_proj_item(p, folder)` | 单个包摘要 | 读 `project.json` → `sheet/savedAt/cells/hasPreview`；坏包给 `error` 而不是抛 |
| `proj_file(p, entry)` | 取包内成员 | 只放行白名单 6 个成员名，否则 `ValueError` |
| `proj_upload(data)` | 拖入的包落盘 | 先验是不是合法 zip 且含 `project.json`，再写到 `out/_drop/` |

### 2.6 `.tsproj` 包格式（就是 zip，改后缀可解压）

```
project.json     {meta:{app,version,savedAt,sheet,cells,flags,tags}, state:<前端完整状态>}
source.png       原始素材图集（★逐字节原样拷入，导入不依赖原文件）
preview.png      当前槽缩略图（≤320px，列表里认脸用；可为空）
flags.txt        8192 项通行表，一行一个十进制（人可读）
manifest.json    图块清单（tileId / 语义 / 来源 / 变换）
README.txt       自解释说明（时间/源图/占用/字段说明/怎么导回）
```

- `proj_file()` 的白名单成员名就是上面这 6 个（`source.png / preview.png / project.json / flags.txt / manifest.json / README.txt`）。
- 压缩方式 `ZIP_DEFLATED`。
- 向后兼容：**老包裸放在导出根目录也能被 `proj_list` 列出并导入**。

---

## 3. 前端 `web/app.js`

### 3.1 常量

```js
TILE = 48
TAGS = [ ground, wall, road, plant_p, plant_np, over(★上层), none ]
       // 各自带 passable / slot / key / color；over.upper=true
TFS  = [ none(原图), h(水平镜像), v(垂直翻转), hv(180°) ]
SLOTS = [ A5(8×16=128), B/C/D/E(16×16=256) ]
SLOT_BASE = { A5:1536, B:0, C:256, D:512, E:768 }   // tileId = base + index
```

> `SLOT_BASE` 是 **MV 引擎的 tileId 分区**，不是随手编的。A5 在 1536 起，
> B/C/D/E 依次 0/256/512/768。改这里等于改产出的 tileId 语义，**必须同步 `flags` 长度与调用方**。

### 3.2 全局状态 `S`（唯一的真相来源）

| 字段 | 含义 |
|---|---|
| `roots / mounts / exportDir / outDir / toolOut / desktop / rpgTilesets / mapSrc` | 来自 `/api/roots`；`outDir` 可被用户改（存 localStorage） |
| `root` | 当前素材目录 |
| `sheets` / `sheet` | 图集列表 / 当前图集 `{name,path,img,w,h,cols,rows}` |
| `cellCache` | `{key, list:[canvas]}`；key = `path + '|' + WxH`，图集变则重建 |
| `sel` / `tagOf` | 素材区选中格集合 / `srcIndex → tagId` |
| `zoom / outZoom / hover / marquee / shift` | 视图态（**不进撤回栈**） |
| `out` | `slotId → Array<cell\|null>`，长度固定 |
| `outSel / outSelRect / outHover` | 输出区选区；`outSelRect` 是框选留下的矩形（决定「整块」范围） |
| `curSlot / placeTf` | 当前槽 / 放置时施加的变换 |
| `blockMode` | `true` 整块贴 / `false` 逐个铺 |
| `blockFlip` | `'order'` 整块镜像（排列也翻）/ `'tile'` 只翻每格 |
| `outMode` | `'brush'` 刷块 / `'select'` 框选 / `'erase'` 橡皮 |
| `outBrush / outRect / outRectAdd` | 拖拽中的临时矩形 |
| `blkSeq / lastBlk / showBlkFrame` | 块编号自增 / 最近贴入的块 / 是否描块框 |
| `proj {path,name}` | 当前工程包（从包里导入时记住；换素材图集会清空） |
| 模块级 `PROJ_DIR` | **已建好的工程文件夹路径缓存**（避免每次导出都 mkdir） |

初始化：`SLOTS.forEach(s => S.out[s.id] = new Array(s.cols*s.rows).fill(null))`。

### 3.3 模块地图（行号会漂，仅作导航，基线 2026-10-02）

| 行 | 模块 |
|---|---|
| 1–40 | 常量（TILE/TAGS/TFS/SLOTS/SLOT_BASE） |
| 42–77 | 状态 `S` |
| 79–170 | 撤回/重做（快照）+ rAF 兜底 |
| 172–201 | DOM 助手 `$`/`$$`、`api()`/`post()`、`toast()` |
| 203–464 | 素材区：切格缓存、绘制、命中、缩放、块信息、变体预览 |
| 465–669 | 输出区：绘制、元信息、槽页签、统计 |
| 671–729 | **变换群** + `selRectOut` + `newCell/pushCell` |
| 730–1295 | **整块贴**：`selBlock/rectFree/findFreeRect/layoutBlocks/stampBlock/commitBrush`、`doPlace`、`doVariants`、`transformOut`、`duplicateOut/deleteOut/eraseOne/eraseBlockAt/compactOut`、`assignByTag` |
| 1296–1493 | **导出**：`slotToCanvas/buildManifest/computeFlags`、**工程文件夹** `projFolderName/exportRoot/ensureProjDir/updateExportHint`、`savePng/saveAllPng/saveJson/saveFlags` |
| 1495–1770 | **工程包**：`projState/applyProjState`、`saveProject/loadProject`、`listProjects`、`dropProjectFile` |
| 1772–2038 | 语义/变换 UI 构建、目录浏览器、加载图集、素材根目录、导出目录选择 |
| 2039–2505 | `bindEvents()`（所有鼠标/键盘绑定，最长的一块） |
| 2506–2561 | `boot()` 启动 |
| 2563–2629 | `window.TS` 对外接口 + 模式切换辅助 + `boot()` 调用 |

### 3.4 核心算法（改之前必须读懂）

#### ① 切格 + 全透明像素 RGB 归零

`ensureCellCache()`：把源图按 48×48 切成 `cols×rows` 个 canvas。
**切完立刻扫一遍**：`a=0` 但 RGB≠0 的像素强制归零。

> 为什么：canvas 2D 内部预乘 alpha，`drawImage → toDataURL` 往返会**静默**把
> `a=0` 的 RGB 抹成 0。不提前归一，「导出图 == 源图块」的逐字节断言会随机失败。
> 校验时必须用**双口径**：alpha 逐字节一致 **且** 归一化后逐字节一致。

#### ② 变换群：h / v 是两个开关，叠加 = 异或

```js
tfBits('h')  → {fx:1, fy:0}
tfBits('hv') → {fx:1, fy:1}
tfOverlay(base, extra) = bitsToTf(a.fx ^ b.fx, a.fy ^ b.fy)
applyTf(base, 'none')  = 'none'        // 「原图」= 强制清除
applyTf(base, 'h')     = tfOverlay(base,'h')   // 其它 = 叠加
```

**连按两次 H 会翻回原图** —— 这是异或的必然结果，是**设计如此**（用户确认过）。
想强制还原请用「原图」按钮。

#### ③ 「块」`blk`

```js
blk = { id, c0, r0, w, h }     // 贴在槽里的相对位置（列/行/宽/高）
```

- 块 = 源选区的外接矩形；块内**没被选中的格子 = 空洞**，贴的时候跳过（不填空）。
- `S.lastBlk` 记录最近贴入的块（用于「没选中时按 H/V/B 作用到它」）。
- `blockCellsOf(refCell)` 按 `blk.id` 收集同块格子。

#### ④ 整块镜像 vs 只翻每格（**最容易搞错的口径**）

`transformOut(tf)` 的决策：

```
没选中输出格？
  ├─ 有 lastBlk → 作用到最近贴入的整块
  └─ 否则 → 设置「放置变换 placeTf」
选中了：
  R = selRectOut()                      // 框选矩形优先，否则选中格外接矩形
  single = (R.w==1 && R.h==1)
  tileOnly = single || S.blockFlip==='tile'
  ├─ tileOnly → 位置不动，只翻内容（单格微调 / ③区强制「只翻每格」）
  └─ 否则     → 整块镜像：在 R 内「格子换位 + 每格翻转」
```

整块镜像的实现（`arr[ni] = {...src[sy][sx], tf: applyTf(c.tf, tf)}`）：
`fx` 时 `sx = R.w-1-x`，`fy` 时 `sy = R.h-1-y` —— **换位和翻转同时发生**。

> 所以 2×2 框选按 H，出来是**左右两列对调**，当然≠原图。
> 用户 2026-10-01 问过「有些我镜像为啥跟原图不一样」，结论就是口径如此，不是 bug。
> 要做图块集（第 N 格必须还在第 N 格）→ ③ 区切「只翻每格」。
>
> **几何回算**（同函数末尾，2026-10-01 修）：矩形变换后，被碰到的块外框要按
> 「它自己的格子现在在哪」重求一遍，否则块会「搬家」而 `blk.c0/r0` 留在原地 →
> 黄框画在空地上，看起来像「块被翻没了」。
> 选区跨多个块时**统一 rebrand 成一块**（形状已经分不清了，免得黄框骗人）。

#### ⑤ 放置：整块贴 vs 逐个铺

| 模式 | 函数 | 行为 |
|---|---|---|
| 整块贴（默认） | `stampBlock` / `layoutBlocks` | 块保持形状原样落进空位，块之间按块尺寸切网格对齐 |
| 逐个铺 | `pushCell` | 每格依次填空位，排成一行 |

- `rectFree` / `findFreeRect`：从左上找第一块 `w×h` 全空矩形。
- `commitBrush(c0,r0,c1,r1)`：刷块拖拽松手 → 把源块**平铺**填进这个矩形。
- 源选区为空 → 什么都不做（提示用户先框选）。

#### ⑥ 按语义分配槽位 `assignByTag()`

1. 把输出区格子**按块分组**（无块标记的各自成组）。
2. 清空全部槽、`blkSeq = 0`，按「槽顺序 → 块左上角」排序**整块重放**。
3. 目标槽：块内语义一致 → 按该语义的 `slot`；**混合语义的块不拆，整体进 B**。
4. 装不下的块统计 `dropped`，最后 toast 里 `⚠` 提示（**不静默丢**）。

> 「同一个块不会被拆开」是硬要求 —— 拆开会毁掉块的相对位置。

#### ⑦ 导出：`slotToCanvas` / `buildManifest` / `computeFlags`

- `slotToCanvas(slotId)`：建 `cols*48 × rows*48` 画布，逐格 `drawCell`（按 `tf` 变换），
  空位保持透明。**尺寸天然是标称值**（A5 384×768、其余 768×768），顺手解决「最后一行全黑」。
- `buildManifest()`：逐格输出来源 / 变换 / 语义 / `tileId = SLOT_BASE[slot] + index` / `passable` / `upper`，
  外加完整 `flags` 与 `tagDict`。
- `computeFlags()`：`new Array(8192).fill(0)`，对每格：
  `!passable → |= 0x000F`；`upper → |= 0x0010`。

#### ⑧ ★ 每个工程一个文件夹（本波新增）

```
导出根(default: 桌面\图块工坊导出)
└── <工程名>\                 ← projFolderName() 决定
    ├── <工程名>.tsproj        ← 再存 = 覆盖自己
    ├── <工程名>_B.png
    ├── <工程名>_B-2.png       ← 重名自动加序号，旧的不动
    └── <工程名>_flags.json
```

工程名取值优先级（`projFolderName()`）：
1. `S.proj.name`（存过/导入过工程）
2. 源图名去扩展名（`map1_7x6.png → map1_7x6`）
3. 底栏前缀框（都没有时兜底）

配套函数：

| 函数 | 职责 |
|---|---|
| `exportRoot()` | `S.outDir \|\| S.exportDir` |
| `ensureProjDir()` | 算出 `<root>\<工程名>`，`POST /api/mkdir` 建出来，**结果缓存进 `PROJ_DIR`** |
| `updateExportHint()` | 底栏实时显示 `根 ▸ 工程名\`；未存工程标 `（未存工程）` |
| `savePng/saveJson/saveFlags(dir?, opt?)` | 不传 `dir` → 走新口径（`ensureProjDir` + 工程名前缀 + `noClobber`）；传了 `dir` → 老口径（前缀框命名） |

**兼容关键行**（改这里要同时想清楚两条路）：

```js
const pre = opt.prefix || (dir ? prefixName() : projFolderName());
```

**唯一例外**：`#btnWriteRpg`（写进 `img/tilesets/`）传 `{prefix: prefixName(), noClobber: false}`
—— 那边引用的是固定文件名，**必须覆盖**。

缓存失效点：`openSheetByPath()` / `loadProject()` / `setOutDir()` 都会
`PROJ_DIR = null; updateExportHint();`（换源图 / 换目录 → 文件夹名跟着变）。

### 3.5 撤回 / 重做（快照式）

```js
HIST = { undo: [], redo: [], max: 80 }
snapState()    // 深快照：5 个槽.slice() + blkSeq + lastBlk + tagOf + curSlot
pushHist(label)// ★ 必须在「改数据之前」调用
restoreState() // 回填 + 清选区 + reqSrc/reqOut
```

- **只快照数据**，选中态属于视图，不进栈（否则每点一下就多一步历史）。
- `cell` 进栈只存 `{snap(canvas 引用), src, tf, tag, blk}`，其中 `blk` 是**值拷贝**
  —— 曾经存浅拷贝导致撤回后改一处、历史里跟着变。
- 进栈的动作：贴块 / 刷块 / 清空槽 / 删除 / 复制 / 整理 / 变换 / 打标签 / 按语义分配 / 橡皮擦。
- **不进栈**：切槽、切素材、缩放、导入工程包（导入是整体替换，一次性的）。

### 3.6 rAF 兜底

浏览器在标签页转后台时会**暂停/节流 `requestAnimationFrame`**，导致状态读数不刷新。
所以 `reqSrc()/reqOut()` 同时挂 `requestAnimationFrame` 与 `setTimeout`，
谁先到用谁，跑过互斥清掉（`fireSrcFrame/fireOutFrame`）。**别删 setTimeout 那半边。**

### 3.7 `window.TS`（自动化测试 & 控制台调试入口）

暴露了状态、常量、全部核心函数（详见文件末尾）。自测页面靠它做跨 iframe 断言。
新增需要被测试的能力时，**记得往 `window.TS` 里加一项**，否则测试够不着。
另有 `setMode/setOutMode/setBlkFlip` 三个模式切换辅助。

---

## 4. 数据契约（跨前后端 / 跨版本，改动即破坏兼容）

### 4.1 `cell`（输出槽里的一格）

```js
cell = {
  snap : HTMLCanvasElement,   // 源格像素快照（48×48）
  src  : { sheet, sheetName, index },   // 来源图集路径 / 名 / 源格号
  tf   : 'none' | 'h' | 'v' | 'hv',     // 翻法
  tag  : 'ground' | 'wall' | ... | 'none',
  blk  : { id, c0, r0, w, h } | null    // 所属块（单格为 null）
}
```

> `snap` 是 **canvas 引用**，进撤回栈时共享同一对象（像素不可变，安全）。
> 序列化时（`projCellOf`）只存 `src/tf/tag/blk`，源像素靠包内 `source.png` + `src.index` 还原。

### 4.2 `projState()`（写进 `project.json` 的 `state`）

```js
{ v:1, app:'TilesetStudio', sheet:{name,path,w,h,cols,rows}, tagOf,
  out:{ A5:[cell|null], B:[...], C, D, E }, blkSeq, lastBlk, curSlot,
  blockMode, blockFlip, placeTf, showBlkFrame, zoom, outZoom }
```

`applyProjState()` 负责还原；还原后画布**逐像素等于存之前**（自测 589824 像素 0 不符）。

### 4.3 `flags`（通行表）

| 值 | 含义 |
|---|---|
| `0x0000` | 可通行（未标 / 地面 / 路面 / 可通行植物） |
| `0x000F` | 四面不可通行（墙面 / 不可通行物体） |
| `0x0010` | ★上层块（树冠：盖住角色，不影响通行） |

- 数组长度固定 **8192**，下标 = `tileId = SLOT_BASE[slot] + cellIndex`。
- 空槽位保持 `0`。

### 4.4 命名规范

| 产物 | 命名 |
|---|---|
| 工程文件夹 | `<工程名>\`（非法字符替换为 `_`） |
| 工程包 | `<工程名>.tsproj` |
| 图集 PNG | `<前缀>_<槽>.png`，前缀默认 = 工程名；重名 → `-2`、`-3`… |
| 清单 / 通行表 | `<前缀>_manifest.json` / `<前缀>_flags.json` |

---

## 5. 自测与回归

### 5.1 分层

```
_regress.py  ── 编排：确认服务 → 跑页面 → 跑复算 → 打总表
   ├── _selftest.py            后端接口回归（48 项，requests 走 HTTP）
   ├── web/_e2e*.html          浏览器端到端（页面标题写「通过 N / 失败 M」）
   └── _verify_*.py            产物独立复算（PIL 重算，不看前端代码）
```

### 5.2 跑法

```bash
python _regress.py              # 全量（默认不碰桌面）
python _regress.py folder       # 只跑名字含 folder 的项
python _regress.py 桌面          # 额外跑「真往桌面写」的链路（会在桌面留文件）
```

**手工等价**：见 `README.md` §自测（逐页 URL + 每个复算脚本对应的项数）。

无头自测（Windows / Edge）：

```bash
msedge.exe --headless=new --disable-gpu --user-data-dir=/tmp/e \
  --virtual-time-budget=90000 --dump-dom "http://127.0.0.1:19850/web/_e2e_block.html"
```

### 5.3 当前基线（2026-10-02 · 531 项）

| 组 | 项 |
|---|---|
| e2e 基础 `_e2e.html` | 53 |
| e2e 整块贴 `_e2e_block.html` | 75 |
| e2e 第三波 `_e2e_v3.html`（撤回/框选/橡皮） | 82 |
| e2e 第四波 `_e2e_v4.html`（镜像口径逐像素） | 34 |
| e2e 图集列表 `_e2e_sheet.html` | 27 |
| 后端 `_selftest.py` | 48 |
| 链路 逐个铺（存盘 1 + 复算 26） | 27 |
| 链路 整块贴（存盘 1 + 复算 23） | 24 |
| 链路 工程包（存盘 48 + 复算 27） | 75 |
| 链路 工程文件夹（存盘 49 + 复算 37） | 86 |
| **合计** | **531** |

> 桌面链路 `_e2e_save_desktop.html` + `_verify_desktop.py`（23 项）**默认不跑**
> —— 会在用户桌面留自测文件，删它属于动桌面、会被安全删除拦截拦下。

### 5.4 写测试的规矩（踩过坑，照做）

1. **回归里禁止 `shutil.rmtree`**。想「跑前清干净目录」会撞上环境的**安全删除批量拦截**
   （`SAFE_DELETE_BULK_CONFIRM_REQUIRED count=590 threshold=50`）→ 整个回归**静默卡死**。
   正解：**每次用带时间戳的工程名从零开始**（`我的地图工程_20261001_235442`），
   并把本次工程名写进 `out/_folder_case.json` 交给复算脚本定位。
2. **断言不要用「正好 N 个」**。自测目录随每轮累积，改成「**包含**本次的」。
3. **`/api/list` 只列图片和目录，不列 `.json`**。要断言 `flags.json / manifest.json` 存在，
   用 `/api/info`（任何文件都返回 bytes）—— 顺便可以用它验「重名没覆盖：老文件字节数没变」。
4. **无头页面用 iframe + `window.TS` 做断言**（页面标题写结果，`--dump-dom` 抓）。
5. **新增页面要挂进 `_regress.py` 的 `E2E_PAGES`**，新增存盘链路挂 `CHAINS`，否则等于没测。

---

## 6. 已知坑（改代码前扫一眼）

| 坑 | 现象 | 处理 |
|---|---|---|
| **canvas 预乘 alpha** | 导出往返后 `a=0` 像素 RGB 被抹成 0 → 逐字节比对失败 | 切格时就归零；校验用双口径（§3.4①） |
| **rAF 后台暂停** | 切标签页后读数不刷新 | rAF + setTimeout 兜底（§3.6） |
| **`ImageData.data.buffer` 带 byteOffset** | `new Uint8ClampedArray(buf,0,N)` 读垃圾 | 用 `.slice(0, N)` |
| **768 宽画布取第 N 格** | 整段 `slice` 只拿第 1 格 | 按行 `(y*768+x)*4` 取 |
| **橡皮擦按「索引」写** | 鼠标链路传进来是 cell 对象，当索引用 → 擦不掉 | 统一 `eraseBlockAt(cellOrIdx)` |
| **撤回栈存引用** | 撤回后改一处历史跟着变 | 进栈深快照（§3.5） |
| **`@upDir/@downDir/...` 只是格子相邻** | 误当作「通行依赖」 | 与大世界地图语义无关，别混 |
| **默认打开排序第一张** | 目录里 `bz.png`（5×1）排最前 → 看着像「素材加载失败」 | 三级兜底：上次打开 → `map1*` → 格数最多（§7 示例） |

---

## 7. 常见改动指南

**加一个新语义标签**：改 `TAGS`（`id/name/color/passable/slot/key`）→
`buildTagUI()` 会自动出按钮；`computeFlags()` 按 `passable/upper` 自动算；
`buildManifest().tagDict` 自动带上。若新标签要独占槽位，改它的 `slot` 即可。

**加一个槽位**：`SLOTS` 加一项 + `SLOT_BASE` 给 tileId 基线 + 确认 `flags` 长度够
（现在 8192 已覆盖到 E 槽末尾 1024 之后很多，够用）。**同时要更新前端布局与测试。**

**改导出命名规则**：改 `projFolderName()`（文件夹名）或 `savePng()` 里的 `pre`
与 `/api/savePng` 的 `noClobber` 分支。**记得保留 `dir ? prefixName() : projFolderName()`
这条兼容线**，否则「写进 RPG 工程」会跟着变。

**改 flags 口径**：改 `computeFlags()`。**必须**同步 `buildManifest().flagsNote`、
`proj_save()` 里的 `flags.txt` 说明、README §flags 约定，以及 `_verify_*.py` 的独立重算。

**新增一个 e2e 页面**：放 `web/_e2e_xxx.html` → 挂进 `_regress.py` 的 `E2E_PAGES`
→ 需要真写盘就再挂 `CHAINS` 并配一个 `_verify_xxx.py`。

**「素材加载失败」再出现时怎么查**（2026-10-01 实战路径）：
1. 素材在不在（Glob 目录）
2. 后端逐项验（`/api/list`、`/api/info`）
3. `--dump-dom` 抓前端真实状态（`S.sheet` 是否为 null、`#srcMeta` 文案）

---

## 8. 遗留 TODO / 未完成

- [ ] **「写进工程 `img/tilesets/`」按钮未替用户按下**（需用户确认后才动 RPG 工程）
- [ ] 用户自测包 `D:\_mv_tabtest` / `D:\_mv_capacity_test` 的 `RUN_TEST.bat` 需用户双击
- [ ] 桌面 `图块工坊导出\` 里前几轮自测旧文件（`MAP1_FLIP_*` / `NEW_*` / `桌面试写_*`）未清理（等用户点头）
- [ ] `out/_foldertest/` 随回归累积（刻意设计，嫌乱可整目录删，无副作用）
- [ ] 与「地图管线」的对接：`flags.json` → `Tilesets.json` 的合并流程尚未开工
      （管线报告 §7 五个待拍板问题，见 `memory/rpg_map_pipeline.md`）

---

## 9. 跟游戏工程的关系

- 产出的 `<工程名>_A5/B/C/D/E.png` 对应 MV 的 `img/tilesets/` 图块集；
  `flags.json` 对应 `Tilesets.json` 里每个图块的 flags 数组。
- **本工具不直接改 `Tilesets.json`**：只产文件。合并由后续「地图管线」或人工完成。
- `tileId` 分区（`SLOT_BASE`）与 MV 引擎一致，所以产出的 flags 可以按 tileId 直接对号入座。
- 战斗/地图等游戏逻辑**一概不涉及**，这是纯素材加工工具。

---

## 10. 接手 checklist

1. `python tools/tileset_studio/_regress.py` 跑一遍，确认 **531 / 531** 再动手。
2. 通读 `README.md`（用户视角）+ 本文 §3.4（核心口径）。
3. 起服务，跟着 README 的「场景 A」走一遍，建立手感。
4. 改代码前先想清楚：**改动是否破坏 §4 的数据契约 / §5.4 的测试规矩**。
5. 每改一处核心逻辑，**同步加/改测试**，跑 `_regress.py` 确认无回归。
6. 保持**零第三方依赖**、**前端不加构建步骤**。

---

*最后更新：2026-10-02 · 全量回归 531 项全绿*
