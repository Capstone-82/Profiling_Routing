import logging
from typing import Optional, List, Dict

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
    UserGuessSchema,
)
from app.services.governance_service import governance_service
from app.services.routing_service import routing_service
from app.services.model_mapping_service import model_mapping_service
from app.services.bedrock_invoke_service import bedrock_invoke_service
from app.routes.connection import get_connection

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/prompt", tags=["Prompt Routing"])


def _display_names() -> Dict[str, str]:
    """bedrock_model_id -> catalog display name, for the currently maintained Bedrock catalog."""
    return {c.get("providerModelId"): c.get("name") for c in model_mapping_service.catalog}


def _profile_summary_schema(profile) -> ProfileSummarySchema:
    return ProfileSummarySchema(
        domain=profile.domain,
        intent=profile.intent,
        task_type=profile.task_type,
        derived_tier=profile.derived_tier,
        resolved_tier=profile.derived_tier,
        complexity_score=profile.complexity_score,
        confidence=profile.confidence,
        reasoning_chain_detected=profile.reasoning_chain_detected,
        research_signals=profile.research_signals,
        input_token_count=profile.input_token_count,
        est_output_tokens=profile.est_output_tokens,
        dimensions=DimensionBreakdown(
            d1_semantic_complexity=profile.d1,
            d2_domain_specificity=profile.d2,
            d3_output_formality=profile.d3,
            d4_research_dependency=profile.d4,
            d5_context_requirement=profile.d5,
        ),
    )


async def _resolve_verified_connection(x_user_id: Optional[str], user_id: str):
    conn = await get_connection(x_user_id=x_user_id)
    if conn.status != "verified":
        raise HTTPException(
            status_code=403,
            detail="AWS Bedrock connection is not verified. Connect and verify your AWS account first.",
        )
    return conn


@router.get("/catalog", response_model=List[ModelSchema])
async def get_allowed_bedrock_catalog():
    """Returns the hardcoded, maintained allowed Bedrock model catalog."""
    return model_mapping_service.get_allowed_catalog()


@router.post("/profile", response_model=ProfileOnlyResponse)
async def profile_prompt(
    req: PromptRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
):
    """
    Profiles and routes a prompt against the caller's real allowed candidate pool without
    invoking Bedrock. Requires a verified AWS connection -- no full-catalog fallback.
    Does not consume throttle/quota (preview only).
    """
    user_id = x_user_id or "demo-user-uuid"
    conn = await _resolve_verified_connection(x_user_id, user_id)

    gov_result = await governance_service.evaluate_prompt(
        org_id=user_id, prompt=req.prompt, max_tokens=req.max_tokens
    )

    connected_bedrock_ids = [m.providerModelId for m in conn.availableModels]
    allowed_bedrock_ids = gov_result.allowed_bedrock_model_ids or []
    if not allowed_bedrock_ids:
        raise HTTPException(status_code=400, detail="Governance allow-list is empty. No models are permitted.")

    candidate_bedrock_ids = set(connected_bedrock_ids) & set(allowed_bedrock_ids)
    if not candidate_bedrock_ids:
        raise HTTPException(
            status_code=400,
            detail="No models are both Bedrock-enabled on your account and permitted by governance rules.",
        )

    candidate_friendly_ids = [
        fid for fid in (model_mapping_service.get_friendly_id(b) for b in candidate_bedrock_ids) if fid
    ]

    routing_result = routing_service.route(
        prompt=req.prompt,
        allowed_model_ids=candidate_friendly_ids,
        max_tokens=req.max_tokens,
        top_n=3,
    )

    names = _display_names()
    recs = []
    for r in routing_result.recommendations:
        b_id = model_mapping_service.get_bedrock_id(r.model_id)
        recs.append(ModelRecommendationSchema(
            rank=r.rank,
            model_id=r.model_id,
            bedrock_model_id=b_id,
            display_name=names.get(b_id),
            provider=r.provider,
            tier=r.tier,
            estimated_cost_usd=r.estimated_cost_usd,
            domain_match_count=r.domain_match_count,
            reasons=r.reasons,
            routing_score=r.routing_score,
        ))

    gov_schemas = [
        GovernanceEvaluationSchema(rule_type=e.rule_type, passed=e.passed, mode=e.mode, message=e.message, details=e.details)
        for e in gov_result.evaluations
    ]

    return ProfileOnlyResponse(
        profile=_profile_summary_schema(routing_result.prompt_profile),
        resolved_tier=routing_result.resolved_tier,
        recommendations=recs,
        rejections=routing_result.rejections,
        governance_evaluations=gov_schemas,
        warnings=routing_result.warnings,
    )


@router.post("/route", response_model=ModelResponse)
async def route_and_invoke_prompt(
    req: PromptRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
):
    """
    Production pipeline: governance -> profile -> route (top 3, allowed-models-only) -> invoke rank #1.

    No automatic fallback. If `retry_bedrock_model_id` is supplied, it is validated against a freshly
    recomputed top-3 and invoked instead of rank #1 -- this is the only path a non-#1 model is invoked.
    Invocation failure does not raise: the response is still 200 with `invocation_error` set and the
    full top-3 recommendations attached, so the caller can offer a manual retry.
    """
    user_id = x_user_id or "demo-user-uuid"
    conn = await _resolve_verified_connection(x_user_id, user_id)

    gov_result = await governance_service.evaluate_prompt(
        org_id=user_id, prompt=req.prompt, max_tokens=req.max_tokens
    )
    gov_schemas = [
        GovernanceEvaluationSchema(rule_type=e.rule_type, passed=e.passed, mode=e.mode, message=e.message, details=e.details)
        for e in gov_result.evaluations
    ]

    if gov_result.blocked_by_enforce:
        failed_msgs = [e.message for e in gov_result.evaluations if not e.passed and e.mode == "enforce"]
        raise HTTPException(status_code=403, detail="Governance policy violation: " + " | ".join(failed_msgs))

    connected_bedrock_ids = [m.providerModelId for m in conn.availableModels]
    allowed_bedrock_ids = gov_result.allowed_bedrock_model_ids or []
    if not allowed_bedrock_ids:
        raise HTTPException(status_code=400, detail="Governance allow-list is empty. No models are permitted.")

    candidate_bedrock_ids = set(connected_bedrock_ids) & set(allowed_bedrock_ids)
    if not candidate_bedrock_ids:
        raise HTTPException(
            status_code=400,
            detail="No models are both Bedrock-enabled on your account and permitted by governance rules.",
        )

    if req.guessed_bedrock_model_id and req.guessed_bedrock_model_id not in candidate_bedrock_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Guessed model '{req.guessed_bedrock_model_id}' is not in the allowed candidate pool.",
        )

    candidate_friendly_ids = [
        fid for fid in (model_mapping_service.get_friendly_id(b) for b in candidate_bedrock_ids) if fid
    ]

    routing_result = routing_service.route(
        prompt=req.prompt,
        allowed_model_ids=candidate_friendly_ids,
        max_tokens=req.max_tokens,
        top_n=3,
    )
    if not routing_result.recommendations:
        raise HTTPException(
            status_code=422,
            detail="No candidate models passed routing capability and context filters for this prompt.",
        )

    names = _display_names()
    recs = []
    for r in routing_result.recommendations:
        b_id = model_mapping_service.get_bedrock_id(r.model_id)
        recs.append(ModelRecommendationSchema(
            rank=r.rank,
            model_id=r.model_id,
            bedrock_model_id=b_id,
            display_name=names.get(b_id),
            provider=r.provider,
            tier=r.tier,
            estimated_cost_usd=r.estimated_cost_usd,
            domain_match_count=r.domain_match_count,
            reasons=r.reasons,
            routing_score=r.routing_score,
        ))

    # Choose invocation target: rank #1 by default, or a validated retry model from the current top 3.
    if req.retry_bedrock_model_id:
        target = next((r for r in recs if r.bedrock_model_id == req.retry_bedrock_model_id), None)
        if target is None:
            raise HTTPException(
                status_code=400,
                detail=f"Retry model '{req.retry_bedrock_model_id}' is not in the current top {len(recs)} recommendations.",
            )
    else:
        target = recs[0]

    invocation_error: Optional[str] = None
    text = ""
    tokens_used = None
    latency_ms = None
    try:
        invoke_res = bedrock_invoke_service.invoke(
            role_arn=conn.roleArn,
            external_id=user_id,
            bedrock_model_id=target.bedrock_model_id,
            prompt=req.prompt,
            max_tokens=req.max_tokens or 1500,
        )
        text = invoke_res["text"]
        tokens_used = invoke_res.get("tokens_used")
        latency_ms = invoke_res.get("latency_ms")
    except Exception as e:
        logger.warning(f"Invocation of {target.bedrock_model_id} (rank {target.rank}) failed: {e}")
        invocation_error = str(e)

    # Record this attempt against throttle/quota counters -- once, regardless of outcome.
    governance_service.record_request_attempt(user_id, gov_result.estimated_input_tokens)

    user_guess: Optional[UserGuessSchema] = None
    if req.guessed_bedrock_model_id:
        guessed_rec = next((r for r in recs if r.bedrock_model_id == req.guessed_bedrock_model_id), None)
        guessed_name = guessed_rec.display_name if guessed_rec else names.get(req.guessed_bedrock_model_id)
        matched = req.guessed_bedrock_model_id == target.bedrock_model_id
        if matched:
            insight = f"Your guess ({guessed_name}) matched the routing engine's top pick."
        else:
            insight = (
                f"You guessed {guessed_name}, but the router chose {target.display_name} "
                f"(tier {routing_result.resolved_tier}, complexity {routing_result.prompt_profile.complexity_score:.2f})."
            )
        user_guess = UserGuessSchema(
            bedrock_model_id=req.guessed_bedrock_model_id,
            display_name=guessed_name,
            matched_top_pick=matched,
            insight=insight,
        )

    return ModelResponse(
        text=text,
        model_used=target.bedrock_model_id,
        model_used_name=target.display_name,
        profile_summary=_profile_summary_schema(routing_result.prompt_profile),
        governance_evaluations=gov_schemas,
        recommendations=recs,
        user_guess=user_guess,
        warnings=routing_result.warnings,
        invocation_error=invocation_error,
        tokens_used=tokens_used,
        latency_ms=latency_ms,
    )
