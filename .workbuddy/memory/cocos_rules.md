# Cocos 铁律 + 怪物资源命名（从 MEMORY.md 迁出，2026-10-01）

> 热记忆 `MEMORY.md` §4/§5 只留指针，正文在此。工程 `D:\jjfbol-cocos\jjfbol-cocos\jjfb`（Cocos 3.8.7）。

## 一、Cocos / 资源铁律

- **cc 类型必须 import**（漏 → `ReferenceError` 被 `try/catch` 吞掉 → 包住的初始化必须能被日志看见）。
- **`resources.load` 只能读 `assets/resources/`** → 资源**双写**（编辑器目录 + resources 目录）；
  移资源时 `.meta` 同迁；帧 `.meta` 需 subMetas `6c48a`(texture) / `f9941`(spriteFrame)。
- ★**素材重生成必须复用 uuid**（换 uuid → `RobotShow.prefab` 等引用**全断 → 静默不播**）；
  守卫脚本 `tools/_test_skill_anim_assets.py`。
- ★**画布 = 全动画图元并集，禁止固定 192**（`position=3` 可达 ±408 → 静默裁掉 211/251 图元）；
  改画布尺寸后**同步 `library/` 缓存**。
- **克隆节点/组件必须重新生成唯一 `_id`**（重复 `_id` → 反序列化串位 → 血条不更新 / 状态机卡死）；
  改完双校验：`__id__` 无越界 + `_id` 无重复。
- 写回 JSON：`json.dump(..., ensure_ascii=False, indent=2)`；**禁 `separators=(',',':')`**。
  编辑器弹「Scene 数据已经修改」→ **必须点「不保存」**。
- 排查客户端异常**先看 `temp/logs/project.log`**；`.ts` 有 `SyntaxError` → 整 bundle 编译失败 → 全脚本 `Missing class`。
- `Logger.debug` 受 `DEBUG_MODE` 门控 → **诊断日志用 `Logger.warn`**。
  `scheduleOnce(callback, delay)` 以 `target+函数引用` 为键去重 → **递归调度同名函数必须包匿名闭包**；组件**未激活**时不可靠。
- 表现层兜底**必须与既有同类逻辑一致**（例：技能距离兜底 = 普攻口径，持枪=远程）。
- 工程 `package.json` 有 `"type": "module"` → Node 脚本必须 `.cjs`；编译产物目录放 `{"type":"commonjs"}`。
- **组件挂载**：面板组件**零 `@property`**（靠节点名递归查找）+ 编辑器**显式挂载**；`addComponent` 只做兜底并打一次提示。

## 二、怪物资源命名（拼音首字母）

- 文件名 / `AniID` = 中文名逐字**拼音首字母小写** + `_L{stage}`（`枯骨魔龙→kgml_L1`），**`AniID == 帧前缀`**。
- 英文 / 数字保留（`山猫-RT→smrt`）；罗马数字 NFKC 归一（`野马Ⅲ→ymiii`）；`· - ｜` 丢弃；`|初/中/终` 截断。
- 重名追加 `_2` / `_3`；**99 个机甲动画名是保留字**（撞名会播成机甲）；
  同一中文名按**阶段族一次性锁后缀**（`AniKeyAllocator`）。
- pypinyin 缺失回退 GB2312 区位码；旧命名清理用显式 `--clean`（默认关）。
