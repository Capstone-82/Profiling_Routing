import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Header

from app.schemas import (
    PromptRequest,
    ModelResponse,
    ProfileOnlyResponse,
    ProfileSummarySchema,
    DimensionBreakdown,
    ModelRecommendationSchema,
    GovernanceEvaluationSchema,
    ModelSchema,
)
from app.services.governance_service import governance_service
from app.services.routing_service import routing_service
from app.services.model_mapping_service import model_mapping_service
from app.services.bedrock_invoke_service import bedrock_invoke_service
from app.routes.connection import get_connection

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/prompt", tags=["Prompt Routing"])

@router.get("/catalog", response_model=List[ModelSchema])
async def get_allowed_bedrock_catalog():
    """Returns the hardcoded, maintained allowed Bedrock model catalog."""
    return model_mapping_service.get_allowed_catalog()

@router.post("/profile", response_model=ProfileOnlyResponse)
async def profile_prompt(
    req: PromptRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """
    Profiles prompt and returns routing recommendations without invoking AWS Bedrock.
    Useful for testing and governance previews.
    """
    user_id = x_user_id or "demo-user-uuid"

    # 1. Run Governance evaluations
    gov_result = await governance_service.evaluate_prompt(
        org_id=user_id,
        prompt=req.prompt,
        user_specified_models=req.selectedModelIds,
        max_tokens=req.max_tokens
    )

    # 2. Intersect candidates: Connected Bedrock models ∩ Governance allow-list
    conn = await get_connection(x_user_id=user_id)
    connected_bedrock_ids = [m.providerModelId for m in conn.availableModels] if conn.status == "verified" else []
    
    # If no connection verified yet, use all mapped Bedrock models for demo
    if not connected_bedrock_ids:
        connected_bedrock_ids = list(model_mapping_service.bedrock_to_friendly.keys())

    candidate_friendly_ids, mapping_warnings = model_mapping_service.intersect_candidates(
        user_selected_friendly_or_bedrock_ids=None,
        connected_bedrock_model_ids=connected_bedrock_ids,
        allow_listed_friendly_ids=gov_result.allowed_models,
    )

    # 3. Route prompt against allowed models
    routing_result = routing_service.route(
        prompt=req.prompt,
        allowed_model_ids=candidate_friendly_ids,
        max_tokens=req.max_tokens,
        enterprise_criticality=req.enterprise_criticality or "standard",
        top_n=3,
    )

    p = routing_result.prompt_profile
    profile_summary = ProfileSummarySchema(
        domain=p.domain,
        intent=p.intent,
        task_type=p.task_type,
        derived_tier=p.derived_tier,
        resolved_tier=routing_result.resolved_tier,
        complexity_score=p.complexity_score,
        confidence=p.confidence,
        reasoning_chain_detected=p.reasoning_chain_detected,
        research_signals=p.research_signals,
        input_token_count=p.input_token_count,
        est_output_tokens=p.est_output_tokens,
        dimensions=DimensionBreakdown(
            d1_semantic_complexity=p.d1,
            d2_domain_specificity=p.d2,
            d3_output_formality=p.d3,
            d4_research_dependency=p.d4,
            d5_context_requirement=p.d5,
        )
    )

    recs = []
    for r in routing_result.recommendations:
        b_id = model_mapping_service.get_bedrock_id(r.model_id)
        recs.append(ModelRecommendationSchema(
            rank=r.rank,
            model_id=r.model_id,
            bedrock_model_id=b_id,
            provider=r.provider,
            tier=r.tier,
            estimated_cost_usd=r.estimated_cost_usd,
            domain_match_count=r.domain_match_count,
            reasons=r.reasons,
            routing_score=r.routing_score,
        ))

    gov_schemas = [
        GovernanceEvaluationSchema(
            rule_type=e.rule_type,
            passed=e.passed,
            mode=e.mode,
            message=e.message,
            details=e.details
        ) for e in gov_result.evaluations
    ]

    return ProfileOnlyResponse(
        profile=profile_summary,
        resolved_tier=routing_result.resolved_tier,
        recommendations=recs,
        rejections=routing_result.rejections,
        governance_evaluations=gov_schemas,
        warnings=routing_result.warnings + mapping_warnings
    )

@router.post("", response_model=ModelResponse)
@router.post("/route", response_model=ModelResponse)
async def route_and_invoke_prompt(
    req: PromptRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """
    Main End-to-End pipeline:
    1. Governance check (allow-list, throttling, context window)
    2. Prompt Profiling & Complexity evaluation
    3. Optimal Model Routing across all Allowed Bedrock Models (recommends top 3)
    4. Invocation dispatch: Top 1 -> fallback to Top 2 -> fallback to Top 3
    5. Response Normalization, Benchmark Insight, & Audit metadata
    """
    user_id = x_user_id or "demo-user-uuid"

    # Step 1: Governance check
    gov_result = await governance_service.evaluate_prompt(
        org_id=user_id,
        prompt=req.prompt,
        user_specified_models=req.selectedModelIds,
        max_tokens=req.max_tokens
    )

    gov_schemas = [
        GovernanceEvaluationSchema(
            rule_type=e.rule_type,
            passed=e.passed,
            mode=e.mode,
            message=e.message,
            details=e.details
        ) for e in gov_result.evaluations
    ]

    # If blocked by strict enforcement, return 403 error with evaluations
    if gov_result.blocked_by_enforce:
        failed_msgs = [e.message for e in gov_result.evaluations if not e.passed and e.mode == "enforce"]
        err_msg = "Governance policy violation: " + " | ".join(failed_msgs)
        raise HTTPException(status_code=403, detail=err_msg)

    # Step 2: Fetch customer connection (IAM Role ARN + enabled models)
    conn = await get_connection(x_user_id=user_id)
    connected_bedrock_ids = [m.providerModelId for m in conn.availableModels] if conn.status == "verified" else []
    
    # Fallback to standard catalog if in test mode without verified AWS account
    if not connected_bedrock_ids:
        connected_bedrock_ids = list(model_mapping_service.bedrock_to_friendly.keys())

    # Identify user's optional selected / preferred model for comparison benchmarking
    user_preferred_raw = req.preferredModelId or req.preferred_model_id or (req.selectedModelIds[0] if (req.selectedModelIds and len(req.selectedModelIds) > 0) else None)
    user_selected_friendly = model_mapping_service.to_friendly_id(user_preferred_raw) if user_preferred_raw else None

    # Candidate pool is always the Allowed Models (connected Bedrock models ∩ governance allow-list).
    # We do NOT restrict routing to the user's manual selection — router always picks optimal model from allowed pool.
    candidate_friendly_ids, mapping_warnings = model_mapping_service.intersect_candidates(
        user_selected_friendly_or_bedrock_ids=None,
        connected_bedrock_model_ids=connected_bedrock_ids,
        allow_listed_friendly_ids=gov_result.allowed_models,
    )

    if not candidate_friendly_ids:
        raise HTTPException(
            status_code=400,
            detail="No routable models available that satisfy the Allow-list policy and Bedrock enablement."
        )

    # Step 3: Run Prompt Profiling & Model Routing Engine (Top 3 recommendations)
    routing_result = routing_service.route(
        prompt=req.prompt,
        allowed_model_ids=candidate_friendly_ids,
        max_tokens=req.max_tokens,
        enterprise_criticality=req.enterprise_criticality or "standard",
        top_n=3,
    )

    if not routing_result.recommendations:
        raise HTTPException(
            status_code=422,
            detail="No candidate models passed routing capability and context filters for this prompt."
        )

    # Step 4: Dispatch to Bedrock with cascade fallback: Top 1 -> Top 2 -> Top 3
    invoke_res = None
    winning_rec = None
    actual_routed_bedrock_id = None
    actual_friendly_id = None
    actual_reasons = []
    fallback_chain = []
    errors = []

    for rec in routing_result.recommendations[:3]:
        target_bedrock_id = model_mapping_service.get_bedrock_id(rec.model_id)
        if not target_bedrock_id:
            continue
        try:
            logger.info(f"Attempting invocation of rank {rec.rank} model: {rec.model_id} ({target_bedrock_id})")
            invoke_res = bedrock_invoke_service.invoke(
                role_arn=conn.roleArn if conn.status == "verified" else None,
                external_id=user_id,
                bedrock_model_id=target_bedrock_id,
                prompt=req.prompt,
                max_tokens=req.max_tokens or 1500,
            )
            winning_rec = rec
            actual_routed_bedrock_id = target_bedrock_id
            actual_friendly_id = rec.model_id
            actual_reasons = rec.reasons
            break
        except Exception as e:
            logger.warning(f"Rank {rec.rank} model {target_bedrock_id} failed: {e}. Attempting next fallback...")
            fallback_chain.append(target_bedrock_id)
            errors.append(f"Rank {rec.rank} ({rec.model_id}): {str(e)}")

    if not invoke_res or not winning_rec:
        raise HTTPException(
            status_code=502,
            detail=f"All top candidate models failed to invoke: {' | '.join(errors)}"
        )

    fallback_used = len(fallback_chain) > 0
    fallback_from = fallback_chain[0] if fallback_chain else None

    # Format profile summary
    p = routing_result.prompt_profile
    profile_summary = ProfileSummarySchema(
        domain=p.domain,
        intent=p.intent,
        task_type=p.task_type,
        derived_tier=p.derived_tier,
        resolved_tier=routing_result.resolved_tier,
        complexity_score=p.complexity_score,
        confidence=p.confidence,
        reasoning_chain_detected=p.reasoning_chain_detected,
        research_signals=p.research_signals,
        input_token_count=p.input_token_count,
        est_output_tokens=p.est_output_tokens,
        dimensions=DimensionBreakdown(
            d1_semantic_complexity=p.d1,
            d2_domain_specificity=p.d2,
            d3_output_formality=p.d3,
            d4_research_dependency=p.d4,
            d5_context_requirement=p.d5,
        )
    )

    all_recs = []
    for r in routing_result.recommendations:
        all_recs.append(ModelRecommendationSchema(
            rank=r.rank,
            model_id=r.model_id,
            bedrock_model_id=model_mapping_service.get_bedrock_id(r.model_id),
            provider=r.provider,
            tier=r.tier,
            estimated_cost_usd=r.estimated_cost_usd,
            domain_match_count=r.domain_match_count,
            reasons=r.reasons,
            routing_score=r.routing_score,
        ))

    # Display name lookup
    display_name = actual_friendly_id.replace("-", " ").title()
    for cat_item in model_mapping_service.catalog:
        pm_id = cat_item.get("providerModelId", "")
        if (
            cat_item.get("friendly_id") == actual_friendly_id
            or pm_id == actual_routed_bedrock_id
            or (pm_id and actual_routed_bedrock_id.endswith(pm_id))
        ):
            display_name = cat_item["name"]
            break

    # Look up user selected model display name
    user_selected_display_name = None
    if user_preferred_raw:
        for cat_item in model_mapping_service.catalog:
            pm_id = cat_item.get("providerModelId", "")
            if (
                cat_item.get("id") == user_preferred_raw
                or cat_item.get("friendly_id") == user_selected_friendly
                or pm_id == user_preferred_raw
                or (pm_id and user_preferred_raw.endswith(pm_id))
            ):
                user_selected_display_name = cat_item["name"]
                break
        if not user_selected_display_name and user_selected_friendly:
            user_selected_display_name = user_selected_friendly.replace("-", " ").title()

    comparison_insight = None
    if user_selected_display_name:
        if user_selected_friendly == actual_friendly_id:
            comparison_insight = f"Your chosen model ({user_selected_display_name}) matched the routing engine recommendation as the optimal model for this prompt."
        else:
            comparison_insight = f"You selected {user_selected_display_name}, but Prompt Profiler analyzed your prompt (Tier {routing_result.resolved_tier}, Complexity: {p.complexity_score:.2f}) and routed to {display_name} as the optimal model satisfying your governance policies and cost constraints."

    return ModelResponse(
        text=invoke_res["text"],
        model_used=actual_routed_bedrock_id,
        model_used_name=display_name,
        routed_model_id=actual_friendly_id,
        user_selected_model=user_preferred_raw,
        user_selected_model_name=user_selected_display_name,
        comparison_insight=comparison_insight,
        routing_reason=actual_reasons,
        tier=routing_result.resolved_tier,
        complexity_score=p.complexity_score,
        cost_estimate=winning_rec.estimated_cost_usd,
        tokens_used=invoke_res.get("tokens_used"),
        latency_ms=invoke_res.get("latency_ms"),
        fallback_used=fallback_used,
        fallback_from=fallback_from,
        fallback_chain=fallback_chain,
        fallback_count=len(fallback_chain),
        governance_evaluations=gov_schemas,
        profile_summary=profile_summary,
        recommendations=all_recs,
        warnings=routing_result.warnings + mapping_warnings
    )
