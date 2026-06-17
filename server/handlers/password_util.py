"""
密码哈希工具（bcrypt，兼容历史明文密码）
"""
import bcrypt

_BCRYPT_PREFIX = "$2"


def hash_password(plain: str) -> str:
    if not plain:
        return plain
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, stored: str) -> bool:
    if not stored or not plain:
        return False
    if stored.startswith(_BCRYPT_PREFIX):
        try:
            return bcrypt.checkpw(plain.encode("utf-8"), stored.encode("utf-8"))
        except Exception:
            return False
    return stored == plain


def needs_rehash(stored: str) -> bool:
    return bool(stored) and not stored.startswith(_BCRYPT_PREFIX)
