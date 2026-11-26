"""Internal, stateless purchase projections for the web application."""

import os
from dataclasses import asdict
from datetime import date, datetime, timedelta
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Request
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, ConfigDict, Field
from starlette.responses import JSONResponse

from app import auth, simulator
from app.installment_planning import MAX_INSTALLMENTS

router = APIRouter(prefix="/_internal", include_in_schema=False)
Money = Annotated[int, Field(strict=True, ge=0, le=999_999_999)]
PositiveMoney = Annotated[int, Field(strict=True, gt=0, le=999_999_999)]


class Purchase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_due_on: str = Field(pattern=r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")
    cash_price_cents: PositiveMoney
    down_payment_cents: Money = 0
    installment_cents: PositiveMoney
    installment_count: int = Field(strict=True, ge=1, le=MAX_INSTALLMENTS)
    rate_bps: int = Field(strict=True, ge=simulator.MIN_RATE_BPS, le=simulator.MAX_RATE_BPS)
    initial_cash_cents: Money | None = None


@router.post("/simulator")
def calculate(request: Request, payload: Purchase):
    if os.getenv("BALSAVE_AUTH_SECRET"):
        auth.require_user(request, auth.require_internal(request))

    today = datetime.now(ZoneInfo("America/Sao_Paulo")).date()
    try:
        first_due_on = date.fromisoformat(payload.first_due_on)
    except ValueError:
        raise auth.error(422, "Invalid first due date") from None
    if not today <= first_due_on <= today + timedelta(days=3650):
        raise auth.error(422, "First due date is outside the supported period")

    result = simulator.simulate(
        purchase_on=today, **payload.model_dump(exclude={"first_due_on"}), first_due_on=first_due_on,
    )
    return JSONResponse(jsonable_encoder(asdict(result)), headers=auth.NO_STORE)
