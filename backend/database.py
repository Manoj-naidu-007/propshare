"""
Database engine/session setup — MySQL via SQLAlchemy 2.0 async ORM.
Replaces the old Motor (MongoDB) client.
"""
import os
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MYSQL_USER = os.environ["MYSQL_USER"]
MYSQL_PASSWORD = quote_plus(os.environ["MYSQL_PASSWORD"])  # escapes special chars like @ : /
MYSQL_HOST = os.environ.get("MYSQL_HOST", "localhost")
MYSQL_PORT = os.environ.get("MYSQL_PORT", "3306")
MYSQL_DB = os.environ["MYSQL_DB"]

MYSQL_URL = (
    f"mysql+aiomysql://{MYSQL_USER}:{MYSQL_PASSWORD}"
    f"@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}"
)

engine = create_async_engine(
    MYSQL_URL,
    pool_pre_ping=True,   # avoids "MySQL server has gone away" on idle connections
    pool_recycle=1800,
    echo=False,
)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_db():
    """FastAPI dependency: yields one AsyncSession per request."""
    async with SessionLocal() as session:
        yield session