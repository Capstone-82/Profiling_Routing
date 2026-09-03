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

    # 2. Intersect candidates
    conn = await get_connection(x_user_id=user_id)
    connected_bedrock_ids = [m.providerModelId for m in conn.availableModels] if conn.status == "verified" else []
    
    # If no connection verified yet, use all mapped Bedrock models for demo
    if not connected_bedrock_ids:
        connected_bedrock_ids = list(model_mapping_service.bedrock_to_friendly.keys())

    candidate_friendly_ids, mapping_warnings = model_mapping_service.intersect_candidates(
        user_selected_friendly_or_bedrock_ids=req.selectedModelIds,
        connected_bedrock_model_ids=connected_bedrock_ids,
        allow_listed_friendly_ids=gov_result.allowed_models,
    )

    # 3. Route prompt
    routing_result = routing_service.route(
        prompt=req.prompt,
        allowed_model_ids=candidate_friendly_ids,
        max_tokens=req.max_tokens,
        enterprise_criticality=req.enterprise_criticality or "standard",
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
    3. Optimal Model Routing against allowed Bedrock models
    4. Bedrock InvokeModel dispatch via customer's IAM AssumeRole credentials
    5. Response Normalization & Audit metadata
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

    candidate_friendly_ids, mapping_warnings = model_mapping_service.intersect_candidates(
        user_selected_friendly_or_bedrock_ids=req.selectedModelIds,
        connected_bedrock_model_ids=connected_bedrock_ids,
        allow_listed_friendly_ids=gov_result.allowed_models,
    )

    if not candidate_friendly_ids:
        raise HTTPException(
            status_code=400,
            detail="No routable models available that satisfy the Allow-list, user selection, and Bedrock enablement."
        )

    # Step 3: Run Prompt Profiling & Model Routing Engine
    routing_result = routing_service.route(
        prompt=req.prompt,
        allowed_model_ids=candidate_friendly_ids,
        max_tokens=req.max_tokens,
        enterprise_criticality=req.enterprise_criticality or "standard",
    )

    if not routing_result.recommendations:
        raise HTTPException(
            status_code=422,
            detail="No candidate models passed routing capability and context filters for this prompt."
        )

    # Top-ranked recommendation
    primary_rec = routing_result.recommendations[0]
    routed_friendly_id = primary_rec.model_id
    routed_bedrock_id = model_mapping_service.get_bedrock_id(routed_friendly_id) or "anthropic.claude-3-5-sonnet-20241022-v2:0"

    # Step 4: Dispatch to Bedrock (with fallback to #2 candidate if primary invocation fails)
    fallback_used = False
    fallback_from = None
    invoke_res = None
    actual_routed_bedrock_id = routed_bedrock_id
    actual_friendly_id = routed_friendly_id
    actual_reasons = primary_rec.reasons

    try:
        invoke_res = bedrock_invoke_service.invoke(
            role_arn=conn.roleArn if conn.status == "verified" else None,
            external_id=user_id,
            bedrock_model_id=routed_bedrock_id,
            prompt=req.prompt,
            max_tokens=req.max_tokens or 1500,
        )
    except Exception as e:
        logger.warning(f"Primary routed model {routed_bedrock_id} failed: {e}. Attempting fallback...")
        if len(routing_result.recommendations) > 1:
            fallback_rec = routing_result.recommendations[1]
            fallback_friendly_id = fallback_rec.model_id
            fallback_bedrock_id = model_mapping_service.get_bedrock_id(fallback_friendly_id)
            if fallback_bedrock_id:
                try:
                    invoke_res = bedrock_invoke_service.invoke(
                        role_arn=conn.roleArn if conn.status == "verified" else None,
                        external_id=user_id,
                        bedrock_model_id=fallback_bedrock_id,
                        prompt=req.prompt,
                        max_tokens=req.max_tokens or 1500,
                    )
                    fallback_used = True
                    fallback_from = routed_bedrock_id
                    actual_routed_bedrock_id = fallback_bedrock_id
                    actual_friendly_id = fallback_friendly_id
                    actual_reasons = fallback_rec.reasons
                except Exception as fb_err:
                    logger.error(f"Fallback model {fallback_bedrock_id} also failed: {fb_err}")
                    raise HTTPException(
                        status_code=502,
                        detail=f"Both primary model ({routed_bedrock_id}) and fallback model ({fallback_bedrock_id}) failed: {fb_err}"
                    )
        if not invoke_res:
            raise HTTPException(
                status_code=502,
                detail=f"Bedrock invocation failed on {routed_bedrock_id}: {str(e)}"
            )

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
        if cat_item.get("friendly_id") == actual_friendly_id or cat_item.get("providerModelId") == actual_routed_bedrock_id:
            display_name = cat_item["name"]
            break

    return ModelResponse(
        text=invoke_res["text"],
        model_used=actual_routed_bedrock_id,
        model_used_name=display_name,
        routed_model_id=actual_friendly_id,
        routing_reason=actual_reasons,
        tier=routing_result.resolved_tier,
        complexity_score=p.complexity_score,
        cost_estimate=primary_rec.estimated_cost_usd,
        tokens_used=invoke_res.get("tokens_used"),
        latency_ms=invoke_res.get("latency_ms"),
        fallback_used=fallback_used,
        fallback_from=fallback_from,
        governance_evaluations=gov_schemas,
        profile_summary=profile_summary,
        recommendations=all_recs,
        warnings=routing_result.warnings + mapping_warnings
    )
