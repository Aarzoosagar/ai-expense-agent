from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..categories import normalize_category
from ..database import get_db
from ..models import User
from ..services import analytics, budgets as budget_service
from ..services.dates import PERIODS, DateRange, previous_range, resolve_range, today
from ..services.money import pct_change

router = APIRouter(prefix="/analytics", tags=["analytics"])


def date_range(
    period: str | None = Query(None, description=f"One of {', '.join(PERIODS)}"),
    start_date: date | None = None,
    end_date: date | None = None,
) -> DateRange:
    try:
        return resolve_range(period, start_date, end_date)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e


def _cat(category: str | None) -> str | None:
    if not category:
        return None
    c = normalize_category(category)
    if c is None:
        raise HTTPException(422, "Unknown category")
    return c


@router.get("/summary")
def summary(r: DateRange = Depends(date_range), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cur = analytics.summary(db, user.id, r)
    prev_r = previous_range(r)
    prev = analytics.summary(db, user.id, prev_r)
    return {
        **cur,
        "previous": {"range": prev_r.to_dict(), "total": prev["total"], "count": prev["count"], "average_daily": prev["average_daily"]},
        "change_percent": pct_change(cur["total"], prev["total"]),
    }


@router.get("/category-breakdown")
def category_breakdown(r: DateRange = Depends(date_range), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return {"range": r.to_dict(), "categories": analytics.by_category(db, user.id, r)}


@router.get("/trend")
def trend(
    granularity: Literal["day", "week", "month"] = "day",
    category: str | None = None,
    r: DateRange = Depends(date_range),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return {"range": r.to_dict(), "granularity": granularity, "points": analytics.trend(db, user.id, r, granularity, _cat(category))}


@router.get("/top-expenses")
def top_expenses(
    limit: int = Query(5, ge=1, le=20),
    category: str | None = None,
    r: DateRange = Depends(date_range),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return {"range": r.to_dict(), "items": analytics.top_expenses(db, user.id, r, limit, _cat(category))}


@router.get("/compare")
def compare(
    category: str | None = None,
    r: DateRange = Depends(date_range),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Selected range vs the comparable previous period (this month vs last month by default)."""
    return analytics.compare(db, user.id, r, previous_range(r), _cat(category))


@router.get("/month-over-month")
def month_over_month(months: int = Query(6, ge=2, le=24), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = today()
    start = t.replace(day=1)
    for _ in range(months - 1):
        start = (start - timedelta(days=1)).replace(day=1)
    r = DateRange(start, t, f"Last {months} months")
    return {"range": r.to_dict(), "points": analytics.trend(db, user.id, r, "month")}


@router.get("/budget-vs-actual")
def budget_vs_actual(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return {"items": budget_service.budget_vs_actual(db, user.id)}


@router.get("/insights")
def insights(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return {"insights": analytics.insights(db, user.id)}
