import asyncio
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.model_mapping_service import model_mapping_service
from app.services.governance_service import governance_service, GovernanceRule, throttle_tracker
from app.services.routing_service import routing_service
from app.schemas import ConnectionResponse, ModelSchema

def run_sync_tests():
    print("\n--- Running Model Mapping Tests ---")
    b_id = model_mapping_service.get_bedrock_id("anthropic-claude-3-5-sonnet-v2")
    assert b_id == "anthropic.claude-3-5-sonnet-20241022-v2:0", f"Expected claude 3.5 sonnet v2, got {b_id}"
    print("[PASS] get_bedrock_id('anthropic-claude-3-5-sonnet-v2') ->", b_id)

    r_id = model_mapping_service.get_router_id("amazon.nova-pro-v1:0")
    assert r_id == "amazon-nova-pro", f"Expected amazon-nova-pro, got {r_id}"
    print("[PASS] get_router_id('amazon.nova-pro-v1:0') ->", r_id)

    r_us_id = model_mapping_service.get_router_id("us.meta.llama3-3-70b-instruct-v1:0")
    assert r_us_id == "meta-llama-3-3-70b-instruct", f"Expected meta-llama-3-3-70b-instruct, got {r_us_id}"
    print("[PASS] get_router_id with us. prefix ->", r_us_id)

    catalog = model_mapping_service.get_allowed_catalog()
    assert len(catalog) >= 8
    print(f"[PASS] Catalog has {len(catalog)} models with verified Bedrock provider IDs.")

    # Test routing
    print("\n--- Running Routing Tests ---")
    candidate_router_ids = model_mapping_service.to_router_ids([
        "anthropic.claude-3-5-sonnet-20241022-v2:0",
        "amazon.nova-pro-v1:0",
        "meta.llama3-3-70b-instruct-v1:0"
    ])
    result = routing_service.route(
        prompt="Design a fault-tolerant multi-region AWS cloud data pipeline with real-time stream processing.",
        allowed_model_ids=candidate_router_ids,
        max_tokens=1500,
        top_n=3
    )
    assert len(result.recommendations) > 0
    top_rec = result.recommendations[0]
    assert top_rec.rank == 1
    assert top_rec.bedrock_model_id is not None
    assert top_rec.display_name is not None
    print(f"[PASS] Route result: Resolved Tier {result.resolved_tier}, Rank #1 = {top_rec.display_name} ({top_rec.bedrock_model_id})")

async def run_async_tests():
    print("\n--- Running Governance Policy Tests ---")
    org_id = "test-org-verify"

    # Context window rule
    cw_rule = GovernanceRule(
        org_id=org_id,
        rule_type="context_window",
        mode="enforce",
        config={"max_input_tokens": 5, "min_input_tokens": 1}
    )
    await governance_service.save_rule(cw_rule)

    res_fail = await governance_service.evaluate_prompt(org_id, "This is a long prompt exceeding five tokens limit easily")
    assert res_fail.blocked_by_enforce is True
    print("[PASS] Context window enforce strictly blocked oversized prompt (blocked_by_enforce = True).")

    # Allow list rule with Bedrock IDs
    al_rule = GovernanceRule(
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
    await governance_service.save_rule(al_rule)

    res_al = await governance_service.evaluate_prompt(org_id, "Short prompt")
    assert "anthropic.claude-3-5-sonnet-20241022-v2:0" in res_al.allowed_bedrock_model_ids
    print(f"[PASS] Allow-list returned {len(res_al.allowed_bedrock_model_ids)} permitted Bedrock IDs.")

    # Throttle purity check
    initial_rpm = throttle_tracker.get_stats(org_id)["rpm"]
    await governance_service.evaluate_prompt(org_id, "Test eval 1")
    await governance_service.evaluate_prompt(org_id, "Test eval 2")
    after_eval_rpm = throttle_tracker.get_stats(org_id)["rpm"]
    assert initial_rpm == after_eval_rpm
    print("[PASS] evaluate_prompt did NOT mutate throttle counter (Pure evaluation verified).")

if __name__ == "__main__":
    run_sync_tests()
    asyncio.run(run_async_tests())
    print("\n=== ALL BACKEND UNIT & INTEGRATION TESTS PASSED SUCCESSFULLY! ===")
