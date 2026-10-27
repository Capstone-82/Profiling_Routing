from typing import List
from fastapi import APIRouter, Depends, HTTPException
from app.auth.supabase_auth import CurrentUser, get_current_user

from app.schemas import GovernanceRuleSchema
from app.services.governance_service import (
    governance_service,
    GovernanceRule,
    DEFAULT_GOVERNANCE_RULES,
)

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
