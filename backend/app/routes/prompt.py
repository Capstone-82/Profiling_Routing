import logging
from typing import Optional, List, Dict, Any
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
    Evaluates governance context window and throttle policies purely without recording usage.
    """
    user_id = x_user_id or "demo-user-uuid"

    # Step 1: Verify customer AWS Bedrock connection
    conn = await get_connection(x_user_id=user_id)
    if conn.status != "verified":
        raise HTTPException(
            status_code=403,
            detail="AWS Bedrock connection not verified. Please connect an IAM Role on the Connections page before routing prompts."
        )

    connected_bedrock_ids = [m.providerModelId for m in conn.availableModels]
    if not connected_bedrock_ids:
        raise HTTPException(
            status_code=403,
            detail="No accessible Bedrock models detected for your verified AWS IAM role."
        )

    # Step 2: Run pure governance evaluations
    gov_result = await governance_service.evaluate_prompt(
        org_id=user_id,
        prompt=req.prompt,
        max_tokens=req.max_tokens
    )

    allowed_bedrock_ids = gov_result.allowed_bedrock_model_ids
    if not allowed_bedrock_ids:
        raise HTTPException(
            status_code=400,
            detail="Governance Allow-list is empty. Please enable at least one Bedrock model in Governance settings."
        )

    # Step 3: Intersect: connected Bedrock models ∩ allowed Bedrock models
    candidate_bedrock_ids = [b for b in connected_bedrock_ids if b in allowed_bedrock_ids]
    if not candidate_bedrock_ids:
        raise HTTPException(
            status_code=400,
            detail="No models available that are both enabled on your AWS account and permitted by your Governance Allow-list."
        )

    # Convert Bedrock candidate IDs to Router model IDs
    candidate_router_ids = model_mapping_service.to_router_ids(candidate_bedrock_ids)

    # Step 4: Route prompt across candidate pool only
    routing_result = routing_service.route(
        prompt=req.prompt,
        allowed_model_ids=candidate_router_ids,
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
        recs.append(ModelRecommendationSchema(
            rank=r.rank,
            model_id=r.model_id,
            bedrock_model_id=r.bedrock_model_id,
            display_name=r.display_name,
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
        warnings=routing_result.warnings
    )


@router.post("", response_model=ModelResponse)
@router.post("/route", response_model=ModelResponse)
async def route_and_invoke_prompt(
    req: PromptRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """
    Production Bedrock Routing Pipeline:
    1. Resolve user ID from X-User-ID.
    2. Fetch verified connection (403 if not connected).
    3. Fetch connected Bedrock models.
    4. Fetch governance rules & allowed_bedrock_model_ids (400 if empty).
    5. Intersect: connected Bedrock models ∩ allowed Bedrock models (400 if empty).
    6. Validate user guess if provided (must be in candidate pool).
    7. Evaluate governance rules (403 if enforce rule fails).
    8. Profile prompt & route across candidate pool only (top 3 recommendations).
    9. Choose invocation target: Rank #1 normally, requested retry model if in top 3.
    10. Invoke Bedrock with customer IAM role.
    11. Record throttle/usage.
    12. Return markdown response and metadata.
    """
    user_id = x_user_id or "demo-user-uuid"

    # 1 & 2: Fetch verified connection
    conn = await get_connection(x_user_id=user_id)
    if conn.status != "verified":
        raise HTTPException(
            status_code=403,
            detail="AWS Bedrock connection not verified. Please connect an IAM Role on the Connections page before routing prompts."
        )

    # 3: Fetch connected Bedrock model IDs
    connected_bedrock_ids = [m.providerModelId for m in conn.availableModels]
    if not connected_bedrock_ids:
        raise HTTPException(
            status_code=403,
            detail="No accessible Bedrock models detected for your verified AWS IAM role."
        )

    # 4: Fetch governance rules & evaluate
    gov_result = await governance_service.evaluate_prompt(
        org_id=user_id,
        prompt=req.prompt,
        max_tokens=req.max_tokens
    )

    allowed_bedrock_ids = gov_result.allowed_bedrock_model_ids
    if not allowed_bedrock_ids:
        raise HTTPException(
            status_code=400,
            detail="Governance Allow-list is empty. Please enable at least one Bedrock model in Governance settings."
        )

    # 5: Intersect: connected Bedrock models ∩ allowed Bedrock models
    candidate_bedrock_ids = [b for b in connected_bedrock_ids if b in allowed_bedrock_ids]
    if not candidate_bedrock_ids:
        raise HTTPException(
            status_code=400,
            detail="No models available that are both connected to your AWS Bedrock account and permitted by your Governance Allow-list."
        )

    # 6: Validate guessed model if provided
    guessed_id = req.guessed_bedrock_model_id or req.preferredModelId or req.preferred_model_id
    if guessed_id:
        # Match against candidate pool
        if guessed_id not in candidate_bedrock_ids and not any(guessed_id in c for c in candidate_bedrock_ids):
            raise HTTPException(
                status_code=400,
                detail=f"Guessed model '{guessed_id}' is not in your allowed & connected Bedrock candidate pool."
            )

    # 7: Governance enforcement gate
    gov_schemas = [
        GovernanceEvaluationSchema(
            rule_type=e.rule_type,
            passed=e.passed,
            mode=e.mode,
            message=e.message,
            details=e.details
        ) for e in gov_result.evaluations
    ]

    if gov_result.blocked_by_enforce:
        failed_msgs = [e.message for e in gov_result.evaluations if not e.passed and e.mode == "enforce"]
        raise HTTPException(
            status_code=403,
            detail="Governance policy violation: " + " | ".join(failed_msgs)
        )

    # 8: Convert candidate Bedrock IDs to Router IDs and Route
    candidate_router_ids = model_mapping_service.to_router_ids(candidate_bedrock_ids)

    routing_result = routing_service.route(
        prompt=req.prompt,
        allowed_model_ids=candidate_router_ids,
        max_tokens=req.max_tokens,
        enterprise_criticality=req.enterprise_criticality or "standard",
        top_n=3,
    )

    if not routing_result.recommendations:
        raise HTTPException(
            status_code=422,
            detail="No candidate models passed routing capability and context filters for this prompt."
        )

    # Build recommendations list
    all_recs: List[ModelRecommendationSchema] = []
    for r in routing_result.recommendations:
        all_recs.append(ModelRecommendationSchema(
            rank=r.rank,
            model_id=r.model_id,
            bedrock_model_id=r.bedrock_model_id,
            display_name=r.display_name,
            provider=r.provider,
            tier=r.tier,
            estimated_cost_usd=r.estimated_cost_usd,
            domain_match_count=r.domain_match_count,
            reasons=r.reasons,
            routing_score=r.routing_score,
        ))

    # 9: Determine invocation target (Rank #1 by default, or specific valid retry model)
    target_rec = all_recs[0]
    target_bedrock_id = target_rec.bedrock_model_id

    if req.retry_bedrock_model_id:
        # User requested manual retry with rank #2 or #3
        matching_recs = [r for r in all_recs if r.bedrock_model_id == req.retry_bedrock_model_id or r.model_id == req.retry_bedrock_model_id]
        if not matching_recs:
            raise HTTPException(
                status_code=400,
                detail=f"Requested retry model '{req.retry_bedrock_model_id}' is not among the top 3 recommendations for this prompt."
            )
        target_rec = matching_recs[0]
        target_bedrock_id = target_rec.bedrock_model_id

    # 10: Invoke Bedrock Foundation Model
    invocation_error = None
    invoke_res = None

    try:
        logger.info(f"Invoking Bedrock model {target_bedrock_id} (Rank #{target_rec.rank} - {target_rec.display_name})")
        invoke_res = bedrock_invoke_service.invoke(
            role_arn=conn.roleArn,
            external_id=user_id,
            bedrock_model_id=target_bedrock_id,
            prompt=req.prompt,
            max_tokens=req.max_tokens or 1500,
        )
    except Exception as e:
        logger.error(f"Invocation of {target_bedrock_id} failed: {e}")
        invocation_error = str(e)
        raise HTTPException(
            status_code=502,
            detail=f"Bedrock invocation failed for {target_rec.display_name} ({target_bedrock_id}): {str(e)}"
        )

    # 11: Record throttle / usage attempt
    p = routing_result.prompt_profile
    governance_service.record_request_attempt(user_id, p.input_token_count)

    # 12: User Guess Analysis
    user_guess_info = None
    if guessed_id:
        guessed_display = model_mapping_service.get_display_name(guessed_id)
        is_match = (guessed_id == target_bedrock_id or model_mapping_service.get_router_id(guessed_id) == target_rec.model_id)
        if is_match:
            insight = f"Your guessed model ({guessed_display}) matched the AI Router recommendation as the optimal model for this prompt."
        else:
            insight = f"You guessed {guessed_display}, but AI Router routed to {target_rec.display_name} (Rank #{target_rec.rank}) as the optimal model for complexity Tier {routing_result.resolved_tier} (Score: {p.complexity_score:.2f})."
        user_guess_info = {
            "guessed_model_id": guessed_id,
            "guessed_model_name": guessed_display,
            "is_match": is_match,
            "comparison_insight": insight,
        }

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

    return ModelResponse(
        text=invoke_res["text"],
        model_used=target_bedrock_id,
        model_used_name=target_rec.display_name,
        routed_model_id=target_rec.model_id,
        profile_summary=profile_summary,
        governance_evaluations=gov_schemas,
        recommendations=all_recs,
        user_guess=user_guess_info,
        warnings=routing_result.warnings,
        invocation_error=invocation_error,
        tier=routing_result.resolved_tier,
        complexity_score=p.complexity_score,
        cost_estimate=target_rec.estimated_cost_usd,
        tokens_used=invoke_res.get("tokens_used"),
        latency_ms=invoke_res.get("latency_ms"),
        routing_reason=target_rec.reasons,
    )
