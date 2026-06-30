from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── App ────────────────────────────────────────────────────────────────────
    APP_ENV: str = "development"

    # ── CORS — comma-separated, split at startup ───────────────────────────────
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:8790"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    # ── Database (wired in B1) ──────────────────────────────────────────────────
    DATABASE_URL: str = ""

    # ── Redis (wired in B1) ────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_PASSWORD: str = ""

    # ── MinIO (wired in B6) ────────────────────────────────────────────────────
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = ""
    MINIO_SECRET_KEY: str = ""
    MINIO_BUCKET: str = "agentcrew"
    MINIO_SECURE: bool = False

    # ── Clerk (wired in B2) ────────────────────────────────────────────────────
    CLERK_SECRET_KEY: str = ""
    CLERK_WEBHOOK_SECRET: str = ""
    # JWKS URL from Clerk dashboard → API Keys → Advanced → JWT public key (JWKS)
    # Typically: https://<your-clerk-instance>.clerk.accounts.dev/.well-known/jwks.json
    CLERK_JWKS_URL: str = ""

    # ── Fernet master key for ApiKeyVault (wired in B7) ───────────────────────
    FERNET_MASTER_KEY: str = ""

    # ── LLM provider API keys (wired in B4) — LiteLLM reads these from env ────
    ANTHROPIC_API_KEY: str = ""   # → Claude
    GEMINI_API_KEY: str = ""      # → Gemini (also GOOGLE_API_KEY works)
    OPENAI_API_KEY: str = ""      # → GPT


settings = Settings()
