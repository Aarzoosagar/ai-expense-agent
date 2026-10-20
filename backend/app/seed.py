"""Create a demo user with ~3 months of realistic transactions.

    python -m app.seed            # creates demo@example.com / demo12345
"""

import random
from datetime import timedelta
from decimal import Decimal

from sqlalchemy import select

from .auth import hash_password
from .database import Base, SessionLocal, engine
from .models import Budget, Expense, User
from .services.dates import today

DEMO_EMAIL = "demo@example.com"
DEMO_PASSWORD = "demo12345"

TEMPLATES = {
    "Food & Dining": (["Dinner out", "Lunch at office", "Coffee", "Swiggy order", "Zomato order", "Biryani"], 150, 900, 0.9),
    "Groceries": (["BigBasket order", "Vegetables", "Monthly groceries", "Milk & bread"], 200, 2200, 0.35),
    "Shopping": (["Amazon order", "Clothes", "Shoes", "Headphones"], 400, 4500, 0.12),
    "Travel": (["Uber ride", "Auto rickshaw", "Petrol", "Train ticket"], 60, 1800, 0.45),
    "Entertainment": (["Movie tickets", "Netflix", "Concert", "Gaming"], 150, 1500, 0.12),
    "Healthcare": (["Pharmacy", "Doctor consultation"], 200, 1800, 0.05),
    "Education": (["Online course", "Books"], 300, 2500, 0.04),
}
FIXED = [("Rent", "Monthly rent", Decimal("18000"), 1), ("Bills & Utilities", "Electricity bill", Decimal("1450"), 8), ("Bills & Utilities", "Internet bill", Decimal("799"), 10)]


def seed(db) -> User:
    if db.scalar(select(User).where(User.email == DEMO_EMAIL)):
        raise SystemExit("Demo user already exists.")
    rng = random.Random(42)
    user = User(email=DEMO_EMAIL, name="Demo User", password_hash=hash_password(DEMO_PASSWORD))
    db.add(user)
    db.flush()

    t = today()
    start = (t.replace(day=1) - timedelta(days=1)).replace(day=1)
    start = (start - timedelta(days=1)).replace(day=1)  # two full months back + this month
    d = start
    while d <= t:
        for cat, (descs, lo, hi, p) in TEMPLATES.items():
            if rng.random() < p / (2 if cat == "Food & Dining" else 3):
                amt = Decimal(rng.randrange(lo, hi, 10))
                db.add(Expense(user_id=user.id, amount=amt, category=cat, description=rng.choice(descs), expense_date=d))
        for cat, desc, amt, day in FIXED:
            if d.day == day:
                db.add(Expense(user_id=user.id, amount=amt, category=cat, description=desc, expense_date=d))
        d += timedelta(days=1)

    for cat, amount in [("Overall", 40000), ("Food & Dining", 6000), ("Groceries", 5000), ("Shopping", 4000), ("Travel", 3500)]:
        db.add(Budget(user_id=user.id, category=cat, amount=Decimal(amount)))
    db.commit()
    return user


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        seed(session)
    print(f"Seeded demo user → {DEMO_EMAIL} / {DEMO_PASSWORD}")
