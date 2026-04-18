import os
from urllib.parse import urlparse, urlunparse

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = os.environ["DATABASE_URL"]

# Normalize URL scheme for asyncpg driver
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://") and "+asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# asyncpg doesn't accept libpq query params (sslmode, channel_binding, etc.)
# Strip all query params and pass SSL via connect_args instead
parsed = urlparse(DATABASE_URL)
DATABASE_URL = urlunparse(parsed._replace(query=""))

engine = create_async_engine(
    DATABASE_URL,
    connect_args={"ssl": "require"},
    echo=False,
    pool_pre_ping=True,
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
