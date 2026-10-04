# -*- coding: utf-8 -*-
"""
把 docs/monster_distribution.xlsx 的「地图分区 + 刷怪分布」落库到远端生产 MongoDB。

产出三个动作（幂等，可重复执行）：
  1) MonsterMap   —— 地图/分区索引集合（map_id 为主键，1..58）
  2) MonsterSpawn —— 刷怪分布集合（map_id + 怪物id 唯一）
  3) MonsterBase  —— 回填 MonsterExtra.map_id / map_ids 归属标签

关联铁律：分布表「段内id」== MonsterExtra.MonsterID。
同名段（尼利亚荒原/无尽森林/雷奥斯）合并共用 map_id，但 MonsterSpawn 用
(map_id, monster_id, form) 唯一，因此跨段重复的怪会在同 map_id 下各自保留。

用法：
  python deploy_monster_distribution.py            # 预演（不写库）
  python deploy_monster_distribution.py --apply    # 实际写库
  python deploy_monster_distribution.py --apply --drop   # 先整集 drop 再重建
"""
import argparse
import os
import sys
from collections import OrderedDict, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
XLSX = os.path.join(ROOT, "docs", "monster_distribution.xlsx")

# 本机全局代理会拦 Mongo/网络，清掉
for _k in ("http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY", "all_proxy", "ALL_PROXY"):
    os.environ.pop(_k, None)
os.environ["NO_PROXY"] = "*"
os.environ["no_proxy"] = "*"


def load_mongo_url():
    """从 server/.env 读取 MONGO_URL（不落地明文）。"""
    env_path = os.path.join(ROOT, "server", ".env")
    url = os.environ.get("MONGO_URL", "")
    if not url and os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("MONGO_URL="):
                    url = line.split("=", 1)[1].strip()
                    break
    if not url:
        raise RuntimeError("未找到 MONGO_URL（server/.env 或环境变量）")
    return url


def read_xlsx():
    import openpyxl

    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb["怪物分布表"]
    header = [c.value for c in ws[1]]
    rows = []
    for r in ws.iter_rows(min_row=2, values_only=True):
        if r[0] is None:
            continue
        rows.append(dict(zip(header, r)))
    idx_ws = wb["地图索引"]
    idx_header = [c.value for c in idx_ws[1]]
    idx = []
    for r in idx_ws.iter_rows(min_row=2, values_only=True):
        if r[0] is None:
            continue
        idx.append(dict(zip(idx_header, r)))
    return rows, idx


def to_int(v, default=0):
    try:
        if v is None or v == "":
            return default
        return int(float(str(v).strip()))
    except Exception:
        return default


def parse_level_hint(text):
    """从「敌人等级15~27（danger=3）」解析出 (lo, hi, danger)。"""
    import re

    if not text:
        return None, None, None
    lo = hi = danger = None
    m = re.search(r"(\d+)\s*~\s*(\d+)", str(text))
    if m:
        lo, hi = int(m.group(1)), int(m.group(2))
    m2 = re.search(r"danger\s*=\s*(\d+)", str(text))
    if m2:
        danger = int(m2.group(1))
    return lo, hi, danger


def build_map_docs(idx_rows):
    """构建 MonsterMap 文档。"""
    docs = []
    for r in idx_rows:
        mid = to_int(r.get("map_id"))
        seg = (r.get("段名") or "").strip()
        mtype = (r.get("类型") or "").strip()
        doc = {
            "MapID": mid,
            "SeasonName": seg,          # 原始段名（地图名）
            "Name": seg,
            "IsMap": 1 if mtype == "地图" else 0,
            "Category": mtype,
            "UnitCount": to_int(r.get("单位数")),
            "EnemyGroupCount": to_int(r.get("敌群数")),
            "RobotCount": to_int(r.get("机甲数")),
        }
        docs.append(doc)
    return docs


def build_spawn_docs(rows):
    """构建 MonsterSpawn 文档，唯一键 (MapID, MonsterID, Form)。"""
    seen = OrderedDict()
    map_levels = defaultdict(lambda: [None, None, None])
    for r in rows:
        mid = to_int(r.get("map_id"))
        monster_id = to_int(r.get("段内id"))
        form = (r.get("形态") or "").strip() or None
        name = (r.get("名称") or "").strip()
        key = (mid, monster_id, form or "")
        lo, hi, danger = parse_level_hint(r.get("世界提示"))
        if lo is not None:
            cur = map_levels[mid]
            cur[0] = lo if cur[0] is None else min(cur[0], lo)
            cur[1] = hi if cur[1] is None else max(cur[1], hi)
            cur[2] = danger if cur[2] is None else max(cur[2], danger)
        doc = {
            "MapID": mid,
            "SeasonName": (r.get("段名") or "").strip(),
            "MonsterID": monster_id,
            "RobotID": monster_id + 100000,
            "MonsterName": name,
            "Form": form,
            "FormText": form,
            "ImgID": to_int(r.get("imgID")),
            "IsEnemyGroup": to_int(r.get("是否敌群")),
            "IsRobot": to_int(r.get("isRobot")),
            "BaseAtt": (r.get("baseAtt") or "").strip() or None,
            "JinLevel": to_int(r.get("jinLevel"), None),
            "WorldHint": (r.get("世界提示") or "").strip() or None,
            "OldSegNo": to_int(r.get("旧段号"), None),
            "IdRange": (r.get("ID区间") or "").strip() or None,
            "Kind": "robot" if to_int(r.get("isRobot")) == 1 else "monster",
        }
        seen[key] = doc
    return list(seen.values()), dict(map_levels)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="实际写库（默认预演）")
    ap.add_argument("--drop", action="store_true", help="先 drop 集合再重建")
    args = ap.parse_args()

    rows, idx = read_xlsx()
    map_docs = build_map_docs(idx)
    spawn_docs, map_levels = build_spawn_docs(rows)

    # 把等级提示合并进 MonsterMap
    for d in map_docs:
        lo, hi, danger = map_levels.get(d["MapID"], (None, None, None))
        d["EnemyLevelMin"] = lo
        d["EnemyLevelMax"] = hi
        d["DangerLevel"] = danger

    # MonsterBase 归属标签：MonsterID -> [map_id...]
    mb_maps = defaultdict(set)
    for s in spawn_docs:
        mb_maps[s["MonsterID"]].add(s["MapID"])

    print("=" * 62)
    print("分布表行数        :", len(rows))
    print("MonsterMap 文档数 :", len(map_docs))
    print("MonsterSpawn 文档 :", len(spawn_docs))
    print("覆盖怪物ID数      :", len(mb_maps))
    print("敌群条目(IsEnemyGroup=1):", sum(1 for s in spawn_docs if s["IsEnemyGroup"] == 1))
    print("机甲条目(IsRobot=1)     :", sum(1 for s in spawn_docs if s["IsRobot"] == 1))
    print("=" * 62)

    if not args.apply:
        print("[预演] 未写库。加 --apply 实际执行。")
        print("样例 MonsterMap :", map_docs[1])
        print("样例 MonsterSpawn:", spawn_docs[19] if len(spawn_docs) > 19 else spawn_docs[0])
        return

    from pymongo import MongoClient, ASCENDING, DESCENDING

    url = load_mongo_url()
    client = MongoClient(url, serverSelectionTimeoutMS=8000, connectTimeoutMS=8000)
    db = client["jjfb"]
    # 连通性自检
    client.admin.command("ping")

    mp_col = db["MonsterMap"]
    sp_col = db["MonsterSpawn"]
    mb_col = db["MonsterBase"]

    if args.drop:
        mp_col.drop()
        sp_col.drop()
        print("[drop] MonsterMap / MonsterSpawn 已清空")

    # --- MonsterMap：按 MapID 覆盖 ---
    from pymongo import ReplaceOne

    ops = [ReplaceOne({"MapID": d["MapID"]}, d, upsert=True) for d in map_docs]
    res = mp_col.bulk_write(ops, ordered=False)
    print("[MonsterMap] upsert=%d modified=%d" % (res.upserted_count, res.modified_count))

    # --- MonsterSpawn：按 (MapID, MonsterID, Form) 覆盖 ---
    ops = [
        ReplaceOne(
            {"MapID": d["MapID"], "MonsterID": d["MonsterID"], "Form": d["Form"]},
            d,
            upsert=True,
        )
        for d in spawn_docs
    ]
    res = sp_col.bulk_write(ops, ordered=False)
    print("[MonsterSpawn] upsert=%d modified=%d" % (res.upserted_count, res.modified_count))

    # --- MonsterBase：回填 map_id / map_ids ---
    updated = 0
    for monster_id, maps in mb_maps.items():
        r = mb_col.update_many(
            {"MonsterExtra.MonsterID": monster_id},
            {
                "$set": {
                    "MonsterExtra.map_id": sorted(maps)[0],
                    "MonsterExtra.map_ids": sorted(maps),
                    "MonsterExtra.season_name": spawn_docs and next(
                        (s["SeasonName"] for s in spawn_docs if s["MonsterID"] == monster_id),
                        None,
                    ),
                }
            },
        )
        updated += r.modified_count
    print("[MonsterBase] 回填 map 归属 modified=%d" % updated)

    # --- 立绘资源关联：ArtRef 三个等级 ---
    #   同 id 有立绘 → ArtSource="self"
    #   同 id 无但同名其他 id 有 → ArtSource="alias"，并给 ArtOwnerID / ArtAniID
    #   都没有 → ArtSource="none"
    mb_by_name = {}
    for d in mb_col.find({}, {"RobotName": 1, "AniID": 1, "MonsterExtra.MonsterID": 1}):
        nm = d.get("RobotName")
        if nm:
            mb_by_name.setdefault(nm, []).append(
                (int((d.get("MonsterExtra") or {}).get("MonsterID", -1)), d.get("AniID") or "")
            )

    own_ids = set(
        int((d.get("MonsterExtra") or {}).get("MonsterID", -1))
        for d in mb_col.find({}, {"MonsterExtra.MonsterID": 1})
    )

    art_stats = {"self": 0, "alias": 0, "none": 0}
    art_ops = []
    for s in spawn_docs:
        mid = s["MonsterID"]
        if mid in own_ids:
            art = {"ArtSource": "self", "ArtOwnerID": mid, "ArtAniID": None}
        else:
            cand = mb_by_name.get(s["MonsterName"]) or []
            if cand:
                cand_sorted = sorted(cand, key=lambda x: x[0])
                art = {
                    "ArtSource": "alias",
                    "ArtOwnerID": cand_sorted[0][0],
                    "ArtAniID": cand_sorted[0][1],
                    "ArtAliasIDs": [c[0] for c in cand_sorted],
                }
                # 按 Form 优先匹配 初/中/终 对应 AniID 的 _L1/_L2/_L3
            else:
                art = {"ArtSource": "none", "ArtOwnerID": None, "ArtAniID": None}
        art_stats[art["ArtSource"]] += 1
        art_ops.append((s, art))

    from pymongo import UpdateOne

    ops = [
        UpdateOne(
            {"MapID": s["MapID"], "MonsterID": s["MonsterID"], "Form": s["Form"]},
            {"$set": art},
        )
        for s, art in art_ops
    ]
    if ops:
        res = sp_col.bulk_write(ops, ordered=False)
        print(
            "[MonsterSpawn] 立绘关联 modified=%d  (self=%d alias=%d none=%d)"
            % (res.modified_count, art_stats["self"], art_stats["alias"], art_stats["none"])
        )

    # --- 索引 ---
    mp_col.create_index([("MapID", ASCENDING)], unique=True, name="MonsterMap.MapID")
    mp_col.create_index([("IsMap", ASCENDING)], name="MonsterMap.IsMap")
    sp_col.create_index(
        [("MapID", ASCENDING), ("MonsterID", ASCENDING), ("Form", ASCENDING)],
        unique=True,
        name="MonsterSpawn.uk",
    )
    sp_col.create_index([("MonsterID", ASCENDING)], name="MonsterSpawn.MonsterID")
    sp_col.create_index(
        [("MapID", ASCENDING), ("IsEnemyGroup", DESCENDING)], name="MonsterSpawn.map_enemy"
    )
    sp_col.create_index([("IsRobot", ASCENDING)], name="MonsterSpawn.IsRobot")
    print("[index] 已建立")

    # --- 校验 ---
    print("-" * 62)
    print("MonsterMap count  :", mp_col.count_documents({}))
    print("MonsterSpawn count:", sp_col.count_documents({}))
    print("敌群 count        :", sp_col.count_documents({"IsEnemyGroup": 1}))
    print("机甲 count        :", sp_col.count_documents({"IsRobot": 1}))
    print("MonsterBase 带 map_id:", mb_col.count_documents({"MonsterExtra.map_id": {"$exists": True}}))
    print("MonsterBase 总数     :", mb_col.count_documents({}))
    print("-" * 62)
    client.close()
    print("[done]")


if __name__ == "__main__":
    main()
