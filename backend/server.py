"""
PropShare — Property Share Investment Platform
FastAPI backend with JWT auth, RBAC (Admin/Company/Investor), Razorpay wallet, MySQL.
"""
import hashlib
import hmac
import os
import secrets
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import List, Optional

import httpx
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database import Base, engine, get_db
from db_helpers import (
    credit_wallet, debit_wallet_if_sufficient, get_or_create_wallet,
    now_iso, to_dict, to_dicts, upsert_holding_inc,
)
from models import (
    ActivityLog, Company, Holding, InterestPayout, KycDoc, MarketplaceOrder,
    Property, RazorpayOrder, User, Wallet, WalletTransaction, Withdrawal,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------------- config ----------------
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = os.environ.get("JWT_ALG", "HS256")
ACCESS_TOKEN_MINUTES = int(os.environ.get("ACCESS_TOKEN_MINUTES", "1440"))
RESET_TOKEN_MINUTES = int(os.environ.get("RESET_TOKEN_MINUTES", "30"))
ADMIN_EMAIL = os.environ["ADMIN_EMAIL"].lower()
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]
RAZORPAY_KEY_ID = os.environ["RAZORPAY_KEY_ID"]
RAZORPAY_KEY_SECRET = os.environ["RAZORPAY_KEY_SECRET"]
PUBLIC_BASE_URL = os.environ["PUBLIC_BASE_URL"]

# Platform commission (0.5%) — special virtual user id owns the platform wallet
PLATFORM_USER_ID = "platform_wallet"
PLATFORM_COMMISSION_RATE = 0.005

pwd = PasswordHash.recommended()


class Role(str, Enum):
    admin = "Admin"
    company = "Company"
    investor = "Investor"


# ---------------- Models (request/response) ----------------
def new_id() -> str:
    return str(uuid.uuid4())


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    role: Role = Role.investor
    name: str
    phone: Optional[str] = None
    company_name: Optional[str] = None  # required if role=Company


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str


class CompanyIn(BaseModel):
    name: str
    description: Optional[str] = ""
    kyc_document: Optional[str] = None  # base64
    logo: Optional[str] = None  # base64


class PropertyIn(BaseModel):
    name: str
    property_type: str
    location: str
    description: str
    images: List[str] = []  # base64
    documents: List[str] = []  # base64
    total_value: float
    total_shares: int
    share_price: float
    monthly_return_rate: float  # % e.g. 1.2


class PropertyUpdateIn(BaseModel):
    name: Optional[str] = None
    property_type: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    total_value: Optional[float] = None
    total_shares: Optional[int] = None
    share_price: Optional[float] = None
    monthly_return_rate: Optional[float] = None
    status: Optional[str] = None  # pending|approved|rejected|frozen


class BuySharesIn(BaseModel):
    property_id: str
    shares: int = Field(gt=0)


class DepositOrderIn(BaseModel):
    amount: float = Field(gt=0)


class VerifyPaymentIn(BaseModel):
    order_id: str
    payment_id: str
    signature: str


class WithdrawIn(BaseModel):
    amount: float = Field(gt=0)


class MarketplaceOrderIn(BaseModel):
    property_id: str
    shares: int = Field(gt=0)
    price_per_share: float = Field(gt=0)
    order_type: str  # "sell" only (user lists own shares)


class InterestDistributeIn(BaseModel):
    property_id: str
    month: str  # e.g. "2026-02"


class AdminUserUpdateIn(BaseModel):
    status: Optional[str] = None  # active|suspended
    name: Optional[str] = None
    role: Optional[Role] = None


class MockDepositIn(BaseModel):
    amount: float = Field(gt=0)


# ---------------- helpers ----------------
def hash_pw(p: str) -> str:
    return pwd.hash(p)


def verify_pw(p: str, h: str) -> bool:
    try:
        return pwd.verify(p, h)
    except Exception:
        return False


def make_token(user: dict) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES)
    payload = {"sub": user["id"], "email": user["email"], "role": user["role"], "exp": exp}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def token_hash(t: str) -> str:
    return hashlib.sha256((t + JWT_SECRET).encode()).hexdigest()


def clean_doc(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return None
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    doc.pop("reset_token_hash", None)
    doc.pop("reset_token_exp", None)
    return doc


async def log_activity(session: AsyncSession, user_id: str, action: str, meta: Optional[dict] = None):
    session.add(ActivityLog(id=new_id(), user_id=user_id, action=action, meta=meta or {}, created_at=now_iso()))


# ---------------- auth ----------------
security_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    session: AsyncSession = Depends(get_db),
) -> dict:
    if not creds:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid or expired token")
    user = await session.get(User, payload["sub"])
    if not user:
        raise HTTPException(401, "User not found")
    user_d = to_dict(user)
    user_d.pop("password_hash", None)
    if user_d.get("status") == "suspended":
        raise HTTPException(403, "Account suspended")
    return user_d


def require_roles(*allowed: str):
    async def guard(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in allowed:
            raise HTTPException(403, "Forbidden")
        return user
    return guard


# ---------------- app + router ----------------
@asynccontextmanager
async def lifespan(_: FastAPI):
    # create tables (indexes/uniques are declared on the models themselves)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSession(engine) as session:
        # seed admin
        existing_admin = (await session.execute(select(User).where(User.email == ADMIN_EMAIL))).scalar_one_or_none()
        if not existing_admin:
            admin_id = new_id()
            session.add(User(
                id=admin_id, email=ADMIN_EMAIL, password_hash=hash_pw(ADMIN_PASSWORD),
                role=Role.admin.value, name="System Admin", phone=None,
                status="active", kyc_status="verified", created_at=now_iso(),
            ))
            session.add(Wallet(user_id=admin_id, balance=0, created_at=now_iso()))
        # ensure platform wallet exists
        platform_wallet = await session.get(Wallet, PLATFORM_USER_ID)
        if not platform_wallet:
            session.add(Wallet(user_id=PLATFORM_USER_ID, balance=0, created_at=now_iso()))
        await session.commit()

    yield
    await engine.dispose()


app = FastAPI(title="PropShare API", lifespan=lifespan)
api = APIRouter(prefix="/api")


# ---------------- auth routes ----------------
@api.post("/auth/register")
async def register(body: RegisterIn, session: AsyncSession = Depends(get_db)):
    email = body.email.lower()
    if body.role == Role.admin:
        raise HTTPException(400, "Admin role cannot self-register")
    existing = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if existing:
        raise HTTPException(409, "Email already registered")

    user_id = new_id()
    user_row = User(
        id=user_id, email=email, password_hash=hash_pw(body.password), role=body.role.value,
        name=body.name, phone=body.phone, status="active", kyc_status="pending", created_at=now_iso(),
    )
    session.add(user_row)
    session.add(Wallet(user_id=user_id, balance=0, created_at=now_iso()))

    if body.role == Role.company:
        cname = body.company_name or body.name
        session.add(Company(
            id=new_id(), owner_id=user_id, name=cname, description="",
            kyc_document=None, logo=None, status="pending", created_at=now_iso(),
        ))

    await log_activity(session, user_id, "register", {"role": body.role.value})
    await session.commit()

    user = to_dict(await session.get(User, user_id))
    return {"access_token": make_token(user), "token_type": "bearer", "user": clean_doc(user)}


@api.post("/auth/login")
async def login(body: LoginIn, session: AsyncSession = Depends(get_db)):
    email = body.email.lower()
    user_row = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if not user_row or not verify_pw(body.password, user_row.password_hash):
        verify_pw(body.password, hash_pw("dummy"))  # dummy verify to reduce timing leak
        raise HTTPException(401, "Incorrect email or password")
    if user_row.status == "suspended":
        raise HTTPException(403, "Account suspended")
    await log_activity(session, user_row.id, "login")
    await session.commit()
    user = to_dict(user_row)
    return {"access_token": make_token(user), "token_type": "bearer", "user": clean_doc(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return clean_doc(user)


@api.post("/auth/change-password")
async def change_password(body: ChangePasswordIn, user: dict = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    full = await session.get(User, user["id"])
    if not verify_pw(body.current_password, full.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    full.password_hash = hash_pw(body.new_password)
    await session.commit()
    return {"ok": True}


@api.post("/auth/forgot-password")
async def forgot_password(body: ForgotPasswordIn, session: AsyncSession = Depends(get_db)):
    user_row = (await session.execute(select(User).where(User.email == body.email.lower()))).scalar_one_or_none()
    reset_token = None
    if user_row:
        raw = secrets.token_urlsafe(24)
        user_row.reset_token_hash = token_hash(raw)
        user_row.reset_token_exp = (datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_MINUTES)).isoformat()
        await session.commit()
        reset_token = raw
    # In dev, return the token so mobile can reset without email
    return {"ok": True, "reset_token": reset_token}


@api.post("/auth/reset-password")
async def reset_password(body: ResetPasswordIn, session: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc).isoformat()
    user_row = (await session.execute(
        select(User).where(User.reset_token_hash == token_hash(body.token), User.reset_token_exp > now)
    )).scalar_one_or_none()
    if not user_row:
        raise HTTPException(400, "Invalid or expired token")
    user_row.password_hash = hash_pw(body.new_password)
    user_row.reset_token_hash = None
    user_row.reset_token_exp = None
    await session.commit()
    return {"ok": True}


# ---------------- users (admin) ----------------
@api.get("/admin/users")
async def admin_list_users(admin: dict = Depends(require_roles(Role.admin.value)), session: AsyncSession = Depends(get_db)):
    rows = (await session.execute(select(User))).scalars().all()
    return [clean_doc(to_dict(r)) for r in rows]


@api.patch("/admin/users/{user_id}")
async def admin_update_user(user_id: str, body: AdminUserUpdateIn, admin: dict = Depends(require_roles(Role.admin.value)), session: AsyncSession = Depends(get_db)):
    update_vals = {k: (v.value if hasattr(v, "value") else v) for k, v in body.model_dump(exclude_none=True).items()}
    if not update_vals:
        return {"ok": True}
    result = await session.execute(update(User).where(User.id == user_id).values(**update_vals))
    if result.rowcount == 0:
        raise HTTPException(404, "User not found")
    await session.commit()
    return {"ok": True}


@api.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin: dict = Depends(require_roles(Role.admin.value)), session: AsyncSession = Depends(get_db)):
    if user_id == admin["id"]:
        raise HTTPException(400, "Cannot delete self")
    await session.execute(delete(User).where(User.id == user_id))
    await session.execute(delete(Wallet).where(Wallet.user_id == user_id))
    await session.commit()
    return {"ok": True}


@api.get("/admin/users/{user_id}/portfolio")
async def admin_user_portfolio(user_id: str, admin: dict = Depends(require_roles(Role.admin.value)), session: AsyncSession = Depends(get_db)):
    return await get_portfolio_data(session, user_id)


# ---------------- companies ----------------
@api.get("/companies")
async def list_companies(user: dict = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    stmt = select(Company)
    if user["role"] != Role.admin.value:
        stmt = stmt.where(Company.status == "approved")
    rows = (await session.execute(stmt)).scalars().all()
    return to_dicts(rows)


@api.get("/companies/mine")
async def my_company(user: dict = Depends(require_roles(Role.company.value)), session: AsyncSession = Depends(get_db)):
    c = (await session.execute(select(Company).where(Company.owner_id == user["id"]))).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Company not found")
    return to_dict(c)


@api.patch("/companies/mine")
async def update_my_company(body: CompanyIn, user: dict = Depends(require_roles(Role.company.value)), session: AsyncSession = Depends(get_db)):
    update_vals = body.model_dump(exclude_none=True)
    await session.execute(update(Company).where(Company.owner_id == user["id"]).values(**update_vals))
    await session.commit()
    return {"ok": True}


@api.patch("/admin/companies/{company_id}")
async def admin_update_company(company_id: str, status_val: str = Query(..., alias="status"), admin: dict = Depends(require_roles(Role.admin.value)), session: AsyncSession = Depends(get_db)):
    if status_val not in ("approved", "rejected", "suspended", "pending"):
        raise HTTPException(400, "Invalid status")
    result = await session.execute(update(Company).where(Company.id == company_id).values(status=status_val))
    if result.rowcount == 0:
        raise HTTPException(404, "Company not found")
    await session.commit()
    return {"ok": True}


# ---------------- properties ----------------
@api.get("/properties")
async def list_properties(status_val: Optional[str] = Query(None, alias="status"), user: dict = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    stmt = select(Property)
    if user["role"] == Role.investor.value:
        stmt = stmt.where(Property.status == "approved")
    elif user["role"] == Role.company.value:
        c = (await session.execute(select(Company).where(Company.owner_id == user["id"]))).scalar_one_or_none()
        if not c:
            return []
        stmt = stmt.where(Property.company_id == c.id)
        if status_val:
            stmt = stmt.where(Property.status == status_val)
    else:  # admin
        if status_val:
            stmt = stmt.where(Property.status == status_val)
    stmt = stmt.order_by(Property.created_at.desc())
    rows = (await session.execute(stmt)).scalars().all()
    return to_dicts(rows)


@api.get("/properties/{prop_id}")
async def get_property(prop_id: str, user: dict = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    p = await session.get(Property, prop_id)
    if not p:
        raise HTTPException(404, "Property not found")
    if user["role"] == Role.investor.value and p.status != "approved":
        raise HTTPException(404, "Property not found")
    return to_dict(p)


@api.post("/properties")
async def create_property(body: PropertyIn, user: dict = Depends(require_roles(Role.company.value, Role.admin.value)), session: AsyncSession = Depends(get_db)):
    if user["role"] == Role.company.value:
        c = (await session.execute(select(Company).where(Company.owner_id == user["id"]))).scalar_one_or_none()
        if not c:
            raise HTTPException(400, "Company profile missing")
        if c.status != "approved":
            raise HTTPException(403, "Company not approved yet")
        company_id = c.id
        company_name = c.name
    else:
        company_id = "platform"
        company_name = "PropShare Platform"

    pid = new_id()
    row = Property(
        id=pid, company_id=company_id, company_name=company_name, name=body.name,
        property_type=body.property_type, location=body.location, description=body.description,
        images=body.images, documents=body.documents, total_value=body.total_value,
        total_shares=body.total_shares, share_price=body.share_price, shares_sold=0,
        monthly_return_rate=body.monthly_return_rate,
        status="approved" if user["role"] == Role.admin.value else "pending",
        created_at=now_iso(),
    )
    session.add(row)
    await log_activity(session, user["id"], "create_property", {"property_id": pid})
    await session.commit()
    return to_dict(row)


@api.patch("/properties/{prop_id}")
async def update_property(prop_id: str, body: PropertyUpdateIn, user: dict = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    p = await session.get(Property, prop_id)
    if not p:
        raise HTTPException(404, "Property not found")

    update_vals = body.model_dump(exclude_none=True)
    if "status" in update_vals and user["role"] != Role.admin.value:
        raise HTTPException(403, "Only admin can change status")
    if user["role"] == Role.company.value:
        c = (await session.execute(select(Company).where(Company.owner_id == user["id"]))).scalar_one_or_none()
        if not c or p.company_id != c.id:
            raise HTTPException(403, "Not your property")

    if update_vals:
        await session.execute(update(Property).where(Property.id == prop_id).values(**update_vals))
        await session.commit()
    return {"ok": True}


@api.delete("/properties/{prop_id}")
async def delete_property(prop_id: str, admin: dict = Depends(require_roles(Role.admin.value)), session: AsyncSession = Depends(get_db)):
    await session.execute(delete(Property).where(Property.id == prop_id))
    await session.commit()
    return {"ok": True}


# ---------------- investments / portfolio ----------------
@api.post("/investments/buy")
async def buy_shares(body: BuySharesIn, user: dict = Depends(require_roles(Role.investor.value)), session: AsyncSession = Depends(get_db)):
    prop = await session.get(Property, body.property_id)
    if not prop or prop.status != "approved":
        raise HTTPException(404, "Property not available")
    available = prop.total_shares - prop.shares_sold
    if body.shares > available:
        raise HTTPException(400, f"Only {available} shares available")

    total_cost = body.shares * float(prop.share_price)
    ok = await debit_wallet_if_sufficient(session, user["id"], total_cost)
    if not ok:
        raise HTTPException(400, "Insufficient wallet balance")

    commission = round(total_cost * PLATFORM_COMMISSION_RATE, 2)
    company_amount = round(total_cost - commission, 2)

    company = await session.get(Company, prop.company_id)
    if company:
        await credit_wallet(session, company.owner_id, company_amount)
    await credit_wallet(session, PLATFORM_USER_ID, commission)

    await session.execute(
        update(Property).where(Property.id == prop.id)
        .values(shares_sold=Property.shares_sold + body.shares)
        .execution_options(synchronize_session=False)
    )
    await upsert_holding_inc(session, new_id(), user["id"], prop.id, body.shares, total_cost)

    session.add(WalletTransaction(
        id=new_id(), user_id=user["id"], type="share_purchase", amount=-total_cost,
        meta={"property_id": prop.id, "shares": body.shares}, created_at=now_iso(),
    ))
    if company:
        session.add(WalletTransaction(
            id=new_id(), user_id=company.owner_id, type="share_sale_received", amount=company_amount,
            meta={"property_id": prop.id, "shares": body.shares, "buyer_id": user["id"], "gross": total_cost, "commission": commission},
            created_at=now_iso(),
        ))
    session.add(WalletTransaction(
        id=new_id(), user_id=PLATFORM_USER_ID, type="commission_purchase", amount=commission,
        meta={"property_id": prop.id, "shares": body.shares, "buyer_id": user["id"], "gross": total_cost},
        created_at=now_iso(),
    ))
    await log_activity(session, user["id"], "buy_shares", {"property_id": prop.id, "shares": body.shares, "cost": total_cost})
    await session.commit()
    return {"ok": True, "shares": body.shares, "cost": total_cost}


async def get_portfolio_data(session: AsyncSession, user_id: str) -> dict:
    holdings = (await session.execute(select(Holding).where(Holding.user_id == user_id))).scalars().all()
    enriched = []
    total_invested = 0.0
    total_current = 0.0
    total_returns = 0.0
    for h in holdings:
        prop = await session.get(Property, h.property_id)
        if not prop:
            continue
        current_value = h.shares * float(prop.share_price)
        interest_total = (await session.execute(
            select(func.coalesce(func.sum(WalletTransaction.amount), 0)).where(
                WalletTransaction.user_id == user_id,
                WalletTransaction.type == "interest",
                func.json_unquote(func.json_extract(WalletTransaction.meta, "$.property_id")) == h.property_id,
            )
        )).scalar_one()
        interest = float(interest_total or 0.0)
        total_invested += float(h.invested)
        total_current += current_value
        total_returns += interest
        h_d = to_dict(h)
        h_d["property"] = to_dict(prop)
        h_d["current_value"] = current_value
        h_d["returns_earned"] = interest
        h_d["pnl"] = current_value + interest - float(h.invested)
        enriched.append(h_d)
    return {
        "holdings": enriched,
        "total_invested": total_invested,
        "total_current_value": total_current,
        "total_returns": total_returns,
        "pnl": total_current + total_returns - total_invested,
    }


@api.get("/portfolio")
async def my_portfolio(user: dict = Depends(require_roles(Role.investor.value)), session: AsyncSession = Depends(get_db)):
    return await get_portfolio_data(session, user["id"])


# ---------------- wallet ----------------
@api.get("/wallet")
async def get_wallet(user: dict = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    w = await get_or_create_wallet(session, user["id"])
    await session.commit()
    return to_dict(w)


@api.get("/wallet/transactions")
async def wallet_transactions(user: dict = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    rows = (await session.execute(
        select(WalletTransaction).where(WalletTransaction.user_id == user["id"]).order_by(WalletTransaction.created_at.desc())
    )).scalars().all()
    return to_dicts(rows)


@api.post("/wallet/mock-deposit")
async def mock_deposit(body: MockDepositIn, user: dict = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    """Simulated deposit for testing without going through Razorpay."""
    await credit_wallet(session, user["id"], body.amount)
    session.add(WalletTransaction(
        id=new_id(), user_id=user["id"], type="deposit_mock", amount=body.amount, meta={}, created_at=now_iso(),
    ))
    await session.commit()
    return {"ok": True}


@api.post("/wallet/withdraw")
async def request_withdraw(body: WithdrawIn, user: dict = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    ok = await debit_wallet_if_sufficient(session, user["id"], body.amount)
    if not ok:
        raise HTTPException(400, "Insufficient balance")
    req_id = new_id()
    session.add(Withdrawal(id=req_id, user_id=user["id"], amount=body.amount, status="pending", created_at=now_iso()))
    session.add(WalletTransaction(
        id=new_id(), user_id=user["id"], type="withdrawal_requested", amount=-body.amount,
        meta={"request_id": req_id, "status": "pending"}, created_at=now_iso(),
    ))
    await session.commit()
    return {"ok": True, "request_id": req_id}


@api.get("/admin/withdrawals")
async def admin_list_withdrawals(admin: dict = Depends(require_roles(Role.admin.value)), session: AsyncSession = Depends(get_db)):
    rows = (await session.execute(select(Withdrawal).order_by(Withdrawal.created_at.desc()))).scalars().all()
    return to_dicts(rows)


@api.post("/admin/withdrawals/{req_id}/approve")
async def admin_approve_withdrawal(req_id: str, admin: dict = Depends(require_roles(Role.admin.value)), session: AsyncSession = Depends(get_db)):
    r = await session.get(Withdrawal, req_id)
    if not r:
        raise HTTPException(404, "Not found")
    if r.status != "pending":
        raise HTTPException(400, "Already processed")
    r.status = "approved"
    r.processed_at = now_iso()
    await session.commit()
    return {"ok": True}


@api.post("/admin/withdrawals/{req_id}/reject")
async def admin_reject_withdrawal(req_id: str, admin: dict = Depends(require_roles(Role.admin.value)), session: AsyncSession = Depends(get_db)):
    r = await session.get(Withdrawal, req_id)
    if not r:
        raise HTTPException(404, "Not found")
    if r.status != "pending":
        raise HTTPException(400, "Already processed")
    r.status = "rejected"
    r.processed_at = now_iso()
    await credit_wallet(session, r.user_id, r.amount)
    session.add(WalletTransaction(
        id=new_id(), user_id=r.user_id, type="withdrawal_refunded", amount=r.amount,
        meta={"request_id": req_id}, created_at=now_iso(),
    ))
    await session.commit()
    return {"ok": True}


# ---------------- Razorpay ----------------
@api.post("/wallet/deposit/order")
async def create_deposit_order(body: DepositOrderIn, user: dict = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    amount_paise = int(round(body.amount * 100))
    payload = {
        "amount": amount_paise, "currency": "INR",
        "receipt": f"rcpt_{uuid.uuid4().hex[:20]}",
        "notes": {"user_id": user["id"], "type": "wallet_deposit"},
    }
    async with httpx.AsyncClient(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET), timeout=15) as client:
        r = await client.post("https://api.razorpay.com/v1/orders", json=payload)
    if r.status_code >= 400:
        raise HTTPException(400, f"Razorpay error: {r.text}")
    order = r.json()
    session.add(RazorpayOrder(
        id=new_id(), user_id=user["id"], order_id=order["id"], amount_paise=amount_paise,
        status="created", created_at=now_iso(),
    ))
    await session.commit()
    return {
        "order_id": order["id"], "amount_paise": amount_paise, "key_id": RAZORPAY_KEY_ID,
        "checkout_url": f"{PUBLIC_BASE_URL}/api/pay/{order['id']}",
    }


def _verify_signature(order_id: str, payment_id: str, signature: str) -> bool:
    msg = f"{order_id}|{payment_id}".encode()
    digest = hmac.new(RAZORPAY_KEY_SECRET.encode(), msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature)


@api.post("/wallet/deposit/verify")
async def verify_deposit(body: VerifyPaymentIn, session: AsyncSession = Depends(get_db)):
    if not _verify_signature(body.order_id, body.payment_id, body.signature):
        raise HTTPException(400, "Invalid signature")
    result = await session.execute(
        update(RazorpayOrder)
        .where(RazorpayOrder.order_id == body.order_id, RazorpayOrder.status != "paid")
        .values(status="paid", payment_id=body.payment_id, signature=body.signature, paid_at=now_iso())
    )
    if result.rowcount == 0:
        await session.commit()
        return {"ok": True, "idempotent": True}
    order = (await session.execute(select(RazorpayOrder).where(RazorpayOrder.order_id == body.order_id))).scalar_one()
    amount = order.amount_paise / 100.0
    await credit_wallet(session, order.user_id, amount)
    session.add(WalletTransaction(
        id=new_id(), user_id=order.user_id, type="deposit", amount=amount,
        meta={"order_id": body.order_id, "payment_id": body.payment_id}, created_at=now_iso(),
    ))
    await session.commit()
    return {"ok": True, "credited": amount}


@app.get("/api/pay/{order_id}", response_class=HTMLResponse)
async def hosted_checkout(order_id: str, session: AsyncSession = Depends(get_db)):
    order = (await session.execute(select(RazorpayOrder).where(RazorpayOrder.order_id == order_id))).scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Order not found")
    return f"""
<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>PropShare Deposit</title>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<style>
  body {{ margin:0; background:#121215; color:#fff; font-family:-apple-system,BlinkMacSystemFont,sans-serif; height:100vh; display:flex; align-items:center; justify-content:center; }}
  .card {{ background:#1C1C21; padding:32px; border-radius:20px; text-align:center; border:1px solid #2A2A32; max-width:320px; }}
  h1 {{ color:#D4AF37; font-size:22px; margin:0 0 8px; }}
  .amt {{ font-size:40px; font-weight:600; margin:16px 0; }}
  button {{ background:#D4AF37; color:#121215; border:0; padding:14px 24px; border-radius:12px; font-size:16px; font-weight:600; cursor:pointer; width:100%; }}
  #status {{ margin-top:16px; color:#A0A0A8; font-size:14px; }}
</style></head><body>
<div class="card">
<h1>PropShare Wallet</h1>
<div style="color:#A0A0A8;font-size:14px;">Add funds securely</div>
<div class="amt">₹{order.amount_paise // 100}</div>
<button id="pay">Pay with Razorpay</button>
<div id="status"></div>
</div>
<script>
const setStatus = (m,ok) => {{ const el=document.getElementById('status'); el.style.color = ok?'#2A9D8F':'#C1121F'; el.innerText=m; }};
const options = {{
  key: "{RAZORPAY_KEY_ID}",
  amount: "{order.amount_paise}",
  currency: "INR",
  name: "PropShare",
  description: "Wallet Deposit",
  order_id: "{order_id}",
  theme: {{ color: "#D4AF37" }},
  handler: async function (res) {{
    setStatus('Verifying payment…');
    try {{
      const r = await fetch("{PUBLIC_BASE_URL}/api/wallet/deposit/verify", {{
        method: "POST", headers: {{ "Content-Type": "application/json" }},
        body: JSON.stringify({{ order_id: res.razorpay_order_id, payment_id: res.razorpay_payment_id, signature: res.razorpay_signature }})
      }});
      if (r.ok) {{
        setStatus('Payment successful! Return to the app.', true);
        window.location.href = 'propshare://payment-success?order_id={order_id}';
      }} else setStatus('Verification failed. Please contact support.');
    }} catch (e) {{ setStatus('Network error. Try again.'); }}
  }},
  modal: {{ ondismiss: function() {{ setStatus('Payment cancelled.'); }} }}
}};
document.getElementById('pay').onclick = () => new Razorpay(options).open();
</script></body></html>
"""


# ---------------- marketplace ----------------
@api.get("/marketplace")
async def list_marketplace(user: dict = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    orders = (await session.execute(
        select(MarketplaceOrder).where(MarketplaceOrder.status == "open").order_by(MarketplaceOrder.created_at.desc())
    )).scalars().all()
    out = []
    for o in orders:
        o_d = to_dict(o)
        p = await session.get(Property, o.property_id)
        p_d = to_dict(p)
        if p_d:
            p_d.pop("documents", None)
        o_d["property"] = p_d
        out.append(o_d)
    return out


@api.post("/marketplace")
async def create_marketplace_order(body: MarketplaceOrderIn, user: dict = Depends(require_roles(Role.investor.value)), session: AsyncSession = Depends(get_db)):
    if body.order_type != "sell":
        raise HTTPException(400, "Only sell orders supported")
    h = (await session.execute(
        select(Holding).where(Holding.user_id == user["id"], Holding.property_id == body.property_id)
    )).scalar_one_or_none()
    if not h or h.shares < body.shares:
        raise HTTPException(400, "Insufficient shares to sell")
    oid = new_id()
    row = MarketplaceOrder(
        id=oid, seller_id=user["id"], property_id=body.property_id, shares=body.shares,
        price_per_share=body.price_per_share, order_type="sell", status="open", created_at=now_iso(),
    )
    session.add(row)
    await session.commit()
    return to_dict(row)


@api.post("/marketplace/{order_id}/accept")
async def accept_marketplace_order(order_id: str, user: dict = Depends(require_roles(Role.investor.value)), session: AsyncSession = Depends(get_db)):
    o = await session.get(MarketplaceOrder, order_id)
    if not o or o.status != "open":
        raise HTTPException(404, "Order not available")
    if o.seller_id == user["id"]:
        raise HTTPException(400, "Cannot buy your own order")
    total = o.shares * float(o.price_per_share)

    ok = await debit_wallet_if_sufficient(session, user["id"], total)
    if not ok:
        raise HTTPException(400, "Insufficient wallet balance")

    commission = round(total * PLATFORM_COMMISSION_RATE, 2)
    seller_amount = round(total - commission, 2)

    seller_holding = (await session.execute(
        select(Holding).where(Holding.user_id == o.seller_id, Holding.property_id == o.property_id)
    )).scalar_one_or_none()
    if not seller_holding or seller_holding.shares < o.shares:
        # refund the buyer's debit since the trade can't complete
        await credit_wallet(session, user["id"], total)
        await session.commit()
        raise HTTPException(400, "Seller no longer has enough shares")

    await credit_wallet(session, o.seller_id, seller_amount)
    await credit_wallet(session, PLATFORM_USER_ID, commission)

    invested_delta = -(o.shares * (float(seller_holding.invested) / max(seller_holding.shares, 1)))
    await session.execute(
        update(Holding)
        .where(Holding.user_id == o.seller_id, Holding.property_id == o.property_id)
        .values(shares=Holding.shares - o.shares, invested=Holding.invested + invested_delta)
        .execution_options(synchronize_session=False)
    )
    await upsert_holding_inc(session, new_id(), user["id"], o.property_id, o.shares, total)

    o.status = "filled"
    o.buyer_id = user["id"]
    o.filled_at = now_iso()

    for uid, amt, t in [(user["id"], -total, "marketplace_buy"), (o.seller_id, seller_amount, "marketplace_sell")]:
        session.add(WalletTransaction(
            id=new_id(), user_id=uid, type=t, amount=amt,
            meta={"order_id": order_id, "property_id": o.property_id, "shares": o.shares, "gross": total, "commission": commission},
            created_at=now_iso(),
        ))
    session.add(WalletTransaction(
        id=new_id(), user_id=PLATFORM_USER_ID, type="commission_marketplace", amount=commission,
        meta={"order_id": order_id, "property_id": o.property_id, "shares": o.shares, "gross": total},
        created_at=now_iso(),
    ))
    await session.commit()
    return {"ok": True}


# ---------------- interest ----------------
@api.post("/admin/interest/distribute")
async def admin_distribute_interest(body: InterestDistributeIn, admin: dict = Depends(require_roles(Role.admin.value)), session: AsyncSession = Depends(get_db)):
    prop = await session.get(Property, body.property_id)
    if not prop:
        raise HTTPException(404, "Property not found")
    existing = (await session.execute(
        select(InterestPayout).where(InterestPayout.property_id == prop.id, InterestPayout.month == body.month)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(400, "Already distributed for this month")
    holdings = (await session.execute(select(Holding).where(Holding.property_id == prop.id))).scalars().all()
    total_paid = 0.0
    for h in holdings:
        if h.shares <= 0:
            continue
        payout = (float(prop.share_price) * h.shares) * (float(prop.monthly_return_rate) / 100.0)
        if payout <= 0:
            continue
        await credit_wallet(session, h.user_id, payout)
        session.add(WalletTransaction(
            id=new_id(), user_id=h.user_id, type="interest", amount=payout,
            meta={"property_id": prop.id, "month": body.month, "shares": h.shares}, created_at=now_iso(),
        ))
        total_paid += payout
    session.add(InterestPayout(
        id=new_id(), property_id=prop.id, month=body.month, total_paid=total_paid,
        investors=len(holdings), created_at=now_iso(),
    ))
    await session.commit()
    return {"ok": True, "total_paid": total_paid, "investors": len(holdings)}


@api.get("/admin/interest/history")
async def admin_interest_history(admin: dict = Depends(require_roles(Role.admin.value)), session: AsyncSession = Depends(get_db)):
    rows = (await session.execute(select(InterestPayout).order_by(InterestPayout.created_at.desc()).limit(200))).scalars().all()
    return to_dicts(rows)


# ---------------- admin dashboard ----------------
@api.get("/admin/dashboard")
async def admin_dashboard(admin: dict = Depends(require_roles(Role.admin.value)), session: AsyncSession = Depends(get_db)):
    total_users = (await session.execute(select(func.count()).select_from(User).where(User.role == Role.investor.value))).scalar_one()
    total_companies = (await session.execute(select(func.count()).select_from(Company))).scalar_one()
    total_properties = (await session.execute(select(func.count()).select_from(Property))).scalar_one()
    approved_properties = (await session.execute(select(func.count()).select_from(Property).where(Property.status == "approved"))).scalar_one()
    pending_properties = (await session.execute(select(func.count()).select_from(Property).where(Property.status == "pending"))).scalar_one()
    pending_companies = (await session.execute(select(func.count()).select_from(Company).where(Company.status == "pending"))).scalar_one()
    pending_withdrawals = (await session.execute(select(func.count()).select_from(Withdrawal).where(Withdrawal.status == "pending"))).scalar_one()

    props = (await session.execute(select(Property.total_shares, Property.shares_sold))).all()
    total_listed_shares = sum(p[0] for p in props)
    total_shares_sold = sum(p[1] for p in props)

    total_investments = float((await session.execute(select(func.coalesce(func.sum(Holding.invested), 0)))).scalar_one() or 0.0)
    total_wallet_balance = float((await session.execute(select(func.coalesce(func.sum(Wallet.balance), 0)))).scalar_one() or 0.0)

    platform_wallet = await session.get(Wallet, PLATFORM_USER_ID)
    pending_kyc = (await session.execute(select(func.count()).select_from(User).where(User.kyc_status == "submitted"))).scalar_one()

    recent_rows = (await session.execute(select(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(10))).scalars().all()

    return {
        "total_users": total_users,
        "total_companies": total_companies,
        "total_properties": total_properties,
        "approved_properties": approved_properties,
        "pending_properties": pending_properties,
        "pending_companies": pending_companies,
        "pending_withdrawals": pending_withdrawals,
        "total_listed_shares": total_listed_shares,
        "total_shares_sold": total_shares_sold,
        "total_pending_shares": total_listed_shares - total_shares_sold,
        "total_investments": total_investments,
        "total_wallet_balance": total_wallet_balance,
        "platform_earnings": float(platform_wallet.balance) if platform_wallet else 0.0,
        "pending_kyc": pending_kyc,
        "recent_activities": to_dicts(recent_rows),
    }


@api.get("/admin/platform-wallet")
async def admin_platform_wallet(admin: dict = Depends(require_roles(Role.admin.value)), session: AsyncSession = Depends(get_db)):
    w = await session.get(Wallet, PLATFORM_USER_ID)
    tx = (await session.execute(
        select(WalletTransaction).where(WalletTransaction.user_id == PLATFORM_USER_ID).order_by(WalletTransaction.created_at.desc()).limit(200)
    )).scalars().all()
    return {"balance": float(w.balance) if w else 0.0, "transactions": to_dicts(tx)}


# ---------------- KYC ----------------
class KycUploadIn(BaseModel):
    document: str  # base64 image
    doc_type: str = "id_proof"  # id_proof | company_kyc


@api.post("/kyc/upload")
async def kyc_upload(body: KycUploadIn, user: dict = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    if user["role"] == Role.admin.value:
        raise HTTPException(400, "Admin does not need KYC")
    session.add(KycDoc(id=new_id(), user_id=user["id"], doc_type=body.doc_type, document=body.document, created_at=now_iso()))
    await session.execute(update(User).where(User.id == user["id"]).values(kyc_status="submitted"))
    await log_activity(session, user["id"], "kyc_submit", {"doc_type": body.doc_type})
    await session.commit()
    return {"ok": True, "kyc_status": "submitted"}


@api.get("/kyc/mine")
async def kyc_mine(user: dict = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    docs = (await session.execute(
        select(KycDoc).where(KycDoc.user_id == user["id"]).order_by(KycDoc.created_at.desc()).limit(20)
    )).scalars().all()
    return {"kyc_status": user.get("kyc_status", "pending"), "documents": to_dicts(docs)}


@api.get("/admin/kyc/pending")
async def admin_kyc_pending(admin: dict = Depends(require_roles(Role.admin.value)), session: AsyncSession = Depends(get_db)):
    rows = (await session.execute(select(User).where(User.kyc_status == "submitted"))).scalars().all()
    users = [clean_doc(to_dict(u)) for u in rows]
    for u in users:
        latest = (await session.execute(
            select(KycDoc).where(KycDoc.user_id == u["id"]).order_by(KycDoc.created_at.desc()).limit(1)
        )).scalar_one_or_none()
        u["latest_doc"] = to_dict(latest)
    return users


@api.post("/admin/kyc/{user_id}/verify")
async def admin_kyc_verify(user_id: str, admin: dict = Depends(require_roles(Role.admin.value)), session: AsyncSession = Depends(get_db)):
    result = await session.execute(update(User).where(User.id == user_id).values(kyc_status="verified"))
    if result.rowcount == 0:
        raise HTTPException(404, "User not found")
    await log_activity(session, admin["id"], "kyc_verified", {"user_id": user_id})
    await session.commit()
    return {"ok": True}


@api.post("/admin/kyc/{user_id}/reject")
async def admin_kyc_reject(user_id: str, admin: dict = Depends(require_roles(Role.admin.value)), session: AsyncSession = Depends(get_db)):
    result = await session.execute(update(User).where(User.id == user_id).values(kyc_status="rejected"))
    if result.rowcount == 0:
        raise HTTPException(404, "User not found")
    await log_activity(session, admin["id"], "kyc_rejected", {"user_id": user_id})
    await session.commit()
    return {"ok": True}


@api.get("/admin/logs")
async def admin_logs(admin: dict = Depends(require_roles(Role.admin.value)), session: AsyncSession = Depends(get_db)):
    rows = (await session.execute(select(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(200))).scalars().all()
    return to_dicts(rows)


# ---------------- company dashboard ----------------
@api.get("/company/dashboard")
async def company_dashboard(user: dict = Depends(require_roles(Role.company.value)), session: AsyncSession = Depends(get_db)):
    c = (await session.execute(select(Company).where(Company.owner_id == user["id"]))).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Company not found")
    props = (await session.execute(select(Property).where(Property.company_id == c.id))).scalars().all()
    total_shares_listed = sum(p.total_shares for p in props)
    total_shares_sold = sum(p.shares_sold for p in props)
    total_raised = sum(float(p.share_price) * p.shares_sold for p in props)
    wallet = await session.get(Wallet, user["id"])
    prop_ids = [p.id for p in props]
    investors_count = 0
    if prop_ids:
        investors = (await session.execute(
            select(func.count(func.distinct(Holding.user_id))).where(Holding.property_id.in_(prop_ids), Holding.shares > 0)
        )).scalar_one()
        investors_count = investors

    return {
        "company": to_dict(c),
        "total_properties": len(props),
        "approved_properties": len([p for p in props if p.status == "approved"]),
        "pending_properties": len([p for p in props if p.status == "pending"]),
        "total_shares_listed": total_shares_listed,
        "total_shares_sold": total_shares_sold,
        "shares_remaining": total_shares_listed - total_shares_sold,
        "total_raised": total_raised,
        "wallet_balance": float(wallet.balance) if wallet else 0.0,
        "investors_count": investors_count,
    }


# ---------------- notifications ----------------
@api.get("/notifications")
async def notifications(user: dict = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    """Simple notifications derived from user's own transactions."""
    tx = (await session.execute(
        select(WalletTransaction).where(WalletTransaction.user_id == user["id"]).order_by(WalletTransaction.created_at.desc()).limit(20)
    )).scalars().all()
    notes = []
    for t in tx:
        t_d = to_dict(t)
        msg = {
            "deposit": f"₹{t_d['amount']:.2f} deposited to your wallet",
            "deposit_mock": f"₹{t_d['amount']:.2f} added to your wallet (demo)",
            "share_purchase": f"Purchased {t_d['meta'].get('shares', 0)} shares",
            "share_sale_received": f"Received ₹{t_d['amount']:.2f} from share sale",
            "interest": f"Interest credited: ₹{t_d['amount']:.2f}",
            "withdrawal_requested": f"Withdrawal request: ₹{abs(t_d['amount']):.2f}",
            "withdrawal_refunded": f"Withdrawal refunded: ₹{t_d['amount']:.2f}",
            "marketplace_buy": "Bought shares on marketplace",
            "marketplace_sell": "Sold shares on marketplace",
        }.get(t_d["type"], t_d["type"])
        notes.append({"id": t_d["id"], "message": msg, "created_at": t_d["created_at"], "type": t_d["type"]})
    return notes


# ---------------- mount ----------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"service": "PropShare API", "status": "ok"}
