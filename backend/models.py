"""
ORM models — one class per former MongoDB collection.

Timestamps are kept as ISO-8601 strings (VARCHAR) rather than native DATETIME,
on purpose: the original app compares/sorts timestamps as strings (e.g. reset
token expiry, `sort("created_at", -1)`), and ISO-8601 strings sort identically
to their chronological order. This keeps all that logic working unchanged.
If you want native DATETIME later, it's a mechanical follow-up migration.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import JSON, ForeignKey, Index, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), index=True)
    name: Mapped[str] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")
    kyc_status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    reset_token_hash: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    reset_token_exp: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    created_at: Mapped[str] = mapped_column(String(40))


class Wallet(Base):
    __tablename__ = "wallets"

    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    balance: Mapped[float] = mapped_column(Numeric(16, 2), default=0)
    created_at: Mapped[str] = mapped_column(String(40))


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(36), index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    kyc_document: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    logo: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    created_at: Mapped[str] = mapped_column(String(40))


class Property(Base):
    __tablename__ = "properties"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    company_id: Mapped[str] = mapped_column(String(64), index=True)
    company_name: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(255))
    property_type: Mapped[str] = mapped_column(String(50))
    location: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    images: Mapped[list] = mapped_column(JSON, default=list)
    documents: Mapped[list] = mapped_column(JSON, default=list)
    total_value: Mapped[float] = mapped_column(Numeric(16, 2))
    total_shares: Mapped[int] = mapped_column()
    share_price: Mapped[float] = mapped_column(Numeric(14, 2))
    shares_sold: Mapped[int] = mapped_column(default=0)
    monthly_return_rate: Mapped[float] = mapped_column(Numeric(6, 3))
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    created_at: Mapped[str] = mapped_column(String(40), index=True)


class Holding(Base):
    __tablename__ = "holdings"
    __table_args__ = (UniqueConstraint("user_id", "property_id", name="uq_holdings_user_property"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    property_id: Mapped[str] = mapped_column(String(36), index=True)
    shares: Mapped[int] = mapped_column(default=0)
    invested: Mapped[float] = mapped_column(Numeric(16, 2), default=0)
    created_at: Mapped[str] = mapped_column(String(40))


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    type: Mapped[str] = mapped_column(String(40))
    amount: Mapped[float] = mapped_column(Numeric(16, 2))
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[str] = mapped_column(String(40), index=True)


class RazorpayOrder(Base):
    __tablename__ = "razorpay_orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    order_id: Mapped[str] = mapped_column(String(64), unique=True)
    amount_paise: Mapped[int] = mapped_column()
    status: Mapped[str] = mapped_column(String(20), default="created")
    payment_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    signature: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    paid_at: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    created_at: Mapped[str] = mapped_column(String(40))


class MarketplaceOrder(Base):
    __tablename__ = "marketplace_orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    seller_id: Mapped[str] = mapped_column(String(36), index=True)
    buyer_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    property_id: Mapped[str] = mapped_column(String(36), index=True)
    shares: Mapped[int] = mapped_column()
    price_per_share: Mapped[float] = mapped_column(Numeric(14, 2))
    order_type: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)
    created_at: Mapped[str] = mapped_column(String(40), index=True)
    filled_at: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)


class Withdrawal(Base):
    __tablename__ = "withdrawals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    amount: Mapped[float] = mapped_column(Numeric(16, 2))
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    created_at: Mapped[str] = mapped_column(String(40), index=True)
    processed_at: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)


class InterestPayout(Base):
    __tablename__ = "interest_payouts"
    __table_args__ = (UniqueConstraint("property_id", "month", name="uq_payout_prop_month"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    property_id: Mapped[str] = mapped_column(String(36), index=True)
    month: Mapped[str] = mapped_column(String(10))
    total_paid: Mapped[float] = mapped_column(Numeric(16, 2))
    investors: Mapped[int] = mapped_column()
    created_at: Mapped[str] = mapped_column(String(40), index=True)


class KycDoc(Base):
    __tablename__ = "kyc_docs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    doc_type: Mapped[str] = mapped_column(String(30))
    document: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String(40), index=True)


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    action: Mapped[str] = mapped_column(String(50))
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[str] = mapped_column(String(40), index=True)
