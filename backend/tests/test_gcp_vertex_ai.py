from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app
from app.auth.supabase_auth import CurrentUser, get_current_user
from app.schemas import GCPConnectionResponse, ModelSchema
from app.services.gcp.gcp_service import GCPService
from app.services.gcp.auth import GCPAuthenticationError, load_gcp_credentials
from app.services.gcp.model_discovery import (
    normalize_publisher_models,
    validate_project_and_region,
)
from app.config import settings
from app.services.gcp.vertex_ai_service import VertexAIInvokeService
from app.services.routing.router import ModelRegistry, ModelRouter
from app.services.routing.routing_models import ModelCandidate, PromptProfile

# GCP/Vertex AI is intentionally paused until a GCP account is available.
# Keep these tests in place so the integration can be resumed without rebuilding
# its coverage; they are not part of the active AWS Bedrock phase.
pytestmark = pytest.mark.skip(reason="GCP/Vertex AI integration is currently paused")

client = TestClient(app)
app.dependency_overrides[get_current_user] = lambda: CurrentUser(
    user_id="gcp-test-user",
    organization_id="gcp-test-user",
    email="gcp@example.com",
)


@pytest.fixture(autouse=True)
def use_gcp_test_user():
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        user_id="gcp-test-user",
        organization_id="gcp-test-user",
        email="gcp@example.com",
    )


def test_explicit_service_account_file_has_priority_over_adc(tmp_path, monkeypatch):
    credential_file = tmp_path / "vertex-service-account.json"
    credential_file.write_text("{}", encoding="utf-8")
    monkeypatch.setattr(settings, "GOOGLE_APPLICATION_CREDENTIALS", str(credential_file))

    with patch(
        "google.oauth2.service_account.Credentials.from_service_account_file",
        return_value=SimpleNamespace(
            project_id="file-project",
            with_quota_project=lambda project_id: SimpleNamespace(project_id="file-project"),
        ),
    ) as load_file, patch("google.auth.default") as load_adc:
        credentials, detected_project, source = load_gcp_credentials("my-project-123")

    assert credentials is not None
    assert detected_project == "file-project"
    assert source == "service-account-file"
    load_file.assert_called_once()
    load_adc.assert_not_called()


def test_missing_gcp_credentials_is_explicit(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_APPLICATION_CREDENTIALS", "")
    from google.auth.exceptions import DefaultCredentialsError

    with patch("google.auth.default", side_effect=DefaultCredentialsError("missing")):
        with pytest.raises(GCPAuthenticationError, match="not configured on the backend"):
            load_gcp_credentials("my-project-123")


def test_invalid_service_account_file_does_not_expose_credential_details(tmp_path, monkeypatch):
    credential_file = tmp_path / "vertex-service-account.json"
    credential_file.write_text("not-json", encoding="utf-8")
    monkeypatch.setattr(settings, "GOOGLE_APPLICATION_CREDENTIALS", str(credential_file))

    with pytest.raises(GCPAuthenticationError) as error:
        load_gcp_credentials("my-project-123")

    assert str(error.value) == (
        "GCP credentials are invalid or could not be loaded from the configured credential file."
    )
    assert "not-json" not in str(error.value)


def test_validate_vertex_project_and_region():
    assert validate_project_and_region("my-project-123", "us-central1") == ("my-project-123", "us-central1")

    try:
        validate_project_and_region("not a project", "us-central1")
        assert False, "invalid project should raise"
    except ValueError as error:
        assert "project ID" in str(error)


def test_normalize_vertex_publisher_models_only_returns_maintained_catalog_models():
    rows = [
        SimpleNamespace(name="publishers/google/models/gemini-2.5-flash"),
        SimpleNamespace(name="publishers/google/models/not-maintained"),
    ]

    models = normalize_publisher_models(rows, "us-central1")

    assert len(models) == 1
    assert models[0].providerModelId == "gemini-2.5-flash"
    assert models[0].cloudProvider == "vertex-ai"
    assert models[0].routerModelId == "gemini-2.5-flash"


def test_gcp_connection_permission_denied_is_reported_without_fake_success():
    class DeniedClient:
        def list_models(self, **kwargs):
            raise RuntimeError("Permission denied: aiplatform.models.list")

    result = GCPService().verify_connection(
        "my-project-123",
        "us-central1",
        credentials=object(),
        model_service_client=DeniedClient(),
    )

    assert result.status == "failed"
    assert "Permission denied" in result.error
    assert result.availableModels == []


def test_vertex_invocation_normalizes_text_tokens_and_latency():
    captured = {}

    class FakeModels:
        def generate_content(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(
                text="Hello from Gemini",
                usage_metadata=SimpleNamespace(total_token_count=17),
            )

    class FakeClient:
        models = FakeModels()

        def close(self):
            captured["closed"] = True

    service = VertexAIInvokeService()
    result = service.invoke(
        "my-project-123",
        "us-central1",
        "gemini-2.5-flash",
        "Say hello",
        max_tokens=100,
        client_factory=lambda **kwargs: FakeClient(),
        generation_config_factory=lambda **kwargs: kwargs,
    )

    assert result["text"] == "Hello from Gemini"
    assert result["tokens_used"] == 17
    assert result["latency_ms"] >= 0
    assert captured["model"] == "gemini-2.5-flash"
    assert captured["closed"] is True


def test_router_can_select_a_verified_gcp_model_without_new_routing_algorithm():
    class FakeProfiler:
        def profile(self, prompt, max_tokens=None):
            return PromptProfile(
                d1=0.25, d2=0.25, d3=0.25, d4=0.0, d5=0.0,
                domain="General Knowledge", complexity_score=0.25,
                derived_tier="T1", intent="FACTUAL", task_type="factual_lookup",
                reasoning_chain_detected=False, research_signals=[], confidence=0.9,
                input_token_count=10, est_output_tokens=max_tokens or 100,
            )

    candidate = ModelCandidate(
        model_id="gemini-2.5-flash",
        provider="google",
        generation="current",
        tier="T1",
        cost_in=0.3,
        cost_out=2.5,
        max_input_tokens=100000,
        max_output_tokens=1000,
        tool_tier=2,
        reasoning_mode=False,
        speed_tokens_per_sec=None,
        domain_strengths=["factual_lookup"],
        total_context_tokens=100000,
        api_model_id="gemini-2.5-flash",
        cloud_provider="vertex-ai",
        region="us-central1",
        display_name="Gemini 2.5 Flash",
        availability_status="available",
    )
    result = ModelRouter(FakeProfiler(), ModelRegistry()).route(
        "Say hello",
        max_tokens=100,
        allowed_model_ids=["gemini-2.5-flash"],
        extra_models=[candidate],
        top_n=1,
    )

    assert result.recommendations[0].model_id == "gemini-2.5-flash"
    assert result.recommendations[0].cloud_provider == "vertex-ai"


def _gcp_connection():
    return GCPConnectionResponse(
        status="verified",
        projectId="my-project-123",
        region="us-central1",
        availableModels=[
            ModelSchema(
                id="gcp-gemini-2-5-flash",
                name="Gemini 2.5 Flash",
                provider="Google",
                providerModelId="gemini-2.5-flash",
                cloudProvider="vertex-ai",
                region="us-central1",
                routerModelId="gemini-2.5-flash",
            )
        ],
    )


def _gcp_routing_result():
    from app.services.routing.routing_models import ModelRecommendation, RoutingResult

    profile = PromptProfile(
        d1=0.25, d2=0.25, d3=0.25, d4=0.0, d5=0.0,
        domain="General Knowledge", complexity_score=0.25,
        derived_tier="T1", intent="FACTUAL", task_type="factual_lookup",
        reasoning_chain_detected=False, research_signals=[], confidence=0.9,
        input_token_count=4, est_output_tokens=100,
    )
    return RoutingResult(
        prompt_profile=profile,
        resolved_tier="T1",
        recommendations=[ModelRecommendation(
            rank=1,
            model_id="gemini-2.5-flash",
            provider="google",
            tier="T1",
            estimated_cost_usd=0.001,
            domain_match_count=1,
            reasons=["GCP test candidate"],
            routing_score=90.0,
            cloud_provider="vertex-ai",
            api_model_id="gemini-2.5-flash",
            region="us-central1",
            display_name="Gemini 2.5 Flash",
        )],
        rejections={},
        tier_escalated=False,
        escalation_reason=None,
        warnings=[],
    )


@patch("app.routes.gcp.save_gcp_connection_to_supabase", new_callable=AsyncMock)
@patch("app.routes.gcp.load_gcp_oauth_credentials", new_callable=AsyncMock)
@patch("app.routes.gcp.gcp_service.verify_connection")
def test_gcp_connection_api_persists_verified_discovery(mock_verify, mock_load_credentials, mock_save):
    mock_verify.return_value = _gcp_connection()
    mock_load_credentials.return_value = object()

    response = client.post(
        "/api/gcp/connection/test",
        json={"projectId": "my-project-123", "region": "us-central1"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "verified"
    assert response.json()["availableModels"][0]["cloudProvider"] == "vertex-ai"
    mock_save.assert_awaited_once()


@patch("app.services.provider_dispatch_service.provider_dispatch_service.invoke")
@patch("app.services.governance_service.governance_service.get_rules_for_org")
@patch("app.routes.prompt.get_gcp_connection")
@patch("app.routes.prompt.get_connection")
def test_route_invokes_gcp_and_preserves_recommendation_on_failure(
    mock_aws, mock_gcp, mock_rules, mock_invoke
):
    from app.schemas import ConnectionResponse
    from app.services.governance_service import GovernanceRule

    mock_aws.return_value = ConnectionResponse(status="not_connected", availableModels=[])
    mock_gcp.return_value = _gcp_connection()
    mock_rules.return_value = [GovernanceRule(
        org_id="demo-user-uuid",
        rule_type="allow_list",
        mode="enforce",
        config={"allowed_model_ids": ["gemini-2.5-flash"]},
    )]
    mock_invoke.side_effect = RuntimeError("Quota exceeded")

    with patch("app.routes.prompt.routing_service.route", return_value=_gcp_routing_result()):
        response = client.post("/api/prompt/route", json={"prompt": "Say hello"})

    assert response.status_code == 200
    data = response.json()
    assert data["model_used"] == "gemini-2.5-flash"
    assert data["recommendations"][0]["cloud_provider"] == "vertex-ai"
    assert data["invocation_error"] == "Quota exceeded"
    mock_invoke.assert_called_once()
    assert mock_invoke.call_args.kwargs["cloud_provider"] == "vertex-ai"
