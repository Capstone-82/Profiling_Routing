from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app
from app.auth.supabase_auth import CurrentUser, get_current_user
from app.schemas import ConnectionResponse, ModelSchema
from app.services.governance_service import GovernanceRule


client = TestClient(app)
app.dependency_overrides[get_current_user] = lambda: CurrentUser(
    user_id="toxicity-e2e-user",
    organization_id="toxicity-e2e-user",
)

CONNECTION = ConnectionResponse(
    provider="aws-bedrock",
    status="verified",
    roleArn="arn:aws:iam::123456789012:role/TestRole",
    availableModels=[
        ModelSchema(
            id="model-1",
            name="Claude Sonnet",
            provider="Anthropic",
            providerModelId="anthropic.claude-sonnet-5",
        )
    ],
)


def _rules(action):
    return [
        GovernanceRule(
            org_id="toxicity-e2e-user",
            rule_type="allow_list",
            mode="enforce",
            config={"allowed_bedrock_model_ids": ["anthropic.claude-sonnet-5"]},
        ),
        GovernanceRule(
            org_id="toxicity-e2e-user",
            rule_type="toxicity",
            mode="enforce",
            config={
                "enabled": True,
                "scan_input": True,
                "scan_output": True,
                "action": action,
                "score_threshold": 0.7,
                "categories": ["toxicity", "insult", "threat", "profanity"],
            },
        ),
    ]


@patch("app.services.bedrock_invoke_service.bedrock_invoke_service.invoke")
@patch("app.services.governance_service.governance_service.get_rules_for_org")
@patch("app.routes.prompt.get_connection")
@patch("app.routes.prompt.toxicity_guardrail")
def test_flag_scans_input_and_output_without_blocking(
    mock_guardrail, mock_connection, mock_rules, mock_invoke
):
    mock_connection.return_value = CONNECTION
    mock_rules.return_value = _rules("FLAG")
    mock_guardrail.scan.side_effect = lambda text, config: type(
        "Scan", (), {"text": text, "findings": tuple(), "detected": False}
    )()
    mock_guardrail.apply.side_effect = [
        type(
            "Scan", (), {
                "text": "You are a fool",
                "findings": (type("Finding", (), {"category": "insult", "score": 0.91, "count": 1})(),),
                "detected": True,
            }
        )(),
        type(
            "Scan", (), {
                "text": "I cannot help with that.",
                "findings": (type("Finding", (), {"category": "threat", "score": 0.88, "count": 1})(),),
                "detected": True,
            }
        )(),
    ]
    mock_invoke.return_value = {"text": "I cannot help with that.", "tokens_used": 3, "latency_ms": 2}

    response = client.post("/api/prompt/route", json={"prompt": "You are a fool"})

    assert response.status_code == 200
    body = response.json()
    assert body["toxicity_input_findings"][0]["category"] == "insult"
    assert body["toxicity_output_findings"][0]["category"] == "threat"
    assert body["toxicity_input_action"] == "FLAG"


@patch("app.services.bedrock_invoke_service.bedrock_invoke_service.invoke")
@patch("app.services.governance_service.governance_service.get_rules_for_org")
@patch("app.routes.prompt.get_connection")
def test_block_prevents_invocation_for_toxic_input(mock_connection, mock_rules, mock_invoke):
    mock_connection.return_value = CONNECTION
    mock_rules.return_value = _rules("BLOCK")

    response = client.post("/api/prompt/route", json={"prompt": "I will hurt you"})

    assert response.status_code == 503 or response.status_code == 403
    mock_invoke.assert_not_called()
