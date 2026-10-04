# -*- coding: utf-8 -*-
"""
为 Game.scene 的 AttackCount/Node 补齐 RightLabel + SlashSprite（克隆 ArmorPenetration 的结构）。
==================================================================================
背景：AttackCount/Node 只有 LeftLabel，导致面板无法显示「基础↑当前」分割（只显示静态 1）。
方案：以 ArmorPenetration/Node 的 SlashSprite(503/504/505) 与 RightLabel(506/507/508) 为模板，
      在数组**末尾追加**新节点/组件（不插入，保持既有 __id__ 索引全部不变），
      再把 AttackCount/Node(514) 的 _children 补上这两个新节点。
幂等：若 AttackCount/Node 已有 RightLabel/SlashSprite 则跳过。
"""
import json, os, sys, shutil

HERE = r"D:\jjfbol-cocos\jjfbol-cocos\jjfb"
SCENE = os.path.join(HERE, "assets", "Scene", "Game.scene")

with open(SCENE, encoding="utf-8") as f:
    d = json.load(f)

# ---- 定位 ----
# AttackCount 节点 -> Node(514) -> LeftLabel(515)
ac_node = None
for i, o in enumerate(d):
    if isinstance(o, dict) and o.get("__type__") == "cc.Node" and o.get("_name") == "AttackCount":
        ac_node = i
        break
assert ac_node is not None, "找不到 AttackCount 节点"
ac_node_obj = d[ac_node]
layout_id = ac_node_obj["_children"][0]["__id__"]          # Node 布局节点（514）
layout_obj = d[layout_id]
existing = [d[c["__id__"]].get("_name") for c in layout_obj.get("_children", [])]
print("AttackCount/Node children:", existing)
assert "LeftLabel" in existing, "AttackCount/Node 缺少 LeftLabel"

if "RightLabel" in existing and "SlashSprite" in existing:
    print("已存在 RightLabel/SlashSprite，跳过")
    sys.exit(0)

# ---- 模板：ArmorPenetration/Node(499) 的 SlashSprite(503+504,505) 与 RightLabel(506+507,508) ----
def find_node(name, parent_id=None):
    for i, o in enumerate(d):
        if isinstance(o, dict) and o.get("__type__") == "cc.Node" and o.get("_name") == name:
            if parent_id is None or o.get("_parent", {}).get("__id__") == parent_id:
                return i
    return None

ap_node = find_node("ArmorPenetration")
ap_layout = d[ap_node]["_children"][0]["__id__"]
tmpl_slash = find_node("SlashSprite", ap_layout)
tmpl_right = find_node("RightLabel", ap_layout)
assert tmpl_slash is not None and tmpl_right is not None
print("模板 SlashSprite id=%d, RightLabel id=%d" % (tmpl_slash, tmpl_right))

# 备份
shutil.copy2(SCENE, SCENE + ".bak_attackcount")
print("备份:", SCENE + ".bak_attackcount")

new_ids = []

# ---- 唯一 _id 生成（关键：深拷贝会复制原节点的 _id，重复 _id 会让 Cocos 反序列化节点串位，导致战斗 UI 崩溃）----
import random as _random, string as _string
_EXISTING_IDS = set()
for _o in d:
    if isinstance(_o, dict):
        _v = _o.get("_id")
        if isinstance(_v, str) and _v:
            _EXISTING_IDS.add(_v)

def gen_unique_id():
    chars = _string.ascii_letters + _string.digits + '+/'
    while True:
        nid = ''.join(_random.choice(chars) for _ in range(22))
        if nid not in _EXISTING_IDS:
            _EXISTING_IDS.add(nid)
            return nid

def clone_node_with_comps(src_node_id, new_parent_id):
    """把 src 节点及其组件深拷贝追加到数组末尾，返回 (node_idx, comp_idxs)"""
    src = d[src_node_id]
    comps = []
    # 先克隆组件
    comp_idx_list = []
    for c in src.get("_components", []):
        comp = json.loads(json.dumps(d[c["__id__"]]))
        comp["node"] = {"__id__": -1}  # 占位，稍后修正
        comp["_id"] = gen_unique_id()   # 唯一化：避免与源组件 _id 重复
        d.append(comp)
        comp_idx_list.append(len(d) - 1)
    # 克隆节点
    node = json.loads(json.dumps(src))
    node["_parent"] = {"__id__": new_parent_id}
    node["_children"] = []
    node["_components"] = [{"__id__": ci} for ci in comp_idx_list]
    node["_id"] = gen_unique_id()       # 唯一化：避免与源节点 _id 重复
    d.append(node)
    node_idx = len(d) - 1
    # 修正组件指向
    for ci in comp_idx_list:
        d[ci]["node"] = {"__id__": node_idx}
    return node_idx, comp_idx_list

slash_idx, _ = clone_node_with_comps(tmpl_slash, layout_id)
right_idx, _ = clone_node_with_comps(tmpl_right, layout_id)
print("新增 SlashSprite idx=%d, RightLabel idx=%d" % (slash_idx, right_idx))

# ---- 调整新节点位置（对齐 ArmorPenetration 的相对排布，按 AttackCount 文本宽度微调）----
# LeftLabel 在 AttackCount/Node 的 x 位置：
ll_id = None
for c in layout_obj["_children"]:
    if d[c["__id__"]].get("_name") == "LeftLabel":
        ll_id = c["__id__"]
ll_x = d[ll_id]["_lpos"]["x"]
print("AttackCount LeftLabel x =", ll_x)
# 顺序：LeftLabel(x) → SlashSprite(x+? ) → RightLabel
d[slash_idx]["_lpos"]["x"] = ll_x + 14
d[right_idx]["_lpos"]["x"] = ll_x + 26

# ---- 重排 children 顺序：LeftLabel, SlashSprite, RightLabel ----
layout_obj["_children"] = [{"__id__": ll_id}, {"__id__": slash_idx}, {"__id__": right_idx}]
# RightLabel/SlashSprite 默认隐藏（由脚本按有无 Current 控制显隐）
d[slash_idx]["_active"] = True
d[right_idx]["_active"] = True
# 清空新 RightLabel 的文本
for c in d[right_idx]["_components"]:
    comp = d[c["__id__"]]
    if comp.get("__type__") == "cc.Label":
        comp["_string"] = ""

with open(SCENE, "w", encoding="utf-8") as f:
    json.dump(d, f, ensure_ascii=False, indent=2)

print("完成。AttackCount/Node children 现为:",
      [d[c["__id__"]].get("_name") for c in layout_obj["_children"]])
print("数组长度:", len(d))
