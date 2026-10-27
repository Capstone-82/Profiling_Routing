"""High-level Vertex AI connection and discovery facade."""

import datetime
import logging
from typing import Optional

from app.config import gcp_configuration_issues, settings
from app.schemas import GCPConnectionResponse
from app.services.gcp.model_discovery import (
    VertexAIConfigurationError,
    describe_vertex_exception,
    discover_vertex_models,
    validate_project_and_region,
    verify_vertex_access,
)
from app.services.gcp.auth import load_gcp_credentials

logger = logging.getLogger(__name__)


class GCPService:
    def verify_connection(
        self,
        project_id: Optional[str] = None,
        region: Optional[str] = None,
        *,
        credentials=None,
        model_service_client=None,
        model_garden_client=None,
    ) -> GCPConnectionResponse:
        resolved_project_id = (project_id or settings.GCP_PROJECT_ID).strip()
        resolved_region = (region or settings.GCP_REGION).strip()
        configuration_issues = gcp_configuration_issues(resolved_project_id, resolved_region)
        if configuration_issues:
            return GCPConnectionResponse(
                provider="vertex-ai",
                status="failed",
                projectId=resolved_project_id or None,
                region=resolved_region or None,
                error="GCP configuration is incomplete: " + " ".join(configuration_issues),
                availableModels=[],
            )
        try:
            resolved_project_id, resolved_region = validate_project_and_region(
                resolved_project_id, resolved_region
            )
            if credentials is None:
                credentials, _, _ = load_gcp_credentials(resolved_project_id)
            verify_vertex_access(
                resolved_project_id,
                resolved_region,
                credentials=credentials,
                model_service_client=model_service_client,
            )
            models = discover_vertex_models(
                resolved_project_id,
                resolved_region,
                credentials=credentials,
                model_garden_client=model_garden_client,
            )
            now = datetime.datetime.now(datetime.timezone.utc).isoformat()
            return GCPConnectionResponse(
                provider="vertex-ai",
                status="verified",
                projectId=resolved_project_id,
                region=resolved_region,
                availableModels=models,
                verifiedAt=now,
                lastSyncedAt=now,
            )
        except VertexAIConfigurationError as error:
            return GCPConnectionResponse(
                provider="vertex-ai",
                status="failed",
                projectId=resolved_project_id or None,
                region=resolved_region or None,
                error=str(error),
                availableModels=[],
            )
        except Exception as error:
            logger.warning(
                "Vertex AI connection test failed for project %s: %s",
                resolved_project_id,
                type(error).__name__,
            )
            return GCPConnectionResponse(
                provider="vertex-ai",
                status="failed",
                projectId=resolved_project_id or None,
                region=resolved_region or None,
                error=describe_vertex_exception(error),
                availableModels=[],
            )

    def discover_models(self, project_id: str, region: str, *, credentials=None):
        resolved_project_id = (project_id or settings.GCP_PROJECT_ID).strip()
        resolved_region = (region or settings.GCP_REGION).strip()
        configuration_issues = gcp_configuration_issues(resolved_project_id, resolved_region)
        if configuration_issues:
            raise VertexAIConfigurationError(
                "GCP configuration is incomplete: " + " ".join(configuration_issues)
            )
        resolved_project_id, resolved_region = validate_project_and_region(
            resolved_project_id, resolved_region
        )
        if credentials is None:
            credentials, _, _ = load_gcp_credentials(resolved_project_id)
        verify_vertex_access(resolved_project_id, resolved_region, credentials=credentials)
        return discover_vertex_models(resolved_project_id, resolved_region, credentials=credentials)


gcp_service = GCPService()
