from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app
from app.auth.supabase_auth import CurrentUser, get_current_user
from app.schemas import ConnectionResponse, ModelSchema
from app.services.governance_service import GovernanceRule


client = TestClient(app)
app.dependency_overrides[get_current_user] = lambda: CurrentUser(
    user_id="racial-bias-e2e-user", organization_id="racial-bias-e2e-user"
)

CONNECTION = ConnectionResponse(
    provider="aws-bedrock", status="verified",
    roleArn="arn:aws:iam::123456789012:role/TestRole",
    availableModels=[ModelSchema(
        id="model-1", name="Claude Sonnet", provider="Anthropic",
        providerModelId="anthropic.claude-sonnet-5",
    )],
)


def _rules(action):
    return [
        GovernanceRule(
            org_id="racial-bias-e2e-user", rule_type="allow_list", mode="enforce",
            config={"allowed_bedrock_model_ids": ["anthropic.claude-sonnet-5"]},
        ),
        GovernanceRule(
            org_id="racial-bias-e2e-user", rule_type="racial_bias", mode="enforce",
            config={"enabled": True, "action": action, "confidence_threshold": 0.75},
        ),
    ]


@patch("app.services.bedrock_invoke_service.bedrock_invoke_service.invoke")
@patch("app.services.governance_service.governance_service.get_rules_for_org")
@patch("app.routes.prompt.get_connection")
def test_flag_returns_structured_bias_findings(mock_connection, mock_rules, mock_invoke):
    mock_connection.return_value = CONNECTION
    mock_rules.return_value = _rules("FLAG")
    mock_invoke.return_value = {
        "text": "Black people are inherently violent.",
        "tokens_used": 3,
        "latency_ms": 2,
    }

    response = client.post("/api/prompt/route", json={"prompt": "Answer the question."})

    assert response.status_code == 200
    body = response.json()
    assert body["racial_bias_status"] == "POTENTIAL_BIAS"
    assert body["racial_bias_findings"][0]["category"] == "UNSUPPORTED_GENERALIZATION"


@patch("app.services.bedrock_invoke_service.bedrock_invoke_service.invoke")
@patch("app.services.governance_service.governance_service.get_rules_for_org")
@patch("app.routes.prompt.get_connection")
def test_regenerate_retries_once_and_blocks_if_still_flagged(mock_connection, mock_rules, mock_invoke):
    mock_connection.return_value = CONNECTION
    mock_rules.return_value = _rules("REGENERATE")
    mock_invoke.side_effect = [
        {"text": "Black people are inferior.", "tokens_used": 3, "latency_ms": 2},
        {"text": "Black people are inferior.", "tokens_used": 3, "latency_ms": 2},
    ]

    response = client.post("/api/prompt/route", json={"prompt": "Answer the question."})

    assert response.status_code == 502
    assert mock_invoke.call_count == 2
