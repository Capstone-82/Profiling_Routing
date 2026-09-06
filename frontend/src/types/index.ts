// ─── Auth ────────────────────────────────────────
export interface AuthUser {
  id: string;          // Supabase UUID — used as IAM external_id in Task 2
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
}

// ─── Models ──────────────────────────────────────
export interface Model {
  id: string;              // internal UUID
  name: string;            // display name, e.g. "Claude 3.5 Sonnet"
  provider: string;        // "Anthropic" | "Amazon" | "Meta" | "Mistral"
  providerModelId: string; // e.g. "anthropic.claude-3-5-sonnet-20241022-v2:0"
  contextWindow?: string;
  category?: string;
}

// ─── Governance & Routing Metadata ────────────────
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
  model_id: string;               // internal router/friendly ID
  bedrock_model_id?: string;
  display_name?: string;
  provider: string;
  tier: string;
  estimated_cost_usd: number;
  domain_match_count: number;
  reasons: string[];
  routing_score?: number;
}

export interface UserGuess {
  bedrock_model_id: string;
  display_name?: string;
  matched_top_pick: boolean;
  insight: string;
}

// ─── Requests & Responses ────────────────────────
export interface PromptRequest {
  prompt: string;
  guessed_bedrock_model_id?: string;
  max_tokens?: number;
  retry_bedrock_model_id?: string;
}

export interface ModelResponse {
  text: string;
  model_used?: string;              // Bedrock model ID actually invoked (or attempted, on failure)
  model_used_name?: string;         // Display name
  profile_summary?: ProfileSummary;
  governance_evaluations?: GovernanceEvaluation[];
  recommendations?: ModelRecommendation[];
  user_guess?: UserGuess;
  warnings?: string[];
  invocation_error?: string | null;
  tokens_used?: number;
  latency_ms?: number;
}
