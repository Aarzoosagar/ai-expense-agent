from datetime import date
from decimal import Decimal

from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.orm import Session

from ..models import Expense
from .money import q2


def _filters(user_id: int, start, end, category, q, min_amount, max_amount):
    conds = [Expense.user_id == user_id]
    if start:
        conds.append(Expense.expense_date >= start)
    if end:
        conds.append(Expense.expense_date <= end)
    if category:
        conds.append(Expense.category == category)
    if q:
        like = f"%{q.strip().lower()}%"
        conds.append(or_(func.lower(Expense.description).like(like), func.lower(Expense.category).like(like)))
    if min_amount is not None:
        conds.append(Expense.amount >= min_amount)
    if max_amount is not None:
        conds.append(Expense.amount <= max_amount)
    return conds


def list_expenses(
    db: Session,
    user_id: int,
    *,
    start: date | None = None,
    end: date | None = None,
    category: str | None = None,
    q: str | None = None,
    min_amount: Decimal | None = None,
    max_amount: Decimal | None = None,
    sort_by: str = "date",
    order: str = "desc",
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Expense], int, Decimal]:
    conds = _filters(user_id, start, end, category, q, min_amount, max_amount)
    total, total_amount = db.execute(
        select(func.count(Expense.id), func.coalesce(func.sum(Expense.amount), 0)).where(*conds)
    ).one()

    direction = asc if order == "asc" else desc
    primary = Expense.amount if sort_by == "amount" else Expense.expense_date
    stmt = (
        select(Expense)
        .where(*conds)
        .order_by(direction(primary), direction(Expense.id))
        .offset(max(page - 1, 0) * page_size)
        .limit(page_size)
    )
    return list(db.scalars(stmt)), int(total), q2(total_amount)


def get_expense(db: Session, user_id: int, expense_id: int) -> Expense | None:
    e = db.get(Expense, expense_id)
    return e if e is not None and e.user_id == user_id else None


def create_expense(
    db: Session, user_id: int, *, amount: Decimal, category: str, description: str, expense_date: date
) -> Expense:
    e = Expense(user_id=user_id, amount=q2(amount), category=category, description=description.strip(), expense_date=expense_date)
    db.add(e)
    db.commit()
    db.refresh(e)
    return e


def update_expense(db: Session, expense: Expense, **fields) -> Expense:
    for key in ("amount", "category", "description", "expense_date"):
        if key in fields and fields[key] is not None:
            val = q2(fields[key]) if key == "amount" else fields[key]
            setattr(expense, key, val.strip() if isinstance(val, str) else val)
    db.commit()
    db.refresh(expense)
    return expense


def delete_expense(db: Session, expense: Expense) -> None:
    db.delete(expense)
    db.commit()


def serialize(e: Expense) -> dict:
    return {
        "id": e.id,
        "amount": float(e.amount),
        "category": e.category,
        "description": e.description,
        "expense_date": e.expense_date.isoformat(),
    }
