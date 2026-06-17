"""
邮件服务
"""
from __future__ import annotations

import datetime
import uuid
from typing import Any, Dict, List, Optional

from bson import ObjectId

from handlers import utils

_mails_col = None
MAIL_EXPIRE_DAYS = 30


def init_mail_service(mails_col) -> None:
    global _mails_col
    _mails_col = mails_col


async def send_mail(
    user_id: ObjectId,
    character_id: str,
    title: str,
    body: str = "",
    attachments: Optional[List[dict]] = None,
    source: str = "system",
) -> str:
    if _mails_col is None:
        raise RuntimeError("mails_col not initialized")
    mail_id = str(uuid.uuid4())
    now = datetime.datetime.utcnow()
    doc = {
        "mail_id": mail_id,
        "user_id": user_id,
        "character_id": character_id,
        "title": title,
        "body": body,
        "attachments": attachments or [],
        "read": False,
        "claimed": False,
        "source": source,
        "created_at": now,
        "expire_at": now + datetime.timedelta(days=MAIL_EXPIRE_DAYS),
    }
    await utils.async_mongo_operation(lambda: _mails_col.insert_one(doc), timeout=2.0)
    return mail_id


async def list_mails(character_id: str, limit: int = 50) -> List[dict]:
    cursor = await utils.async_mongo_operation(
        lambda: list(
            _mails_col.find({"character_id": character_id})
            .sort("created_at", -1)
            .limit(limit)
        ),
        timeout=3.0,
    )
    out = []
    for m in cursor or []:
        out.append(
            {
                "mail_id": m.get("mail_id"),
                "title": m.get("title"),
                "body": m.get("body"),
                "read": bool(m.get("read")),
                "claimed": bool(m.get("claimed")),
                "attachments": m.get("attachments") or [],
                "created_at": m.get("created_at").isoformat() if m.get("created_at") else None,
                "expire_at": m.get("expire_at").isoformat() if m.get("expire_at") else None,
            }
        )
    return out


async def mark_read(character_id: str, mail_id: str) -> bool:
    r = await utils.async_mongo_operation(
        lambda: _mails_col.update_one(
            {"character_id": character_id, "mail_id": mail_id},
            {"$set": {"read": True}},
        ),
        timeout=2.0,
    )
    return r.modified_count > 0


async def claim_attachments(user_id: ObjectId, character_id: str, mail_id: str) -> Dict[str, Any]:
    mail = await utils.async_mongo_operation(
        lambda: _mails_col.find_one({"character_id": character_id, "mail_id": mail_id}),
        timeout=2.0,
    )
    if not mail:
        return {"success": False, "error": "邮件不存在"}
    if mail.get("claimed"):
        return {"success": True, "already_claimed": True, "granted": []}
    attachments = mail.get("attachments") or []
    granted = []
    if attachments:
        from handlers import bag_handler

        for att in attachments:
            iid = int(att.get("itemId", att.get("item_id", 0)))
            count = int(att.get("count", 1))
            if iid > 0:
                r = await bag_handler.add_item_to_bag(user_id, character_id, iid, count)
                if r.get("success"):
                    granted.append({"itemId": iid, "count": count})
    await utils.async_mongo_operation(
        lambda: _mails_col.update_one(
            {"character_id": character_id, "mail_id": mail_id},
            {"$set": {"claimed": True, "read": True}},
        ),
        timeout=2.0,
    )
    if granted:
        from handlers.bag_handler import _push_bag_refresh

        await _push_bag_refresh(user_id, character_id, "mail_claim")
    return {"success": True, "granted": granted}


async def delete_mail(character_id: str, mail_id: str) -> bool:
    r = await utils.async_mongo_operation(
        lambda: _mails_col.delete_one({"character_id": character_id, "mail_id": mail_id}),
        timeout=2.0,
    )
    return r.deleted_count > 0
