from datetime import timedelta

from app.services.dates import month_start, today
from app.services.money import inr
from tests.conftest import register


def add(client, auth, amount, category="Food & Dining", desc="x", d=None):
    r = client.post(
        "/api/expenses",
        headers=auth,
        json={"amount": str(amount), "category": category, "description": desc, "expense_date": (d or today()).isoformat()},
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["database"] == "up"


def test_requires_auth(client):
    assert client.get("/api/expenses").status_code == 401
    assert client.get("/api/analytics/summary").status_code == 401


def test_expense_crud_and_validation(client, auth):
    e = add(client, auth, "1200.50", "groceries", "Weekly")
    assert e["amount"] == 1200.5 and e["category"] == "Groceries"

    assert client.post("/api/expenses", headers=auth, json={"amount": "-5", "category": "Rent", "expense_date": today().isoformat()}).status_code == 422
    assert client.post("/api/expenses", headers=auth, json={"amount": "5", "category": "Spaceships", "expense_date": today().isoformat()}).status_code == 422
    future = (today() + timedelta(days=2)).isoformat()
    assert client.post("/api/expenses", headers=auth, json={"amount": "5", "category": "Rent", "expense_date": future}).status_code == 422

    r = client.put(f"/api/expenses/{e['id']}", headers=auth, json={"amount": "1500", "description": "Updated"})
    assert r.status_code == 200 and r.json()["amount"] == 1500 and r.json()["description"] == "Updated"

    page = client.get("/api/expenses?q=updated", headers=auth).json()
    assert page["total"] == 1 and page["total_amount"] == 1500

    assert client.delete(f"/api/expenses/{e['id']}", headers=auth).status_code == 204
    assert client.get("/api/expenses", headers=auth).json()["total"] == 0


def test_sorting_and_pagination(client, auth):
    for i, amt in enumerate([300, 100, 200]):
        add(client, auth, amt, d=today() - timedelta(days=i))
    asc = client.get("/api/expenses?sort_by=amount&order=asc&page_size=2", headers=auth).json()
    assert [x["amount"] for x in asc["items"]] == [100, 200] and asc["total"] == 3
    p2 = client.get("/api/expenses?sort_by=amount&order=asc&page_size=2&page=2", headers=auth).json()
    assert [x["amount"] for x in p2["items"]] == [300]


def test_users_cannot_touch_each_others_data(client):
    a = register(client, "a@example.com")
    b = register(client, "b@example.com", "Bob")
    e = add(client, a, 999)
    assert client.get("/api/expenses", headers=b).json()["total"] == 0
    assert client.put(f"/api/expenses/{e['id']}", headers=b, json={"amount": "1"}).status_code == 404
    assert client.delete(f"/api/expenses/{e['id']}", headers=b).status_code == 404
    assert client.get("/api/expenses", headers=a).json()["total"] == 1


def test_analytics_numbers_are_exact(client, auth):
    t = today()
    ms = month_start(t)
    add(client, auth, "0.10", "Groceries", d=ms)
    add(client, auth, "0.20", "Groceries", d=ms)
    add(client, auth, "500", "Food & Dining", d=ms)
    s = client.get("/api/analytics/summary?period=this_month", headers=auth).json()
    assert s["total"] == 500.30 and s["count"] == 3
    assert s["average_transaction"] == 166.77
    cats = client.get("/api/analytics/category-breakdown?period=this_month", headers=auth).json()["categories"]
    assert cats[0]["category"] == "Food & Dining" and cats[0]["total"] == 500
    assert cats[1]["total"] == 0.3


def test_compare_and_insights_ground_in_data(client, auth):
    t = today()
    ms = month_start(t)
    prev_month_day = (ms - timedelta(days=1)).replace(day=1)
    add(client, auth, 1000, "Shopping", d=prev_month_day)
    add(client, auth, 3000, "Shopping", d=ms)
    c = client.get("/api/analytics/compare?period=this_month", headers=auth).json()
    assert c["difference"] == 2000 and c["percent_change"] == 200.0 and c["direction"] == "up"
    ins = client.get("/api/analytics/insights", headers=auth).json()["insights"]
    inc = [i for i in ins if i["kind"] == "category_increase"]
    assert inc and "Shopping" in inc[0]["title"] and "₹2,000" in inc[0]["text"]


def test_budget_status_and_warnings(client, auth):
    add(client, auth, 900, "Shopping", d=today())
    r = client.put("/api/budgets", headers=auth, json={"category": "Shopping", "amount": "1000"})
    assert r.status_code == 200
    item = r.json()["items"][0]
    assert item["spent"] == 900 and item["remaining"] == 100 and item["status"] == "warning"
    add(client, auth, 200, "Shopping", d=today())
    item = client.get("/api/budgets", headers=auth).json()["items"][0]
    assert item["status"] == "over" and item["remaining"] == -100
    # overall budget is compared against ALL spending
    client.put("/api/budgets", headers=auth, json={"category": None, "amount": "10000"})
    overall = client.get("/api/budgets", headers=auth).json()["overall"]
    assert overall["spent"] == 1100 and overall["status"] == "ok"


def test_inr_formatting():
    assert inr(1200) == "₹1,200"
    assert inr(123456.5) == "₹1,23,456.50"
    assert inr(0) == "₹0"
