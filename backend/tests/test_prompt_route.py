import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_get_allowed_catalog():
    res = client.get("/api/prompt/catalog")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 5
    assert any("Claude" in m["name"] for m in data)

def test_profile_prompt_endpoint():
    payload = {
        "prompt": "Evaluate GDPR compliance impact on data pipelines in AWS and Azure."
    }
    res = client.post("/api/prompt/profile", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "profile" in data
    assert "dimensions" in data["profile"]
    assert "recommendations" in data
    assert len(data["recommendations"]) > 0

def test_route_and_invoke_prompt_simulated():
    payload = {
        "prompt": "Summarize this quarterly revenue report."
    }
    res = client.post("/api/prompt/route", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "text" in data
    assert "model_used" in data
    assert "tier" in data
    assert "complexity_score" in data
    assert "governance_evaluations" in data

def test_governance_rules_api():
    res = client.get("/api/governance/defaults")
    assert res.status_code == 200
    rules = res.json()
    assert len(rules) >= 2
    types = [r["rule_type"] for r in rules]
    assert "context_window" in types
    assert "throttle" in types
