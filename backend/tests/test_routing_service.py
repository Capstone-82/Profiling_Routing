import pytest
from app.services.routing_service import RoutingService

def test_routing_service_basic():
    service = RoutingService.get_instance()
    prompt = "Design a multi-cloud GenAI governance architecture for enterprise scale."
    
    result = service.route(
        prompt=prompt,
        allowed_model_ids=["claude-sonnet-5", "claude-haiku-4-5-20251001", "amazon-nova-pro"],
        top_n=2
    )

    assert result is not None
    assert result.prompt_profile is not None
    assert result.prompt_profile.domain != ""
    assert result.prompt_profile.complexity_score >= 0.0
    assert len(result.recommendations) > 0
    assert result.recommendations[0].model_id in ["claude-sonnet-5", "claude-haiku-4-5-20251001", "amazon-nova-pro"]
