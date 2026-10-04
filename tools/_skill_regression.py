# -*- coding: utf-8 -*-
"""技能系统全量回归（一键跑齐两端 + 类型检查）。

跑的内容（对应交接文档 §14 的验收口径）
--------------------------------------
  1. tools/_test_skill_formula.py        伤害链/公式求值（服务端）
  2. tools/_test_passive_recover.py      回合结束被动恢复 + PVE/PVP 视角交换
  3. tools/_test_skill_battle.py         技能指令结算 / 施放校验 / round_events 结构
  4. tools/_test_skill_level.py          技能等级存储 / 自动升级 / 手动升级 / 路由注册
  5. tools/_test_skill_book.py           技能书使用（职业限制 / 学会 / 升级 / 扣书口径）
  6. tools/_test_skill_range.py          出招方式（近身/远程）口径 + 近身位移源码守卫
  7. tools/_test_skill_anim_assets.py    ★特效资源资产（RPG 移植特效原比例 1× + clip uuid 引用完整性）
  8. tools/_gen_round_events_fixture.py  重新生成「服务端真实 round_events」样例
  9. tsc 编译 SkillData.ts → node tools/_test_skilldata_client.cjs（客户端读取层 + 跨端契约）
 10. node tools/_test_scene_panel_mount.cjs（SkillSelectPanel 挂载位置自检：只许挂在面板根节点）
 11. tsc --noEmit 全项目（排除既有 MAP4 噪声）
 12. pytest server/tests（若当前解释器装了 pytest；没有则 SKIP）

用法：
    python tools/_skill_regression.py            # 全跑
    python tools/_skill_regression.py --no-regen # 不重新生成样例（用现有 fixture）
"""
from __future__ import annotations

import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PY = sys.executable
NODE = os.environ.get("NODE_EXE") or "node"

results = []


def run(name, args, cwd=None, parse_fail=True):
    cwd = cwd or ROOT
    proc = subprocess.run(args, cwd=cwd, capture_output=True, text=True,
                          encoding="utf-8", errors="replace")
    out = (proc.stdout or "") + (proc.stderr or "")
    ok = proc.returncode == 0
    detail = ""
    if parse_fail:
        m = re.search(r"失败\s*[:：]?\s*(\d+)", out)
        if m:
            n = int(m.group(1))
            ok = ok and n == 0
            detail = "失败 %d" % n
        m2 = re.search(r"通过\s+(\d+)", out)
        if m2:
            detail = ("通过 %s " % m2.group(1)) + detail
    if not ok and not detail:
        # 取最后几行作为线索
        detail = " / ".join([ln.strip() for ln in out.strip().splitlines()[-3:] if ln.strip()])
    results.append((name, ok, detail))
    print("  %s %s%s" % ("✓" if ok else "✗", name, ("  " + detail) if detail else ""))
    return ok, out


def main():
    no_regen = "--no-regen" in sys.argv
    all_ok = True

    print("[1-6] 服务端纯逻辑套件 + 出招方式 + 特效资源口径（python）")
    for f in ("_test_skill_formula.py", "_test_passive_recover.py",
              "_test_skill_battle.py", "_test_skill_level.py", "_test_skill_book.py",
              "_test_skill_range.py", "_test_skill_anim_assets.py"):
        ok, _ = run(f, [PY, os.path.join("tools", f)])
        all_ok = all_ok and ok

    if not no_regen:
        print("[8] 重新生成跨端样例（服务端 → 客户端契约）")
        ok, _ = run("_gen_round_events_fixture.py",
                    [PY, os.path.join("tools", "_gen_round_events_fixture.py")], parse_fail=False)
        all_ok = all_ok and ok

    print("[9] 客户端读取层 + 跨端契约（tsc + node）")
    ok, out = run("tsc(编译 SkillData)", [
        NODE, os.path.join("node_modules", "typescript", "bin", "tsc"),
        os.path.join("assets", "Script", "Game", "SkillData.ts"),
        "--outDir", os.path.join("tools", "_preview", "sd"),
        "--target", "es2017", "--module", "commonjs", "--skipLibCheck",
    ], parse_fail=False)
    all_ok = all_ok and ok
    if ok:
        ok, _ = run("_test_skilldata_client.cjs",
                    [NODE, os.path.join("tools", "_test_skilldata_client.cjs")])
        all_ok = all_ok and ok

    print("[10] 面板挂载位置自检（防止 SkillSelectPanel 被误挂到父节点）")
    ok, _ = run("_test_scene_panel_mount.cjs",
                [NODE, os.path.join("tools", "_test_scene_panel_mount.cjs")])
    all_ok = all_ok and ok

    print("[11] 全项目类型检查（tsc --noEmit，排除 MAP4 噪声）")
    proc = subprocess.run([NODE, os.path.join("node_modules", "typescript", "bin", "tsc"),
                           "--noEmit", "-p", "tsconfig.json"],
                          cwd=ROOT, capture_output=True, text=True,
                          encoding="utf-8", errors="replace")
    lines = [ln for ln in ((proc.stdout or "") + (proc.stderr or "")).splitlines()
             if ln.strip() and "MAP4" not in ln]
    ok = not lines
    results.append(("tsc --noEmit", ok, "非 MAP4 错误 %d 条" % len(lines)))
    print("  %s tsc --noEmit  非 MAP4 错误 %d 条" % ("✓" if ok else "✗", len(lines)))
    if lines:
        for ln in lines[:8]:
            print("      " + ln.strip())
    all_ok = all_ok and ok

    print("[12] 服务端 pytest（可选）")
    proc = subprocess.run([PY, "-m", "pytest", "tests", "-q", "-p", "no:cacheprovider"],
                          cwd=os.path.join(ROOT, "server"), capture_output=True, text=True,
                          encoding="utf-8", errors="replace")
    out = (proc.stdout or "") + (proc.stderr or "")
    if "No module named pytest" in out:
        results.append(("pytest server/tests", True, "SKIP（当前解释器无 pytest）"))
        print("  – pytest server/tests  SKIP（当前解释器无 pytest）")
    else:
        m = re.search(r"(\d+) passed", out)
        f = re.search(r"(\d+) failed", out)
        ok = proc.returncode == 0 and not (f and int(f.group(1)) > 0)
        detail = ("%s passed" % m.group(1) if m else "") + \
                 (" / %s failed" % f.group(1) if f else "")
        results.append(("pytest server/tests", ok, detail))
        print("  %s pytest server/tests  %s" % ("✓" if ok else "✗", detail))
        all_ok = all_ok and ok

    print("")
    bad = [r for r in results if not r[1]]
    if bad:
        print("回归失败 %d 项：%s" % (len(bad), [r[0] for r in bad]))
        return 1
    print("回归全绿（共 %d 项检查）" % len(results))
    return 0


if __name__ == "__main__":
    sys.exit(main())
