"""Google OAuth 2.0 authorization-code flow for customer GCP access."""

import base64
import hashlib
import hmac
import json
import secrets
import threading
import time
from dataclasses import dataclass
from typing import Any, Optional

from app.config import settings
from app.services.gcp.model_discovery import validate_project_and_region

GCP_OAUTH_SCOPES = ["https://www.googleapis.com/auth/cloud-platform"]
STATE_TTL_SECONDS = 600


class GCPOAuthConfigurationError(RuntimeError):
    """Raised when the platform OAuth client is not configured."""


class GCPOAuthStateError(RuntimeError):
    """Raised when an OAuth state is missing, invalid, expired, or replayed."""


@dataclass(frozen=True)
class OAuthState:
    user_id: str
    organization_id: str
    project_id: Optional[str]
    region: str
    expires_at: int


class OAuthStateStore:
    """Short-lived, single-use state store for CSRF and login binding."""

    def __init__(self):
        self._states: dict[str, OAuthState] = {}
        self._lock = threading.Lock()

    def _secret(self) -> bytes:
        secret = settings.GCP_OAUTH_STATE_SECRET.strip()
        if not secret:
            raise GCPOAuthConfigurationError("GCP OAuth state protection is not configured.")
        return secret.encode("utf-8")

    def issue(
        self,
        *,
        user_id: str,
        organization_id: str,
        project_id: Optional[str],
        region: str,
    ) -> str:
        now = int(time.time())
        payload = {
            "nonce": secrets.token_urlsafe(24),
            "user_id": user_id,
            "organization_id": organization_id,
            "project_id": project_id,
            "region": region,
            "expires_at": now + STATE_TTL_SECONDS,
        }
        encoded = base64.urlsafe_b64encode(
            json.dumps(payload, separators=(",", ":")).encode("utf-8")
        ).rstrip(b"=").decode("ascii")
        signature = hmac.new(self._secret(), encoded.encode("ascii"), hashlib.sha256).hexdigest()
        token = f"{encoded}.{signature}"
        with self._lock:
            self._states[hashlib.sha256(token.encode("utf-8")).hexdigest()] = OAuthState(
                user_id=user_id,
                organization_id=organization_id,
                project_id=project_id,
                region=region,
                expires_at=payload["expires_at"],
            )
        return token

    def consume(self, token: str) -> OAuthState:
        if not token or "." not in token:
            raise GCPOAuthStateError("The Google authorization state is invalid.")
        encoded, signature = token.rsplit(".", 1)
        expected = hmac.new(self._secret(), encoded.encode("ascii"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise GCPOAuthStateError("The Google authorization state is invalid.")
        key = hashlib.sha256(token.encode("utf-8")).hexdigest()
        with self._lock:
            state = self._states.pop(key, None)
        if state is None or state.expires_at < int(time.time()):
            raise GCPOAuthStateError("The Google authorization state expired or was already used.")
        return state


class GCPOAuthService:
    def __init__(self, state_store: Optional[OAuthStateStore] = None):
        self.state_store = state_store or OAuthStateStore()

    def _validate_configuration(self) -> None:
        missing = [
            name
            for name, value in (
                ("GCP_OAUTH_CLIENT_ID", settings.GCP_OAUTH_CLIENT_ID),
                ("GCP_OAUTH_CLIENT_SECRET", settings.GCP_OAUTH_CLIENT_SECRET),
                ("GCP_OAUTH_REDIRECT_URI", settings.GCP_OAUTH_REDIRECT_URI),
                ("GCP_OAUTH_STATE_SECRET", settings.GCP_OAUTH_STATE_SECRET),
            )
            if not value.strip()
        ]
        if missing:
            raise GCPOAuthConfigurationError(
                "GCP OAuth is not configured on the backend: " + ", ".join(missing) + "."
            )

    def _flow(self, state: Optional[str] = None):
        self._validate_configuration()
        from google_auth_oauthlib.flow import Flow

        return Flow.from_client_config(
            {
                "web": {
                    "client_id": settings.GCP_OAUTH_CLIENT_ID,
                    "client_secret": settings.GCP_OAUTH_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            },
            scopes=GCP_OAUTH_SCOPES,
            state=state,
        )

    def authorization_url(
        self,
        *,
        user_id: str,
        organization_id: str,
        project_id: Optional[str],
        region: str,
    ) -> str:
        self._validate_configuration()
        clean_project = (project_id or "").strip() or None
        clean_region = (region or settings.GCP_REGION).strip().lower()
        if clean_project:
            clean_project, clean_region = validate_project_and_region(clean_project, clean_region)
        state = self.state_store.issue(
            user_id=user_id,
            organization_id=organization_id,
            project_id=clean_project,
            region=clean_region,
        )
        flow = self._flow(state)
        flow.redirect_uri = settings.GCP_OAUTH_REDIRECT_URI
        authorization_url, _ = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
        )
        return authorization_url

    def exchange_code(self, *, code: str, state: str):
        if not code.strip():
            raise GCPOAuthStateError("Google did not return an authorization code.")
        state_data = self.state_store.consume(state)
        flow = self._flow(state)
        flow.redirect_uri = settings.GCP_OAUTH_REDIRECT_URI
        try:
            flow.fetch_token(code=code)
        except Exception as error:
            raise GCPOAuthConfigurationError(
                "Google authorization could not be completed. Please reconnect Google Cloud."
            ) from error
        credentials = flow.credentials
        if not credentials.refresh_token:
            raise GCPOAuthConfigurationError(
                "Google did not grant offline access. Please reconnect and approve the requested access."
            )
        return state_data, credentials


gcp_oauth_service = GCPOAuthService()
