from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class MarketCreate(BaseModel):
    question_text: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    chain_market_id: int
    creator_address: str
    resolution_time: datetime
    side_a_label: Optional[str] = None
    side_b_label: Optional[str] = None
    invite_code: Optional[str] = None
    min_stake: Optional[float] = None
    max_stake: Optional[float] = None


class MarketUpdate(BaseModel):
    chain_market_id: Optional[int] = None
    description: Optional[str] = None
    resolved: Optional[bool] = None
    outcome: Optional[bool] = None
    side_a_label: Optional[str] = None
    side_b_label: Optional[str] = None
    invite_code: Optional[str] = None
    min_stake: Optional[float] = None
    max_stake: Optional[float] = None
    image_url: Optional[str] = None


class MarketResponse(BaseModel):
    id: UUID
    question_text: str
    description: Optional[str]
    image_url: Optional[str]
    chain_market_id: int
    creator_address: str
    resolution_time: datetime
    resolved: Optional[bool]
    outcome: Optional[bool]
    side_a_label: Optional[str]
    side_b_label: Optional[str]
    invite_code: Optional[str]
    min_stake: Optional[float]
    max_stake: Optional[float]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}
