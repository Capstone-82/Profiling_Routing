import sys
import os
from unittest.mock import patch

# Ensure backend directory is in python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

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


def run_all_e2e_tests():
    print("=================================================================")
    print("         RUNNING END-TO-END PRODUCTION ROUTE & GOVERNANCE TESTS  ")
    print("=================================================================")

    # Test 1: Catalog endpoint
    res = client.get("/api/prompt/catalog")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    catalog = res.json()
    assert len(catalog) >= 8, f"Expected at least 8 models, got {len(catalog)}"
    print(f"[TEST 1 PASS] GET /api/prompt/catalog returned {len(catalog)} Bedrock models.")

    # Test 2: Unconnected AWS role check on profile
    with patch("app.routes.prompt.get_connection", return_value=MOCK_UNVERIFIED_CONNECTION):
        res = client.post("/api/prompt/profile", json={"prompt": "Analyze AWS GDPR compliance."})
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"
        assert "not verified" in res.json()["detail"].lower()
        print("[TEST 2 PASS] POST /api/prompt/profile strictly returned 403 Forbidden when AWS is disconnected.")

    # Test 3: Unconnected AWS role check on route
    with patch("app.routes.prompt.get_connection", return_value=MOCK_UNVERIFIED_CONNECTION):
        res = client.post("/api/prompt/route", json={"prompt": "Analyze AWS GDPR compliance."})
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"
        assert "not verified" in res.json()["detail"].lower()
        print("[TEST 3 PASS] POST /api/prompt/route strictly returned 403 Forbidden when AWS is disconnected.")

    # Test 4: Profile prompt with verified connection
    with patch("app.routes.prompt.get_connection", return_value=MOCK_VERIFIED_CONNECTION):
        res = client.post(
            "/api/prompt/profile",
            json={"prompt": "Analyze AWS GDPR compliance and multi-region failover strategies."},
            headers={"X-User-ID": "test-user-e2e"}
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "profile" in data
        assert "dimensions" in data["profile"]
        assert len(data["recommendations"]) > 0
        top = data["recommendations"][0]
        assert top["rank"] == 1
        assert "anthropic" in top["bedrock_model_id"] or "amazon" in top["bedrock_model_id"] or "meta" in top["bedrock_model_id"]
        print(f"[TEST 4 PASS] POST /api/prompt/profile succeeded: Resolved Tier {data['resolved_tier']}, Top Rec = {top['display_name']} ({top['bedrock_model_id']}).")

    # Test 5: Route prompt invokes Rank #1 model by default
    with patch("app.routes.prompt.get_connection", return_value=MOCK_VERIFIED_CONNECTION), \
         patch("app.services.bedrock_invoke_service.BedrockInvokeService.invoke") as mock_invoke:

        mock_invoke.return_value = {
            "text": "# Architecture Analysis\n\n- Multi-region failover configured.\n- Cross-region replication enabled.",
            "tokens_used": 240,
            "latency_ms": 480.2,
            "simulated": False
        }

        res = client.post(
            "/api/prompt/route",
            json={"prompt": "Design a resilient microservices architecture for multi-region cloud deployment."},
            headers={"X-User-ID": "test-user-e2e"}
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["model_used"] == "anthropic.claude-3-5-sonnet-20241022-v2:0"
        assert "Claude 3.5 Sonnet" in data["model_used_name"]
        assert data["tokens_used"] == 240
        assert data["latency_ms"] == 480.2
        assert len(data["recommendations"]) >= 1
        print(f"[TEST 5 PASS] POST /api/prompt/route invoked Rank #1 ({data['model_used_name']}) and returned Markdown response.")

    # Test 6: Manual retry with Rank #2 model
    with patch("app.routes.prompt.get_connection", return_value=MOCK_VERIFIED_CONNECTION), \
         patch("app.services.bedrock_invoke_service.BedrockInvokeService.invoke") as mock_invoke:

        mock_invoke.return_value = {
            "text": "Response from Amazon Nova Pro.",
            "tokens_used": 190,
            "latency_ms": 280.0,
            "simulated": False
        }

        res = client.post(
            "/api/prompt/route",
            json={
                "prompt": "Design a resilient microservices architecture for multi-region cloud deployment.",
                "retry_bedrock_model_id": "amazon.nova-pro-v1:0"
            },
            headers={"X-User-ID": "test-user-e2e"}
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["model_used"] == "amazon.nova-pro-v1:0"
        assert "Amazon Nova Pro" in data["model_used_name"]
        print(f"[TEST 6 PASS] Manual retry with Rank #2 invoked specified target model ({data['model_used_name']}).")

    # Test 7: Guessed model outside candidate pool returns 400
    with patch("app.routes.prompt.get_connection", return_value=MOCK_VERIFIED_CONNECTION):
        res = client.post(
            "/api/prompt/route",
            json={
                "prompt": "Simple greeting prompt",
                "guessed_bedrock_model_id": "nonexistent.fake-model:0"
            },
            headers={"X-User-ID": "test-user-e2e"}
        )
        assert res.status_code == 400
        assert "candidate pool" in res.json()["detail"].lower()
        print("[TEST 7 PASS] Invalid guessed model outside candidate pool returned 400 Bad Request.")

    # Test 8: Retry with model outside top 3 returns 400
    with patch("app.routes.prompt.get_connection", return_value=MOCK_VERIFIED_CONNECTION):
        res = client.post(
            "/api/prompt/route",
            json={
                "prompt": "Simple greeting prompt",
                "retry_bedrock_model_id": "unrecommended.arbitrary-model:0"
            },
            headers={"X-User-ID": "test-user-e2e"}
        )
        assert res.status_code == 400
        assert "top 3 recommendations" in res.json()["detail"].lower()
        print("[TEST 8 PASS] Retry with unrecommended model outside top 3 returned 400 Bad Request.")

    # Test 9: Governance rule enforcement blocking
    # Set strict context window limit of 5 tokens
    client.post(
        "/api/governance/rules",
        json={
            "rule_type": "context_window",
            "mode": "enforce",
            "config": {"max_input_tokens": 5, "min_input_tokens": 1}
        },
        headers={"X-User-ID": "test-user-e2e"}
    )

    with patch("app.routes.prompt.get_connection", return_value=MOCK_VERIFIED_CONNECTION):
        res = client.post(
            "/api/prompt/route",
            json={"prompt": "This is a very long prompt containing far more than five input tokens to trigger policy block."},
            headers={"X-User-ID": "test-user-e2e"}
        )
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"
        assert "governance policy violation" in res.json()["detail"].lower()
        print("[TEST 9 PASS] Governance policy strict enforcement (403 Forbidden) successfully blocked oversized prompt.")

    print("\n=================================================================")
    print("      ALL 9 END-TO-END VERIFICATION TESTS PASSED SUCCESSFULLY!   ")
    print("=================================================================")


if __name__ == "__main__":
    run_all_e2e_tests()
