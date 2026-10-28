from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

class ModelSchema(BaseModel):
    id: str
    name: str
    provider: str
    providerModelId: str
    contextWindow: Optional[str] = "200K tokens"
    contextWindowTokens: Optional[int] = None
    category: Optional[str] = "General"
    inputModalities: Optional[List[str]] = []
    outputModalities: Optional[List[str]] = []
    responseStreamingSupported: Optional[bool] = False
    capabilities: List[str] = Field(default_factory=list)
    cloudProvider: str = "aws-bedrock"
    region: Optional[str] = None
    routerModelId: Optional[str] = None

class ConnectionRequest(BaseModel):
    role_arn: str = Field(..., alias="roleArn", description="AWS IAM Role ARN pasted by user")
    external_id: Optional[str] = Field(None, alias="externalId", description="User Supabase UUID external ID")

    model_config = ConfigDict(populate_by_name=True)

class ConnectionResponse(BaseModel):
    provider: str = "aws-bedrock"
    status: str  # 'not_connected' | 'pending' | 'verified' | 'failed'
    roleArn: Optional[str] = None
    error: Optional[str] = None
    availableModels: List[ModelSchema] = []
    verifiedAt: Optional[str] = None
    lastSyncedAt: Optional[str] = None


class GCPConnectionRequest(BaseModel):
    project_id: Optional[str] = Field(None, alias="projectId")
    region: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class GCPConnectionResponse(BaseModel):
    provider: str = "vertex-ai"
    status: str  # 'not_connected' | 'pending' | 'verified' | 'failed'
    projectId: Optional[str] = None
    organizationId: Optional[str] = None
    projectNumber: Optional[str] = None
    region: Optional[str] = None
    error: Optional[str] = None
    availableModels: List[ModelSchema] = []
    verifiedAt: Optional[str] = None
    lastSyncedAt: Optional[str] = None


class GCPProjectSchema(BaseModel):
    projectId: str
    displayName: Optional[str] = None
    projectNumber: Optional[str] = None


class GCPAuthorizationResponse(BaseModel):
    provider: str = "vertex-ai"
    status: str
    authorizationUrl: str

class GovernanceEvaluationSchema(BaseModel):
    rule_type: str
    passed: bool
    mode: str  # 'dry_run' | 'enforce'
    message: str
    details: Optional[Dict[str, Any]] = None

class PIIFindingSchema(BaseModel):
    entity_type: str
    count: int
    max_score: float

class ToxicityFindingSchema(BaseModel):
    category: str
    score: float
    count: int = 1

class PromptInjectionFindingSchema(BaseModel):
    category: str
    score: float
    label: str

class HallucinationFindingSchema(BaseModel):
    claim: str
    status: str
    confidence: float
    explanation: str

class HallucinationVerificationSchema(BaseModel):
    status: str
    confidence: float
    explanation: str
    findings: List[HallucinationFindingSchema] = []

class ConcisenessFindingSchema(BaseModel):
    code: str
    message: str
    actual: Optional[float] = None
    allowed: Optional[float] = None

class RacialBiasFindingSchema(BaseModel):
    category: str
    confidence: float
    explanation: str

class GovernanceRuleSchema(BaseModel):
    id: Optional[str] = None
    org_id: Optional[str] = None
    rule_type: str
    scope: str = "org"
    scope_target: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=dict)
    mode: str = "dry_run"

class PromptRequest(BaseModel):
    prompt: str
    guessed_bedrock_model_id: Optional[str] = None
    guessed_model_id: Optional[str] = None
    max_tokens: Optional[int] = 1500
    retry_bedrock_model_id: Optional[str] = None
    retry_model_id: Optional[str] = None
    reference_context: Optional[List[str]] = None
    requested_response_length: Optional[str] = None

class DimensionBreakdown(BaseModel):
    d1_semantic_complexity: float
    d2_domain_specificity: float
    d3_output_formality: float
    d4_research_dependency: float
    d5_context_requirement: float

class ProfileSummarySchema(BaseModel):
    domain: str
    intent: str
    task_type: str
    derived_tier: str
    resolved_tier: str
    complexity_score: float
    confidence: float
    reasoning_chain_detected: bool
    research_signals: List[str]
    input_token_count: int
    est_output_tokens: int
    dimensions: DimensionBreakdown

class ModelRecommendationSchema(BaseModel):
    rank: int
    model_id: str                        # internal router/friendly ID
    bedrock_model_id: Optional[str] = None
    display_name: Optional[str] = None
    provider: str
    tier: str
    estimated_cost_usd: float
    domain_match_count: int
    reasons: List[str]
    routing_score: Optional[float] = None
    cloud_provider: str = "aws-bedrock"
    provider_model_id: Optional[str] = None
    region: Optional[str] = None

class UserGuessSchema(BaseModel):
    bedrock_model_id: Optional[str] = None
    model_id: Optional[str] = None
    cloud_provider: str = "aws-bedrock"
    display_name: Optional[str] = None
    matched_top_pick: bool
    insight: str

class ModelResponse(BaseModel):
    text: str
    model_used: Optional[str] = None       # Bedrock model ID actually invoked (or attempted, on failure)
    model_used_name: Optional[str] = None  # Display name
    profile_summary: Optional[ProfileSummarySchema] = None
    governance_evaluations: List[GovernanceEvaluationSchema] = []
    recommendations: List[ModelRecommendationSchema] = []
    user_guess: Optional[UserGuessSchema] = None
    warnings: List[str] = []
    invocation_error: Optional[str] = None
    tokens_used: Optional[int] = None
    latency_ms: Optional[float] = None
    pii_input_findings: List[PIIFindingSchema] = []
    pii_output_findings: List[PIIFindingSchema] = []
    pii_input_masked: bool = False
    pii_output_masked: bool = False
    toxicity_input_findings: List[ToxicityFindingSchema] = []
    toxicity_output_findings: List[ToxicityFindingSchema] = []
    toxicity_input_action: Optional[str] = None
    toxicity_output_action: Optional[str] = None
    prompt_injection_input_findings: List[PromptInjectionFindingSchema] = []
    prompt_injection_input_action: Optional[str] = None
    hallucination_status: Optional[str] = None
    hallucination_confidence: Optional[float] = None
    hallucination_explanation: Optional[str] = None
    hallucination_findings: List[HallucinationFindingSchema] = []
    hallucination_action: Optional[str] = None
    conciseness_word_count: Optional[int] = None
    conciseness_character_count: Optional[int] = None
    conciseness_sentence_count: Optional[int] = None
    conciseness_repetition_ratio: Optional[float] = None
    conciseness_requested_length: Optional[str] = None
    conciseness_findings: List[ConcisenessFindingSchema] = []
    conciseness_action: Optional[str] = None
    racial_bias_status: Optional[str] = None
    racial_bias_confidence: Optional[float] = None
    racial_bias_explanation: Optional[str] = None
    racial_bias_findings: List[RacialBiasFindingSchema] = []
    racial_bias_action: Optional[str] = None

class ProfileOnlyResponse(BaseModel):
    profile: ProfileSummarySchema
    resolved_tier: str
    recommendations: List[ModelRecommendationSchema]
    rejections: Dict[str, str] = {}
    governance_evaluations: List[GovernanceEvaluationSchema] = []
    warnings: List[str] = []

class ReviewQueueItemSchema(BaseModel):
    id: str
    org_id: str
    created_at: str
    status: str = "PENDING"  # PENDING, APPROVED, REJECTED
    guardrail: str  # prompt_injection, hallucination, racial_bias, conciseness, toxicity, pii
    action: str = "REVIEW"
    prompt: str
    reference_context: Optional[List[str]] = None
    model_intended: Optional[str] = None
    findings: List[Dict[str, Any]] = []
    confidence: Optional[float] = None
    severity: str = "MEDIUM"  # LOW, MEDIUM, HIGH
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    resolution_notes: Optional[str] = None

class ReviewResolveRequest(BaseModel):
    status: str  # APPROVED or REJECTED
    resolution_notes: Optional[str] = None

class GuardrailMetricSummary(BaseModel):
    guardrail: str
    trigger_count: int
    percentage: float

class GovernanceAnalyticsSchema(BaseModel):
    total_requests: int
    passed_requests: int
    blocked_requests: int
    masked_requests: int
    review_requests: int
    block_rate_percentage: float
    total_input_tokens: int
    total_output_tokens: int
    total_cost_usd: float
    baseline_cost_usd: float
    cost_saved_usd: float
    savings_percentage: float
    guardrail_breakdown: List[GuardrailMetricSummary]
    recent_activity: List[Dict[str, Any]]

