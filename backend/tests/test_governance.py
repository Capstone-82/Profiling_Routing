import pytest
from app.services.governance_service import GovernanceService, GovernanceRule, throttle_tracker

@pytest.mark.asyncio
async def test_governance_context_window_enforce():
    service = GovernanceService()
    org_id = "test-org-context"

    rule = GovernanceRule(
        org_id=org_id,
        rule_type="context_window",
        mode="enforce",
        config={"max_input_tokens": 5, "min_input_tokens": 1}
    )
    await service.save_rule(rule)

    long_prompt = "This is a very long prompt with way too many words for token limit"
    res = await service.evaluate_prompt(org_id, long_prompt)

    assert res.blocked_by_enforce is True
    assert res.passed is False
    cw_eval = next(e for e in res.evaluations if e.rule_type == "context_window")
    assert cw_eval.passed is False
    assert cw_eval.mode == "enforce"

@pytest.mark.asyncio
async def test_governance_throttle_does_not_mutate_on_evaluate():
    service = GovernanceService()
    org_id = "test-org-throttle-pure"

    rule = GovernanceRule(
        org_id=org_id,
        rule_type="throttle",
        mode="enforce",
        config={"rate_limit_rpm": 2}
    )
    await service.save_rule(rule)

    # Initial stats should be empty
    initial_stats = throttle_tracker.get_stats(org_id)
    assert initial_stats["rpm"] == 0

    # Multiple evaluate_prompt calls should NOT increase rpm
    await service.evaluate_prompt(org_id, "Prompt 1")
    await service.evaluate_prompt(org_id, "Prompt 2")
    await service.evaluate_prompt(org_id, "Prompt 3")

    stats_after_eval = throttle_tracker.get_stats(org_id)
    assert stats_after_eval["rpm"] == 0

    # Explicit record_request_attempt SHOULD record
    service.record_request_attempt(org_id, 100)
    service.record_request_attempt(org_id, 100)
    stats_after_record = throttle_tracker.get_stats(org_id)
    assert stats_after_record["rpm"] == 2

@pytest.mark.asyncio
async def test_governance_allow_list_bedrock_ids():
    service = GovernanceService()
    org_id = "test-org-allow-list"

    rule = GovernanceRule(
        org_id=org_id,
        rule_type="allow_list",
        mode="enforce",
        config={
            "allowed_bedrock_model_ids": [
                "anthropic.claude-3-5-sonnet-20241022-v2:0",
                "amazon.nova-pro-v1:0"
            ]
        }
    )
    await service.save_rule(rule)

    res = await service.evaluate_prompt(org_id, "Hello world")
    assert res.passed is True
    assert len(res.allowed_bedrock_model_ids) == 2
    assert "anthropic.claude-3-5-sonnet-20241022-v2:0" in res.allowed_bedrock_model_ids
