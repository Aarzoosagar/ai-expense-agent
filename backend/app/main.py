from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from . import models  # noqa: F401  (register tables)
from .config import settings
from .database import Base, engine
from .routers import analytics, auth, budgets, chat, expenses


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="AI Expense Agent API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")


@api.get("/health", tags=["health"])
def health():
    db_ok = True
    try:
        with engine.connect() as c:
            c.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        db_ok = False
    provider = settings.llm_provider.lower()
    key = settings.groq_api_key if provider == "groq" else settings.openai_api_key
    return {
        "status": "ok" if db_ok else "degraded",
        "database": "up" if db_ok else "down",
        "llm_provider": provider,
        "llm_configured": bool(key),
        "timezone": settings.timezone,
    }


for r in (auth.router, expenses.router, budgets.router, analytics.router, chat.router):
    api.include_router(r)

app.include_router(api)
