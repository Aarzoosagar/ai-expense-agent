from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..categories import OVERALL
from ..models import Budget
from . import analytics
from .dates import DateRange, month_end, month_start, today
from .money import D, pct, q2

WARNING_THRESHOLD = 80.0


def get_budget(db: Session, user_id: int, category: str | None) -> Budget | None:
    return db.scalar(select(Budget).where(Budget.user_id == user_id, Budget.category == (category or OVERALL)))


def upsert_budget(db: Session, user_id: int, category: str | None, amount: Decimal) -> tuple[Budget, bool]:
    """Create or update. Returns (budget, created)."""
    b = get_budget(db, user_id, category)
    created = b is None
    if b is None:
        b = Budget(user_id=user_id, category=category or OVERALL, amount=q2(amount))
        db.add(b)
    else:
        b.amount = q2(amount)
    db.commit()
    db.refresh(b)
    return b, created


def delete_budget(db: Session, user_id: int, budget_id: int) -> bool:
    b = db.get(Budget, budget_id)
    if b is None or b.user_id != user_id:
        return False
    db.delete(b)
    db.commit()
    return True


def _item(b: Budget, spent: Decimal) -> dict:
    amount = D(b.amount)
    percent = pct(spent, amount)
    remaining = q2(amount - spent)
    status = "over" if spent > amount else "warning" if percent >= WARNING_THRESHOLD else "ok"
    return {
        "id": b.id,
        "category": b.category,
        "is_overall": b.category == OVERALL,
        "amount": float(amount),
        "spent": float(q2(spent)),
        "remaining": float(remaining),
        "percent": percent,
        "status": status,
    }


def status(db: Session, user_id: int, *, ref: date | None = None) -> dict:
    """Budget utilisation for the calendar month containing `ref` (default: today)."""
    t = ref or today()
    r = DateRange(month_start(t), month_end(t), t.strftime("%B %Y"))
    cats = {c["category"]: D(c["total"]) for c in analytics.by_category(db, user_id, r)}
    total_spent = sum(cats.values(), Decimal("0"))
    budgets = list(db.scalars(select(Budget).where(Budget.user_id == user_id)))
    items = [_item(b, total_spent if b.category == OVERALL else cats.get(b.category, Decimal("0"))) for b in budgets]
    items.sort(key=lambda i: (not i["is_overall"], -i["percent"]))
    overall = next((i for i in items if i["is_overall"]), None)
    return {
        "month": t.strftime("%B %Y"),
        "total_spent": float(q2(total_spent)),
        "overall": overall,
        "items": items,
    }


def budget_vs_actual(db: Session, user_id: int, *, ref: date | None = None) -> list[dict]:
    """Category-level budget vs actual for the month (categories without a budget are omitted)."""
    st = status(db, user_id, ref=ref)
    return [
        {"category": i["category"], "budget": i["amount"], "actual": i["spent"], "percent": i["percent"], "status": i["status"]}
        for i in st["items"]
    ]
