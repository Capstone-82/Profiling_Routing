import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app
from app.schemas import ConnectionResponse, ModelSchema

client = TestClient(app)

MOCK_VERIFIED_CONNECTION = ConnectionResponse(
    provider="aws-bedrock",
    status="verified",
    roleArn="arn:aws:iam::123456789012:role/BedrockExecutionRole",
    availableModels=[
        ModelSchema(
            id="anthropic.claude-3-5-sonnet-20241022-v2:0",
            name="Claude 3.5 Sonnet v2",
            provider="Anthropic",
            providerModelId="anthropic.claude-3-5-sonnet-20241022-v2:0",
            contextWindow="200K tokens",
            category="Quality-First"
        ),
        ModelSchema(
            id="amazon.nova-pro-v1:0",
            name="Amazon Nova Pro",
            provider="Amazon",
            providerModelId="amazon.nova-pro-v1:0",
            contextWindow="300K tokens",
            category="Balanced"
        ),
        ModelSchema(
            id="amazon.nova-micro-v1:0",
            name="Amazon Nova Micro",
            provider="Amazon",
            providerModelId="amazon.nova-micro-v1:0",
            contextWindow="128K tokens",
            category="Speed & Economy"
        ),
        ModelSchema(
            id="meta.llama3-3-70b-instruct-v1:0",
            name="Llama 3.3 70B Instruct",
            provider="Meta",
            providerModelId="meta.llama3-3-70b-instruct-v1:0",
            contextWindow="128K tokens",
            category="Balanced"
        )
    ]
)

MOCK_UNVERIFIED_CONNECTION = ConnectionResponse(
    provider="aws-bedrock",
    status="not_connected",
    availableModels=[]
)

def test_get_allowed_catalog():
    res = client.get("/api/prompt/catalog")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 8
    assert any("Claude 3.5 Sonnet" in m["name"] for m in data)
    assert any("Amazon Nova" in m["name"] for m in data)

@patch("app.routes.prompt.get_connection")
def test_route_without_verified_connection_returns_403(mock_get_conn):
    mock_get_conn.return_value = MOCK_UNVERIFIED_CONNECTION

    res = client.post("/api/prompt/route", json={"prompt": "Analyze this code."})
    assert res.status_code == 403
    assert "not verified" in res.json()["detail"].lower()

@patch("app.routes.prompt.get_connection")
def test_profile_without_verified_connection_returns_403(mock_get_conn):
    mock_get_conn.return_value = MOCK_UNVERIFIED_CONNECTION

    res = client.post("/api/prompt/profile", json={"prompt": "Analyze this code."})
    assert res.status_code == 403
    assert "not verified" in res.json()["detail"].lower()

@patch("app.routes.prompt.get_connection")
@patch("app.services.bedrock_invoke_service.BedrockInvokeService.invoke")
def test_route_and_invoke_rank_1_by_default(mock_invoke, mock_get_conn):
    mock_get_conn.return_value = MOCK_VERIFIED_CONNECTION
    mock_invoke.return_value = {
        "text": "# Code Analysis\n\nThis is a clean markdown response from Claude 3.5 Sonnet.",
        "tokens_used": 180,
        "latency_ms": 420.5,
        "simulated": False
    }

    payload = {
        "prompt": "Evaluate GDPR compliance impact on multi-region AWS cloud data pipelines."
    }
    res = client.post("/api/prompt/route", json=payload, headers={"X-User-ID": "test-user-uuid"})
    assert res.status_code == 200
    data = res.json()

    assert "text" in data
    assert data["model_used"] == "anthropic.claude-3-5-sonnet-20241022-v2:0"
    assert "Claude 3.5 Sonnet" in data["model_used_name"]
    assert len(data["recommendations"]) > 0
    assert data["recommendations"][0]["rank"] == 1
    assert data["profile_summary"]["derived_tier"] in ["T1", "T2", "T3"]

@patch("app.routes.prompt.get_connection")
@patch("app.services.bedrock_invoke_service.BedrockInvokeService.invoke")
def test_manual_retry_with_rank_2(mock_invoke, mock_get_conn):
    mock_get_conn.return_value = MOCK_VERIFIED_CONNECTION
    mock_invoke.return_value = {
        "text": "Response from Amazon Nova Pro.",
        "tokens_used": 150,
        "latency_ms": 310.0,
        "simulated": False
    }

    # Request manual retry specifying Amazon Nova Pro
    payload = {
        "prompt": "Evaluate GDPR compliance impact on multi-region AWS cloud data pipelines.",
        "retry_bedrock_model_id": "amazon.nova-pro-v1:0"
    }
    res = client.post("/api/prompt/route", json=payload, headers={"X-User-ID": "test-user-uuid"})
    assert res.status_code == 200
    data = res.json()

    assert data["model_used"] == "amazon.nova-pro-v1:0"
    assert "Amazon Nova Pro" in data["model_used_name"]

@patch("app.routes.prompt.get_connection")
def test_guessed_model_outside_candidate_pool_returns_400(mock_get_conn):
    mock_get_conn.return_value = MOCK_VERIFIED_CONNECTION

    payload = {
        "prompt": "Write a python script",
        "guessed_bedrock_model_id": "unsupported.model-v1:0"
    }
    res = client.post("/api/prompt/route", json=payload, headers={"X-User-ID": "test-user-uuid"})
    assert res.status_code == 400
    assert "candidate pool" in res.json()["detail"].lower()

@patch("app.routes.prompt.get_connection")
def test_retry_with_unrecommended_model_returns_400(mock_get_conn):
    mock_get_conn.return_value = MOCK_VERIFIED_CONNECTION

    payload = {
        "prompt": "Write a python script",
        "retry_bedrock_model_id": "random.unrecommended-model-v1:0"
    }
    res = client.post("/api/prompt/route", json=payload, headers={"X-User-ID": "test-user-uuid"})
    assert res.status_code == 400
    assert "top 3 recommendations" in res.json()["detail"].lower()
