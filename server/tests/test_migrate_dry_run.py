# -*- coding: utf-8 -*-
"""迁移 dry-run：不连接真实 Mongo，使用内存假集合验证幂等日志路径。"""
import os
import sys
import unittest
from typing import Any, Dict, List

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from migrations import list_migrations, run_all


class _FakeIndexCursor(list):
    pass


class FakeCollection:
    def __init__(self, name: str):
        self.name = name
        self.indexes: Dict[str, dict] = {"_id_": {"name": "_id_"}}
        self.deleted_filters: List[dict] = []
        self.created: List[Any] = []

    def list_indexes(self):
        return [{"name": n} for n in self.indexes]

    def create_index(self, keys, **kwargs):
        name = kwargs.get("name") or self._default_name(keys)
        self.indexes[name] = {"name": name, "keys": keys, "kwargs": kwargs}
        self.created.append((keys, kwargs))
        return name

    def drop_index(self, index_name: str):
        if index_name in self.indexes:
            del self.indexes[index_name]
        else:
            raise Exception(f"index not found: {index_name}")

    def count_documents(self, filt):
        # dry-run / apply 都只关心计数；默认无匹配，保证可重复执行
        return 0

    def delete_many(self, filt):
        self.deleted_filters.append(filt)

        class R:
            deleted_count = 0

        return R()

    @staticmethod
    def _default_name(keys):
        if isinstance(keys, str):
            return f"{keys}_1"
        parts = []
        for k, d in keys:
            parts.append(f"{k}_{d}")
        return "_".join(parts)


class FakeDB:
    def __init__(self):
        self._cols: Dict[str, FakeCollection] = {}

    def __getitem__(self, name: str) -> FakeCollection:
        if name not in self._cols:
            self._cols[name] = FakeCollection(name)
        return self._cols[name]


class TestMigrateDryRun(unittest.TestCase):
    def test_list_migrations_non_empty(self):
        items = list_migrations()
        self.assertGreaterEqual(len(items), 1)
        self.assertEqual(items[0][0], "m001_core_indexes")

    def test_dry_run_does_not_mutate(self):
        db = FakeDB()
        lines = run_all(db, dry_run=True)
        joined = "\n".join(lines)
        self.assertIn("DRY-RUN", joined)
        self.assertIn("m001_core_indexes", joined)
        # dry-run 不应真正 create / delete
        for col in db._cols.values():
            self.assertEqual(col.created, [])
            self.assertEqual(col.deleted_filters, [])

    def test_apply_idempotent_second_run(self):
        db = FakeDB()
        run_all(db, dry_run=False)
        created_first = sum(len(c.created) for c in db._cols.values())
        self.assertGreater(created_first, 0)
        # 第二次：同名索引已存在应 skip，不再新增
        before = {name: set(col.indexes) for name, col in db._cols.items()}
        run_all(db, dry_run=False)
        after = {name: set(col.indexes) for name, col in db._cols.items()}
        self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()
