# AI Expense Agent

A premium personal-finance app where you track spending by **talking to an AI assistant** (Penny) — backed by an accurate, deterministic ledger.

- **Frontend:** React + Vite + TypeScript, Tailwind, shadcn-style components (Radix), Lucide, Recharts
- **Backend:** Python + FastAPI + SQLAlchemy (Decimal/NUMERIC money)
- **AI:** OpenAI tool calling, or Groq (OpenAI-compatible) via `LLM_PROVIDER=groq`
- **DB:** SQLite for local dev, PostgreSQL in Docker

## How the AI stays honest

The LLM only **chooses a tool and supplies arguments**. The backend then:

1. validates every argument with Pydantic (amounts > 0, known categories, ISO dates, no future dates),
2. runs the database operation and all arithmetic in Python/SQL (`app/services/`),
3. builds the UI cards (lists, totals, charts, budgets) **from the tool result**, not from model text,
4. blocks "I've added it!" replies when no tool actually ran.

Tools: `add_expense`, `get_expenses`, `calculate_spending`, `get_top_expenses`, `get_top_category`, `compare_spending`, `manage_budget`, `update_expense`, `delete_expense`, plus `ask_clarification` (renders an interactive question card).

- **Dates** are resolved from today's date in `Asia/Kolkata`, injected into the system prompt and used by named periods (`yesterday`, `last_7_days`, `last_month`, …).
- **Deletes** always show a confirmation card first. The server only deletes when a pending confirmation from an *earlier* turn exists (button click or a later "yes"), even if the model sets `confirmed=true` itself.
- **Insights** are rule-based sentences built from computed values (e.g. "Shopping is up ₹2,000 (+200%)").
- **Auth:** JWT; every query is scoped by `user_id`.
- **Settings:** view your account and service status, confirm the configured currency/timezone, and export your expenses as CSV.

## Quick start (local, SQLite)

### 1. Backend
PowerShell:
```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item ..\.env.example ..\.env # then set OPENAI_API_KEY (or GROQ_API_KEY + LLM_PROVIDER=groq) and SECRET_KEY
.\.venv\Scripts\python.exe -m app.seed                # optional: demo user demo@example.com / demo12345 with 3 months of data
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

macOS / Linux:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env        # then set OPENAI_API_KEY (or GROQ_API_KEY + LLM_PROVIDER=groq) and SECRET_KEY
python -m app.seed                # optional: demo user demo@example.com / demo12345 with 3 months of data
python -m uvicorn app.main:app --reload --port 8000
```
API docs: http://localhost:8000/docs

### 2. Frontend
```bash
cd frontend
npm ci
npm run dev
```
Open http://localhost:5173 (Vite proxies `/api` to port 8000).

## Docker (PostgreSQL)
```bash
cp .env.example .env     # set the selected provider's API key and a strong SECRET_KEY
docker compose up --build
```
App: http://localhost:3000 · API: http://localhost:8000/docs
Seed demo data: `docker compose exec backend python -m app.seed`

## Configuration (`.env`)
| Variable | Purpose |
|---|---|
| `LLM_PROVIDER` | `openai` (default) or `groq` |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | OpenAI credentials, default `gpt-4o-mini` |
| `GROQ_API_KEY` / `GROQ_MODEL` | Groq credentials, default `openai/gpt-oss-20b` |
| `SECRET_KEY` | JWT signing key (use 32+ random chars) |
| `DATABASE_URL` | SQLite by default; Postgres URL in production |
| `TIMEZONE` | defaults to `Asia/Kolkata`; used for relative dates and reports |
| `CORS_ORIGINS` | comma-separated allowed origins |
| `VITE_API_URL` | optional frontend API base URL; leave unset when using the Vite proxy or Docker nginx |

Without an API key everything except chat still works (manual add, dashboard, analytics, budgets); the chat page shows a clear setup notice.

## Project layout
```
backend/app/
  main.py  config.py  database.py  models.py  schemas.py  auth.py  categories.py  seed.py
  services/   dates.py money.py expenses.py analytics.py budgets.py   # deterministic logic
  agent/      tools.py (validated tools + schemas)  agent.py (LLM loop)
  routers/    auth expenses budgets analytics chat
backend/tests/                  # 22 tests, LLM mocked with a scripted fake
frontend/src/
  pages/      Dashboard Chat Expenses Analytics Budgets Settings Login
  components/ charts, chat/blocks (chat cards), dialogs, layout, ui/
  lib/        api, queries, format (₹ Indian grouping), categories
docker-compose.yml  .env.example
```

## REST API (all under `/api`, JWT bearer except health/auth)
`GET /health` · `POST /auth/register|login` · `GET /auth/me` ·
`GET/POST /expenses`, `PUT/DELETE /expenses/{id}` (search, category, date range, sort, pagination) ·
`GET/PUT /budgets`, `DELETE /budgets/{id}` ·
`GET /analytics/summary|category-breakdown|trend|top-expenses|compare|month-over-month|budget-vs-actual|insights` ·
`POST /chat`, `GET/DELETE /chat/history`

## Tests
```bash
cd backend && pytest
```
Covers CRUD/validation, per-user isolation, exact Decimal totals, date resolution, budgets, and the agent (tool dispatch, bad args, clarification, delete-confirmation guard, false-success blocking).

## Notes
- Money is `NUMERIC(12,2)` / `Decimal` end to end.
- Tables are created on startup (`create_all`); add Alembic if you need migrations in production.
- Set a strong `SECRET_KEY` and restrict `CORS_ORIGINS` before deploying.
