import pytest
from app.services.review_queue_service import review_queue_service
from app.services.analytics_service import analytics_service


def test_review_queue_lifecycle():
    org_id = "test-org-123"

    # Seeded items check
    items = review_queue_service.list_items(org_id)
    assert len(items) >= 3
    assert any(i.guardrail == "prompt_injection" for i in items)

    # Filter by pending
    pending_items = review_queue_service.list_items(org_id, status="PENDING")
    assert all(i.status == "PENDING" for i in pending_items)

    # Add a new item
    new_item = review_queue_service.add_item(
        org_id=org_id,
        guardrail="hallucination",
        prompt="Test prompt for review",
        findings=[{"claim": "Unverified claim", "status": "CONTRADICTED"}],
        confidence=0.91,
        severity="HIGH",
    )
    assert new_item.id is not None
    assert new_item.status == "PENDING"
    assert new_item.severity == "HIGH"

    # Resolve the item (Approve)
    resolved = review_queue_service.resolve_item(
        org_id=org_id,
        item_id=new_item.id,
        status="APPROVED",
        reviewer_id="compliance_officer@corestack.io",
        notes="Approved exception after manual audit.",
    )
    assert resolved is not None
    assert resolved.status == "APPROVED"
    assert resolved.reviewed_by == "compliance_officer@corestack.io"
    assert resolved.resolution_notes == "Approved exception after manual audit."


def test_analytics_metrics_calculation():
    org_id = "analytics-org-456"

    # Fetch baseline analytics
    analytics = analytics_service.get_analytics(org_id)
    assert analytics.total_requests > 0
    assert analytics.passed_requests >= 0
    assert analytics.cost_saved_usd >= 0.0
    assert analytics.savings_percentage > 0.0
    assert len(analytics.guardrail_breakdown) > 0

    # Record a new event
    analytics_service.record_event(
        org_id=org_id,
        prompt="Sample routed prompt for analytics",
        model_used="anthropic.claude-3-5-haiku-20241022-v1:0",
        tokens_in=500,
        tokens_out=200,
        cost_usd=0.0003,
        baseline_cost_usd=0.0035,
        status="PASSED",
        guardrail_triggers=["conciseness"],
        latency_ms=620.0,
    )

    updated = analytics_service.get_analytics(org_id)
    assert len(updated.recent_activity) > 0
    assert updated.recent_activity[0]["prompt_snippet"].startswith("Sample routed prompt")
