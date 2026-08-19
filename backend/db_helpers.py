"""
Small helpers that replace Mongo-isms ($inc, upsert, projections) with the
equivalent safe SQL patterns.
"""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import inspect, select, update
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.ext.asyncio import AsyncSession

from models import Holding, Wallet

_DECIMAL_FIELDS = {
    "balance", "total_value", "share_price", "invested", "amount",
    "price_per_share", "monthly_return_rate", "total_paid",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def to_dict(obj) -> Optional[dict]:
    """Convert a single ORM instance to a plain dict, coercing Decimal -> float
    (mirrors the plain-dict responses the Mongo version returned)."""
    if obj is None:
        return None
    d = {c.key: getattr(obj, c.key) for c in inspect(obj).mapper.column_attrs}
    for k, v in d.items():
        if isinstance(v, Decimal):
            d[k] = float(v)
    return d


def to_dicts(objs) -> list:
    return [to_dict(o) for o in objs]


async def get_or_create_wallet(session: AsyncSession, user_id: str) -> Wallet:
    w = await session.get(Wallet, user_id)
    if w:
        return w
    w = Wallet(user_id=user_id, balance=0, created_at=now_iso())
    session.add(w)
    await session.flush()
    return w


async def credit_wallet(session: AsyncSession, user_id: str, amount) -> None:
    """Atomic balance += amount, creating the wallet row if it doesn't exist yet.
    Equivalent to Mongo's `update_one(..., {"$inc": ...}, upsert=True)`."""
    stmt = (
        mysql_insert(Wallet)
        .values(user_id=user_id, balance=amount, created_at=now_iso())
        .on_duplicate_key_update(balance=Wallet.balance + amount)
    )
    await session.execute(stmt)


async def debit_wallet_if_sufficient(session: AsyncSession, user_id: str, amount) -> bool:
    """Atomic balance -= amount, but only if balance >= amount.
    Returns True if the debit succeeded. Prevents the race condition an
    unconditional check-then-update would have under concurrent requests.

    execution_options(synchronize_session=False): we never read the stale
    ORM object back out of the identity map after this, so we skip SQLAlchemy's
    in-Python "sync the session" step. Skipping it also sidesteps a real bug:
    that step evaluates `Wallet.balance - amount` in Python, and MySQL NUMERIC
    columns come back as decimal.Decimal, which can't be mixed with a plain
    float `amount` (raises TypeError) if the row happens to already be loaded
    in the session's identity map.
    """
    stmt = (
        update(Wallet)
        .where(Wallet.user_id == user_id, Wallet.balance >= amount)
        .values(balance=Wallet.balance - amount)
        .execution_options(synchronize_session=False)
    )
    result = await session.execute(stmt)
    return result.rowcount > 0


async def upsert_holding_inc(
    session: AsyncSession, holding_id: str, user_id: str, property_id: str,
    shares_delta: int, invested_delta,
) -> None:
    """Equivalent to Mongo's holdings upsert with $inc + $setOnInsert."""
    stmt = (
        mysql_insert(Holding)
        .values(
            id=holding_id, user_id=user_id, property_id=property_id,
            shares=shares_delta, invested=invested_delta, created_at=now_iso(),
        )
        .on_duplicate_key_update(
            shares=Holding.shares + shares_delta,
            invested=Holding.invested + invested_delta,
        )
    )
    await session.execute(stmt.execution_options(synchronize_session=False))
