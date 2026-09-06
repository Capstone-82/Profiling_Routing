import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app
from app.schemas import ConnectionResponse, ModelSchema
from app.services.governance_service import GovernanceRule

client = TestClient(app)

VERIFIED_CONN = ConnectionResponse(
    provider="aws-bedrock",
    status="verified",
    roleArn="arn:aws:iam::123456789012:role/TestRole",
    availableModels=[
        ModelSchema(id="model-1", name="Claude Sonnet 5", provider="Anthropic", providerModelId="anthropic.claude-sonnet-5"),
        ModelSchema(id="model-2", name="Amazon Nova Micro", provider="Amazon", providerModelId="amazon.nova-micro-v1:0"),
        ModelSchema(id="model-3", name="Claude Haiku 4.5", provider="Anthropic", providerModelId="anthropic.claude-haiku-4-5-20251001-v1:0"),
    ],
)
NOT_CONNECTED = ConnectionResponse(provider="aws-bedrock", status="not_connected", availableModels=[])

ALLOW_ALL_THREE = [
    GovernanceRule(
        org_id="demo-user-uuid",
        rule_type="allow_list",
        mode="enforce",
        config={"allowed_bedrock_model_ids": [
            "anthropic.claude-sonnet-5", "amazon.nova-micro-v1:0", "anthropic.claude-haiku-4-5-20251001-v1:0"
        ]},
    ),
]


def test_get_allowed_catalog():
    res = client.get("/api/prompt/catalog")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 5
    assert any("Claude" in m["name"] for m in data)


@patch("app.routes.prompt.get_connection")
def test_route_without_verified_connection_returns_403(mock_conn):
    mock_conn.return_value = NOT_CONNECTED
    res = client.post("/api/prompt/route", json={"prompt": "Summarize this report."})
    assert res.status_code == 403


@patch("app.routes.prompt.get_connection")
def test_profile_without_verified_connection_returns_403(mock_conn):
    mock_conn.return_value = NOT_CONNECTED
    res = client.post("/api/prompt/profile", json={"prompt": "Summarize this report."})
    assert res.status_code == 403


@patch("app.services.governance_service.governance_service.get_rules_for_org")
@patch("app.routes.prompt.get_connection")
def test_profile_prompt_only_recommends_allowed_connected_models(mock_conn, mock_rules):
    mock_conn.return_value = VERIFIED_CONN
    mock_rules.return_value = ALLOW_ALL_THREE

    res = client.post("/api/prompt/profile", json={"prompt": "Evaluate GDPR compliance impact on data pipelines."})
    assert res.status_code == 200
    data = res.json()
    assert "profile" in data
    assert len(data["recommendations"]) > 0
    allowed = {"anthropic.claude-sonnet-5", "amazon.nova-micro-v1:0", "anthropic.claude-haiku-4-5-20251001-v1:0"}
    for r in data["recommendations"]:
        assert r["bedrock_model_id"] in allowed


@patch("app.services.bedrock_invoke_service.bedrock_invoke_service.invoke")
@patch("app.services.governance_service.governance_service.get_rules_for_org")
@patch("app.routes.prompt.get_connection")
def test_route_and_invoke_uses_rank1_by_default(mock_conn, mock_rules, mock_invoke):
    mock_conn.return_value = VERIFIED_CONN
    mock_rules.return_value = ALLOW_ALL_THREE
    mock_invoke.return_value = {"text": "Hello from rank 1", "tokens_used": 42, "latency_ms": 123.0}

    res = client.post("/api/prompt/route", json={"prompt": "Summarize this quarterly revenue report."})
    assert res.status_code == 200
    data = res.json()
    assert data["text"] == "Hello from rank 1"
    assert data["invocation_error"] is None
    rank1_id = data["recommendations"][0]["bedrock_model_id"]
    assert data["model_used"] == rank1_id
    mock_invoke.assert_called_once()
    assert mock_invoke.call_args.kwargs["bedrock_model_id"] == rank1_id


@patch("app.services.bedrock_invoke_service.bedrock_invoke_service.invoke")
@patch("app.services.governance_service.governance_service.get_rules_for_org")
@patch("app.routes.prompt.get_connection")
def test_retry_with_rank2_invokes_only_rank2(mock_conn, mock_rules, mock_invoke):
    mock_conn.return_value = VERIFIED_CONN
    mock_rules.return_value = ALLOW_ALL_THREE
    mock_invoke.return_value = {"text": "Hello from retry", "tokens_used": 10, "latency_ms": 50.0}

    prompt = "Summarize this quarterly revenue report."
    preview = client.post("/api/prompt/profile", json={"prompt": prompt})
    rank2_id = preview.json()["recommendations"][1]["bedrock_model_id"]

    res = client.post("/api/prompt/route", json={"prompt": prompt, "retry_bedrock_model_id": rank2_id})
    assert res.status_code == 200
    data = res.json()
    assert data["model_used"] == rank2_id
    mock_invoke.assert_called_once()
    assert mock_invoke.call_args.kwargs["bedrock_model_id"] == rank2_id


@patch("app.services.governance_service.governance_service.get_rules_for_org")
@patch("app.routes.prompt.get_connection")
def test_retry_with_model_outside_top3_returns_400(mock_conn, mock_rules):
    mock_conn.return_value = VERIFIED_CONN
    mock_rules.return_value = ALLOW_ALL_THREE
    res = client.post("/api/prompt/route", json={
        "prompt": "Summarize this quarterly revenue report.",
        "retry_bedrock_model_id": "meta.llama3-3-70b-instruct-v1:0",  # not in the allowed pool at all
    })
    assert res.status_code == 400


@patch("app.services.governance_service.governance_service.get_rules_for_org")
@patch("app.routes.prompt.get_connection")
def test_empty_allow_list_returns_400(mock_conn, mock_rules):
    mock_conn.return_value = VERIFIED_CONN
    mock_rules.return_value = [
        GovernanceRule(org_id="demo-user-uuid", rule_type="allow_list", mode="enforce", config={"allowed_bedrock_model_ids": []}),
    ]
    res = client.post("/api/prompt/route", json={"prompt": "Hello"})
    assert res.status_code == 400


@patch("app.services.governance_service.governance_service.get_rules_for_org")
@patch("app.routes.prompt.get_connection")
def test_guessed_model_outside_allowed_pool_returns_400(mock_conn, mock_rules):
    mock_conn.return_value = VERIFIED_CONN
    mock_rules.return_value = [
        GovernanceRule(org_id="demo-user-uuid", rule_type="allow_list", mode="enforce", config={"allowed_bedrock_model_ids": [
            "anthropic.claude-sonnet-5", "amazon.nova-micro-v1:0"
        ]}),
    ]
    res = client.post("/api/prompt/route", json={
        "prompt": "Hello",
        "guessed_bedrock_model_id": "meta.llama3-3-70b-instruct-v1:0",
    })
    assert res.status_code == 400


@patch("app.services.bedrock_invoke_service.bedrock_invoke_service.invoke")
@patch("app.services.governance_service.governance_service.get_rules_for_org")
@patch("app.routes.prompt.get_connection")
def test_invocation_failure_returns_200_with_error_and_top3(mock_conn, mock_rules, mock_invoke):
    mock_conn.return_value = VERIFIED_CONN
    mock_rules.return_value = ALLOW_ALL_THREE
    mock_invoke.side_effect = RuntimeError("ThrottlingException: rate exceeded")

    res = client.post("/api/prompt/route", json={"prompt": "Summarize this quarterly revenue report."})
    assert res.status_code == 200
    data = res.json()
    assert data["invocation_error"] is not None
    assert len(data["recommendations"]) > 0  # top-3 still returned so the UI can offer manual retry


def test_governance_rules_api():
    res = client.get("/api/governance/defaults")
    assert res.status_code == 200
    rules = res.json()
    assert len(rules) >= 2
    types = [r["rule_type"] for r in rules]
    assert "context_window" in types
    assert "throttle" in types
