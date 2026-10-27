"""Google Cloud credential loading for local and production runtimes.

Credential source priority is deliberately isolated here so the Vertex model
discovery and invocation layers can later adopt Workload Identity Federation
without changing their provider logic.
"""

import os
from pathlib import Path
from typing import Any, Optional

from app.config import settings

GOOGLE_CLOUD_SCOPE = "https://www.googleapis.com/auth/cloud-platform"


class GCPAuthenticationError(RuntimeError):
    """Raised when backend Google credentials are missing or unusable."""


def _configured_credential_path() -> str:
    return (settings.GOOGLE_APPLICATION_CREDENTIALS or "").strip()


def load_gcp_credentials(project_id: str) -> tuple[Any, Optional[str], str]:
    """Load explicit service-account credentials, then fall back to ADC.

    The Google authentication library owns credential parsing and token
    refresh. This function never reads, logs, stores, or returns credential
    file contents or access tokens.
    """
    import google.auth
    from google.auth.exceptions import DefaultCredentialsError
    from google.oauth2 import service_account

    configured_path = _configured_credential_path()
    if configured_path:
        credential_file = Path(configured_path).expanduser()
        if not credential_file.is_file():
            raise GCPAuthenticationError(
                "GCP credentials are not configured on the backend. "
                "GOOGLE_APPLICATION_CREDENTIALS points to a missing credential file."
            )
        try:
            credentials = service_account.Credentials.from_service_account_file(
                str(credential_file),
                scopes=[GOOGLE_CLOUD_SCOPE],
            )
            if project_id:
                credentials = credentials.with_quota_project(project_id)
            detected_project = getattr(credentials, "project_id", None)
        except Exception as error:
            raise GCPAuthenticationError(
                "GCP credentials are invalid or could not be loaded from the configured credential file."
            ) from error
        return credentials, detected_project, "service-account-file"

    try:
        credentials, detected_project = google.auth.default(
            scopes=[GOOGLE_CLOUD_SCOPE],
            quota_project_id=project_id,
        )
    except DefaultCredentialsError as error:
        raise GCPAuthenticationError(
            "GCP credentials are not configured on the backend. Set "
            "GOOGLE_APPLICATION_CREDENTIALS to a secure service-account JSON path "
            "or configure another supported ADC/workload-identity source."
        ) from error
    except Exception as error:
        raise GCPAuthenticationError(
            "GCP credentials are invalid or could not be loaded."
        ) from error
    return credentials, detected_project, "application-default"


def credentials_configuration_report() -> dict[str, object]:
    """Return safe credential configuration state without exposing secrets."""
    configured_path = _configured_credential_path()
    if configured_path:
        if Path(configured_path).expanduser().is_file():
            return {
                "configured": True,
                "source": "service-account-file",
                "error": None,
            }
        return {
            "configured": False,
            "source": "service-account-file",
            "error": "GOOGLE_APPLICATION_CREDENTIALS points to a missing credential file.",
        }

    adc_candidates = []
    if os.name == "nt" and os.getenv("APPDATA"):
        adc_candidates.append(Path(os.environ["APPDATA"]) / "gcloud" / "application_default_credentials.json")
    adc_candidates.append(Path.home() / ".config" / "gcloud" / "application_default_credentials.json")
    if any(candidate.is_file() for candidate in adc_candidates):
        return {
            "configured": True,
            "source": "application-default",
            "error": None,
        }
    return {
        "configured": False,
        "source": "none",
        "error": "GCP credentials are not configured on the backend.",
    }
