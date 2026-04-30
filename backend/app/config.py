from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://migrator:migrator@db:5432/migrator"
    secret_key: str = "change-me-in-production-use-long-random-string"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    sa_keys_dir: str = "/data/sa_keys"
    progress_dir: str = "/data/progress"
    log_dir: str = "/data/logs"

    # Email notifications (optional — leave blank to disable)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_tls: bool = True
    app_url: str = "http://localhost"

    # Concurrency
    max_concurrent_jobs: int = 3

    class Config:
        env_file = ".env"


settings = Settings()
