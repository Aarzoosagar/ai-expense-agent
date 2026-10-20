from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, PlainSerializer, field_validator

from .categories import CATEGORIES, normalize_category

# Money is Decimal internally and a JSON number on the wire.
Money = Annotated[Decimal, PlainSerializer(lambda v: float(v), return_type=float, when_used="json")]
MAX_AMOUNT = Decimal("100000000")


def _validate_amount(v: Decimal) -> Decimal:
    if v <= 0:
        raise ValueError("Amount must be greater than zero")
    if v > MAX_AMOUNT:
        raise ValueError("Amount is too large")
    return v.quantize(Decimal("0.01"))


def _validate_category(v: str) -> str:
    c = normalize_category(v)
    if c is None:
        raise ValueError(f"Unknown category. Use one of: {', '.join(CATEGORIES)}")
    return c


# ---------- auth ----------
class RegisterIn(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    name: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- expenses ----------
class ExpenseBase(BaseModel):
    amount: Decimal
    category: str
    description: str = Field(default="", max_length=255)
    expense_date: date

    _amount = field_validator("amount")(_validate_amount)
    _category = field_validator("category")(_validate_category)


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(BaseModel):
    amount: Decimal | None = None
    category: str | None = None
    description: str | None = Field(default=None, max_length=255)
    expense_date: date | None = None

    @field_validator("amount")
    @classmethod
    def _a(cls, v):
        return _validate_amount(v) if v is not None else v

    @field_validator("category")
    @classmethod
    def _c(cls, v):
        return _validate_category(v) if v is not None else v


class ExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    amount: Money
    category: str
    description: str
    expense_date: date
    created_at: datetime


class ExpensePage(BaseModel):
    items: list[ExpenseOut]
    total: int
    page: int
    page_size: int
    total_amount: Money


# ---------- budgets ----------
class BudgetUpsert(BaseModel):
    category: str | None = None  # None / "Overall" = overall monthly budget
    amount: Decimal

    _amount = field_validator("amount")(_validate_amount)

    @field_validator("category")
    @classmethod
    def _c(cls, v):
        if v is None or v.strip().lower() in ("overall", "total", "monthly", "all"):
            return None
        return _validate_category(v)


# ---------- chat ----------
class ChatAction(BaseModel):
    type: Literal["confirm_delete", "cancel_delete"]
    expense_id: int


class ChatIn(BaseModel):
    message: str = Field(default="", max_length=2000)
    action: ChatAction | None = None


class ChatMessageOut(BaseModel):
    id: int
    role: str
    content: str
    blocks: list | None = None
    created_at: datetime
