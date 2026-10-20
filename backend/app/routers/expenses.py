from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..categories import CATEGORIES, normalize_category
from ..database import get_db
from ..models import User
from ..schemas import ExpenseCreate, ExpenseOut, ExpensePage, ExpenseUpdate
from ..services import expenses as svc
from ..services.dates import resolve_range, today

router = APIRouter(prefix="/expenses", tags=["expenses"])


@router.get("/categories")
def categories():
    return CATEGORIES


@router.get("", response_model=ExpensePage)
def list_expenses(
    q: str | None = None,
    category: str | None = None,
    period: str | None = Query(None, description="Named period, e.g. this_month, last_7_days (ignored if explicit dates are given)"),
    start_date: date | None = None,
    end_date: date | None = None,
    sort_by: Literal["date", "amount"] = "date",
    order: Literal["asc", "desc"] = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cat = None
    if category:
        cat = normalize_category(category)
        if cat is None:
            raise HTTPException(422, "Unknown category")
    start, end = start_date, end_date
    if period and not (start_date or end_date):
        try:
            r = resolve_range(period)
        except ValueError as e:
            raise HTTPException(422, str(e)) from e
        start, end = r.start, r.end
    rows, total, total_amount = svc.list_expenses(
        db, user.id, start=start, end=end, category=cat, q=q, sort_by=sort_by, order=order, page=page, page_size=page_size
    )
    return ExpensePage(items=rows, total=total, page=page, page_size=page_size, total_amount=total_amount)  # type: ignore[arg-type]


@router.post("", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(body: ExpenseCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if body.expense_date > today():
        raise HTTPException(422, "Expense date cannot be in the future")
    return svc.create_expense(
        db, user.id, amount=body.amount, category=body.category, description=body.description, expense_date=body.expense_date
    )


@router.put("/{expense_id}", response_model=ExpenseOut)
def update_expense(expense_id: int, body: ExpenseUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    e = svc.get_expense(db, user.id, expense_id)
    if e is None:
        raise HTTPException(404, "Expense not found")
    if body.expense_date and body.expense_date > today():
        raise HTTPException(422, "Expense date cannot be in the future")
    return svc.update_expense(db, e, **body.model_dump(exclude_unset=True))


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(expense_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    e = svc.get_expense(db, user.id, expense_id)
    if e is None:
        raise HTTPException(404, "Expense not found")
    svc.delete_expense(db, e)
