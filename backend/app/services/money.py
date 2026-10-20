from decimal import ROUND_HALF_UP, Decimal

TWO = Decimal("0.01")


def D(v) -> Decimal:
    if v is None:
        return Decimal("0.00")
    return v if isinstance(v, Decimal) else Decimal(str(v))


def q2(v) -> Decimal:
    return D(v).quantize(TWO, rounding=ROUND_HALF_UP)


def pct(part, whole) -> float:
    w = D(whole)
    if w == 0:
        return 0.0
    return float((D(part) / w * 100).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def pct_change(new, old) -> float | None:
    o = D(old)
    if o == 0:
        return None
    return float(((D(new) - o) / o * 100).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def inr(v) -> str:
    """Format a number as ₹ with Indian digit grouping (e.g. ₹1,23,456 or ₹1,200.50)."""
    d = q2(v)
    neg = d < 0
    d = abs(d)
    whole, frac = f"{d:.2f}".split(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        whole = ",".join(parts + [tail])
    out = f"₹{whole}" if frac == "00" else f"₹{whole}.{frac}"
    return f"-{out}" if neg else out
