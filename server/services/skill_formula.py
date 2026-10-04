# -*- coding: utf-8 -*-
"""技能伤害公式求值（复刻 RPG Maker MV）

权威来源
--------
原工程 `D:/机甲风暴开发素材合集/机甲风暴2/js/rpg_objects.js`：

    Game_Action.prototype.evalDamageFormula = function(target) {
        var a = this.subject();
        var b = target;
        var sign = ([3, 4].contains(item.damage.type) ? -1 : 1);
        var value = Math.max(eval(item.damage.formula), 0) * sign;
        if (isNaN(value)) value = 0;
        return value;
    };

    Game_Action.prototype.makeDamageValue = function(target, critical) {
        var baseValue = this.evalDamageFormula(target);
        var value = baseValue * this.calcElementRate(target);
        if (this.isPhysical()) value *= target.pdr;
        if (this.isMagical())  value *= target.mdr;
        if (baseValue < 0)     value *= target.rec;
        if (critical)          value = this.applyCritical(value);   // ×3
        value = this.applyVariance(value, item.damage.variance);
        value = this.applyGuard(value, target);
        return Math.round(value);
    };

    Game_Action.prototype.applyVariance = function(damage, variance) {
        var amp = Math.floor(Math.max(Math.abs(damage) * variance / 100, 0));
        var v = Math.randomInt(amp + 1) + Math.randomInt(amp + 1) - amp;
        return damage >= 0 ? damage + v : damage - v;
    };

    Game_Action.prototype.applyCritical = function(damage) { return damage * 3; };
    Game_Action.prototype.applyGuard = function(damage, target) {
        return damage / (damage > 0 && target.isGuard() ? 2 * target.grd : 1);
    };
    Game_Action.prototype.itemCri = function(target) {
        return this.item().damage.critical ? this.subject().cri * (1 - target.cev) : 0;
    };

公式里的 `a` = 攻击方，`b` = 被击方，属性用 `a.atk` / `b.def` 这类写法。

安全说明
--------
公式是纯表达式，用 AST 白名单求值，**不使用 eval/exec**。
只允许：数字常量、`a` / `b` 的属性访问、四则运算与括号、少量 Math 函数。
"""
from __future__ import annotations

import ast
import math
import random
import re
from typing import Any, Dict, Optional

__all__ = [
    "SkillFormulaError",
    "BattleActorView",
    "normalize_formula",
    "eval_formula",
    "eval_damage_formula",
    "make_damage_value",
    "apply_variance",
    "apply_guard",
    "apply_critical",
    "item_cri",
    "is_critical_roll",
    "is_self_target",
    "is_all_target",
    "resolve_scope",
    "CRITICAL_MULTIPLIER",
]

CRITICAL_MULTIPLIER = 3.0   # rpg_objects.js: applyCritical
DEFAULT_GRD = 1.0           # 普通单位守护倍率；带「防御」指令的按 2×grd 减半


class SkillFormulaError(ValueError):
    """公式解析/求值失败。"""


# ---------------------------------------------------------------------------
# 攻击方 / 被击方视图：把战斗房间的 actor 字段映射成 MV 的属性名
# ---------------------------------------------------------------------------
_PARAM_MAP: Dict[str, str] = {
    # MV 属性名        -> battle_room actor 字段
    "atk": "attack",     # 攻击（melee + shoot）
    "def": "defense",    # 防御（armor）
    "mat": "attack",     # 魔攻：本工程未单列，沿用攻击
    "mdf": "defense",    # 魔防：本工程未单列，沿用防御
    "agi": "initiative",  # 速度
    "luk": "luck",       # 幸运：actor 无此字段时按 0
    "hp": "hp",
    "mp": "mp",
    "mhp": "max_hp",
    "mmp": "max_mp",
    "level": "level",
    "tp": "tp",          # 本工程没有 TP，固定 0
    # `def` 在 Python 里是关键字，`.def` 会直接语法报错 → 预处理改名后再查表
    "__def__": "defense",
}

# 公式预处理：把 JS 里合法、Python 里是关键字/保留字的属性名换掉
_ATTR_RENAME = (
    (re.compile(r"\.\s*def\b"), ".__def__"),   # a.def / b.def -> a.__def__
)

# 只允许公式访问这些属性（白名单，杜绝 a.__class__ 这类逃逸）
_ALLOWED_ATTRS = frozenset(_PARAM_MAP) | {"name"}


def normalize_formula(formula: str) -> str:
    """把 MV 公式转成可被 Python `ast` 解析的等价表达式（只改属性名，不改语义）。"""
    text = str(formula)
    for pattern, repl in _ATTR_RENAME:
        text = pattern.sub(repl, text)
    return text


class BattleActorView:
    """只读地把 battle_room 的 actor dict 包装成 MV 公式里的 `a` / `b`。

    缺失字段按 0 处理（例如老数据没有 max_mp）。
    """

    __slots__ = ("_d", "grd", "pdr", "mdr", "rec", "cev", "cri", "guarding")

    def __init__(self, actor: Optional[Dict[str, Any]] = None) -> None:
        self._d = actor or {}
        # 伤害率 / 暴击相关：本工程暂未使用装备加成，先给中性默认值
        self.grd = float(self._d.get("grd", DEFAULT_GRD) or DEFAULT_GRD)
        self.pdr = float(self._d.get("pdr", 1.0) or 1.0)   # 物理伤害率
        self.mdr = float(self._d.get("mdr", 1.0) or 1.0)   # 魔法伤害率
        self.rec = float(self._d.get("rec", 1.0) or 1.0)   # 被恢复率
        self.cev = float(self._d.get("cev", 0.0) or 0.0)   # 暴击闪避率
        self.cri = float(self._d.get("cri", 0.05) or 0.0)  # 暴击率，默认 5%
        self.guarding = bool(self._d.get("guarding") or self._d.get("is_guard"))

    def __getattr__(self, name: str) -> float:
        field = _PARAM_MAP.get(name)
        if field is None:
            # 故意抛 AttributeError（而不是 SkillFormulaError）：
            # 避免污染 copy/pickle 等对 dunder 属性的探测
            raise AttributeError(name)
        raw = self._d.get(field, 0)
        try:
            return float(raw or 0)
        except (TypeError, ValueError):
            return 0.0

    # 公式里偶见 a.name / b.name 之类，给个字符串兜底（不参与算术）
    @property
    def name(self) -> str:
        return str(self._d.get("name") or "")

    def is_guard(self) -> bool:
        return self.guarding

    def __repr__(self) -> str:  # pragma: no cover
        return "<BattleActorView %s hp=%.0f/%.0f atk=%.0f def=%.0f>" % (
            self._d.get("name") or self._d.get("side") or "?",
            self.hp, self.mhp, self.atk, self._d.get("defense", 0),
        )


# ---------------------------------------------------------------------------
# 安全表达式求值
# ---------------------------------------------------------------------------
_MATH_FUNCS = {
    "floor": math.floor,
    "ceil": math.ceil,
    "round": round,
    "abs": abs,
    "min": min,
    "max": max,
    "sqrt": math.sqrt,
    "pow": pow,
}

_BIN_OPS = {
    ast.Add: lambda x, y: x + y,
    ast.Sub: lambda x, y: x - y,
    ast.Mult: lambda x, y: x * y,
    ast.Div: lambda x, y: x / y,
    ast.FloorDiv: lambda x, y: x // y,
    ast.Mod: lambda x, y: x % y,
    ast.Pow: lambda x, y: x ** y,
}

_UNARY_OPS = {
    ast.UAdd: lambda x: +x,
    ast.USub: lambda x: -x,
}


def _safe_eval(node: ast.AST, a: BattleActorView, b: BattleActorView) -> float:
    if isinstance(node, ast.Expression):
        return _safe_eval(node.body, a, b)

    if isinstance(node, ast.Constant):
        if isinstance(node.value, bool) or not isinstance(node.value, (int, float)):
            raise SkillFormulaError("公式里出现了非数值常量：%r" % (node.value,))
        return float(node.value)

    if isinstance(node, ast.Name):
        if node.id == "a":
            return a  # type: ignore[return-value]
        if node.id == "b":
            return b  # type: ignore[return-value]
        if node.id == "Math":
            return _MATH_FUNCS  # type: ignore[return-value]
        raise SkillFormulaError("公式里出现了未定义的变量：%s" % node.id)

    if isinstance(node, ast.Attribute):
        owner = _safe_eval(node.value, a, b)
        if owner is _MATH_FUNCS:
            fn = _MATH_FUNCS.get(node.attr)
            if fn is None:
                raise SkillFormulaError("不支持的 Math 方法：Math.%s" % node.attr)
            return fn  # type: ignore[return-value]
        if isinstance(owner, BattleActorView):
            if node.attr not in _ALLOWED_ATTRS:
                raise SkillFormulaError("公式里用了不支持的属性：.%s" % node.attr)
            return getattr(owner, node.attr)
        raise SkillFormulaError("不能对 %r 取属性 .%s" % (owner, node.attr))

    if isinstance(node, ast.BinOp):
        op = _BIN_OPS.get(type(node.op))
        if op is None:
            raise SkillFormulaError("不支持的运算符：%s" % type(node.op).__name__)
        return op(_safe_eval(node.left, a, b), _safe_eval(node.right, a, b))

    if isinstance(node, ast.UnaryOp):
        op = _UNARY_OPS.get(type(node.op))
        if op is None:
            raise SkillFormulaError("不支持的一元运算符：%s" % type(node.op).__name__)
        return op(_safe_eval(node.operand, a, b))

    if isinstance(node, ast.Call):
        fn = _safe_eval(node.func, a, b)
        if not callable(fn):
            raise SkillFormulaError("公式里调用了不可调用的对象")
        args = [_safe_eval(arg, a, b) for arg in node.args]
        if node.keywords:
            raise SkillFormulaError("公式里不支持关键字参数")
        return float(fn(*args))

    raise SkillFormulaError("公式里出现了不允许的语法：%s" % type(node).__name__)


def eval_formula(
    formula: str,
    attacker: Any,
    defender: Any,
) -> float:
    """求值一段 MV 伤害公式，返回**未取整、未夹取**的原始值。"""
    if formula is None:
        raise SkillFormulaError("公式为空")
    text = str(formula).strip()
    if not text:
        raise SkillFormulaError("公式为空")
    text = normalize_formula(text)
    try:
        tree = ast.parse(text, mode="eval")
    except SyntaxError as exc:
        raise SkillFormulaError("公式语法错误：%s（%s）" % (text, exc)) from exc

    a = attacker if isinstance(attacker, BattleActorView) else BattleActorView(attacker)
    b = defender if isinstance(defender, BattleActorView) else BattleActorView(defender)
    return float(_safe_eval(tree, a, b))


def eval_damage_formula(
    formula: str,
    attacker: Any,
    defender: Any,
    damage_type: int = 1,
) -> float:
    """复刻 `evalDamageFormula`：结果先 `max(value, 0)`，再按吸收类（type 3/4）取负。"""
    value = max(eval_formula(formula, attacker, defender), 0.0)
    if math.isnan(value):
        value = 0.0
    if damage_type in (3, 4):   # HP 吸收 / MP 吸收
        value = -value
    return value


def apply_critical(damage: float) -> float:
    """rpg_objects.js: applyCritical -> damage * 3"""
    return damage * CRITICAL_MULTIPLIER


def apply_variance(damage: float, variance: float, rng: Optional[random.Random] = None) -> float:
    """复刻 `applyVariance`：三角分布，落在 [damage-amp, damage+amp]。"""
    rnd = rng or random
    amp = math.floor(max(abs(damage) * float(variance or 0) / 100.0, 0.0))
    # Math.randomInt(amp + 1) = randint(0, amp)
    v = rnd.randint(0, amp) + rnd.randint(0, amp) - amp
    return damage + v if damage >= 0 else damage - v


def apply_guard(damage: float, target: Any, guarding: Optional[bool] = None) -> float:
    """复刻 `applyGuard`：目标处于防御时伤害 ÷ (2 × grd)。"""
    view = target if isinstance(target, BattleActorView) else BattleActorView(target)
    is_guard = view.is_guard() if guarding is None else bool(guarding)
    if damage > 0 and is_guard:
        return damage / (2.0 * view.grd)
    return damage


def item_cri(attacker: Any, defender: Any, critical_enabled: bool) -> float:
    """暴击率：`cri × (1 - cev)`；技能本身不开暴击则为 0。"""
    a = attacker if isinstance(attacker, BattleActorView) else BattleActorView(attacker)
    b = defender if isinstance(defender, BattleActorView) else BattleActorView(defender)
    return a.cri * (1.0 - b.cev) if critical_enabled else 0.0


def is_critical_roll(
    attacker: Any,
    defender: Any,
    critical_enabled: bool,
    rng: Optional[random.Random] = None,
) -> bool:
    rnd = rng or random
    return rnd.random() < item_cri(attacker, defender, critical_enabled)


def make_damage_value(
    formula: str,
    attacker: Any,
    defender: Any,
    *,
    variance: float = 20,
    critical_enabled: bool = False,
    damage_type: int = 1,
    element_rate: float = 1.0,
    is_physical: bool = False,
    is_magical: bool = False,
    rng: Optional[random.Random] = None,
    force_critical: Optional[bool] = None,
    min_value: float = 0.0,
) -> Dict[str, Any]:
    """完整复刻 `makeDamageValue`，返回最终伤害与中间量（便于调参与日志）。

    `min_value`：**本工程扩展**，用于给「高防保底」留底。
      RPG 原版 `evalDamageFormula` 只做 `Math.max(…, 0)`，因此防高到一定程度就是 0 伤害；
      现网旧公式是 `max(1, 攻击 − 装甲)`（保底 1），为避免出现「双方都打不动」的僵局，
      战斗侧按 1 传入。默认 0 = RPG 原义。

    返回:
        {
          "formula": 公式原文,
          "base": 公式原始值（已 max(…,0) 与 sign）,
          "value": 最终伤害（int，已取整）,
          "critical": 是否命中暴击,
        }
    """
    rnd = rng or random
    a = attacker if isinstance(attacker, BattleActorView) else BattleActorView(attacker)
    b = defender if isinstance(defender, BattleActorView) else BattleActorView(defender)

    base = eval_damage_formula(formula, a, b, damage_type)
    if min_value and base >= 0 and base < min_value:
        base = float(min_value)
    value = base * float(element_rate or 1.0)
    if is_physical:
        value *= b.pdr
    if is_magical:
        value *= b.mdr
    if base < 0:
        value *= b.rec

    critical = (
        bool(force_critical)
        if force_critical is not None
        else is_critical_roll(a, b, critical_enabled, rnd)
    )
    if critical:
        value = apply_critical(value)

    value = apply_variance(value, variance, rnd)
    value = apply_guard(value, b)
    return {
        "formula": formula,
        "base": base,
        "value": int(round(value)),
        "critical": critical,
    }


# ---------------------------------------------------------------------------
# 目标选择（scope）
# ---------------------------------------------------------------------------
_SCOPE_ALL = {2, 8, 10}
_SCOPE_SELF = {11}
_SCOPE_ALLY = {7, 8, 9, 10}


def is_all_target(scope: int) -> bool:
    """是否群体（全体敌人 / 全体己方）。"""
    return int(scope) in _SCOPE_ALL


def is_self_target(scope: int) -> bool:
    """是否只作用于自己。"""
    return int(scope) in _SCOPE_SELF


def resolve_scope(scope: int) -> Dict[str, Any]:
    """把 MV scope 编号翻译成战斗系统需要的信息。"""
    scope = int(scope)
    return {
        "scope": scope,
        "target": "all" if scope in _SCOPE_ALL else ("single" if scope not in (0,) else "none"),
        "side": (
            "self" if scope in _SCOPE_SELF
            else ("ally" if scope in _SCOPE_ALLY else ("enemy" if scope else "none"))
        ),
        "is_all": scope in _SCOPE_ALL,
        "is_self": scope in _SCOPE_SELF,
        "is_ally": scope in _SCOPE_ALLY,
    }
