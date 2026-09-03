import pytest
from app.services.model_mapping_service import ModelMappingService

def test_model_mapping_service_lookups():
    service = ModelMappingService()
    
    # Friendly -> Bedrock
    bedrock_id = service.get_bedrock_id("claude-sonnet-5")
    assert bedrock_id is not None
    assert "claude-3-5-sonnet" in bedrock_id

    nova_id = service.get_bedrock_id("amazon-nova-pro")
    assert nova_id == "amazon.nova-pro-v1:0"

    # Bedrock -> Friendly
    f_id = service.get_friendly_id("amazon.nova-pro-v1:0")
    assert f_id == "amazon-nova-pro"

    f_claude = service.get_friendly_id("anthropic.claude-3-5-sonnet-20241022-v2:0")
    assert f_claude == "claude-sonnet-5"

def test_allowed_catalog():
    service = ModelMappingService()
    catalog = service.get_allowed_catalog()
    assert len(catalog) >= 5
    names = [m.name for m in catalog]
    assert "Claude 3.5 Sonnet" in names
    assert "Amazon Nova Pro" in names

def test_intersect_candidates():
    service = ModelMappingService()
    connected_bedrock = [
        "anthropic.claude-3-5-sonnet-20241022-v2:0",
        "amazon.nova-pro-v1:0",
        "meta.llama3-3-70b-instruct-v1:0"
    ]
    
    # Case 1: Allow list has sonnet & nova
    candidates, warnings = service.intersect_candidates(
        user_selected_friendly_or_bedrock_ids=None,
        connected_bedrock_model_ids=connected_bedrock,
        allow_listed_friendly_ids=["claude-sonnet-5", "amazon-nova-pro"]
    )
    assert "claude-sonnet-5" in candidates
    assert "amazon-nova-pro" in candidates
    assert "llama-3.3-70b" not in candidates

    # Case 2: User specified only nova
    candidates_user, _ = service.intersect_candidates(
        user_selected_friendly_or_bedrock_ids=["amazon-nova-pro"],
        connected_bedrock_model_ids=connected_bedrock,
        allow_listed_friendly_ids=["claude-sonnet-5", "amazon-nova-pro"]
    )
    assert candidates_user == ["amazon-nova-pro"]
