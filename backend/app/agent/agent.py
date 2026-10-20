"""LLM agent loop: the model picks tools, the backend validates + executes them."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any

from ..categories import CATEGORIES
from ..config import settings
from ..services.dates import TZ
from .tools import TOOL_SCHEMAS, ToolContext, execute_tool

logger = logging.getLogger(__name__)


class AgentError(Exception):
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass
class AgentReply:
    message: str
    blocks: list[dict] = field(default_factory=list)
    tools_used: list[str] = field(default_factory=list)


def build_system_prompt(ctx: ToolContext, user_name: str) -> str:
    t = ctx.today
    return f"""You are Penny, the friendly, precise finance assistant inside AI Expense Agent. You are talking to {user_name}.

TODAY is {t.strftime('%A, %d %B %Y')} ({t.isoformat()}), timezone {TZ.key}. Currency is Indian rupees (₹). Weeks start on Monday.

HARD RULES
1. All financial data comes from tools. NEVER invent expenses, ids, dates, totals, percentages or budget figures. NEVER say an expense was added/updated/deleted or a budget was set unless the tool result says so.
2. Do NOT do arithmetic yourself. Quote numbers exactly as they appear in tool results (format them as ₹ with Indian grouping, e.g. ₹1,200).
3. Resolve relative dates ("yesterday", "last Friday", "3 days ago") from TODAY above and pass ISO dates (YYYY-MM-DD). If the user gives no date when adding an expense, omit expense_date (it defaults to today).
4. If the amount is missing/unclear, or the date/expense they mean is ambiguous ("recently", "last weekend", several matching expenses), call ask_clarification with ONE short question (and options when helpful). Don't guess.
5. Categories: {', '.join(CATEGORIES)}. Examples: dinner/lunch/coffee/eating out → Food & Dining; vegetables/supermarket → Groceries; cab/fuel/flight → Travel; electricity/internet/phone → Bills & Utilities.
6. Deleting: call delete_expense WITHOUT confirmed first (the app shows a confirmation card). Only use confirmed=true if the user explicitly said yes in a LATER message. To locate an expense, call get_expenses first and use the id it returns (earlier messages may list ids in [brackets]).
7. Updating needs an expense id from get_expenses (or from earlier messages).
8. "Am I spending too much on X?": call calculate_spending for X this month, compare_spending (category X) vs last month, and manage_budget get for X. Judge using only that data — no generic advice.
9. The app renders rich cards for tool results (lists, totals, charts, budgets). Do NOT repeat lists or tables in text. Reply in 1–3 short sentences: the key takeaway plus one data-grounded observation.
10. If a tool returns ok=false, explain briefly what went wrong using its error text. Never pretend it worked.
11. Only help with the user's expenses, budgets and spending. Politely decline anything else."""


_FALSE_SUCCESS = re.compile(
    r"\b(i['’]?ve|i have|successfully|done[,.!]?)\s*(just\s+)?(added|saved|recorded|logged|deleted|removed|updated|changed|set)\b", re.I
)


def history_for_llm(rows: list[Any]) -> list[dict]:
    """Convert stored chat rows to LLM messages, keeping expense ids visible for follow-ups."""
    out: list[dict] = []
    for m in rows:
        content = m.content or ""
        if m.role == "assistant" and m.blocks:
            notes = []
            for b in m.blocks:
                t = b.get("type")
                if t == "expense_list":
                    notes.append(
                        "; ".join(f"#{i['id']} ₹{i['amount']:g} {i['category']} '{i['description']}' {i['expense_date']}" for i in b["items"][:15])
                    )
                elif t == "expense_saved":
                    e = b["expense"]
                    notes.append(f"saved #{e['id']} ₹{e['amount']:g} {e['category']} {e['expense_date']}")
                elif t == "confirm_delete":
                    e = b["expense"]
                    notes.append(f"asked user to confirm deleting #{e['id']} ₹{e['amount']:g} {e['description']}")
                elif t == "clarification":
                    notes.append("asked a clarification question")
            if notes:
                content = f"{content}\n[context: {' | '.join(notes)}]".strip()
        if content:
            out.append({"role": m.role, "content": content})
    return out


def get_llm() -> tuple[Any, str]:
    from openai import OpenAI

    provider = settings.llm_provider.lower()
    if provider == "groq":
        if not settings.groq_api_key:
            raise AgentError("The AI assistant isn't configured yet. Set GROQ_API_KEY in the backend .env file.", 503)
        return OpenAI(api_key=settings.groq_api_key, base_url=settings.groq_base_url), settings.groq_model
    if provider == "openai":
        if not settings.openai_api_key:
            raise AgentError("The AI assistant isn't configured yet. Set OPENAI_API_KEY in the backend .env file.", 503)
        return OpenAI(api_key=settings.openai_api_key), settings.openai_model
    raise AgentError("Unsupported LLM_PROVIDER. Set it to 'openai' or 'groq'.", 503)


def _log_provider_failure(provider: str, error: Exception) -> None:
    message = getattr(error, "message", None)
    if not isinstance(message, str) or not message:
        message = str(error)
    for secret in (settings.openai_api_key, settings.groq_api_key):
        if secret:
            message = message.replace(secret, "[REDACTED]")
    message = re.sub(r"(?i)\bBearer\s+\S+", "Bearer [REDACTED]", message)
    message = re.sub(r"(?i)\b(?:gsk_|sk-)[A-Za-z0-9_-]+", "[REDACTED]", message)
    status = getattr(error, "status_code", None) or "unknown"
    logger.error(
        "AI provider request failed: provider=%s status=%s error=%s",
        provider,
        status,
        message[:500],
    )


def _call_llm(client: Any, model: str, messages: list[dict]):
    import openai

    kwargs = dict(model=model, messages=messages, tools=TOOL_SCHEMAS, tool_choice="auto", temperature=0.1)
    provider = settings.llm_provider.lower()
    try:
        try:
            return client.chat.completions.create(**kwargs)
        except openai.BadRequestError:
            # Open models occasionally emit malformed tool calls; one retry usually fixes it.
            return client.chat.completions.create(**kwargs)
    except openai.AuthenticationError as e:
        _log_provider_failure(provider, e)
        raise AgentError("The AI provider rejected the API key. Check your .env configuration.", 502)
    except openai.RateLimitError as e:
        _log_provider_failure(provider, e)
        raise AgentError("The AI provider is rate-limiting requests. Please try again in a moment.", 429)
    except openai.APIConnectionError as e:
        _log_provider_failure(provider, e)
        raise AgentError("Couldn't reach the AI provider. Check your connection and try again.", 502)
    except openai.APIError as e:
        _log_provider_failure(provider, e)
        raise AgentError(f"The AI provider returned an error ({getattr(e, 'status_code', 'unknown')}). Please try again.", 502)


def run_agent(
    ctx: ToolContext,
    *,
    user_name: str,
    message: str,
    history: list[dict],
    client: Any | None = None,
    model: str | None = None,
) -> AgentReply:
    if client is None:
        client, model = get_llm()
    assert model is not None

    messages: list[dict] = [{"role": "system", "content": build_system_prompt(ctx, user_name)}, *history, {"role": "user", "content": message}]
    blocks: list[dict] = []
    used: list[str] = []

    for _ in range(settings.llm_max_tool_rounds):
        resp = _call_llm(client, model, messages)
        msg = resp.choices[0].message
        calls = msg.tool_calls or []

        if not calls:
            text = (msg.content or "").strip()
            if not used and _FALSE_SUCCESS.search(text):
                text = "I haven't changed anything yet. Could you tell me exactly what you'd like me to do?"
            return AgentReply(text or "Done.", blocks, used)

        messages.append(
            {
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [
                    {"id": c.id, "type": "function", "function": {"name": c.function.name, "arguments": c.function.arguments or "{}"}}
                    for c in calls
                ],
            }
        )
        terminal: str | None = None
        for c in calls:
            outcome = execute_tool(ctx, c.function.name, c.function.arguments)
            used.append(c.function.name)
            blocks.extend(outcome.blocks)
            if outcome.terminal_message and terminal is None:
                terminal = outcome.terminal_message
            messages.append(
                {"role": "tool", "tool_call_id": c.id, "content": json.dumps(outcome.data, default=str, ensure_ascii=False)}
            )
        if terminal:
            # clarification / delete-confirmation: stop and let the user answer
            return AgentReply(terminal, blocks, used)

    return AgentReply("That took more steps than expected, so I stopped. Could you try asking in a simpler way?", blocks, used)
