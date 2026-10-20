from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    # Database: SQLite for local dev, PostgreSQL in Docker / production
    database_url: str = "sqlite:///./expense_agent.db"

    # Auth
    secret_key: str = "dev-only-change-me"
    access_token_expire_minutes: int = 60 * 24 * 7

    # CORS (comma separated)
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # LLM: "openai" or "groq" (Groq uses its OpenAI-compatible endpoint)
    llm_provider: str = "openai"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-20b"
    groq_base_url: str = "https://api.groq.com/openai/v1"
    llm_max_tool_rounds: int = 6

    # Dates are always resolved in this timezone
    timezone: str = "Asia/Kolkata"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
