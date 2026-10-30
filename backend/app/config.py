import os
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv(override=True)

class Settings(BaseModel):
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    AWS_ACCESS_KEY_ID: str = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    AWS_TRUSTED_ACCOUNT_ID: str = os.getenv("AWS_TRUSTED_ACCOUNT_ID", "381061952352")
    GCP_PROJECT_ID: str = os.getenv("GCP_PROJECT_ID", "")
    GCP_REGION: str = os.getenv("GCP_REGION", "us-central1")
    GCP_OAUTH_CLIENT_ID: str = os.getenv("GCP_OAUTH_CLIENT_ID", "")
    GCP_OAUTH_CLIENT_SECRET: str = os.getenv("GCP_OAUTH_CLIENT_SECRET", "")
    GCP_OAUTH_REDIRECT_URI: str = os.getenv(
        "GCP_OAUTH_REDIRECT_URI",
        "http://localhost:8000/api/gcp/callback",
    )
    GCP_OAUTH_STATE_SECRET: str = os.getenv("GCP_OAUTH_STATE_SECRET", "")
    GCP_TOKEN_ENCRYPTION_KEY: str = os.getenv("GCP_TOKEN_ENCRYPTION_KEY", "")
    FRONTEND_BASE_URL: str = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
    GOOGLE_APPLICATION_CREDENTIALS: str = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://bzjxqbgeosbjoalprqdo.supabase.co")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "sb_publishable_xMmyHK13pc58iJx7yqVYhQ_CpKhAyt7")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    CORS_ORIGINS: list[str] = (
        os.getenv("CORS_ORIGINS", "").split(",") if os.getenv("CORS_ORIGINS") else [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    )

settings = Settings()


def gcp_configuration_issues(project_id: str | None = None, region: str | None = None) -> list[str]:
    """Return actionable messages for missing Vertex AI configuration."""
    resolved_project_id = (project_id if project_id is not None else settings.GCP_PROJECT_ID).strip()
    resolved_region = (region if region is not None else settings.GCP_REGION).strip()
    issues = []
    if not resolved_project_id:
        issues.append("GCP_PROJECT_ID is not configured.")
    if not resolved_region:
        issues.append("GCP_REGION is not configured.")
    return issues


def gcp_configuration_report() -> dict[str, object]:
    """Expose non-secret Vertex configuration state for startup/health diagnostics."""
    issues = gcp_configuration_issues()
    from app.services.gcp.auth import credentials_configuration_report

    credential_report = credentials_configuration_report()
    oauth_configured = all(
        [
            settings.GCP_OAUTH_CLIENT_ID,
            settings.GCP_OAUTH_CLIENT_SECRET,
            settings.GCP_OAUTH_REDIRECT_URI,
            settings.GCP_OAUTH_STATE_SECRET,
        ]
    )
    token_encryption_configured = bool(settings.GCP_TOKEN_ENCRYPTION_KEY)
    token_storage_configured = bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY)
    missing = list(issues)
    if not oauth_configured:
        missing.append("GCP OAuth client configuration is incomplete.")
    if not token_encryption_configured:
        missing.append("GCP token encryption is not configured.")
    if not token_storage_configured:
        missing.append("Supabase service-role storage is not configured for encrypted GCP authorization.")
    return {
        "configured": not missing,
        "projectConfigured": not any("GCP_PROJECT_ID" in issue for issue in issues),
        "regionConfigured": not any("GCP_REGION" in issue for issue in issues),
        "oauthConfigured": oauth_configured,
        "tokenEncryptionConfigured": token_encryption_configured,
        "tokenStorageConfigured": token_storage_configured,
        "localCredentialFallbackConfigured": credential_report["configured"],
        "localCredentialSource": credential_report["source"],
        "projectId": settings.GCP_PROJECT_ID or None,
        "region": settings.GCP_REGION or None,
        "missing": missing,
    }
