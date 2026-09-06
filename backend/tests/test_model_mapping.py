import pytest
from app.services.model_mapping_service import ModelMappingService

def test_model_mapping_service_lookups():
    service = ModelMappingService()
    
    # Router -> Bedrock
    bedrock_id = service.get_bedrock_id("anthropic-claude-3-5-sonnet-v2")
    assert bedrock_id == "anthropic.claude-3-5-sonnet-20241022-v2:0"

    nova_id = service.get_bedrock_id("amazon-nova-pro")
    assert nova_id == "amazon.nova-pro-v1:0"

    # Bedrock -> Router
    r_id = service.get_router_id("amazon.nova-pro-v1:0")
    assert r_id == "amazon-nova-pro"

    r_claude = service.get_router_id("anthropic.claude-3-5-sonnet-20241022-v2:0")
    assert r_claude == "anthropic-claude-3-5-sonnet-v2"

    # Cross-region inference profile prefix normalization
    r_us_claude = service.get_router_id("us.anthropic.claude-3-5-sonnet-20241022-v2:0")
    assert r_us_claude == "anthropic-claude-3-5-sonnet-v2"

def test_allowed_catalog():
    service = ModelMappingService()
    catalog = service.get_allowed_catalog()
    assert len(catalog) >= 8
    names = [m.name for m in catalog]
    assert "Claude 3.5 Sonnet v2" in names
    assert "Amazon Nova Pro" in names
    assert "Llama 3.3 70B Instruct" in names

def test_batch_conversions():
    service = ModelMappingService()
    bedrock_ids = [
        "anthropic.claude-3-5-sonnet-20241022-v2:0",
        "amazon.nova-pro-v1:0",
        "meta.llama3-3-70b-instruct-v1:0"
    ]
    router_ids = service.to_router_ids(bedrock_ids)
    assert "anthropic-claude-3-5-sonnet-v2" in router_ids
    assert "amazon-nova-pro" in router_ids
    assert "meta-llama-3-3-70b-instruct" in router_ids

    # Round trip
    back_to_bedrock = service.to_bedrock_ids(router_ids)
    assert set(back_to_bedrock) == set(bedrock_ids)
