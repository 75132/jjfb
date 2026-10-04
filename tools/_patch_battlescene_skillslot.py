# -*- coding: utf-8 -*-
"""一次性把「技能选择面板随战斗流程关闭」的调用插进 BattleScene.ts 的各个隐藏点。

每处都用**带上下文的长锚点**，并要求锚点在全文中**恰好出现一次**，否则整脚本中止（不写文件）。
（避免多处相同短句造成误插）
"""
import io
import sys

P = r'D:\jjfbol-cocos\jjfbol-cocos\jjfb\assets\Script\Game\BattleScene.ts'

with io.open(P, 'r', encoding='utf-8') as f:
    src = f.read()

PAIRS = []

# A) onEnable —— 每次打开战斗先复位
PAIRS.append((
    "        if (this.battleSelectPanel) this.battleSelectPanel.active = false;\n"
    "        if (this.timerRoot) this.timerRoot.active = false;\n"
    "\n"
    "        this.prepareRobotShowsForNewBattle();\n",
    "        if (this.battleSelectPanel) this.battleSelectPanel.active = false;\n"
    "        if (this.timerRoot) this.timerRoot.active = false;\n"
    "        this.closeSkillSelectPanel();\n"
    "\n"
    "        this.prepareRobotShowsForNewBattle();\n",
))

# B) startNewBattle —— 开战先隐藏
PAIRS.append((
    "        if (this.battleSelectPanel) {\n"
    "            this.battleSelectPanel.active = false; // 初始先隐藏，等轮到玩家时再显示\n"
    "        }\n",
    "        if (this.battleSelectPanel) {\n"
    "            this.battleSelectPanel.active = false; // 初始先隐藏，等轮到玩家时再显示\n"
    "        }\n"
    "        this.closeSkillSelectPanel();\n",
))

# C) sendBattleRoomAction —— 已提交本回合指令
PAIRS.append((
    "        if (this.battleSelectPanel) this.battleSelectPanel.active = false;\n"
    "        if (this.timerRoot) this.timerRoot.active = this.graceActive;\n",
    "        if (this.battleSelectPanel) this.battleSelectPanel.active = false;\n"
    "        this.closeSkillSelectPanel();   // 已提交指令 → 技能面板一并收起\n"
    "        if (this.timerRoot) this.timerRoot.active = this.graceActive;\n",
))

# D) tryResolveRound —— 本地模拟路径
PAIRS.append((
    "        // 一旦双方都有指令，先关闭面板并锁定 UI\n"
    "        if (this.battleSelectPanel) {\n"
    "            this.battleSelectPanel.active = false;\n"
    "        }\n",
    "        // 一旦双方都有指令，先关闭面板并锁定 UI\n"
    "        if (this.battleSelectPanel) {\n"
    "            this.battleSelectPanel.active = false;\n"
    "        }\n"
    "        this.closeSkillSelectPanel();\n",
))

# E) 播放服务器回合动画
PAIRS.append((
    "        this.setButtonsInteractable(false);\n"
    "        if (this.battleSelectPanel) this.battleSelectPanel.active = false;\n"
    "        if (this.timerRoot) this.timerRoot.active = false;\n"
    "\n"
    "        // 同步单位/展示数据（不结束战斗、不显示面板）\n",
    "        this.setButtonsInteractable(false);\n"
    "        if (this.battleSelectPanel) this.battleSelectPanel.active = false;\n"
    "        this.closeSkillSelectPanel();\n"
    "        if (this.timerRoot) this.timerRoot.active = false;\n"
    "\n"
    "        // 同步单位/展示数据（不结束战斗、不显示面板）\n",
))

# F) finishBattle —— 战斗结束
PAIRS.append((
    "        this.state = BattleState.FINISHED;\n"
    "        this.isAnimating = false;\n"
    "        this.setButtonsInteractable(false);\n"
    "        if (this.battleSelectPanel) {\n"
    "            this.battleSelectPanel.active = false;\n"
    "        }\n",
    "        this.state = BattleState.FINISHED;\n"
    "        this.isAnimating = false;\n"
    "        this.setButtonsInteractable(false);\n"
    "        if (this.battleSelectPanel) {\n"
    "            this.battleSelectPanel.active = false;\n"
    "        }\n"
    "        this.closeSkillSelectPanel();\n",
))

# G) onBackClicked —— 返回键与技能面板联动
PAIRS.append((
    "    private onBackClicked() {\n"
    "        // 正常情况：只在指令选择阶段开关面板\n"
    "        if (this.state === BattleState.WAITING_COMMANDS) {\n",
    "    private onBackClicked() {\n"
    "        // 【联动】技能选择面板开着时，返回键先关技能面板（不退出战斗、也不切换操作面板）\n"
    "        const skillPanel = this.skillSelectPanel;\n"
    "        if (skillPanel && skillPanel.isValid && skillPanel.isOpen()) {\n"
    "            skillPanel.close();\n"
    "            return;\n"
    "        }\n"
    "        // 正常情况：只在指令选择阶段开关面板\n"
    "        if (this.state === BattleState.WAITING_COMMANDS) {\n",
))

for i, (old, new) in enumerate(PAIRS):
    n = src.count(old)
    if n != 1:
        print('✗ 锚点 #%d 出现 %d 次，已中止（未写文件）' % (i, n))
        sys.exit(1)
    src = src.replace(old, new, 1)

with io.open(P, 'w', encoding='utf-8', newline='') as f:
    f.write(src)
print('✓ 已插入 %d 处 closeSkillSelectPanel / 联动逻辑' % len(PAIRS))
