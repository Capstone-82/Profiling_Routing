from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app
from app.auth.supabase_auth import CurrentUser, get_current_user
from app.schemas import ConnectionResponse, ModelSchema
from app.services.governance_service import GovernanceRule


client = TestClient(app)
app.dependency_overrides[get_current_user] = lambda: CurrentUser(
    user_id="pii-e2e-user",
    organization_id="pii-e2e-user",
    email="pii-e2e@example.com",
)

VERIFIED_CONNECTION = ConnectionResponse(
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


def _rules(action: str):
    return [
        GovernanceRule(
            org_id="pii-e2e-user",
            rule_type="allow_list",
            mode="enforce",
            config={"allowed_bedrock_model_ids": ["anthropic.claude-sonnet-5"]},
        ),
        GovernanceRule(
            org_id="pii-e2e-user",
            rule_type="pii",
            mode="enforce",
            config={
                "enabled": True,
                "scan_input": True,
                "scan_output": True,
                "action": action,
                "failure_mode": "BLOCK",
                "entities": ["EMAIL_ADDRESS", "PHONE_NUMBER", "IN_AADHAAR", "IN_PAN"],
            },
        ),
    ]


@patch("app.services.bedrock_invoke_service.bedrock_invoke_service.invoke")
@patch("app.services.governance_service.governance_service.get_rules_for_org")
@patch("app.routes.prompt.get_connection")
def test_route_masks_input_before_invocation_and_output_before_response(
    mock_connection, mock_rules, mock_invoke
):
    mock_connection.return_value = VERIFIED_CONNECTION
    mock_rules.return_value = _rules("MASK")
    mock_invoke.return_value = {
        "text": "Reply to alice@example.com with PAN ABCDE1234F.",
        "tokens_used": 12,
        "latency_ms": 5.0,
    }

    response = client.post(
        "/api/prompt/route",
        json={"prompt": "Contact alice@example.com and call +1 212-555-0100."},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["text"] == "Reply to <EMAIL_ADDRESS> with PAN <IN_PAN>."
    assert body["pii_input_masked"] is True
    assert body["pii_output_masked"] is True
    assert {item["entity_type"] for item in body["pii_input_findings"]} == {
        "EMAIL_ADDRESS",
        "PHONE_NUMBER",
    }
    assert {item["entity_type"] for item in body["pii_output_findings"]} == {
        "EMAIL_ADDRESS",
        "IN_PAN",
    }
    invoked_prompt = mock_invoke.call_args.kwargs["prompt"]
    assert "alice@example.com" not in invoked_prompt
    assert "<EMAIL_ADDRESS>" in invoked_prompt


@patch("app.services.bedrock_invoke_service.bedrock_invoke_service.invoke")
@patch("app.services.governance_service.governance_service.get_rules_for_org")
@patch("app.routes.prompt.get_connection")
def test_route_blocks_input_before_model_invocation(mock_connection, mock_rules, mock_invoke):
    mock_connection.return_value = VERIFIED_CONNECTION
    mock_rules.return_value = _rules("BLOCK")

    response = client.post(
        "/api/prompt/route",
        json={"prompt": "Send the report to alice@example.com."},
    )

    assert response.status_code == 403
    assert "blocked" in response.json()["detail"].lower()
    mock_invoke.assert_not_called()


@patch("app.services.governance_service.governance_service.get_rules_for_org")
@patch("app.routes.prompt.get_connection")
def test_invalid_pii_configuration_is_rejected(mock_connection, mock_rules):
    mock_connection.return_value = VERIFIED_CONNECTION
    mock_rules.return_value = [
        GovernanceRule(
            org_id="pii-e2e-user",
            rule_type="pii",
            mode="enforce",
            config={"enabled": True, "action": "REDACT"},
        )
    ]

    response = client.post("/api/prompt/route", json={"prompt": "Hello"})
    assert response.status_code == 422
