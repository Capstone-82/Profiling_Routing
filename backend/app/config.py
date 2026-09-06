import os
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()

class Settings(BaseModel):
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    AWS_TRUSTED_ACCOUNT_ID: str = os.getenv("AWS_TRUSTED_ACCOUNT_ID", "108839616732")
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://bzjxqbgeosbjoalprqdo.supabase.co")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "sb_publishable_xMmyHK13pc58iJx7yqVYhQ_CpKhAyt7")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]

settings = Settings()
