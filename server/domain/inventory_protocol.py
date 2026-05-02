"""
统一容器抽象（协议）：背包 / 仓库 / 邮件附件等可逐步实现同一接口。
"""
from __future__ import annotations

from typing import Any, Dict, List, Protocol, runtime_checkable


@runtime_checkable
class IInventoryContainer(Protocol):
    """最小容器能力，供后续仓库、邮件等复用。"""

    async def apply_sorted_slots(self, slots: List[Dict[str, Any]]) -> Dict[str, Any]:
        """写回排序后的格子列表（实现类自行定义 slot 结构）。"""
        ...

    async def move_slot(self, source_index: int, target_index: int, category: int) -> Dict[str, Any]:
        """同分类内移动或交换。"""
        ...
