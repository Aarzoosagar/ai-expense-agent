from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import User
from ..schemas import BudgetUpsert
from ..services import budgets as svc

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("")
def get_budgets(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Budget utilisation for the current month."""
    return svc.status(db, user.id)


@router.put("")
def upsert_budget(body: BudgetUpsert, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    svc.upsert_budget(db, user.id, body.category, body.amount)
    return svc.status(db, user.id)


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(budget_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not svc.delete_budget(db, user.id, budget_id):
        raise HTTPException(404, "Budget not found")
