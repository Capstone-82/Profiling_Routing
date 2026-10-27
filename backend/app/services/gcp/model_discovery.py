"""Vertex AI authentication and Model Garden discovery.

Google client libraries are imported lazily so AWS-only deployments and the
existing test suite do not require Google credentials or SDK initialization.
"""

import json
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from app.schemas import ModelSchema
from app.services.gcp.auth import GCPAuthenticationError, load_gcp_credentials
from app.services.routing.routing_models import ModelCandidate

CATALOG_PATH = Path(__file__).with_name("vertex_model_catalog.json")
PROJECT_ID_RE = re.compile(r"^[a-z][a-z0-9-]{4,28}[a-z0-9]$")
REGION_RE = re.compile(r"^(?:[a-z]+-[a-z0-9]+[0-9]|global)$")
class VertexAIConfigurationError(ValueError):
    """Raised when a project or region cannot be used for Vertex AI."""


# Backwards-compatible name for callers that imported the old exception.
VertexAIConnectionError = GCPAuthenticationError

def load_vertex_catalog() -> List[Dict[str, Any]]:
    with CATALOG_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle).get("models", [])


def validate_project_and_region(project_id: str, region: str) -> Tuple[str, str]:
    clean_project = (project_id or "").strip()
    clean_region = (region or "").strip().lower()
    if not PROJECT_ID_RE.fullmatch(clean_project):
        raise VertexAIConfigurationError(
            "Invalid GCP project ID. Use the project ID, not the project name or number."
        )
    if not REGION_RE.fullmatch(clean_region):
        raise VertexAIConfigurationError(
            "Invalid GCP region. Use a Vertex AI region such as us-central1 or global."
        )
    return clean_project, clean_region


def _regional_client_options(region: str):
    from google.api_core.client_options import ClientOptions

    if region == "global":
        return ClientOptions()
    return ClientOptions(api_endpoint=f"{region}-aiplatform.googleapis.com")


def verify_vertex_access(
    project_id: str,
    region: str,
    *,
    credentials=None,
    model_service_client=None,
) -> None:
    """Verify credentials can access the configured Vertex project and region."""
    validate_project_and_region(project_id, region)
    if credentials is None:
        credentials, _, _ = load_gcp_credentials(project_id)

    if model_service_client is None:
        from google.cloud import aiplatform_v1

        model_service_client = aiplatform_v1.ModelServiceClient(
            credentials=credentials,
            client_options=_regional_client_options(region),
        )

    parent = f"projects/{project_id}/locations/{region}"
    # Listing is intentionally enough to verify the project, API, region, and
    # aiplatform.models.list permission. An empty pager is a valid result.
    pager = model_service_client.list_models(parent=parent, timeout=10.0)
    next(iter(pager), None)


def _model_id_from_publisher_name(name: str) -> str:
    marker = "/models/"
    return name.rsplit(marker, 1)[-1] if marker in name else name.rsplit("/", 1)[-1]


def _publisher_model_rows(client: Any, publisher: str = "google") -> Iterable[Any]:
    pager = client.list_publisher_models(parent=f"publishers/{publisher}", timeout=15.0)
    return pager


def _catalog_by_model_id() -> Dict[str, Dict[str, Any]]:
    return {row["model_id"]: row for row in load_vertex_catalog()}


def normalize_publisher_models(
    publisher_models: Iterable[Any],
    region: str,
    *,
    catalog: Optional[Dict[str, Dict[str, Any]]] = None,
) -> List[ModelSchema]:
    catalog = catalog or _catalog_by_model_id()
    normalized: List[ModelSchema] = []
    seen: set[str] = set()

    for publisher_model in publisher_models:
        name = getattr(publisher_model, "name", "") or ""
        model_id = _model_id_from_publisher_name(name)
        metadata = catalog.get(model_id)
        if not metadata or model_id in seen:
            continue
        seen.add(model_id)
        normalized.append(
            ModelSchema(
                id=f"gcp-{model_id}",
                name=metadata["name"],
                provider=metadata.get("provider", "Google"),
                providerModelId=model_id,
                contextWindow=metadata.get("context_window", "1M tokens"),
                contextWindowTokens=metadata.get("max_input_tokens"),
                category="Quality-First" if metadata.get("tier") == "T3" else "Balanced",
                inputModalities=metadata.get("input_modalities", ["TEXT"]),
                outputModalities=metadata.get("output_modalities", ["TEXT"]),
                responseStreamingSupported=bool(metadata.get("streaming_support", True)),
                capabilities=metadata.get("capabilities", []),
                cloudProvider="vertex-ai",
                region=region,
                routerModelId=metadata.get("router_model_id", model_id),
            )
        )
    return normalized


def models_to_routing_candidates(models: Iterable[ModelSchema]) -> List[ModelCandidate]:
    catalog = _catalog_by_model_id()
    candidates: List[ModelCandidate] = []
    for model in models:
        router_id = model.routerModelId or model.providerModelId
        metadata = catalog.get(model.providerModelId) or catalog.get(router_id)
        if not metadata:
            continue
        candidates.append(
            ModelCandidate(
                model_id=router_id,
                provider="google",
                generation="current",
                tier=metadata.get("tier", "T2"),
                cost_in=float(metadata.get("cost_in", 0.0)),
                cost_out=float(metadata.get("cost_out", 0.0)),
                max_input_tokens=int(metadata.get("max_input_tokens", 1048576)),
                max_output_tokens=int(metadata.get("max_output_tokens", 65536)),
                tool_tier=3,
                reasoning_mode=bool(metadata.get("reasoning_mode", False)),
                speed_tokens_per_sec=None,
                domain_strengths=metadata.get("domain_strengths", []),
                total_context_tokens=int(metadata.get("total_context_tokens", metadata.get("max_input_tokens", 1048576))),
                api_model_id=model.providerModelId,
                verification_status="Verified by Vertex AI discovery",
                capability_tags=metadata.get("capabilities", []),
                availability_status="available",
                cloud_provider="vertex-ai",
                region=model.region,
                display_name=model.name,
            )
        )
    return candidates


def discover_vertex_models(
    project_id: str,
    region: str,
    *,
    credentials=None,
    model_garden_client=None,
) -> List[ModelSchema]:
    project_id, region = validate_project_and_region(project_id, region)
    if credentials is None:
        credentials, _, _ = load_gcp_credentials(project_id)
    if model_garden_client is None:
        from google.cloud import aiplatform_v1beta1

        model_garden_client = aiplatform_v1beta1.ModelGardenServiceClient(
            credentials=credentials,
            client_options=_regional_client_options(region),
        )
    return normalize_publisher_models(_publisher_model_rows(model_garden_client), region)


def describe_vertex_exception(error: Exception) -> str:
    """Convert common Google API failures into actionable user-facing text."""
    message = str(error) or error.__class__.__name__
    lowered = message.lower()
    if isinstance(error, VertexAIConnectionError):
        return message
    if "default credentials" in lowered or "could not automatically determine" in lowered:
        return "GCP credentials are not configured on the backend. Set GOOGLE_APPLICATION_CREDENTIALS to a secure service-account JSON path or configure another supported ADC/workload-identity source."
    if "no module named 'google.cloud.aiplatform'" in lowered or "cannot import name 'aiplatform" in lowered:
        return "The Vertex AI Python SDK is not installed. Install the backend dependencies, including google-cloud-aiplatform."
    if "permission_denied" in lowered or "permission denied" in lowered or "403" in lowered:
        return "Permission denied: authenticated successfully, but the configured identity cannot access Vertex AI. Grant Vertex AI User and Service Usage Consumer permissions."
    if "serviceusage" in lowered or "api has not been used" in lowered or "disabled" in lowered:
        return "Vertex AI API is not enabled for the configured GCP project."
    if "quota" in lowered or "resource exhausted" in lowered:
        return "Vertex AI quota was exceeded for the configured project or region."
    if "not found" in lowered or "invalid argument" in lowered:
        return f"Google Cloud rejected the project, region, or model configuration: {message}"
    if "unauthenticated" in lowered or "invalid credential" in lowered or "401" in lowered:
        return "GCP credentials are invalid or could not be used to authenticate with Google Cloud."
    return f"Vertex AI connection failed: {message}"
