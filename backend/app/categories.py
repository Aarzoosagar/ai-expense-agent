"""Canonical expense categories and forgiving alias normalisation."""

CATEGORIES: list[str] = [
    "Food & Dining",
    "Groceries",
    "Shopping",
    "Travel",
    "Bills & Utilities",
    "Healthcare",
    "Entertainment",
    "Education",
    "Rent",
    "Other",
]

OVERALL = "Overall"  # sentinel used for the overall monthly budget

_ALIASES: dict[str, str] = {
    "food": "Food & Dining",
    "dining": "Food & Dining",
    "food and dining": "Food & Dining",
    "eating out": "Food & Dining",
    "restaurant": "Food & Dining",
    "restaurants": "Food & Dining",
    "dinner": "Food & Dining",
    "lunch": "Food & Dining",
    "breakfast": "Food & Dining",
    "coffee": "Food & Dining",
    "snacks": "Food & Dining",
    "takeout": "Food & Dining",
    "grocery": "Groceries",
    "groceries": "Groceries",
    "supermarket": "Groceries",
    "vegetables": "Groceries",
    "shopping": "Shopping",
    "clothes": "Shopping",
    "clothing": "Shopping",
    "travel": "Travel",
    "transport": "Travel",
    "transportation": "Travel",
    "taxi": "Travel",
    "cab": "Travel",
    "fuel": "Travel",
    "petrol": "Travel",
    "flight": "Travel",
    "bills": "Bills & Utilities",
    "utilities": "Bills & Utilities",
    "bills and utilities": "Bills & Utilities",
    "electricity": "Bills & Utilities",
    "internet": "Bills & Utilities",
    "healthcare": "Healthcare",
    "health": "Healthcare",
    "medical": "Healthcare",
    "medicine": "Healthcare",
    "entertainment": "Entertainment",
    "movies": "Entertainment",
    "movie": "Entertainment",
    "education": "Education",
    "books": "Education",
    "course": "Education",
    "rent": "Rent",
    "other": "Other",
    "misc": "Other",
    "miscellaneous": "Other",
}


def normalize_category(value: str | None) -> str | None:
    """Return the canonical category name, or None if it cannot be mapped."""
    if not value:
        return None
    v = value.strip().lower()
    for c in CATEGORIES:
        if c.lower() == v:
            return c
    return _ALIASES.get(v)
