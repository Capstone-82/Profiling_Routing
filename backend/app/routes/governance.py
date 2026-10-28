from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from app.auth.supabase_auth import CurrentUser, get_current_user

from app.schemas import (
    GovernanceRuleSchema,
    ReviewQueueItemSchema,
    ReviewResolveRequest,
    GovernanceAnalyticsSchema,
)
from app.services.governance_service import (
    governance_service,
    GovernanceRule,
    DEFAULT_GOVERNANCE_RULES,
)
from app.services.review_queue_service import review_queue_service
from app.services.analytics_service import analytics_service

router = APIRouter(prefix="/api/governance", tags=["Governance Rules"])


@router.get("/rules", response_model=List[GovernanceRuleSchema])
async def get_rules(current_user: CurrentUser = Depends(get_current_user)):
    """Get all configured governance rules for the user/organization."""
    user_id = current_user.organization_id
    rules = await governance_service.get_rules_for_org(user_id)
    return [
        GovernanceRuleSchema(
            id=r.id,
            org_id=r.org_id,
            rule_type=r.rule_type,
            scope=r.scope,
            scope_target=r.scope_target,
            config=r.config,
            mode=r.mode
        ) for r in rules
    ]

@router.post("/rules", response_model=GovernanceRuleSchema)
async def create_or_update_rule(
    rule_req: GovernanceRuleSchema,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Upsert a governance rule (allow_list, throttle, context_window)."""
    user_id = current_user.organization_id
    rule = GovernanceRule(
        id=rule_req.id,
        org_id=user_id,
        rule_type=rule_req.rule_type,
        scope=rule_req.scope,
        scope_target=rule_req.scope_target,
        config=rule_req.config,
        mode=rule_req.mode
    )
    saved = await governance_service.save_rule(rule)
    return GovernanceRuleSchema(
        id=saved.id,
        org_id=saved.org_id,
        rule_type=saved.rule_type,
        scope=saved.scope,
        scope_target=saved.scope_target,
        config=saved.config,
        mode=saved.mode
    )


@router.put("/rules/{rule_id}", response_model=GovernanceRuleSchema)
async def update_rule(
    rule_id: str,
    rule_req: GovernanceRuleSchema,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update one governance rule without allowing the caller to change its tenant."""
    rule = GovernanceRule(
        id=rule_id,
        org_id=current_user.organization_id,
        rule_type=rule_req.rule_type,
        scope=rule_req.scope,
        scope_target=rule_req.scope_target,
        config=rule_req.config,
        mode=rule_req.mode,
    )
    saved = await governance_service.save_rule(rule)
    return GovernanceRuleSchema(
        id=saved.id,
        org_id=saved.org_id,
        rule_type=saved.rule_type,
        scope=saved.scope,
        scope_target=saved.scope_target,
        config=saved.config,
        mode=saved.mode,
    )


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_rule(
    rule_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete one governance rule belonging to the authenticated organization."""
    deleted = await governance_service.delete_rule(rule_id, current_user.organization_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Governance rule not found.")

@router.get("/defaults", response_model=List[GovernanceRuleSchema])
async def get_default_rules():
    """Returns platform default governance rule templates."""
    return [
        GovernanceRuleSchema(
            rule_type=r["rule_type"],
            scope="org",
            config=r["config"],
            mode=r["mode"]
        ) for r in DEFAULT_GOVERNANCE_RULES
    ]


@router.get("/review-queue", response_model=List[ReviewQueueItemSchema])
async def get_review_queue(
    status: Optional[str] = Query(None, description="Filter by status: PENDING, APPROVED, REJECTED"),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List flagged prompt/response items requiring human compliance review."""
    org_id = current_user.organization_id
    items = review_queue_service.list_items(org_id, status=status)
    return [
        ReviewQueueItemSchema(
            id=item.id,
            org_id=item.org_id,
            created_at=item.created_at,
            status=item.status,
            guardrail=item.guardrail,
            action=item.action,
            prompt=item.prompt,
            reference_context=item.reference_context,
            model_intended=item.model_intended,
            findings=item.findings,
            confidence=item.confidence,
            severity=item.severity,
            reviewed_by=item.reviewed_by,
            reviewed_at=item.reviewed_at,
            resolution_notes=item.resolution_notes,
        )
        for item in items
    ]


@router.post("/review-queue/{item_id}/resolve", response_model=ReviewQueueItemSchema)
async def resolve_review_item(
    item_id: str,
    resolve_req: ReviewResolveRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Approve or Reject a flagged item in the human review queue."""
    org_id = current_user.organization_id
    updated = review_queue_service.resolve_item(
        org_id=org_id,
        item_id=item_id,
        status=resolve_req.status,
        reviewer_id=current_user.email or current_user.user_id,
        notes=resolve_req.resolution_notes,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Review queue item not found.")
    return ReviewQueueItemSchema(
        id=updated.id,
        org_id=updated.org_id,
        created_at=updated.created_at,
        status=updated.status,
        guardrail=updated.guardrail,
        action=updated.action,
        prompt=updated.prompt,
        reference_context=updated.reference_context,
        model_intended=updated.model_intended,
        findings=updated.findings,
        confidence=updated.confidence,
        severity=updated.severity,
        reviewed_by=updated.reviewed_by,
        reviewed_at=updated.reviewed_at,
        resolution_notes=updated.resolution_notes,
    )


@router.get("/analytics", response_model=GovernanceAnalyticsSchema)
async def get_governance_analytics(
    current_user: CurrentUser = Depends(get_current_user),
):
    """Returns governance safety statistics and intelligent routing cost optimization metrics."""
    org_id = current_user.organization_id
    return analytics_service.get_analytics(org_id)

