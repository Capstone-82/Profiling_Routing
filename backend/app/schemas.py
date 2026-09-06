from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

class ModelSchema(BaseModel):
    id: str
    name: str
    provider: str
    providerModelId: str
    contextWindow: Optional[str] = "200K tokens"
    category: Optional[str] = "General"
    inputModalities: Optional[List[str]] = []
    outputModalities: Optional[List[str]] = []
    responseStreamingSupported: Optional[bool] = False

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

class GovernanceEvaluationSchema(BaseModel):
    rule_type: str
    passed: bool
    mode: str  # 'dry_run' | 'enforce'
    message: str
    details: Optional[Dict[str, Any]] = None

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
    selectedModelIds: Optional[List[str]] = []
    preferredModelId: Optional[str] = None
    preferred_model_id: Optional[str] = None
    max_tokens: Optional[int] = None
    mode: Optional[str] = "auto"  # 'auto' | 'legacy'
    enterprise_criticality: Optional[str] = "standard"

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
    model_id: str
    bedrock_model_id: Optional[str] = None
    provider: str
    tier: str
    estimated_cost_usd: float
    domain_match_count: int
    reasons: List[str]
    routing_score: Optional[float] = None

class ModelResponse(BaseModel):
    text: str
    model_used: str               # Bedrock model ID (e.g. anthropic.claude-3-5-sonnet-20241022-v2:0)
    model_used_name: str          # Display name (e.g. Claude 3.5 Sonnet)
    routed_model_id: str          # Friendly ID (e.g. claude-sonnet-5)
    user_selected_model: Optional[str] = None
    user_selected_model_name: Optional[str] = None
    comparison_insight: Optional[str] = None
    routing_reason: List[str] = []
    tier: str = "T1"
    complexity_score: float = 0.0
    cost_estimate: Optional[float] = None
    tokens_used: Optional[int] = None
    latency_ms: Optional[float] = None
    fallback_used: bool = False
    fallback_from: Optional[str] = None
    fallback_chain: Optional[List[str]] = []
    fallback_count: Optional[int] = 0
    governance_evaluations: List[GovernanceEvaluationSchema] = []
    profile_summary: Optional[ProfileSummarySchema] = None
    recommendations: List[ModelRecommendationSchema] = []
    warnings: List[str] = []

class ProfileOnlyResponse(BaseModel):
    profile: ProfileSummarySchema
    resolved_tier: str
    recommendations: List[ModelRecommendationSchema]
    rejections: Dict[str, str] = {}
    governance_evaluations: List[GovernanceEvaluationSchema] = []
    warnings: List[str] = []
