import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import Base, engine, get_db
from models import Market
from schemas import MarketCreate, MarketResponse, MarketUpdate


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title="Private Polymarket API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to your frontend domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/markets", response_model=list[MarketResponse])
async def list_markets(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Market).order_by(Market.created_at.desc()))
    return result.scalars().all()


@app.post("/markets", response_model=MarketResponse, status_code=201)
async def create_market(data: MarketCreate, db: AsyncSession = Depends(get_db)):
    market = Market(**data.model_dump())
    db.add(market)
    await db.commit()
    await db.refresh(market)
    return market


# NOTE: this route must be defined before /markets/{id} to avoid
# FastAPI treating "by-invite" as an ID param
@app.get("/markets/by-invite/{invite_code}", response_model=MarketResponse)
async def get_market_by_invite_code(
    invite_code: str, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Market).where(Market.invite_code == invite_code.upper())
    )
    market = result.scalar_one_or_none()
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    return market


@app.get("/markets/{id}", response_model=MarketResponse)
async def get_market(id: str, db: AsyncSession = Depends(get_db)):
    try:
        market_id = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid market ID")
    result = await db.execute(select(Market).where(Market.id == market_id))
    market = result.scalar_one_or_none()
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    return market


@app.patch("/markets/{id}", response_model=MarketResponse)
async def update_market(
    id: str, data: MarketUpdate, db: AsyncSession = Depends(get_db)
):
    try:
        market_id = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid market ID")
    result = await db.execute(select(Market).where(Market.id == market_id))
    market = result.scalar_one_or_none()
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(market, field, value)
    await db.commit()
    await db.refresh(market)
    return market


@app.delete("/markets/{id}", status_code=204)
async def delete_market(id: str, db: AsyncSession = Depends(get_db)):
    try:
        market_id = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid market ID")
    result = await db.execute(select(Market).where(Market.id == market_id))
    market = result.scalar_one_or_none()
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    await db.delete(market)
    await db.commit()
