import logging
from typing import Optional, List, Dict

from fastapi import APIRouter, Depends, HTTPException

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
    PIIFindingSchema,
    ToxicityFindingSchema,
    PromptInjectionFindingSchema,
    HallucinationFindingSchema,
)
from app.services.governance_service import governance_service
from app.services.routing_service import routing_service
from app.services.model_mapping_service import model_mapping_service
from app.routes.connection import get_connection
from app.services.bedrock_invoke_service import bedrock_invoke_service
from app.services.pii_guardrail import pii_guardrail, PIIGuardrailError, settings_from_config
from app.services.toxicity_guardrail import (
    toxicity_guardrail,
    ToxicityGuardrailError,
    settings_from_config as toxicity_settings_from_config,
)
from app.services.prompt_injection_guardrail import (
    prompt_injection_guardrail,
    PromptInjectionGuardrailError,
    settings_from_config as prompt_injection_settings_from_config,
)
from app.services.hallucination_guardrail import (
    hallucination_guardrail,
    HallucinationGuardrailError,
    settings_from_config as hallucination_settings_from_config,
)
from app.services.conciseness_guardrail import (
    conciseness_guardrail,
    ConcisenessGuardrailError,
    settings_from_config as conciseness_settings_from_config,
    requested_length_from_prompt,
)
from app.services.racial_bias_guardrail import (
    racial_bias_guardrail,
    RacialBiasGuardrailError,
    settings_from_config as racial_bias_settings_from_config,
)
from app.auth.supabase_auth import CurrentUser, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/prompt", tags=["Prompt Routing"])


def _display_names() -> Dict[str, str]:
    """bedrock_model_id -> catalog display name, for the currently maintained Bedrock catalog."""
    return {c.get("providerModelId"): c.get("name") for c in model_mapping_service.catalog}


def _unified_display_names() -> Dict[str, str]:
    return {c.providerModelId: c.name for c in model_mapping_service.get_unified_catalog()}


def _requested_model_id(req: PromptRequest, retry: bool = False) -> Optional[str]:
    if retry:
        return req.retry_model_id or req.retry_bedrock_model_id
    return req.guessed_model_id or req.guessed_bedrock_model_id


def _model_aliases(model) -> set[str]:
    aliases = {model.providerModelId}
    if model.routerModelId:
        aliases.add(model.routerModelId)
    if model.cloudProvider == "aws-bedrock":
        friendly = model_mapping_service.get_friendly_id(model.providerModelId)
        if friendly:
            aliases.add(friendly)
    return aliases


def _allowed_connected_models(aws_conn, allowed_model_ids: List[str]):
    allowed = set(allowed_model_ids)
    models = []
    for model in aws_conn.availableModels or []:
        if _model_aliases(model) & allowed:
            models.append(model)
    return models


def _recommendation_schema(recommendation, names: Dict[str, str]) -> ModelRecommendationSchema:
    provider_model_id = recommendation.api_model_id or recommendation.model_id
    bedrock_model_id = provider_model_id if recommendation.cloud_provider == "aws-bedrock" else None
    if recommendation.cloud_provider == "aws-bedrock":
        bedrock_model_id = model_mapping_service.get_bedrock_id(recommendation.model_id) or provider_model_id
        provider_model_id = bedrock_model_id
    return ModelRecommendationSchema(
        rank=recommendation.rank,
        model_id=recommendation.model_id,
        bedrock_model_id=bedrock_model_id,
        provider_model_id=provider_model_id,
        display_name=recommendation.display_name or names.get(provider_model_id),
        provider=recommendation.provider,
        tier=recommendation.tier,
        estimated_cost_usd=recommendation.estimated_cost_usd,
        domain_match_count=recommendation.domain_match_count,
        reasons=recommendation.reasons,
        routing_score=recommendation.routing_score,
        cloud_provider=recommendation.cloud_provider,
        region=recommendation.region,
    )


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


async def _resolve_verified_connection(user_id: str):
    conn = await get_connection(
        current_user=CurrentUser(user_id=user_id, organization_id=user_id)
    )
    if conn.status != "verified":
        raise HTTPException(
            status_code=403,
            detail="AWS Bedrock connection is not verified. Connect and verify your AWS account first.",
        )
    return conn


async def _load_verified_connection(user_id: str):
    aws_connection = await get_connection(
        current_user=CurrentUser(user_id=user_id, organization_id=user_id)
    )
    if aws_connection.status != "verified":
        raise HTTPException(
            status_code=403,
            detail="AWS Bedrock connection is not verified. Connect and verify your AWS account first.",
        )
    return aws_connection


def _routing_inputs(aws_connection, allowed_model_ids: List[str]):
    connected = _allowed_connected_models(aws_connection, allowed_model_ids)
    if not connected:
        return [], [], []

    router_ids: List[str] = []
    for model in connected:
        router_id = model.routerModelId
        if not router_id and model.cloudProvider == "aws-bedrock":
            router_id = model_mapping_service.get_friendly_id(model.providerModelId)
        if not router_id:
            router_id = model.providerModelId
        if router_id:
            router_ids.append(router_id)

    return connected, list(dict.fromkeys(router_ids)), []


def _pii_findings(result) -> List[PIIFindingSchema]:
    return [
        PIIFindingSchema(
            entity_type=finding.entity_type,
            count=finding.count,
            max_score=round(finding.max_score, 4),
        )
        for finding in result.findings
    ]


def _toxicity_findings(result) -> List[ToxicityFindingSchema]:
    return [
        ToxicityFindingSchema(
            category=finding.category,
            score=round(finding.score, 4),
            count=finding.count,
        )
        for finding in result.findings
    ]


def _prompt_injection_findings(result) -> List[PromptInjectionFindingSchema]:
    return [
        PromptInjectionFindingSchema(
            category=finding.category,
            score=round(finding.score, 4),
            label=finding.label,
        )
        for finding in result.findings
    ]


def _hallucination_findings(result) -> List[HallucinationFindingSchema]:
    return [
        HallucinationFindingSchema(
            claim=finding.claim,
            status=finding.status,
            confidence=round(finding.confidence, 4),
            explanation=finding.explanation,
        )
        for finding in result.findings
    ]


@router.get("/catalog", response_model=List[ModelSchema])
async def get_allowed_bedrock_catalog():
    """Returns the maintained AWS and Vertex model catalog."""
    return model_mapping_service.get_unified_catalog()


@router.post("/profile", response_model=ProfileOnlyResponse)
async def profile_prompt(
    req: PromptRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Profiles and routes a prompt against the caller's real multi-provider candidate pool
    without invoking a model. Requires at least one verified provider connection.
    Does not consume throttle/quota (preview only).
    """
    user_id = current_user.user_id
    aws_connection = await _load_verified_connection(user_id)
    pii_config = await governance_service.get_pii_config(user_id)
    try:
        pii_settings = settings_from_config(pii_config)
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Invalid PII policy configuration.") from error
    try:
        input_scan = (
            pii_guardrail.apply(req.prompt, pii_config)
            if pii_settings.enabled and pii_settings.scan_input
            else pii_guardrail.scan(req.prompt, {"enabled": False})
        )
    except PIIGuardrailError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    if input_scan.detected and pii_settings.action == "BLOCK":
        raise HTTPException(status_code=403, detail="Prompt blocked by the configured PII policy.")
    prompt_text = input_scan.text
    toxicity_config = await governance_service.get_toxicity_config(user_id)
    try:
        toxicity_settings = toxicity_settings_from_config(toxicity_config)
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Invalid toxicity policy configuration.") from error
    if toxicity_settings.enabled and toxicity_settings.scan_input:
        try:
            toxicity_input_scan = toxicity_guardrail.apply(req.prompt, toxicity_config)
        except ToxicityGuardrailError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
        if toxicity_input_scan.detected and toxicity_settings.action in {"BLOCK", "REGENERATE"}:
            logger.info(
                "Toxicity input policy action=%s categories=%s",
                toxicity_settings.action,
                [finding.category for finding in toxicity_input_scan.findings],
            )
            raise HTTPException(status_code=403, detail="Prompt blocked by the configured toxicity policy.")
    else:
        toxicity_input_scan = toxicity_guardrail.scan(req.prompt, {"enabled": False})
    prompt_injection_config = await governance_service.get_prompt_injection_config(user_id)
    try:
        prompt_injection_settings = prompt_injection_settings_from_config(prompt_injection_config)
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Invalid prompt injection policy configuration.") from error
    if prompt_injection_settings.enabled and prompt_injection_settings.scan_input:
        try:
            prompt_injection_scan = prompt_injection_guardrail.apply(prompt_text, prompt_injection_config)
        except PromptInjectionGuardrailError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
        if prompt_injection_scan.detected and prompt_injection_settings.action in {"BLOCK", "REVIEW"}:
            logger.info(
                "Prompt injection input policy action=%s score=%s",
                prompt_injection_settings.action,
                prompt_injection_scan.findings[0].score,
            )
            raise HTTPException(
                status_code=403,
                detail="Prompt blocked by the configured prompt injection policy.",
            )
    else:
        prompt_injection_scan = prompt_injection_guardrail.scan(prompt_text, {"enabled": False})

    gov_result = await governance_service.evaluate_prompt(
        org_id=user_id, prompt=prompt_text, max_tokens=req.max_tokens
    )

    allowed_model_ids = gov_result.allowed_model_ids or []
    if not allowed_model_ids:
        raise HTTPException(status_code=400, detail="Governance allow-list is empty. No models are permitted.")

    connected_models, candidate_router_ids, provider_candidates = _routing_inputs(
        aws_connection, allowed_model_ids
    )
    if not connected_models:
        raise HTTPException(
            status_code=400,
            detail="No connected provider models are permitted by governance rules.",
        )

    routing_result = routing_service.route(
        prompt=prompt_text,
        allowed_model_ids=candidate_router_ids,
        max_tokens=req.max_tokens,
        top_n=3,
        provider_models=provider_candidates,
    )

    names = _unified_display_names()
    recs = [_recommendation_schema(r, names) for r in routing_result.recommendations]

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
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Production pipeline: governance -> profile -> route (top 3, allowed-models-only) -> invoke rank #1.

    No automatic fallback. If `retry_bedrock_model_id` is supplied, it is validated against a freshly
    recomputed top-3 and invoked instead of rank #1 -- this is the only path a non-#1 model is invoked.
    Invocation failure does not raise: the response is still 200 with `invocation_error` set and the
    full top-3 recommendations attached, so the caller can offer a manual retry.
    """
    user_id = current_user.user_id
    aws_connection = await _load_verified_connection(user_id)
    pii_config = await governance_service.get_pii_config(user_id)
    try:
        pii_settings = settings_from_config(pii_config)
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Invalid PII policy configuration.") from error
    try:
        input_scan = (
            pii_guardrail.apply(req.prompt, pii_config)
            if pii_settings.enabled and pii_settings.scan_input
            else pii_guardrail.scan(req.prompt, {"enabled": False})
        )
    except PIIGuardrailError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    if input_scan.detected and pii_settings.action == "BLOCK":
        raise HTTPException(status_code=403, detail="Prompt blocked by the configured PII policy.")
    prompt_text = input_scan.text
    toxicity_config = await governance_service.get_toxicity_config(user_id)
    try:
        toxicity_settings = toxicity_settings_from_config(toxicity_config)
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Invalid toxicity policy configuration.") from error
    if toxicity_settings.enabled and toxicity_settings.scan_input:
        try:
            toxicity_input_scan = toxicity_guardrail.apply(prompt_text, toxicity_config)
        except ToxicityGuardrailError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
        if toxicity_input_scan.detected and toxicity_settings.action in {"BLOCK", "REGENERATE"}:
            logger.info(
                "Toxicity input policy action=%s categories=%s",
                toxicity_settings.action,
                [finding.category for finding in toxicity_input_scan.findings],
            )
            raise HTTPException(status_code=403, detail="Prompt blocked by the configured toxicity policy.")
    else:
        toxicity_input_scan = toxicity_guardrail.scan(prompt_text, {"enabled": False})
    prompt_injection_config = await governance_service.get_prompt_injection_config(user_id)
    try:
        prompt_injection_settings = prompt_injection_settings_from_config(prompt_injection_config)
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Invalid prompt injection policy configuration.") from error
    if prompt_injection_settings.enabled and prompt_injection_settings.scan_input:
        try:
            prompt_injection_scan = prompt_injection_guardrail.apply(prompt_text, prompt_injection_config)
        except PromptInjectionGuardrailError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
        if prompt_injection_scan.detected and prompt_injection_settings.action in {"BLOCK", "REVIEW"}:
            logger.info(
                "Prompt injection input policy action=%s score=%s",
                prompt_injection_settings.action,
                prompt_injection_scan.findings[0].score,
            )
            raise HTTPException(
                status_code=403,
                detail="Prompt blocked by the configured prompt injection policy.",
            )
    else:
        prompt_injection_scan = prompt_injection_guardrail.scan(prompt_text, {"enabled": False})

    gov_result = await governance_service.evaluate_prompt(
        org_id=user_id, prompt=prompt_text, max_tokens=req.max_tokens
    )
    gov_schemas = [
        GovernanceEvaluationSchema(rule_type=e.rule_type, passed=e.passed, mode=e.mode, message=e.message, details=e.details)
        for e in gov_result.evaluations
    ]

    if gov_result.blocked_by_enforce:
        failed_msgs = [e.message for e in gov_result.evaluations if not e.passed and e.mode == "enforce"]
        raise HTTPException(status_code=403, detail="Governance policy violation: " + " | ".join(failed_msgs))

    allowed_model_ids = gov_result.allowed_model_ids or []
    if not allowed_model_ids:
        raise HTTPException(status_code=400, detail="Governance allow-list is empty. No models are permitted.")

    connected_models, candidate_router_ids, provider_candidates = _routing_inputs(
        aws_connection, allowed_model_ids
    )
    if not connected_models:
        raise HTTPException(
            status_code=400,
            detail="No connected provider models are permitted by governance rules.",
        )

    guessed_model_id = _requested_model_id(req)
    if guessed_model_id and not any(guessed_model_id in _model_aliases(m) for m in connected_models):
        raise HTTPException(
            status_code=400,
            detail=f"Guessed model '{guessed_model_id}' is not in the allowed candidate pool.",
        )

    routing_result = routing_service.route(
        prompt=prompt_text,
        allowed_model_ids=candidate_router_ids,
        max_tokens=req.max_tokens,
        top_n=3,
        provider_models=provider_candidates,
    )
    if not routing_result.recommendations:
        raise HTTPException(
            status_code=422,
            detail="No candidate models passed routing capability and context filters for this prompt.",
        )

    names = _unified_display_names()
    recs = [_recommendation_schema(r, names) for r in routing_result.recommendations]

    # Choose invocation target: rank #1 by default, or a validated retry model from the current top 3.
    retry_model_id = _requested_model_id(req, retry=True)
    if retry_model_id:
        target = next(
            (
                r for r in recs
                if retry_model_id in {r.model_id, r.provider_model_id, r.bedrock_model_id}
            ),
            None,
        )
        if target is None:
            raise HTTPException(
                status_code=400,
                detail=f"Retry model '{retry_model_id}' is not in the current top {len(recs)} recommendations.",
            )
    else:
        target = recs[0]

    invocation_error: Optional[str] = None
    text = ""
    tokens_used = None
    latency_ms = None
    try:
        if target.cloud_provider != "aws-bedrock":
            raise RuntimeError("The selected provider is paused. AWS Bedrock is currently enabled.")
        invoke_res = bedrock_invoke_service.invoke(
            role_arn=aws_connection.roleArn,
            external_id=user_id,
            bedrock_model_id=target.provider_model_id or target.model_id,
            prompt=prompt_text,
            max_tokens=req.max_tokens or 1500,
        )
        text = invoke_res["text"]
        tokens_used = invoke_res.get("tokens_used")
        latency_ms = invoke_res.get("latency_ms")
    except Exception as e:
        logger.warning(f"Invocation of {target.provider_model_id} (rank {target.rank}) failed: {e}")
        invocation_error = str(e)

    # Output guardrails run after Bedrock returns and before the response is
    # serialized. Each policy is tenant-scoped, emits metadata only, and owns
    # at most one regeneration attempt; none can bypass authentication,
    # governance, or the AWS provider boundary.
    output_scan = pii_guardrail.scan(text, {"enabled": False})
    if text and pii_settings.enabled and pii_settings.scan_output:
        try:
            output_scan = pii_guardrail.apply(text, pii_config)
        except PIIGuardrailError as error:
            raise HTTPException(status_code=502, detail=str(error)) from error
        if output_scan.detected and pii_settings.action == "BLOCK":
            raise HTTPException(status_code=502, detail="Response blocked by the configured PII policy.")
        text = output_scan.text

    toxicity_output_scan = toxicity_guardrail.scan(text, {"enabled": False})
    toxicity_output_action: Optional[str] = None
    if text and toxicity_settings.enabled and toxicity_settings.scan_output:
        try:
            toxicity_output_scan = toxicity_guardrail.apply(text, toxicity_config)
        except ToxicityGuardrailError as error:
            raise HTTPException(status_code=502, detail=str(error)) from error
        if toxicity_output_scan.detected and toxicity_settings.action == "REGENERATE":
            try:
                retry_result = bedrock_invoke_service.invoke(
                    role_arn=aws_connection.roleArn,
                    external_id=user_id,
                    bedrock_model_id=target.provider_model_id or target.model_id,
                    prompt=(
                        f"{prompt_text}\n\n"
                        "Return a safe, non-abusive response. Do not include threats, hate, "
                        "harassment, or targeted insults."
                    ),
                    max_tokens=req.max_tokens or 1500,
                )
                text = retry_result["text"]
                tokens_used = retry_result.get("tokens_used", tokens_used)
                latency_ms = retry_result.get("latency_ms", latency_ms)
                toxicity_output_scan = toxicity_guardrail.apply(text, toxicity_config)
            except ToxicityGuardrailError as error:
                raise HTTPException(status_code=502, detail=str(error)) from error
            except Exception as error:
                raise HTTPException(status_code=502, detail="Safe response regeneration failed.") from error
            if toxicity_output_scan.detected:
                logger.info(
                    "Toxicity output regeneration remained unsafe categories=%s",
                    [finding.category for finding in toxicity_output_scan.findings],
                )
                raise HTTPException(status_code=502, detail="Response blocked after safe regeneration failed.")
            toxicity_output_action = "REGENERATE"
        elif toxicity_output_scan.detected and toxicity_settings.action == "BLOCK":
            logger.info(
                "Toxicity output policy action=BLOCK categories=%s",
                [finding.category for finding in toxicity_output_scan.findings],
            )
            raise HTTPException(status_code=502, detail="Response blocked by the configured toxicity policy.")
        elif toxicity_output_scan.detected:
            logger.info(
                "Toxicity output policy action=%s categories=%s",
                toxicity_settings.action,
                [finding.category for finding in toxicity_output_scan.findings],
            )
            toxicity_output_action = toxicity_settings.action

    hallucination_config = await governance_service.get_hallucination_config(user_id)
    try:
        hallucination_settings = hallucination_settings_from_config(hallucination_config)
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Invalid hallucination policy configuration.") from error
    hallucination_result = hallucination_guardrail.scan(
        text, req.reference_context, {"enabled": False}
    )
    hallucination_action: Optional[str] = None
    if text and hallucination_settings.enabled:
        try:
            hallucination_result = hallucination_guardrail.apply(
                text, req.reference_context, hallucination_config
            )
        except HallucinationGuardrailError as error:
            raise HTTPException(status_code=502, detail=str(error)) from error
        questionable = hallucination_result.requires_action and any(
            finding.status == "INSUFFICIENT_EVIDENCE"
            or finding.confidence >= hallucination_settings.confidence_threshold
            for finding in hallucination_result.findings
        )
        if questionable and hallucination_settings.action == "REGENERATE":
            try:
                retry_result = bedrock_invoke_service.invoke(
                    role_arn=aws_connection.roleArn,
                    external_id=user_id,
                    bedrock_model_id=target.provider_model_id or target.model_id,
                    prompt=(
                        f"{prompt_text}\n\n"
                        "Produce a response grounded only in the supplied reference context. "
                        "Avoid unsupported claims and clearly state when evidence is insufficient."
                    ),
                    max_tokens=req.max_tokens or 1500,
                )
                text = retry_result["text"]
                tokens_used = retry_result.get("tokens_used", tokens_used)
                latency_ms = retry_result.get("latency_ms", latency_ms)
                hallucination_result = hallucination_guardrail.apply(
                    text, req.reference_context, hallucination_config
                )
            except HallucinationGuardrailError as error:
                raise HTTPException(status_code=502, detail=str(error)) from error
            except Exception as error:
                raise HTTPException(status_code=502, detail="Hallucination-safe regeneration failed.") from error
            questionable = hallucination_result.requires_action and any(
                finding.status == "INSUFFICIENT_EVIDENCE"
                or finding.confidence >= hallucination_settings.confidence_threshold
                for finding in hallucination_result.findings
            )
            hallucination_action = "REGENERATE"
            if questionable:
                raise HTTPException(status_code=502, detail="Response blocked after hallucination regeneration failed.")
        elif questionable and hallucination_settings.action in {"BLOCK", "REVIEW"}:
            logger.info(
                "Hallucination output policy action=%s status=%s findings=%s",
                hallucination_settings.action,
                hallucination_result.status,
                len(hallucination_result.findings),
            )
            if hallucination_settings.action == "REVIEW":
                raise HTTPException(status_code=502, detail="Response requires hallucination review; no review queue is configured.")
            raise HTTPException(status_code=502, detail="Response blocked by the configured hallucination policy.")
        elif hallucination_result.findings:
            hallucination_action = hallucination_settings.action

    conciseness_config = await governance_service.get_conciseness_config(user_id)
    try:
        conciseness_settings = conciseness_settings_from_config(conciseness_config)
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Invalid conciseness policy configuration.") from error
    requested_length = req.requested_response_length or requested_length_from_prompt(req.prompt)
    conciseness_result = conciseness_guardrail.evaluate(
        text, {"enabled": False}, requested_length
    )
    conciseness_action: Optional[str] = None
    if text and conciseness_settings.enabled:
        try:
            conciseness_result = conciseness_guardrail.apply(
                text, conciseness_config, requested_length
            )
        except ConcisenessGuardrailError as error:
            raise HTTPException(status_code=502, detail=str(error)) from error
        if conciseness_result.detected and conciseness_settings.action == "REGENERATE":
            try:
                retry_result = bedrock_invoke_service.invoke(
                    role_arn=aws_connection.roleArn,
                    external_id=user_id,
                    bedrock_model_id=target.provider_model_id or target.model_id,
                    prompt=(
                        f"{prompt_text}\n\n"
                        "Rewrite the answer to satisfy the requested response length and format. "
                        "Remove repeated content and stay within the configured word, character, "
                        "and sentence limits. Return only the revised answer."
                    ),
                    max_tokens=req.max_tokens or 1500,
                )
                text = retry_result["text"]
                tokens_used = retry_result.get("tokens_used", tokens_used)
                latency_ms = retry_result.get("latency_ms", latency_ms)
                conciseness_result = conciseness_guardrail.apply(
                    text, conciseness_config, requested_length
                )
            except ConcisenessGuardrailError as error:
                raise HTTPException(status_code=502, detail=str(error)) from error
            except Exception as error:
                raise HTTPException(status_code=502, detail="Conciseness-safe regeneration failed.") from error
            conciseness_action = "REGENERATE"
            if conciseness_result.detected:
                raise HTTPException(status_code=502, detail="Response blocked after conciseness regeneration failed.")
        elif conciseness_result.detected and conciseness_settings.action in {"BLOCK", "REVIEW"}:
            logger.info(
                "Conciseness output policy action=%s findings=%s",
                conciseness_settings.action,
                [finding.code for finding in conciseness_result.findings],
            )
            if conciseness_settings.action == "REVIEW":
                raise HTTPException(status_code=502, detail="Response requires conciseness review; no review queue is configured.")
            raise HTTPException(status_code=502, detail="Response blocked by the configured conciseness policy.")
        elif conciseness_result.detected:
            conciseness_action = conciseness_settings.action

    racial_bias_config = await governance_service.get_racial_bias_config(user_id)
    try:
        racial_bias_settings = racial_bias_settings_from_config(racial_bias_config)
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Invalid racial bias policy configuration.") from error
    racial_bias_result = racial_bias_guardrail.scan(text, {"enabled": False})
    racial_bias_action: Optional[str] = None
    if text and racial_bias_settings.enabled:
        try:
            racial_bias_result = racial_bias_guardrail.apply(text, racial_bias_config)
        except RacialBiasGuardrailError as error:
            raise HTTPException(status_code=502, detail=str(error)) from error
        questionable = (
            racial_bias_result.status == "POTENTIAL_BIAS"
            and racial_bias_result.confidence >= racial_bias_settings.confidence_threshold
        )
        if questionable and racial_bias_settings.action == "REGENERATE":
            try:
                retry_result = bedrock_invoke_service.invoke(
                    role_arn=aws_connection.roleArn,
                    external_id=user_id,
                    bedrock_model_id=target.provider_model_id or target.model_id,
                    prompt=(
                        f"{prompt_text}\n\n"
                        "Rewrite the response without stereotypes, unsupported generalizations, "
                        "dehumanizing language, or unjustified differential treatment. Preserve "
                        "neutral educational or anti-discrimination context where relevant. Return "
                        "only the revised response."
                    ),
                    max_tokens=req.max_tokens or 1500,
                )
                text = retry_result["text"]
                tokens_used = retry_result.get("tokens_used", tokens_used)
                latency_ms = retry_result.get("latency_ms", latency_ms)
                racial_bias_result = racial_bias_guardrail.apply(text, racial_bias_config)
            except RacialBiasGuardrailError as error:
                raise HTTPException(status_code=502, detail=str(error)) from error
            except Exception as error:
                raise HTTPException(status_code=502, detail="Racial-bias-safe regeneration failed.") from error
            racial_bias_action = "REGENERATE"
            if (
                racial_bias_result.status == "POTENTIAL_BIAS"
                and racial_bias_result.confidence >= racial_bias_settings.confidence_threshold
            ):
                raise HTTPException(status_code=502, detail="Response blocked after racial-bias regeneration failed.")
        elif questionable and racial_bias_settings.action in {"BLOCK", "REVIEW"}:
            logger.info(
                "Racial bias output policy action=%s categories=%s",
                racial_bias_settings.action,
                [finding.category for finding in racial_bias_result.findings],
            )
            if racial_bias_settings.action == "REVIEW":
                raise HTTPException(status_code=502, detail="Response requires racial-bias review; no review queue is configured.")
            raise HTTPException(status_code=502, detail="Response blocked by the configured racial-bias policy.")
        elif racial_bias_result.findings or racial_bias_result.status == "REVIEW_REQUIRED":
            racial_bias_action = racial_bias_settings.action

    # Record this attempt against throttle/quota counters -- once, regardless of outcome.
    governance_service.record_request_attempt(user_id, gov_result.estimated_input_tokens)

    user_guess: Optional[UserGuessSchema] = None
    if guessed_model_id:
        guessed_rec = next(
            (r for r in recs if guessed_model_id in {r.model_id, r.provider_model_id, r.bedrock_model_id}),
            None,
        )
        guessed_name = guessed_rec.display_name if guessed_rec else names.get(guessed_model_id)
        matched = guessed_rec is not None and guessed_rec.model_id == target.model_id
        if matched:
            insight = f"Your guess ({guessed_name}) matched the routing engine's top pick."
        else:
            insight = (
                f"You guessed {guessed_name}, but the router chose {target.display_name} "
                f"(tier {routing_result.resolved_tier}, complexity {routing_result.prompt_profile.complexity_score:.2f})."
            )
        user_guess = UserGuessSchema(
            bedrock_model_id=guessed_rec.bedrock_model_id if guessed_rec else None,
            model_id=guessed_model_id,
            cloud_provider=guessed_rec.cloud_provider if guessed_rec else "aws-bedrock",
            display_name=guessed_name,
            matched_top_pick=matched,
            insight=insight,
        )

    return ModelResponse(
        text=text,
        model_used=target.provider_model_id or target.model_id,
        model_used_name=target.display_name,
        profile_summary=_profile_summary_schema(routing_result.prompt_profile),
        governance_evaluations=gov_schemas,
        recommendations=recs,
        user_guess=user_guess,
        warnings=routing_result.warnings,
        invocation_error=invocation_error,
        tokens_used=tokens_used,
        latency_ms=latency_ms,
        pii_input_findings=_pii_findings(input_scan),
        pii_output_findings=_pii_findings(output_scan),
        pii_input_masked=input_scan.changed,
        pii_output_masked=output_scan.changed,
        toxicity_input_findings=_toxicity_findings(toxicity_input_scan),
        toxicity_output_findings=_toxicity_findings(toxicity_output_scan),
        toxicity_input_action=(
            toxicity_settings.action if toxicity_input_scan.detected else None
        ),
        toxicity_output_action=toxicity_output_action,
        prompt_injection_input_findings=_prompt_injection_findings(prompt_injection_scan),
        prompt_injection_input_action=(
            prompt_injection_settings.action if prompt_injection_scan.detected else None
        ),
        hallucination_status=hallucination_result.status,
        hallucination_confidence=round(hallucination_result.confidence, 4),
        hallucination_explanation=hallucination_result.explanation,
        hallucination_findings=_hallucination_findings(hallucination_result),
        hallucination_action=hallucination_action,
        conciseness_word_count=conciseness_result.word_count if conciseness_settings.enabled else None,
        conciseness_character_count=conciseness_result.character_count if conciseness_settings.enabled else None,
        conciseness_sentence_count=conciseness_result.sentence_count if conciseness_settings.enabled else None,
        conciseness_repetition_ratio=conciseness_result.repetition_ratio if conciseness_settings.enabled else None,
        conciseness_requested_length=conciseness_result.requested_length if conciseness_settings.enabled else None,
        conciseness_findings=[
            {
                "code": finding.code,
                "message": finding.message,
                "actual": finding.actual,
                "allowed": finding.allowed,
            }
            for finding in conciseness_result.findings
        ],
        conciseness_action=conciseness_action,
        racial_bias_status=racial_bias_result.status,
        racial_bias_confidence=round(racial_bias_result.confidence, 4),
        racial_bias_explanation=racial_bias_result.explanation,
        racial_bias_findings=[
            {
                "category": finding.category,
                "confidence": round(finding.confidence, 4),
                "explanation": finding.explanation,
            }
            for finding in racial_bias_result.findings
        ],
        racial_bias_action=racial_bias_action,
    )
