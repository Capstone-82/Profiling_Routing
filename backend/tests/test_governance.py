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

    # Send first request, then record it as an actual attempt (evaluate_prompt itself no longer mutates)
    res1 = await service.evaluate_prompt(org_id, "Hello")
    assert res1.passed is True
    service.record_request_attempt(org_id, res1.estimated_input_tokens)

    # Send second request immediately (exceeds 1 rpm because the first attempt was recorded)
    res2 = await service.evaluate_prompt(org_id, "Hello again")
    # Because it is dry_run, blocked_by_enforce should be False, but evaluation flag is False
    assert res2.blocked_by_enforce is False
    throttle_eval = next(e for e in res2.evaluations if e.rule_type == "throttle")
    assert throttle_eval.passed is False
    assert throttle_eval.mode == "dry_run"


@pytest.mark.asyncio
async def test_evaluate_prompt_does_not_mutate_throttle():
    service = GovernanceService()
    org_id = "test-org-evaluate-only"

    stats_before = throttle_tracker.get_stats(org_id)
    await service.evaluate_prompt(org_id, "Hello there, just previewing.")
    stats_after = throttle_tracker.get_stats(org_id)

    assert stats_after == stats_before


@pytest.mark.asyncio
async def test_record_request_attempt_mutates_throttle():
    service = GovernanceService()
    org_id = "test-org-record-attempt"

    stats_before = throttle_tracker.get_stats(org_id)
    service.record_request_attempt(org_id, tokens=50)
    stats_after = throttle_tracker.get_stats(org_id)

    assert stats_after["rpm"] == stats_before["rpm"] + 1
    assert stats_after["tokens_24h"] == stats_before["tokens_24h"] + 50
