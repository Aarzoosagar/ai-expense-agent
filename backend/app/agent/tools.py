"""Agent tools.

The LLM only *chooses* a tool and supplies arguments. Everything else happens here:
argument validation (pydantic), database access, arithmetic, and building the UI blocks
that the frontend renders. Tool results are the only source of numbers the model may quote.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Callable, Literal

from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..categories import CATEGORIES, OVERALL, normalize_category
from ..models import PendingAction
from ..schemas import _validate_amount
from ..services import analytics, budgets as budget_service, expenses as expense_service
from ..services.dates import PERIODS, DateRange, month_end, month_start, previous_range, resolve_range, today
from ..services.money import D, inr

PENDING_TTL = timedelta(minutes=30)


class ToolError(Exception):
    """A business-rule failure. `message` is safe to show to the user."""

    def __init__(self, message: str, *, visible: bool = True):
        super().__init__(message)
        self.message = message
        self.visible = visible


@dataclass
class ToolContext:
    db: Session
    user_id: int
    today: date = field(default_factory=today)
    turn_started: datetime = field(default_factory=lambda: datetime.now(timezone.utc).replace(tzinfo=None))


@dataclass
class ToolOutcome:
    ok: bool
    data: dict
    blocks: list[dict] = field(default_factory=list)
    terminal_message: str | None = None  # if set, the agent stops and shows this (clarify / confirm)


def _naive_utc(dt: datetime) -> datetime:
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


# ---------------------------------------------------------------- argument models
def _check_period(v: str | None) -> str | None:
    if v is None:
        return v
    v = v.strip().lower()
    if v not in PERIODS:
        raise ValueError(f"period must be one of {', '.join(PERIODS)}")
    return v


class RangeArgs(BaseModel):
    period: str | None = None
    start_date: date | None = None
    end_date: date | None = None

    _p = field_validator("period")(_check_period)

    def resolve(self, ctx: ToolContext, default: str = "this_month") -> DateRange:
        try:
            return resolve_range(self.period or default, self.start_date, self.end_date, ref=ctx.today)
        except ValueError as e:
            raise ToolError(str(e)) from e


def _category_or_error(v: str | None) -> str | None:
    if v is None or str(v).strip() == "":
        return None
    c = normalize_category(v)
    if c is None:
        raise ToolError(f"'{v}' is not a known category. Categories: {', '.join(CATEGORIES)}")
    return c


class AddExpenseArgs(BaseModel):
    amount: Decimal
    category: str
    description: str = Field(default="", max_length=255)
    expense_date: date | None = None

    _a = field_validator("amount")(_validate_amount)


class GetExpensesArgs(RangeArgs):
    category: str | None = None
    search: str | None = None
    min_amount: Decimal | None = None
    max_amount: Decimal | None = None
    sort_by: Literal["date", "amount"] = "date"
    order: Literal["asc", "desc"] = "desc"
    limit: int = Field(default=10, ge=1, le=50)


class CalculateSpendingArgs(RangeArgs):
    category: str | None = None


class TopExpensesArgs(RangeArgs):
    limit: int = Field(default=5, ge=1, le=20)
    category: str | None = None


class TopCategoryArgs(RangeArgs):
    pass


class CompareArgs(BaseModel):
    period_a: str | None = None
    start_a: date | None = None
    end_a: date | None = None
    period_b: str | None = None
    start_b: date | None = None
    end_b: date | None = None
    category: str | None = None

    _pa = field_validator("period_a")(_check_period)
    _pb = field_validator("period_b")(_check_period)


class ManageBudgetArgs(BaseModel):
    action: Literal["get", "set", "delete"]
    category: str | None = None
    amount: Decimal | None = None

    @model_validator(mode="after")
    def _check(self):
        if self.action == "set":
            if self.amount is None:
                raise ValueError("amount is required to set a budget")
            _validate_amount(self.amount)
        if self.action == "delete" and not self.category:
            raise ValueError("category is required to delete a budget (use 'Overall' for the overall monthly budget)")
        return self


class UpdateExpenseArgs(BaseModel):
    expense_id: int
    amount: Decimal | None = None
    category: str | None = None
    description: str | None = Field(default=None, max_length=255)
    expense_date: date | None = None

    @field_validator("amount")
    @classmethod
    def _a(cls, v):
        return _validate_amount(v) if v is not None else v


class DeleteExpenseArgs(BaseModel):
    expense_id: int
    confirmed: bool = False


class ClarifyArgs(BaseModel):
    question: str = Field(min_length=3, max_length=300)
    options: list[str] | None = Field(default=None, max_length=6)


# ---------------------------------------------------------------- helpers
def _expense_or_error(ctx: ToolContext, expense_id: int):
    e = expense_service.get_expense(ctx.db, ctx.user_id, expense_id)
    if e is None:
        raise ToolError(f"I couldn't find expense #{expense_id}.")
    return e


def _budget_alerts(ctx: ToolContext, category: str, on: date) -> dict:
    st = budget_service.status(ctx.db, ctx.user_id, ref=on)
    cat_item = next((i for i in st["items"] if i["category"] == category), None)
    return {"category": cat_item, "overall": st["overall"]}


# ---------------------------------------------------------------- tools
def add_expense(ctx: ToolContext, a: AddExpenseArgs) -> ToolOutcome:
    category = _category_or_error(a.category)
    if category is None:
        raise ToolError("A category is required.")
    when = a.expense_date or ctx.today
    if when > ctx.today:
        raise ToolError(f"{when.isoformat()} is in the future. Expenses can only be recorded up to today ({ctx.today.isoformat()}).")
    e = expense_service.create_expense(
        ctx.db, ctx.user_id, amount=a.amount, category=category, description=a.description, expense_date=when
    )
    month = DateRange(month_start(when), month_end(when), when.strftime("%B %Y"))
    month_total = analytics.summary(ctx.db, ctx.user_id, month)["total"]
    cat_total = analytics.summary(ctx.db, ctx.user_id, month, category)["total"]
    alerts = _budget_alerts(ctx, category, when)
    exp = expense_service.serialize(e)
    data = {
        "saved": True,
        "expense": exp,
        "month": month.label,
        "month_total_all_categories": month_total,
        "month_total_in_category": cat_total,
        "budget": alerts,
    }
    block = {
        "type": "expense_saved",
        "expense": exp,
        "month": month.label,
        "month_total": month_total,
        "category_month_total": cat_total,
        "budget": alerts["category"] or alerts["overall"],
    }
    return ToolOutcome(True, data, [block])


def get_expenses(ctx: ToolContext, a: GetExpensesArgs) -> ToolOutcome:
    r = a.resolve(ctx, default="all_time")
    category = _category_or_error(a.category)
    rows, total, total_amount = expense_service.list_expenses(
        ctx.db,
        ctx.user_id,
        start=r.start,
        end=r.end,
        category=category,
        q=a.search,
        min_amount=a.min_amount,
        max_amount=a.max_amount,
        sort_by=a.sort_by,
        order=a.order,
        page=1,
        page_size=a.limit,
    )
    items = [expense_service.serialize(e) for e in rows]
    data = {
        "range": r.to_dict(),
        "category": category,
        "matching_count": total,
        "matching_total": float(total_amount),
        "returned": len(items),
        "expenses": items,
    }
    title = f"{category} · {r.label}" if category else r.label
    block = {
        "type": "expense_list",
        "title": title,
        "range": r.to_dict(),
        "items": items,
        "count": total,
        "shown": len(items),
        "total": float(total_amount),
    }
    return ToolOutcome(True, data, [block])


def calculate_spending(ctx: ToolContext, a: CalculateSpendingArgs) -> ToolOutcome:
    r = a.resolve(ctx)
    category = _category_or_error(a.category)
    s = analytics.summary(ctx.db, ctx.user_id, r, category, ref=ctx.today)
    cats = analytics.by_category(ctx.db, ctx.user_id, r) if not category else []
    block = {"type": "spending_summary", "summary": s, "categories": cats}
    return ToolOutcome(True, {**s, "categories": cats}, [block])


def get_top_expenses(ctx: ToolContext, a: TopExpensesArgs) -> ToolOutcome:
    r = a.resolve(ctx)
    category = _category_or_error(a.category)
    items = analytics.top_expenses(ctx.db, ctx.user_id, r, a.limit, category)
    total = float(sum((D(i["amount"]) for i in items), Decimal("0")))
    block = {
        "type": "expense_list",
        "title": f"Top {len(items)} expenses · {r.label}",
        "range": r.to_dict(),
        "items": items,
        "count": len(items),
        "shown": len(items),
        "total": total,
    }
    return ToolOutcome(True, {"range": r.to_dict(), "category": category, "top_expenses": items}, [block])


def get_top_category(ctx: ToolContext, a: TopCategoryArgs) -> ToolOutcome:
    r = a.resolve(ctx)
    cats = analytics.by_category(ctx.db, ctx.user_id, r)
    top = cats[0] if cats else None
    block = {"type": "top_category", "range": r.to_dict(), "top": top, "categories": cats}
    return ToolOutcome(True, {"range": r.to_dict(), "top_category": top, "categories": cats}, [block])


def compare_spending(ctx: ToolContext, a: CompareArgs) -> ToolOutcome:
    try:
        ra = resolve_range(a.period_a or "this_month", a.start_a, a.end_a, ref=ctx.today)
        if a.period_b or a.start_b or a.end_b:
            rb = resolve_range(a.period_b, a.start_b, a.end_b, ref=ctx.today)
        else:
            rb = previous_range(ra, ref=ctx.today)
    except ValueError as e:
        raise ToolError(str(e)) from e
    category = _category_or_error(a.category)
    result = analytics.compare(ctx.db, ctx.user_id, ra, rb, category)
    return ToolOutcome(True, result, [{"type": "comparison", "data": result}])


def manage_budget(ctx: ToolContext, a: ManageBudgetArgs) -> ToolOutcome:
    cat_raw = a.category
    is_overall = cat_raw is None or str(cat_raw).strip().lower() in ("overall", "total", "monthly", "all", "")
    category = None if is_overall else _category_or_error(cat_raw)
    label = OVERALL if category is None else category

    if a.action == "set":
        assert a.amount is not None
        b, created = budget_service.upsert_budget(ctx.db, ctx.user_id, category, a.amount)
        st = budget_service.status(ctx.db, ctx.user_id, ref=ctx.today)
        item = next((i for i in st["items"] if i["id"] == b.id), None)
        data = {"saved": True, "created": created, "budget": item, "month": st["month"]}
        return ToolOutcome(True, data, [{"type": "budget_status", "action": "set", "created": created, "focus": label, "month": st["month"], "items": st["items"]}])

    if a.action == "delete":
        b = budget_service.get_budget(ctx.db, ctx.user_id, category)
        if b is None:
            raise ToolError(f"There is no {label} budget to remove.")
        budget_service.delete_budget(ctx.db, ctx.user_id, b.id)
        st = budget_service.status(ctx.db, ctx.user_id, ref=ctx.today)
        return ToolOutcome(True, {"deleted": True, "category": label}, [{"type": "budget_status", "action": "delete", "focus": label, "month": st["month"], "items": st["items"]}])

    st = budget_service.status(ctx.db, ctx.user_id, ref=ctx.today)
    items = st["items"] if (is_overall and cat_raw is None) else [i for i in st["items"] if i["category"] == label]
    data = {"month": st["month"], "total_spent_this_month": st["total_spent"], "budgets": items}
    if not items:
        data["note"] = f"No {label} budget is set." if cat_raw is not None else "No budgets are set."
    return ToolOutcome(True, data, [{"type": "budget_status", "action": "get", "focus": label if cat_raw is not None else None, "month": st["month"], "items": items}])


def update_expense(ctx: ToolContext, a: UpdateExpenseArgs) -> ToolOutcome:
    e = _expense_or_error(ctx, a.expense_id)
    category = _category_or_error(a.category)
    if a.expense_date and a.expense_date > ctx.today:
        raise ToolError("The new date is in the future.")
    if not any([a.amount, category, a.description is not None, a.expense_date]):
        raise ToolError("Nothing to update — tell me which field to change.")
    before = expense_service.serialize(e)
    expense_service.update_expense(
        ctx.db, e, amount=a.amount, category=category, description=a.description, expense_date=a.expense_date
    )
    after = expense_service.serialize(e)
    return ToolOutcome(True, {"updated": True, "before": before, "after": after}, [{"type": "expense_updated", "before": before, "after": after}])


def _pending(ctx: ToolContext, expense_id: int) -> PendingAction | None:
    return ctx.db.scalar(
        select(PendingAction)
        .where(
            PendingAction.user_id == ctx.user_id,
            PendingAction.expense_id == expense_id,
            PendingAction.kind == "delete",
            PendingAction.resolved.is_(False),
        )
        .order_by(PendingAction.id.desc())
    )


def request_delete(ctx: ToolContext, expense_id: int) -> ToolOutcome:
    e = _expense_or_error(ctx, expense_id)
    # Always issue a fresh pending action so a stale one can never be confirmed within the same turn.
    for old in ctx.db.scalars(
        select(PendingAction).where(
            PendingAction.user_id == ctx.user_id,
            PendingAction.expense_id == e.id,
            PendingAction.kind == "delete",
            PendingAction.resolved.is_(False),
        )
    ):
        old.resolved = True
    ctx.db.add(PendingAction(user_id=ctx.user_id, kind="delete", expense_id=e.id))
    ctx.db.commit()
    exp = expense_service.serialize(e)
    return ToolOutcome(
        True,
        {"deleted": False, "awaiting_user_confirmation": True, "expense": exp},
        [{"type": "confirm_delete", "expense": exp}],
        terminal_message="Please confirm — deleting an expense can't be undone.",
    )


def perform_delete(ctx: ToolContext, expense_id: int, *, require_prior_turn: bool) -> ToolOutcome:
    """Delete an expense that the user has been asked to confirm."""
    pending = _pending(ctx, expense_id)
    if pending is None:
        raise ToolError("That deletion hasn't been confirmed yet.")
    created = _naive_utc(pending.created_at)
    if datetime.now(timezone.utc).replace(tzinfo=None) - created > PENDING_TTL:
        pending.resolved = True
        ctx.db.commit()
        raise ToolError("That confirmation expired. Ask me to delete it again if you still want to.")
    if require_prior_turn and created >= ctx.turn_started:
        raise ToolError("The user hasn't had a chance to confirm yet.", visible=False)
    e = _expense_or_error(ctx, expense_id)
    exp = expense_service.serialize(e)
    expense_service.delete_expense(ctx.db, e)
    pending.resolved = True
    ctx.db.commit()
    return ToolOutcome(True, {"deleted": True, "expense": exp}, [{"type": "expense_deleted", "expense": exp}])


def cancel_delete(ctx: ToolContext, expense_id: int) -> None:
    p = _pending(ctx, expense_id)
    if p:
        p.resolved = True
        ctx.db.commit()


def delete_expense(ctx: ToolContext, a: DeleteExpenseArgs) -> ToolOutcome:
    _expense_or_error(ctx, a.expense_id)
    if not a.confirmed:
        return request_delete(ctx, a.expense_id)
    try:
        return perform_delete(ctx, a.expense_id, require_prior_turn=True)
    except ToolError as err:
        if not err.visible or "hasn't been confirmed" in err.message:
            # the model tried to skip the confirmation step: show the card instead
            return request_delete(ctx, a.expense_id)
        raise


def ask_clarification(ctx: ToolContext, a: ClarifyArgs) -> ToolOutcome:
    opts = [o.strip() for o in (a.options or []) if o and o.strip()][:6]
    return ToolOutcome(
        True,
        {"clarification_requested": True},
        [{"type": "clarification", "question": a.question, "options": opts}],
        terminal_message=a.question,
    )


# ---------------------------------------------------------------- registry + schemas
def _range_props(desc_suffix: str = "") -> dict:
    return {
        "period": {"type": "string", "enum": PERIODS, "description": f"Named period.{desc_suffix} Weeks start on Monday. Omit if using explicit dates."},
        "start_date": {"type": "string", "description": "Explicit start date, YYYY-MM-DD (inclusive)."},
        "end_date": {"type": "string", "description": "Explicit end date, YYYY-MM-DD (inclusive)."},
    }


def _fn(name: str, description: str, props: dict, required: list[str] | None = None) -> dict:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {"type": "object", "properties": props, "required": required or []},
        },
    }


_CAT = {"type": "string", "enum": CATEGORIES}

TOOLS: dict[str, tuple[type[BaseModel], Callable[[ToolContext, Any], ToolOutcome]]] = {
    "add_expense": (AddExpenseArgs, add_expense),
    "get_expenses": (GetExpensesArgs, get_expenses),
    "calculate_spending": (CalculateSpendingArgs, calculate_spending),
    "get_top_expenses": (TopExpensesArgs, get_top_expenses),
    "get_top_category": (TopCategoryArgs, get_top_category),
    "compare_spending": (CompareArgs, compare_spending),
    "manage_budget": (ManageBudgetArgs, manage_budget),
    "update_expense": (UpdateExpenseArgs, update_expense),
    "delete_expense": (DeleteExpenseArgs, delete_expense),
    "ask_clarification": (ClarifyArgs, ask_clarification),
}

TOOL_SCHEMAS: list[dict] = [
    _fn(
        "add_expense",
        "Save a NEW expense. Use when the user says they spent/paid/bought something. Requires a clear amount. "
        "If the user gives no date, omit expense_date (the server uses today). If the date is vague or ambiguous, call ask_clarification instead.",
        {
            "amount": {"type": "number", "description": "Amount in INR, exactly as the user stated."},
            "category": {**_CAT, "description": "Best-fit category."},
            "description": {"type": "string", "description": "Short description, e.g. 'Dinner at Barbeque Nation'."},
            "expense_date": {"type": "string", "description": "YYYY-MM-DD, resolved from today's date. Omit for today."},
        },
        ["amount", "category"],
    ),
    _fn(
        "get_expenses",
        "List the user's transactions with optional filters. Also use this to find an expense id before updating or deleting.",
        {
            **_range_props(" Omit for all time."),
            "category": _CAT,
            "search": {"type": "string", "description": "Text to match in the description."},
            "min_amount": {"type": "number"},
            "max_amount": {"type": "number"},
            "sort_by": {"type": "string", "enum": ["date", "amount"]},
            "order": {"type": "string", "enum": ["asc", "desc"]},
            "limit": {"type": "integer", "description": "Max rows to return (1-50, default 10)."},
        },
    ),
    _fn(
        "calculate_spending",
        "Compute total, transaction count, average per transaction, average per day and category breakdown for a period, optionally for one category.",
        {**_range_props(" Defaults to this_month."), "category": _CAT},
    ),
    _fn(
        "get_top_expenses",
        "Return the most expensive individual transactions in a period.",
        {**_range_props(" Defaults to this_month."), "limit": {"type": "integer"}, "category": _CAT},
    ),
    _fn(
        "get_top_category",
        "Identify the highest-spending category (with full ranking) for a period.",
        _range_props(" Defaults to this_month."),
    ),
    _fn(
        "compare_spending",
        "Compare spending between two periods (A vs B), overall and by category. If period B is omitted, the previous comparable period is used.",
        {
            "period_a": {"type": "string", "enum": PERIODS},
            "start_a": {"type": "string", "description": "YYYY-MM-DD"},
            "end_a": {"type": "string", "description": "YYYY-MM-DD"},
            "period_b": {"type": "string", "enum": PERIODS},
            "start_b": {"type": "string", "description": "YYYY-MM-DD"},
            "end_b": {"type": "string", "description": "YYYY-MM-DD"},
            "category": _CAT,
        },
    ),
    _fn(
        "manage_budget",
        "Get, set or delete MONTHLY budgets. category 'Overall' (or omitted) is the overall monthly budget. 'get' without a category lists all budgets with utilisation for the current month.",
        {
            "action": {"type": "string", "enum": ["get", "set", "delete"]},
            "category": {"type": "string", "enum": CATEGORIES + [OVERALL]},
            "amount": {"type": "number", "description": "Monthly limit in INR (required for set)."},
        },
        ["action"],
    ),
    _fn(
        "update_expense",
        "Modify an existing expense by id (get the id from get_expenses first). Only pass fields that change.",
        {
            "expense_id": {"type": "integer"},
            "amount": {"type": "number"},
            "category": _CAT,
            "description": {"type": "string"},
            "expense_date": {"type": "string", "description": "YYYY-MM-DD"},
        },
        ["expense_id"],
    ),
    _fn(
        "delete_expense",
        "Delete an expense by id. First call WITHOUT confirmed to show the user a confirmation card. "
        "Only set confirmed=true if the user explicitly said yes/confirm in a message AFTER that card was shown.",
        {"expense_id": {"type": "integer"}, "confirmed": {"type": "boolean"}},
        ["expense_id"],
    ),
    _fn(
        "ask_clarification",
        "Ask the user ONE short question when the amount, date, category, or which expense they mean is missing or ambiguous. "
        "Provide tappable options when there are a few likely answers.",
        {
            "question": {"type": "string"},
            "options": {"type": "array", "items": {"type": "string"}, "description": "Up to 6 short answer choices."},
        },
        ["question"],
    ),
]


def _fmt_validation(err: ValidationError) -> str:
    parts = []
    for e in err.errors():
        loc = ".".join(str(x) for x in e["loc"]) or "arguments"
        parts.append(f"{loc}: {e['msg']}")
    return "; ".join(parts)


def execute_tool(ctx: ToolContext, name: str, raw_args: str | dict | None) -> ToolOutcome:
    """Validate + run one tool call. Never raises; failures come back as ok=False outcomes."""
    entry = TOOLS.get(name)
    if entry is None:
        return ToolOutcome(False, {"ok": False, "error": f"Unknown tool '{name}'."})
    model, fn = entry
    try:
        args = raw_args if isinstance(raw_args, dict) else json.loads(raw_args or "{}")
    except json.JSONDecodeError:
        return ToolOutcome(False, {"ok": False, "error": "Arguments were not valid JSON."})
    try:
        parsed = model.model_validate(args)
        outcome = fn(ctx, parsed)
        outcome.data = {"ok": True, **outcome.data}
        return outcome
    except ValidationError as err:
        ctx.db.rollback()
        return ToolOutcome(False, {"ok": False, "error": f"Invalid arguments — {_fmt_validation(err)}. Ask the user if information is missing."})
    except ToolError as err:
        ctx.db.rollback()
        blocks = [{"type": "error", "message": err.message}] if err.visible else []
        return ToolOutcome(False, {"ok": False, "error": err.message}, blocks)
    except Exception:  # noqa: BLE001 — never leak internals to the model/user
        ctx.db.rollback()
        return ToolOutcome(False, {"ok": False, "error": "Something went wrong while running that action. Nothing was changed."}, [{"type": "error", "message": "Something went wrong. Nothing was changed."}])
