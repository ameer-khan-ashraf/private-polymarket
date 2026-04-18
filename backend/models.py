import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, Float, String, Text, TIMESTAMP, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Market(Base):
    __tablename__ = "markets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    chain_market_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    creator_address: Mapped[str] = mapped_column(String(42), nullable=False)
    resolution_time: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    resolved: Mapped[Optional[bool]] = mapped_column(Boolean, default=False)
    outcome: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    side_a_label: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    side_b_label: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    invite_code: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, index=True
    )
    min_stake: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    max_stake: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now()
    )
