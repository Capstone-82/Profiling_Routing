from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app
from app.auth.supabase_auth import CurrentUser, get_current_user
from app.schemas import ConnectionResponse, ModelSchema
from app.services.governance_service import GovernanceRule
from app.services.hallucination_guardrail import HallucinationFinding, HallucinationVerification


client = TestClient(app)
app.dependency_overrides[get_current_user] = lambda: CurrentUser(
    user_id="hallucination-e2e-user",
    organization_id="hallucination-e2e-user",
)

CONNECTION = ConnectionResponse(
    provider="aws-bedrock",
    status="verified",
    roleArn="arn:aws:iam::123456789012:role/TestRole",
    availableModels=[ModelSchema(
        id="model-1", name="Claude Sonnet", provider="Anthropic",
        providerModelId="anthropic.claude-sonnet-5",
    )],
)


def _rules(action):
    return [
        GovernanceRule(
            org_id="hallucination-e2e-user", rule_type="allow_list", mode="enforce",
            config={"allowed_bedrock_model_ids": ["anthropic.claude-sonnet-5"]},
        ),
        GovernanceRule(
            org_id="hallucination-e2e-user", rule_type="hallucination", mode="enforce",
            config={"enabled": True, "action": action, "confidence_threshold": 0.7},
        ),
    ]


def _verification(status="INSUFFICIENT_EVIDENCE"):
    finding = HallucinationFinding("A claim.", status, 0.0 if status == "INSUFFICIENT_EVIDENCE" else 0.9, "test")
    return HallucinationVerification(status, finding.confidence, (finding,), "test")


@patch("app.services.bedrock_invoke_service.bedrock_invoke_service.invoke")
@patch("app.services.governance_service.governance_service.get_rules_for_org")
@patch("app.routes.prompt.get_connection")
@patch("app.routes.prompt.hallucination_guardrail")
def test_flag_returns_structured_verification(
    mock_guardrail, mock_connection, mock_rules, mock_invoke
):
    mock_connection.return_value = CONNECTION
    mock_rules.return_value = _rules("FLAG")
    mock_guardrail.scan.side_effect = lambda text, evidence, config: HallucinationVerification(
        "SUPPORTED", 1.0, tuple(), "disabled"
    )
    mock_guardrail.apply.return_value = _verification()
    mock_invoke.return_value = {"text": "A claim.", "tokens_used": 3, "latency_ms": 2}

    response = client.post("/api/prompt/route", json={
        "prompt": "Summarize this.",
        "reference_context": ["Evidence."],
    })

    assert response.status_code == 200
    assert response.json()["hallucination_status"] == "INSUFFICIENT_EVIDENCE"
    assert response.json()["hallucination_findings"][0]["status"] == "INSUFFICIENT_EVIDENCE"


@patch("app.services.bedrock_invoke_service.bedrock_invoke_service.invoke")
@patch("app.services.governance_service.governance_service.get_rules_for_org")
@patch("app.routes.prompt.get_connection")
def test_block_prevents_questionable_response_from_returning(mock_connection, mock_rules, mock_invoke):
    mock_connection.return_value = CONNECTION
    mock_rules.return_value = _rules("BLOCK")
    mock_invoke.return_value = {"text": "Unsupported claim.", "tokens_used": 3, "latency_ms": 2}

    response = client.post("/api/prompt/route", json={"prompt": "Summarize this."})

    assert response.status_code == 502
    mock_invoke.assert_called_once()

