"""Encrypted refresh-token storage for customer-authorized GCP access."""

from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

from app.config import settings
from app.services.gcp.oauth_service import GCP_OAUTH_SCOPES
from app.services.supabase_service import (
    delete_gcp_oauth_secret_from_supabase,
    fetch_gcp_oauth_secret_from_supabase,
    save_gcp_oauth_secret_to_supabase,
)


class GCPTokenStoreError(RuntimeError):
    """Raised when encrypted customer authorization cannot be loaded."""


def _fernet() -> Fernet:
    key = settings.GCP_TOKEN_ENCRYPTION_KEY.strip()
    if not key:
        raise GCPTokenStoreError("GCP token encryption is not configured on the backend.")
    try:
        return Fernet(key.encode("utf-8"))
    except (ValueError, TypeError) as error:
        raise GCPTokenStoreError("GCP token encryption configuration is invalid.") from error


def encrypt_refresh_token(refresh_token: str) -> str:
    if not refresh_token:
        raise GCPTokenStoreError("Google did not return a refresh token for this authorization.")
    return _fernet().encrypt(refresh_token.encode("utf-8")).decode("ascii")


def decrypt_refresh_token(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError, UnicodeDecodeError) as error:
        raise GCPTokenStoreError("Stored Google authorization could not be decrypted.") from error


async def store_gcp_refresh_token(
    *, user_id: str, organization_id: str, refresh_token: str
) -> None:
    await save_gcp_oauth_secret_to_supabase(
        user_id=user_id,
        organization_id=organization_id,
        refresh_token_ciphertext=encrypt_refresh_token(refresh_token),
    )


async def delete_gcp_refresh_token(user_id: str) -> None:
    await delete_gcp_oauth_secret_from_supabase(user_id)


async def load_gcp_oauth_credentials(user_id: str, project_id: Optional[str] = None) -> Credentials:
    row = await fetch_gcp_oauth_secret_from_supabase(user_id)
    if not row:
        raise GCPTokenStoreError("Google Cloud has not been authorized for this account.")
    if not settings.GCP_OAUTH_CLIENT_ID or not settings.GCP_OAUTH_CLIENT_SECRET:
        raise GCPTokenStoreError("GCP OAuth client configuration is incomplete on the backend.")

    refresh_token = decrypt_refresh_token(row["refresh_token_ciphertext"])
    credentials = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GCP_OAUTH_CLIENT_ID,
        client_secret=settings.GCP_OAUTH_CLIENT_SECRET,
        scopes=GCP_OAUTH_SCOPES,
    )
    try:
        credentials.refresh(Request())
    except Exception as error:
        raise GCPTokenStoreError(
            "Google authorization has expired or been revoked. Reconnect Google Cloud."
        ) from error
    if credentials.refresh_token and credentials.refresh_token != refresh_token:
        await store_gcp_refresh_token(
            user_id=user_id,
            organization_id=row.get("organization_id") or user_id,
            refresh_token=credentials.refresh_token,
        )
    return credentials
