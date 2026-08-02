# -*- coding: utf-8 -*-
"""内存 Fake Mongo 集合：支持结算账本测试跨「Service 实例」共享权威状态。"""
from __future__ import annotations

import copy
import threading
from typing import Any, Dict, List, Optional, Tuple


class DuplicateKeyError(Exception):
    code = 11000

    def __init__(self, message: str = "E11000 duplicate key"):
        super().__init__(message)


def _match(doc: dict, filt: dict) -> bool:
    for k, v in (filt or {}).items():
        if doc.get(k) != v:
            return False
    return True


class FakeMongoCollection:
    """最小可用 FakeCollection：find_one / insert_one / update_one / delete_one / create_index。"""

    def __init__(self, name: str = "fake", unique_keys: Optional[List[Tuple[str, ...]]] = None):
        self.name = name
        self._docs: List[dict] = []
        self._lock = threading.Lock()
        self.indexes: Dict[str, dict] = {"_id_": {"name": "_id_"}}
        self._unique: List[Tuple[str, ...]] = list(unique_keys or [])
        self._seq = 0

    def list_indexes(self):
        return [{"name": n} for n in self.indexes]

    def create_index(self, keys, **kwargs):
        name = kwargs.get("name")
        if not name:
            if isinstance(keys, str):
                name = f"{keys}_1"
            else:
                name = "_".join(f"{k}_{d}" for k, d in keys)
        self.indexes[name] = {"name": name, "keys": keys, "kwargs": kwargs}
        if kwargs.get("unique"):
            if isinstance(keys, str):
                self._unique.append((keys,))
            else:
                self._unique.append(tuple(k for k, _d in keys))
        return name

    def _check_unique(self, doc: dict, exclude_id=None) -> None:
        for ukeys in self._unique:
            probe = tuple(doc.get(k) for k in ukeys)
            for existing in self._docs:
                if exclude_id is not None and existing.get("_id") == exclude_id:
                    continue
                if tuple(existing.get(k) for k in ukeys) == probe:
                    raise DuplicateKeyError(
                        f"E11000 duplicate key error collection: {self.name} index: {ukeys}"
                    )

    def insert_one(self, doc: dict):
        with self._lock:
            d = copy.deepcopy(doc)
            if "_id" not in d:
                self._seq += 1
                d["_id"] = self._seq
            self._check_unique(d)
            self._docs.append(d)

            class R:
                inserted_id = d["_id"]

            return R()

    def find_one(self, filt: Optional[dict] = None):
        with self._lock:
            filt = filt or {}
            for d in self._docs:
                if _match(d, filt):
                    return copy.deepcopy(d)
            return None

    def find(self, filt: Optional[dict] = None):
        with self._lock:
            filt = filt or {}
            return [copy.deepcopy(d) for d in self._docs if _match(d, filt)]

    def update_one(self, filt: dict, update: dict, upsert: bool = False):
        with self._lock:
            for i, d in enumerate(self._docs):
                if _match(d, filt):
                    new_d = copy.deepcopy(d)
                    if "$set" in update:
                        new_d.update(update["$set"])
                    else:
                        new_d.update(update)
                    self._check_unique(new_d, exclude_id=new_d.get("_id"))
                    self._docs[i] = new_d

                    class R:
                        matched_count = 1
                        modified_count = 1
                        upserted_id = None

                    return R()
            if upsert:
                base = dict(filt)
                if "$set" in update:
                    base.update(update["$set"])
                else:
                    base.update(update)
                self._seq += 1
                base["_id"] = self._seq
                self._check_unique(base)
                self._docs.append(base)

                class R:
                    matched_count = 0
                    modified_count = 0
                    upserted_id = base["_id"]

                return R()

            class R:
                matched_count = 0
                modified_count = 0
                upserted_id = None

            return R()

    def delete_one(self, filt: dict):
        with self._lock:
            for i, d in enumerate(self._docs):
                if _match(d, filt):
                    self._docs.pop(i)

                    class R:
                        deleted_count = 1

                    return R()

            class R:
                deleted_count = 0

            return R()

    def delete_many(self, filt: dict):
        with self._lock:
            keep = []
            deleted = 0
            for d in self._docs:
                if _match(d, filt):
                    deleted += 1
                else:
                    keep.append(d)
            self._docs = keep

            class R:
                deleted_count = deleted

            return R()

    def count_documents(self, filt: Optional[dict] = None):
        with self._lock:
            filt = filt or {}
            return sum(1 for d in self._docs if _match(d, filt))

    def drop(self):
        with self._lock:
            self._docs.clear()
