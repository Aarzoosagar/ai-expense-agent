"""Deterministic financial calculations. Every number shown to a user or the LLM comes from here."""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Expense
from .dates import DateRange, elapsed_days, previous_range, today
from .expenses import serialize
from .money import D, inr, pct, pct_change, q2


def _base(user_id: int, r: DateRange, category: str | None = None):
    conds = [Expense.user_id == user_id, Expense.expense_date >= r.start, Expense.expense_date <= r.end]
    if category:
        conds.append(Expense.category == category)
    return conds


def summary(db: Session, user_id: int, r: DateRange, category: str | None = None, *, ref: date | None = None) -> dict:
    total, count = db.execute(
        select(func.coalesce(func.sum(Expense.amount), 0), func.count(Expense.id)).where(*_base(user_id, r, category))
    ).one()
    total = q2(total)
    n_days = elapsed_days(r, ref=ref)
    cats = by_category(db, user_id, r)
    top = cats[0] if cats and not category else None
    return {
        "range": r.to_dict(),
        "category": category,
        "total": float(total),
        "count": int(count),
        "average_transaction": float(q2(total / count)) if count else 0.0,
        "average_daily": float(q2(total / n_days)),
        "days_counted": n_days,
        "top_category": top,
    }


def by_category(db: Session, user_id: int, r: DateRange) -> list[dict]:
    rows = db.execute(
        select(Expense.category, func.sum(Expense.amount), func.count(Expense.id))
        .where(*_base(user_id, r))
        .group_by(Expense.category)
    ).all()
    grand = sum((q2(t) for _, t, _ in rows), Decimal("0"))
    out = [
        {"category": c, "total": float(q2(t)), "count": int(n), "percent": pct(t, grand)} for c, t, n in rows
    ]
    out.sort(key=lambda x: x["total"], reverse=True)
    return out


def _daily_totals(db: Session, user_id: int, r: DateRange, category: str | None = None) -> dict[date, Decimal]:
    rows = db.execute(
        select(Expense.expense_date, func.sum(Expense.amount))
        .where(*_base(user_id, r, category))
        .group_by(Expense.expense_date)
    ).all()
    return {d: q2(t) for d, t in rows}


def trend(db: Session, user_id: int, r: DateRange, granularity: str = "day", category: str | None = None) -> list[dict]:
    daily = _daily_totals(db, user_id, r, category)
    buckets: dict[date, Decimal] = defaultdict(lambda: Decimal("0"))

    def key(d: date) -> date:
        if granularity == "week":
            return d - timedelta(days=d.weekday())
        if granularity == "month":
            return d.replace(day=1)
        return d

    # pre-fill so charts have no gaps
    cur = r.start
    while cur <= r.end:
        buckets[key(cur)] += Decimal("0")
        cur += timedelta(days=1)
    for d, t in daily.items():
        buckets[key(d)] += t

    out = []
    for k in sorted(buckets):
        if granularity == "month":
            label = k.strftime("%b %Y")
        elif granularity == "week":
            label = f"{k.day} {k.strftime('%b')}"
        else:
            label = f"{k.day} {k.strftime('%b')}"
        out.append({"period": k.isoformat(), "label": label, "total": float(buckets[k])})
    return out


def top_expenses(db: Session, user_id: int, r: DateRange, limit: int = 5, category: str | None = None) -> list[dict]:
    stmt = (
        select(Expense)
        .where(*_base(user_id, r, category))
        .order_by(Expense.amount.desc(), Expense.expense_date.desc(), Expense.id.desc())
        .limit(limit)
    )
    return [serialize(e) for e in db.scalars(stmt)]


def top_category(db: Session, user_id: int, r: DateRange) -> dict | None:
    cats = by_category(db, user_id, r)
    return cats[0] if cats else None


def compare(
    db: Session, user_id: int, a: DateRange, b: DateRange, category: str | None = None
) -> dict:
    """Compare period A (usually the newer) against period B."""
    sa = summary(db, user_id, a, category)
    sb = summary(db, user_id, b, category)
    diff = q2(D(sa["total"]) - D(sb["total"]))
    cat_a = {c["category"]: D(c["total"]) for c in by_category(db, user_id, a)}
    cat_b = {c["category"]: D(c["total"]) for c in by_category(db, user_id, b)}
    deltas = []
    for c in set(cat_a) | set(cat_b):
        x, y = cat_a.get(c, Decimal("0")), cat_b.get(c, Decimal("0"))
        if category and c != category:
            continue
        deltas.append(
            {
                "category": c,
                "a": float(x),
                "b": float(y),
                "difference": float(q2(x - y)),
                "percent_change": pct_change(x, y),
            }
        )
    deltas.sort(key=lambda d: abs(d["difference"]), reverse=True)
    return {
        "a": {"range": a.to_dict(), "total": sa["total"], "count": sa["count"], "average_daily": sa["average_daily"]},
        "b": {"range": b.to_dict(), "total": sb["total"], "count": sb["count"], "average_daily": sb["average_daily"]},
        "difference": float(diff),
        "percent_change": pct_change(sa["total"], sb["total"]),
        "direction": "up" if diff > 0 else "down" if diff < 0 else "flat",
        "categories": deltas,
        "category": category,
    }


def insights(db: Session, user_id: int, *, ref: date | None = None) -> list[dict]:
    """Rule-based insights. Each sentence is built from computed values, never generated freeform."""
    from . import budgets as budget_service
    from .dates import days_in_month, resolve_range

    t = ref or today()
    cur = resolve_range("this_month", ref=t)
    prev = previous_range(cur, ref=t)
    out: list[dict] = []

    s_cur = summary(db, user_id, cur, ref=t)
    if s_cur["count"] == 0:
        return [
            {
                "kind": "empty",
                "severity": "info",
                "title": "No spending yet this month",
                "text": "Add your first expense from the chat or the quick-add button and insights will appear here.",
            }
        ]

    cmp = compare(db, user_id, cur, prev)
    if cmp["b"]["total"] > 0 and cmp["percent_change"] is not None:
        up = cmp["difference"] > 0
        out.append(
            {
                "kind": "month_over_month",
                "severity": "warning" if up and cmp["percent_change"] >= 20 else "info" if up else "positive",
                "title": (
                    "Spending is on par with last month"
                    if abs(cmp["percent_change"]) < 1
                    else f"Spending is {'up' if up else 'down'} {abs(cmp['percent_change']):.0f}% vs last month"
                ),
                "text": (
                    f"You've spent {inr(cmp['a']['total'])} in the first {cur.days} days of this month "
                    f"compared with {inr(cmp['b']['total'])} over the same days of last month "
                    f"({'+' if up else '-'}{inr(abs(cmp['difference']))})."
                    if cmp["difference"] != 0
                    else f"Spending matches last month's pace at {inr(cmp['a']['total'])}."
                ),
            }
        )

    movers = [c for c in cmp["categories"] if c["difference"] != 0]
    ups = [c for c in movers if c["difference"] > 0]
    downs = [c for c in movers if c["difference"] < 0]
    if ups:
        c = max(ups, key=lambda x: x["difference"])
        extra = f" ({c['percent_change']:+.0f}%)" if c["percent_change"] is not None else " (new this month)"
        out.append(
            {
                "kind": "category_increase",
                "severity": "warning",
                "title": f"{c['category']} increased the most",
                "text": f"{c['category']} is up {inr(c['difference'])}{extra}: {inr(c['a'])} now vs {inr(c['b'])} in the same span last month.",
            }
        )
    if downs:
        c = min(downs, key=lambda x: x["difference"])
        out.append(
            {
                "kind": "category_decrease",
                "severity": "positive",
                "title": f"{c['category']} is down",
                "text": f"You've cut {c['category']} by {inr(abs(c['difference']))} compared with the same span last month.",
            }
        )

    tc = s_cur["top_category"]
    if tc:
        out.append(
            {
                "kind": "top_category",
                "severity": "info",
                "title": f"{tc['category']} leads your spending",
                "text": f"{inr(tc['total'])} — {tc['percent']:.0f}% of this month's spending across {tc['count']} transaction{'s' if tc['count'] != 1 else ''}.",
            }
        )

    big = top_expenses(db, user_id, cur, 1)
    if big:
        b = big[0]
        out.append(
            {
                "kind": "largest_expense",
                "severity": "info",
                "title": "Largest expense this month",
                "text": f"{inr(b['amount'])} on {b['description'] or b['category']} ({b['category']}, {date.fromisoformat(b['expense_date']).strftime('%d %b')}).",
            }
        )

    # Budget pace
    status = budget_service.status(db, user_id, ref=t)
    for item in status["items"]:
        name = "Overall budget" if item["is_overall"] else f"{item['category']} budget"
        if item["status"] == "over":
            out.insert(
                0,
                {
                    "kind": "budget_over",
                    "severity": "danger",
                    "title": f"{name} exceeded",
                    "text": f"You've spent {inr(item['spent'])} against a limit of {inr(item['amount'])} — {inr(abs(item['remaining']))} over.",
                },
            )
        elif item["status"] == "warning":
            out.insert(
                0,
                {
                    "kind": "budget_warning",
                    "severity": "warning",
                    "title": f"{name} is {item['percent']:.0f}% used",
                    "text": f"Only {inr(item['remaining'])} left of {inr(item['amount'])} with {days_in_month(t) - t.day} days to go.",
                },
            )
        elif item["is_overall"]:
            n = elapsed_days(cur, ref=t)
            projected = q2(D(item["spent"]) / n * days_in_month(t))
            if projected > D(item["amount"]):
                out.insert(
                    0,
                    {
                        "kind": "budget_pace",
                        "severity": "warning",
                        "title": "On pace to exceed your monthly budget",
                        "text": f"At {inr(s_cur['average_daily'])}/day you'll reach about {inr(projected)} by month end vs a {inr(item['amount'])} budget.",
                    },
                )
    return out[:6]
