from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app
from app.auth.supabase_auth import CurrentUser, get_current_user
from app.schemas import ConnectionResponse, ModelSchema
from app.services.governance_service import GovernanceRule


client = TestClient(app)
app.dependency_overrides[get_current_user] = lambda: CurrentUser(
    user_id="conciseness-e2e-user", organization_id="conciseness-e2e-user"
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
            org_id="conciseness-e2e-user", rule_type="allow_list", mode="enforce",
            config={"allowed_bedrock_model_ids": ["anthropic.claude-sonnet-5"]},
        ),
        GovernanceRule(
            org_id="conciseness-e2e-user", rule_type="conciseness", mode="enforce",
            config={"enabled": True, "max_words": 3, "max_characters": 100, "max_sentences": 2, "action": action},
        ),
    ]


@patch("app.services.bedrock_invoke_service.bedrock_invoke_service.invoke")
@patch("app.services.governance_service.governance_service.get_rules_for_org")
@patch("app.routes.prompt.get_connection")
def test_flag_returns_metrics_and_findings(mock_connection, mock_rules, mock_invoke):
    mock_connection.return_value = CONNECTION
    mock_rules.return_value = _rules("FLAG")
    mock_invoke.return_value = {"text": "one two three four.", "tokens_used": 3, "latency_ms": 2}

    response = client.post("/api/prompt/route", json={"prompt": "Give a short answer."})

    assert response.status_code == 200
    body = response.json()
    assert body["conciseness_word_count"] == 4
    assert body["conciseness_requested_length"] == "SHORT"
    assert body["conciseness_findings"][0]["code"] == "MAX_WORDS"


@patch("app.services.bedrock_invoke_service.bedrock_invoke_service.invoke")
@patch("app.services.governance_service.governance_service.get_rules_for_org")
@patch("app.routes.prompt.get_connection")
def test_regenerate_retries_once_and_blocks_if_still_over_limit(mock_connection, mock_rules, mock_invoke):
    mock_connection.return_value = CONNECTION
    mock_rules.return_value = _rules("REGENERATE")
    mock_invoke.side_effect = [
        {"text": "one two three four.", "tokens_used": 3, "latency_ms": 2},
        {"text": "one two three four.", "tokens_used": 3, "latency_ms": 2},
    ]

    response = client.post("/api/prompt/route", json={"prompt": "Answer briefly."})

    assert response.status_code == 502
    assert mock_invoke.call_count == 2
