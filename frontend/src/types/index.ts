// ─── Auth ────────────────────────────────────────
export interface AuthUser {
  id: string;          // Supabase UUID — used as IAM external_id
  email: string;
  createdAt?: string;
}

// ─── Connections ─────────────────────────────────
export type Provider = 'aws-bedrock' | 'vertex-ai' | 'azure-foundry';
export type ConnectionStatus = 'not_connected' | 'pending' | 'verified' | 'failed';

export interface Connection {
  provider: Provider;
  status: ConnectionStatus;
  roleArn?: string;
  error?: string;
  availableModels?: Model[];
  verifiedAt?: string;
  lastSyncedAt?: string;
}

// ─── Models ──────────────────────────────────────
export interface Model {
  id: string;              // providerModelId or unique id
  name: string;            // display name, e.g. "Claude 3.5 Sonnet v2"
  provider: string;        // "Anthropic" | "Amazon" | "Meta" | "Mistral"
  providerModelId: string; // e.g. "anthropic.claude-3-5-sonnet-20241022-v2:0"
  contextWindow?: string;
  category?: string;
  tier?: string;
  cost_in?: number;
  cost_out?: number;
}

// ─── Governance Rules ────────────────────────────
export interface GovernanceRule {
  id?: string;
  org_id?: string;
  rule_type: string;       // 'allow_list' | 'throttle' | 'context_window'
  scope?: string;
  scope_target?: string;
  config: {
    allowed_bedrock_model_ids?: string[];
    allowed_models?: string[];
    max_input_tokens?: number;
    min_input_tokens?: number;
    max_output_tokens?: number;
    max_total_tokens?: number;
    rate_limit_rpm?: number;
    burst_limit?: number;
    quota_per_day_tokens?: number;
    quota_per_day_requests?: number;
    [key: string]: unknown;
  };
  mode: 'dry_run' | 'enforce';
}

export interface GovernanceEvaluation {
  rule_type: string;
  passed: boolean;
  mode: 'dry_run' | 'enforce';
  message: string;
  details?: Record<string, unknown>;
}

export interface DimensionBreakdown {
  d1_semantic_complexity: number;
  d2_domain_specificity: number;
  d3_output_formality: number;
  d4_research_dependency: number;
  d5_context_requirement: number;
}

export interface ProfileSummary {
  domain: string;
  intent: string;
  task_type: string;
  derived_tier: string;
  resolved_tier: string;
  complexity_score: number;
  confidence: number;
  reasoning_chain_detected: boolean;
  research_signals: string[];
  input_token_count: number;
  est_output_tokens: number;
  dimensions: DimensionBreakdown;
}

export interface ModelRecommendation {
  rank: number;
  model_id: string;             // router model id
  bedrock_model_id: string;     // bedrock provider model id
  display_name: string;         // display name
  provider: string;
  tier: string;
  estimated_cost_usd: number;
  domain_match_count: number;
  reasons: string[];
  routing_score?: number;
}

export interface UserGuess {
  guessed_model_id: string;
  guessed_model_name: string;
  is_match: boolean;
  comparison_insight: string;
}

// ─── Requests & Responses ────────────────────────
export interface PromptRequest {
  prompt: string;
  guessed_bedrock_model_id?: string;
  max_tokens?: number;
  retry_bedrock_model_id?: string;
  selectedModelIds?: string[];
  preferredModelId?: string;
  preferred_model_id?: string;
}

export interface ModelResponse {
  text: string;
  model_used: string;               // Bedrock model ID
  model_used_name: string;          // Display name
  routed_model_id?: string;         // Router model ID
  profile_summary?: ProfileSummary;
  governance_evaluations?: GovernanceEvaluation[];
  recommendations?: ModelRecommendation[];
  user_guess?: UserGuess;
  warnings?: string[];
  invocation_error?: string | null;
  tier?: string;
  complexity_score?: number;
  cost_estimate?: number;
  tokens_used?: number;
  latency_ms?: number;
  routing_reason?: string[];
}

export interface ProfileOnlyResponse {
  profile: ProfileSummary;
  resolved_tier: string;
  recommendations: ModelRecommendation[];
  rejections: Record<string, string>;
  governance_evaluations: GovernanceEvaluation[];
  warnings: string[];
}
