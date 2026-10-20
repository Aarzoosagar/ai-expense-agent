from datetime import timedelta

from app.services.dates import resolve_range, today, previous_range
from datetime import date
from tests.conftest import llm_response, tool_call


def chat(client, auth, text):
    r = client.post("/api/chat", headers=auth, json={"message": text})
    assert r.status_code == 200, r.text
    return r.json()["assistant_message"]


def expenses(client, auth):
    return client.get("/api/expenses", headers=auth).json()


def test_add_expense_via_tool_call(client, auth, use_llm):
    yesterday = (today() - timedelta(days=1)).isoformat()
    fake = use_llm(
        llm_response(calls=[tool_call("add_expense", {"amount": 500, "category": "Food & Dining", "description": "Dinner", "expense_date": yesterday})]),
        llm_response("Logged your dinner for yesterday."),
    )
    msg = chat(client, auth, "I spent ₹500 on dinner yesterday")
    assert msg["content"] == "Logged your dinner for yesterday."
    assert msg["blocks"][0]["type"] == "expense_saved"
    data = expenses(client, auth)
    assert data["total"] == 1 and data["items"][0]["expense_date"] == yesterday and data["items"][0]["amount"] == 500
    # the system prompt carries today's date in the configured timezone
    assert today().isoformat() in fake.calls[0]["messages"][0]["content"]


def test_invalid_tool_args_are_rejected_not_saved(client, auth, use_llm):
    use_llm(
        llm_response(calls=[tool_call("add_expense", {"amount": -50, "category": "Food & Dining"})]),
        llm_response("That amount doesn't look right — how much was it?"),
    )
    chat(client, auth, "add an expense")
    assert expenses(client, auth)["total"] == 0


def test_future_date_rejected(client, auth, use_llm):
    future = (today() + timedelta(days=5)).isoformat()
    use_llm(
        llm_response(calls=[tool_call("add_expense", {"amount": 10, "category": "Other", "expense_date": future})]),
        llm_response("I can't record future expenses."),
    )
    msg = chat(client, auth, "add 10 for next week")
    assert expenses(client, auth)["total"] == 0
    assert msg["blocks"][0]["type"] == "error"


def test_clarification_stops_loop_and_returns_card(client, auth, use_llm):
    fake = use_llm(llm_response(calls=[tool_call("ask_clarification", {"question": "How much did you spend on dinner?"})]))
    msg = chat(client, auth, "I had dinner")
    assert msg["content"] == "How much did you spend on dinner?"
    assert msg["blocks"][0]["type"] == "clarification"
    assert len(fake.calls) == 1  # no second LLM round-trip


def test_totals_come_from_code_not_the_model(client, auth, use_llm):
    for amt in (100, 250):
        client.post("/api/expenses", headers=auth, json={"amount": amt, "category": "Groceries", "expense_date": today().isoformat()})
    fake = use_llm(
        llm_response(calls=[tool_call("calculate_spending", {"period": "this_month", "category": "Groceries"})]),
        llm_response("You've spent ₹350 on groceries this month."),
    )
    msg = chat(client, auth, "how much on groceries this month?")
    block = msg["blocks"][0]
    assert block["type"] == "spending_summary" and block["summary"]["total"] == 350
    tool_msg = [m for m in fake.calls[1]["messages"] if m["role"] == "tool"][0]
    assert '"total": 350.0' in tool_msg["content"]


def test_delete_requires_confirmation_even_if_model_skips_it(client, auth, use_llm):
    e = client.post("/api/expenses", headers=auth, json={"amount": 75, "category": "Other", "expense_date": today().isoformat()}).json()
    # model tries to delete with confirmed=true in the same turn it asks
    use_llm(llm_response(calls=[tool_call("delete_expense", {"expense_id": e["id"], "confirmed": True})]))
    msg = chat(client, auth, "delete that expense")
    assert expenses(client, auth)["total"] == 1
    assert msg["blocks"][0]["type"] == "confirm_delete"


def test_delete_confirmed_by_button(client, auth, use_llm):
    e = client.post("/api/expenses", headers=auth, json={"amount": 75, "category": "Other", "expense_date": today().isoformat()}).json()
    use_llm(llm_response(calls=[tool_call("delete_expense", {"expense_id": e["id"]})]))
    chat(client, auth, "delete it")
    assert expenses(client, auth)["total"] == 1
    r = client.post("/api/chat", headers=auth, json={"action": {"type": "confirm_delete", "expense_id": e["id"]}})
    assert r.status_code == 200 and r.json()["assistant_message"]["blocks"][0]["type"] == "expense_deleted"
    assert expenses(client, auth)["total"] == 0
    # cannot be replayed
    again = client.post("/api/chat", headers=auth, json={"action": {"type": "confirm_delete", "expense_id": e["id"]}})
    assert again.json()["assistant_message"]["blocks"][0]["type"] == "error"


def test_delete_confirmed_by_typing_yes_next_turn(client, auth, use_llm):
    e = client.post("/api/expenses", headers=auth, json={"amount": 75, "category": "Other", "expense_date": today().isoformat()}).json()
    use_llm(llm_response(calls=[tool_call("delete_expense", {"expense_id": e["id"]})]))
    chat(client, auth, "delete it")
    use_llm(
        llm_response(calls=[tool_call("delete_expense", {"expense_id": e["id"], "confirmed": True})]),
        llm_response("Deleted."),
    )
    chat(client, auth, "yes")
    assert expenses(client, auth)["total"] == 0


def test_cannot_delete_another_users_expense_via_agent(client, use_llm):
    from tests.conftest import register

    a = register(client, "a@example.com")
    b = register(client, "b@example.com", "Bob")
    e = client.post("/api/expenses", headers=a, json={"amount": 75, "category": "Other", "expense_date": today().isoformat()}).json()
    use_llm(llm_response(calls=[tool_call("delete_expense", {"expense_id": e["id"], "confirmed": True})]), llm_response("Couldn't find it."))
    chat(client, b, "delete expense")
    assert expenses(client, a)["total"] == 1


def test_false_success_claim_is_blocked(client, auth, use_llm):
    use_llm(llm_response("I've added ₹900 for your groceries."))
    msg = chat(client, auth, "add 900 groceries")
    assert "haven't changed anything" in msg["content"]
    assert expenses(client, auth)["total"] == 0


def test_budget_set_via_tool(client, auth, use_llm):
    use_llm(
        llm_response(calls=[tool_call("manage_budget", {"action": "set", "category": "Shopping", "amount": 3000})]),
        llm_response("Shopping budget set."),
    )
    msg = chat(client, auth, "set my monthly shopping budget to 3000")
    assert msg["blocks"][0]["type"] == "budget_status"
    b = client.get("/api/budgets", headers=auth).json()["items"]
    assert b[0]["category"] == "Shopping" and b[0]["amount"] == 3000


def test_missing_llm_key_gives_clear_error(client, auth, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "llm_provider", "openai")
    r = client.post("/api/chat", headers=auth, json={"message": "hi"})
    assert r.status_code == 503 and "OPENAI_API_KEY" in r.json()["detail"]


def test_provider_environment_variables_are_loaded(monkeypatch):
    from app.config import Settings

    values = {
        "LLM_PROVIDER": "groq",
        "GROQ_API_KEY": "groq-test-key",
        "GROQ_MODEL": "openai/gpt-oss-20b",
        "OPENAI_API_KEY": "openai-test-key",
        "OPENAI_MODEL": "gpt-test-model",
    }
    for name, value in values.items():
        monkeypatch.setenv(name, value)

    loaded = Settings(_env_file=None)
    assert loaded.llm_provider == values["LLM_PROVIDER"]
    assert loaded.groq_api_key == values["GROQ_API_KEY"]
    assert loaded.groq_model == values["GROQ_MODEL"]
    assert loaded.openai_api_key == values["OPENAI_API_KEY"]
    assert loaded.openai_model == values["OPENAI_MODEL"]


def test_get_llm_uses_provider_specific_endpoint_and_model(monkeypatch):
    import openai
    from app.agent.agent import get_llm
    from app.config import settings

    calls = []
    monkeypatch.setattr(openai, "OpenAI", lambda **kwargs: calls.append(kwargs) or object())
    monkeypatch.setattr(settings, "groq_api_key", "groq-test-key")
    monkeypatch.setattr(settings, "groq_model", "openai/gpt-oss-20b")
    monkeypatch.setattr(settings, "groq_base_url", "https://api.groq.com/openai/v1")
    monkeypatch.setattr(settings, "openai_api_key", "openai-test-key")
    monkeypatch.setattr(settings, "openai_model", "gpt-test-model")

    monkeypatch.setattr(settings, "llm_provider", "groq")
    _, groq_model = get_llm()
    monkeypatch.setattr(settings, "llm_provider", "openai")
    _, openai_model = get_llm()

    assert calls == [
        {"api_key": "groq-test-key", "base_url": "https://api.groq.com/openai/v1"},
        {"api_key": "openai-test-key"},
    ]
    assert (groq_model, openai_model) == ("openai/gpt-oss-20b", "gpt-test-model")


def test_provider_failure_log_redacts_secrets(caplog, monkeypatch):
    from app.agent.agent import _log_provider_failure
    from app.config import settings

    monkeypatch.setattr(settings, "groq_api_key", "gsk_sensitive-test-secret")
    error = RuntimeError("The model is unavailable; key=gsk_sensitive-test-secret")
    error.status_code = 404
    error.message = str(error)

    _log_provider_failure("groq", error)

    assert "provider=groq status=404" in caplog.text
    assert "model is unavailable" in caplog.text
    assert "gsk_sensitive-test-secret" not in caplog.text


def test_relative_ranges_use_given_reference_date():
    ref = date(2026, 10, 19)  # a Monday
    assert resolve_range("this_week", ref=ref).start == date(2026, 10, 19)
    assert resolve_range("last_week", ref=ref).start == date(2026, 10, 12)
    assert resolve_range("last_7_days", ref=ref).start == date(2026, 10, 13)
    assert resolve_range("yesterday", ref=ref).start == date(2026, 10, 18)
    lm = resolve_range("last_month", ref=ref)
    assert (lm.start, lm.end) == (date(2026, 9, 1), date(2026, 9, 30))
    prev = previous_range(resolve_range("this_month", ref=ref), ref=ref)
    assert (prev.start, prev.end) == (date(2026, 9, 1), date(2026, 9, 19))
