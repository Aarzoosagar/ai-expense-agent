"""Deterministic date handling. All "today"/relative dates use the configured timezone (Asia/Kolkata)."""

import calendar
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from ..config import settings

TZ = ZoneInfo(settings.timezone)

PERIODS = [
    "today",
    "yesterday",
    "this_week",
    "last_week",
    "last_7_days",
    "last_30_days",
    "this_month",
    "last_month",
    "this_year",
    "last_year",
    "all_time",
]


def today() -> date:
    return datetime.now(TZ).date()


def month_start(d: date) -> date:
    return d.replace(day=1)


def month_end(d: date) -> date:
    return d.replace(day=calendar.monthrange(d.year, d.month)[1])


def prev_month_start(d: date) -> date:
    return month_start(month_start(d) - timedelta(days=1))


def days_in_month(d: date) -> int:
    return calendar.monthrange(d.year, d.month)[1]


@dataclass(frozen=True)
class DateRange:
    start: date
    end: date
    label: str

    @property
    def days(self) -> int:
        return (self.end - self.start).days + 1

    def to_dict(self) -> dict:
        return {"start": self.start.isoformat(), "end": self.end.isoformat(), "label": self.label, "days": self.days}


def _fmt(d: date) -> str:
    return f"{d.day} {d.strftime('%b')}"


def custom_label(start: date, end: date) -> str:
    if start == end:
        return f"{_fmt(start)} {start.year}"
    if start.year == end.year:
        return f"{_fmt(start)} – {_fmt(end)} {end.year}"
    return f"{_fmt(start)} {start.year} – {_fmt(end)} {end.year}"


def resolve_range(
    period: str | None = None,
    start: date | None = None,
    end: date | None = None,
    *,
    ref: date | None = None,
) -> DateRange:
    """Resolve a named period or explicit dates into a concrete DateRange.

    Explicit start/end win over `period`. Raises ValueError for invalid input.
    """
    t = ref or today()
    if start is not None or end is not None:
        s = start or end
        e = end or start
        assert s is not None and e is not None
        if s > e:
            raise ValueError("start_date must not be after end_date")
        return DateRange(s, e, custom_label(s, e))

    p = (period or "this_month").lower()
    if p == "today":
        return DateRange(t, t, "Today")
    if p == "yesterday":
        y = t - timedelta(days=1)
        return DateRange(y, y, "Yesterday")
    if p == "this_week":
        return DateRange(t - timedelta(days=t.weekday()), t, "This week")
    if p == "last_week":
        s = t - timedelta(days=t.weekday() + 7)
        return DateRange(s, s + timedelta(days=6), "Last week")
    if p == "last_7_days":
        return DateRange(t - timedelta(days=6), t, "Last 7 days")
    if p == "last_30_days":
        return DateRange(t - timedelta(days=29), t, "Last 30 days")
    if p == "this_month":
        return DateRange(month_start(t), t, "This month")
    if p == "last_month":
        s = prev_month_start(t)
        return DateRange(s, month_end(s), "Last month")
    if p == "this_year":
        return DateRange(t.replace(month=1, day=1), t, "This year")
    if p == "last_year":
        return DateRange(date(t.year - 1, 1, 1), date(t.year - 1, 12, 31), "Last year")
    if p == "all_time":
        return DateRange(date(2000, 1, 1), t, "All time")
    raise ValueError(f"Unknown period '{period}'. Use one of: {', '.join(PERIODS)} or explicit dates.")


def elapsed_days(r: DateRange, *, ref: date | None = None) -> int:
    """Days of the range that have already happened (for fair daily averages)."""
    t = ref or today()
    if t < r.start:
        return 1
    return max(1, (min(r.end, t) - r.start).days + 1)


def previous_range(r: DateRange, *, ref: date | None = None) -> DateRange:
    """The comparable earlier period.

    A calendar month (full, or month-to-date) is compared with the same number of
    days in the previous month; any other range with the equal-length span just before it.
    """
    t = ref or today()
    is_month_aligned = r.start.day == 1 and (r.end == month_end(r.start) or (r.end == t and r.end.month == r.start.month))
    if is_month_aligned and r.start.year == r.end.year and r.start.month == r.end.month:
        ps = prev_month_start(r.start)
        pe = min(ps + timedelta(days=r.days - 1), month_end(ps))
        return DateRange(ps, pe, "Last month" if r.end == month_end(r.start) or r.end == t else "Previous period")
    pe = r.start - timedelta(days=1)
    ps = pe - timedelta(days=r.days - 1)
    return DateRange(ps, pe, "Previous period")
