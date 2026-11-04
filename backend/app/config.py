from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="REVANA_", extra="ignore")

    environment: str = "development"
    openai_api_key: SecretStr | None = None
    openai_model: str = ""
    database_path: str = "data/revana.sqlite3"
    # Origins allowed to call the API from a browser, e.g. the web app.
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:8443"])


@lru_cache
def get_settings() -> Settings:
    return Settings()
