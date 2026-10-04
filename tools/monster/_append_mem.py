# -*- coding: utf-8 -*-
"""修复被 shell 反引号破坏的记忆追加内容。"""
import os

p = os.path.join(".workbuddy", "memory", "2026-09-28.md")
txt = open(p, encoding="utf-8").read()
marker = "\n## 追加（01:40"
idx = txt.find(marker)
if idx < 0:
    print("未找到标记段，跳过")
    raise SystemExit(0)
txt = txt[:idx].rstrip("\n")

add = """

## 追加（01:40 用户要求：怪物资源按「中文名拼音首字母」命名 → 已全量完成）

### 命名规则（monster_port.py）
- 中文 → 逐字拼音首字母：枯骨魔龙 -> kgml；进化阶段仍用 _L1/_L2/_L3（|初/中/终 后缀先截断）。
- 英文/数字保留并小写：山猫-RT -> smrt、多普-I-S3 -> dpis3。
- 罗马数字先 NFKC 归一再保留：野马Ⅲ -> ymiii、蝙蝠Ⅳ号 -> bfivh。
- 符号（· / - / ｜ 等）丢弃。重名按用户规则追加 _2/_3：如 力士 -> ls_2、镭射 -> ls_3。
- 拼音首字母优先 pypinyin（清华源已装 0.55.0），缺失时回退 GB2312 区位码表（零依赖，防止境外 pip 超时卡死流水线）。
- 99 个机甲动画名作为保留字：RobotShow.prefab 静态挂了这些 clip，怪物 AniID 撞名会直接播成机甲动画。
- 按阶段族一次性占位（AniKeyAllocator）：同一中文名同时锁定 _L1/_L2/_L3，避免同名不同形态拿到不同后缀。
- AniID == 帧前缀 == {key}_L{n}；临时机甲例外：帧 temp_L1-* / AniID mon_temp_L1。

### 主字段再收紧
- SpriteKey / FramePrefix / FrameCount / TempArt 全部移进 MonsterExtra（客户端与服务端均无引用），
  使 MonsterBase 顶层 = RobotBase 42 字段 + MonsterExtra，严格同构。

### 踩坑记录
- clean_orphan_assets 里 .meta 文件忘记剥离 -序号 后缀 → 误判孤儿要删刚生成的 meta →
  被删除保护钩子批量拦截、进程中断导致导出 JSON 未写出。
  修复：png 与其 meta 共用同一 frame_prefix 判定；并把清理改为显式开关 --clean（默认关闭）。
- shell 里用 python -c 传含反引号的中文文本会被命令替换吞掉，改用写脚本文件的方式。

### 本次成果
- 资源：帧 704 张（全部 >=140，png 与 .meta 尺寸 100% 一致）、动画组 204（203 立绘 + 临时机甲），
  双写 resources/Monster/ani 与 Image/Monster/ani 各 204，uuid 不重复。
- AniID：唯一 204，与 99 个机甲动画零重名，触发 _2 后缀 76 个。
- 数据：导出 tools/monster/monsterbase_export.json（462 docs + name_table 393）。
- 云端：jjfb.MonsterBase 整集重建 462 条（有立绘 393 / 临时机甲 69），索引 RobotID_1 + MonsterExtra.MonsterID_1。
- 校验：同组画布一致性 204/204 全通过；anim 引用抽样 8/8 OK；anim 引用的 @f9941 无效引用 0。
- helper：tools/monster/_dryrun_names.py（只读沙盘，打印全部 名字→AniID 映射）。
"""
open(p, "w", encoding="utf-8").write(txt + add)
print("OK appended", len(add))
