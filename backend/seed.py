"""Seed demo data for PropShare — a demo company, approved properties, one investor.
Run with: python3 seed.py  (after MYSQL_URL etc. are set in backend/.env)
"""
import asyncio
import uuid
from datetime import datetime, timezone

from pwdlib import PasswordHash
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import Base, engine
from models import Company, Property, User, Wallet

pwd = PasswordHash.recommended()

IMG1 = "https://images.unsplash.com/photo-1619218070141-bcfeb8b93074?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwyfHxwcmVtaXVtJTIwbW9kZXJuJTIwYXJjaGl0ZWN0dXJlJTIwYnVpbGRpbmclMjBleHRlcmlvciUyMGRhcmt8ZW58MHx8fHwxNzg1NTAzMDgxfDA&ixlib=rb-4.1.0&q=85"
IMG2 = "https://images.unsplash.com/photo-1643175517006-4a1bd8ad37cb?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwzfHxwcmVtaXVtJTIwbW9kZXJuJTIwYXJjaGl0ZWN0dXJlJTIwYnVpbGRpbmclMjBleHRlcmlvciUyMGRhcmt8ZW58MHx8fHwxNzg1NTAzMDgxfDA&ixlib=rb-4.1.0&q=85"
IMG3 = "https://images.unsplash.com/photo-1724582586495-d050726cf354?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODl8MHwxfHNlYXJjaHwyfHxsdXh1cnklMjBpbnRlcmlvciUyMGxpdmluZyUyMHJvb20lMjBuaWdodHxlbnwwfHx8fDE3ODU1MDMwODB8MA&ixlib=rb-4.1.0&q=85"


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def nid() -> str:
    return str(uuid.uuid4())


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSession(engine) as session:
        company_email = "company@propshare.com"
        inv_email = "investor@propshare.com"

        # --- seed company user + company profile ---
        company_user = (await session.execute(select(User).where(User.email == company_email))).scalar_one_or_none()
        if not company_user:
            cid = nid()
            company_user = User(
                id=cid, email=company_email, password_hash=pwd.hash("Company@123"),
                role="Company", name="Skyline Estates Owner", phone=None,
                status="active", kyc_status="verified", created_at=now(),
            )
            session.add(company_user)
            session.add(Wallet(user_id=cid, balance=0, created_at=now()))
            await session.flush()

        company = (await session.execute(select(Company).where(Company.owner_id == company_user.id))).scalar_one_or_none()
        if not company:
            company = Company(
                id=nid(), owner_id=company_user.id, name="Skyline Estates",
                description="Premium properties in Mumbai, Bangalore & Dubai.",
                kyc_document=None, logo=None, status="approved", created_at=now(),
            )
            session.add(company)
            await session.flush()
        else:
            company.status = "approved"

        # --- seed investor ---
        inv_user = (await session.execute(select(User).where(User.email == inv_email))).scalar_one_or_none()
        if not inv_user:
            iid = nid()
            session.add(User(
                id=iid, email=inv_email, password_hash=pwd.hash("Invest@123"),
                role="Investor", name="Priya Sharma", phone=None,
                status="active", kyc_status="verified", created_at=now(),
            ))
            session.add(Wallet(user_id=iid, balance=500000, created_at=now()))

        # --- seed properties (only if fewer than 3 exist for the company) ---
        existing = (await session.execute(
            select(func.count()).select_from(Property).where(Property.company_id == company.id)
        )).scalar_one()
        if existing < 3:
            props = [
                Property(
                    id=nid(), company_id=company.id, company_name=company.name,
                    name="The Crescent Tower", property_type="Residential",
                    location="Bandra West, Mumbai",
                    description="44-storey premium residential tower with sea view apartments, sky lounges, and a rooftop infinity pool. Fully leased with an anchor 3-year corporate contract.",
                    images=[IMG1], documents=[],
                    total_value=250000000, total_shares=5000, share_price=50000,
                    shares_sold=1250, monthly_return_rate=1.4,
                    status="approved", created_at=now(),
                ),
                Property(
                    id=nid(), company_id=company.id, company_name=company.name,
                    name="Aurum Business Bay", property_type="Commercial",
                    location="Cyber Hub, Gurgaon",
                    description="Grade-A commercial office tower leased to Fortune 500 tenants. 12% net operating income yield with escalation clauses.",
                    images=[IMG2], documents=[],
                    total_value=500000000, total_shares=10000, share_price=50000,
                    shares_sold=4200, monthly_return_rate=1.1,
                    status="approved", created_at=now(),
                ),
                Property(
                    id=nid(), company_id=company.id, company_name=company.name,
                    name="Palm Serenity Villas", property_type="Residential",
                    location="Palm Jumeirah, Dubai",
                    description="Curated collection of 12 beachfront villas on Palm Jumeirah. Managed as a luxury short-term rental portfolio.",
                    images=[IMG3], documents=[],
                    total_value=350000000, total_shares=7000, share_price=50000,
                    shares_sold=850, monthly_return_rate=1.6,
                    status="approved", created_at=now(),
                ),
            ]
            session.add_all(props)

        await session.commit()

    print("Seed OK")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
