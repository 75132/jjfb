# -*- coding: utf-8 -*-
"""校验 server/services/skill_formula.py 的公式求值是否和 RPG Maker 的 eval 一致。

做法：以同一组 mock 攻/守单位，分别用
  1) Python 侧 skill_formula.eval_damage_formula
  2) Node 侧原生 `eval(formula)`（和 rpg_objects.js 里一模一样）
求值，逐条比对。

用法：python tools/_test_skill_formula.py
"""
import io
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))

from services.skill_formula import (  # noqa: E402
    BattleActorView,
    SkillFormulaError,
    apply_variance,
    eval_damage_formula,
    is_all_target,
    is_self_target,
    make_damage_value,
)

NODE = r"C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-3/node.exe"
SKILLS = os.path.join(ROOT, "server", "data", "Skills.json")

ATTACKER = {
    "side": "player", "name": "攻方",
    "attack": 1200, "defense": 800,
    "hp": 5000, "max_hp": 8000,
    "mp": 3000, "max_mp": 5000,
    "level": 30, "initiative": 16,
}
DEFENDER = {
    "side": "enemy", "name": "守方",
    "attack": 900, "defense": 600,
    "hp": 4000, "max_hp": 7000,
    "mp": 2000, "max_mp": 4000,
    "level": 25, "initiative": 12,
}

_fail = []
_ok = 0


def check(label, cond, extra=""):
    global _ok
    if cond:
        _ok += 1
    else:
        _fail.append("%s %s" % (label, extra))
        print("  ✗ %s %s" % (label, extra))


def js_batch(formulas):
    """用 node 原生 eval 求值同一条公式，返回列表。"""
    payload = json.dumps({"formulas": formulas, "a": ATTACKER, "b": DEFENDER}, ensure_ascii=False)
    script = """
const p = JSON.parse(process.argv[1]);
function view(d){
  return {
    atk: d.attack, def: d.defense, mat: d.attack, mdf: d.defense,
    agi: d.initiative, luk: 0, hp: d.hp, mp: d.mp,
    mhp: d.max_hp, mmp: d.max_mp, level: d.level,
  };
}
const out = p.formulas.map(function(f){
  const a = view(p.a), b = view(p.b);
  let v;
  try { v = Math.max(eval(f), 0); } catch (e) { v = null; }
  if (typeof v === 'number' && isNaN(v)) v = 0;
  return v;
});
console.log(JSON.stringify(out));
"""
    res = subprocess.run(
        [NODE, "-e", script, payload],
        capture_output=True, text=True, encoding="utf-8", timeout=60,
    )
    if res.returncode != 0:
        raise RuntimeError("node 执行失败：%s" % res.stderr)
    return json.loads(res.stdout.strip().splitlines()[-1])


def main():
    with io.open(SKILLS, encoding="utf-8") as f:
        data = json.load(f)
    skills = data["skills"]

    # ---------- 1. 公式求值：Python vs Node ----------
    with_formula = [s for s in skills if s.get("formula")]
    formulas = [s["formula"] for s in with_formula]
    js_values = js_batch(formulas)

    print("[1] 公式求值对齐（Python vs Node 原生 eval）  共 %d 条" % len(formulas))
    for s, jsval in zip(with_formula, js_values):
        try:
            pyval = eval_damage_formula(s["formula"], ATTACKER, DEFENDER, damage_type=1)
        except SkillFormulaError as exc:
            check("公式求值", False, "%s -> %s" % (s["name"], exc))
            continue
        check(
            "公式求值 %s" % s["name"],
            jsval is not None and abs(pyval - jsval) < 1e-6,
            "(py=%s js=%s)" % (pyval, jsval),
        )

    # ---------- 2. 手算校验几条 ----------
    print("[2] 手算校验")
    # 肉搏攻击: 1200*5 - 600*1 + 2000 = 7400
    v = eval_damage_formula("a.atk * 5 - b.def * 1 + 2000", ATTACKER, DEFENDER)
    check("肉搏攻击=7400", v == 7400, "实得 %s" % v)
    # 超能拳: 1200*3 - 600*0.8 + 1000 = 3600-480+1000 = 4120
    v = eval_damage_formula("a.atk * 3 - b.def * 0.8 + 1000", ATTACKER, DEFENDER)
    check("超能拳=4120", v == 4120, "实得 %s" % v)
    # 固定值
    check("等离子屏障=2500", eval_damage_formula("2500", ATTACKER, DEFENDER) == 2500)
    check("虚空冲击=2000", eval_damage_formula("2000", ATTACKER, DEFENDER) == 2000)
    # 负结果被 max(...,0) 夹住
    check("负值夹到 0", eval_damage_formula("a.atk - 99999", ATTACKER, DEFENDER) == 0)
    # 吸收类取负
    check("吸收取负", eval_damage_formula("a.atk + 100", ATTACKER, DEFENDER, damage_type=3) == -1300)

    # ---------- 3. 安全：注入防护 ----------
    print("[3] 公式安全（不允许的语法应报错）")
    for bad in ["__import__('os').system('echo 1')", "a.__class__", "1 if a else 2",
                "a.atk ** 99999 ** 99999 if False else (lambda: 1)()",
                "[x for x in range(3)]", "open('x')"]:
        try:
            eval_damage_formula(bad, ATTACKER, DEFENDER)
            check("拦截危险公式", False, "未被拦截：%s" % bad)
        except SkillFormulaError:
            check("拦截危险公式", True)
        except Exception as exc:  # noqa: BLE001
            check("拦截危险公式", False, "抛出非预期异常 %s: %s" % (type(exc).__name__, exc))

    # ---------- 4. variance / guard / critical 复刻 ----------
    print("[4] variance / guard / critical")
    import random as _r
    rng = _r.Random(20260930)
    vals = [apply_variance(1000.0, 20, rng) for _ in range(2000)]
    check("variance 落在 ±20%", all(800 <= v <= 1200 for v in vals),
          "min=%s max=%s" % (min(vals), max(vals)))
    check("variance 均值≈1000", abs(sum(vals) / len(vals) - 1000) < 15,
          "均值 %s" % (sum(vals) / len(vals)))
    check("variance=0 不抖动", apply_variance(1000.0, 0, rng) == 1000)
    # 三角分布：两端概率低于中间
    import statistics
    mid = sum(1 for v in vals if 900 <= v <= 1100)
    tail = sum(1 for v in vals if v < 850 or v > 1150)
    check("三角分布（中段多于尾段）", mid > tail, "mid=%s tail=%s" % (mid, tail))

    guarded = dict(DEFENDER, guarding=True)
    r = make_damage_value("a.atk * 3", ATTACKER, guarded,
                          variance=0, critical_enabled=False, force_critical=False,
                          rng=_r.Random(1))
    check("防御减半", r["value"] == 1800, "实得 %s（应 3600/2）" % r["value"])
    r2 = make_damage_value("a.atk * 3", ATTACKER, DEFENDER,
                           variance=0, critical_enabled=False, force_critical=True,
                           rng=_r.Random(1))
    check("暴击 ×3", r2["value"] == 10800, "实得 %s" % r2["value"])
    check("暴击标记", r2["critical"] is True)

    # ---------- 5. scope ----------
    print("[5] scope 判定")
    for s in skills:
        sc = s.get("scope")
        if sc is None:
            continue
        if sc == 2:
            check("%s 群体" % s["name"], is_all_target(sc) and s["target"] == "all")
        elif sc == 1:
            check("%s 单体" % s["name"], not is_all_target(sc) and s["target"] == "single")
        elif sc == 7:
            check("%s 自身向" % s["name"], s["side"] == "ally" and not is_all_target(sc))

    print("\n通过 %d 项，失败 %d 项" % (_ok, len(_fail)))
    if _fail:
        print("失败清单：")
        for f in _fail:
            print("  -", f)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
