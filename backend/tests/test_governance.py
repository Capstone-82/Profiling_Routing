import pytest
from app.services.governance_service import GovernanceService, GovernanceRule, throttle_tracker

@pytest.mark.asyncio
async def test_governance_context_window_enforce():
    service = GovernanceService()
    org_id = "test-org-1"

    # Set strict context window rule
    rule = GovernanceRule(
        org_id=org_id,
        rule_type="context_window",
        mode="enforce",
        config={"max_input_tokens": 5, "min_input_tokens": 1}
    )
    await service.save_rule(rule)

    # Prompt with 10 words (exceeds 5 tokens)
    long_prompt = "This is a very long prompt with way too many words for token limit"
    res = await service.evaluate_prompt(org_id, long_prompt)

    assert res.blocked_by_enforce is True
    assert res.passed is False
    cw_eval = next(e for e in res.evaluations if e.rule_type == "context_window")
    assert cw_eval.passed is False
    assert cw_eval.mode == "enforce"

@pytest.mark.asyncio
async def test_governance_throttle_dry_run():
    service = GovernanceService()
    org_id = "test-org-2"

    # Set throttle limit to 1 rpm in dry_run mode
    rule = GovernanceRule(
        org_id=org_id,
        rule_type="throttle",
        mode="dry_run",
        config={"rate_limit_rpm": 1}
    )
    await service.save_rule(rule)

    # Send first request
    res1 = await service.evaluate_prompt(org_id, "Hello")
    assert res1.passed is True

    # Send second request immediately (exceeds 1 rpm)
    res2 = await service.evaluate_prompt(org_id, "Hello again")
    # Because it is dry_run, blocked_by_enforce should be False, but evaluation flag is False
    assert res2.blocked_by_enforce is False
    throttle_eval = next(e for e in res2.evaluations if e.rule_type == "throttle")
    assert throttle_eval.passed is False
    assert throttle_eval.mode == "dry_run"
