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
  lastSyncedAt?: string;
  cloudProvider?: string;
  projectId?: string;
  projectNumber?: string;
  region?: string;
}

export interface GCPProject {
  projectId: string;
  displayName?: string;
  projectNumber?: string;
}

// ─── Models ──────────────────────────────────────
export interface Model {
  id: string;              // internal UUID
  name: string;            // display name, e.g. "Claude 3.5 Sonnet"
  provider: string;        // "Anthropic" | "Amazon" | "Meta" | "Mistral"
  providerModelId: string; // e.g. "anthropic.claude-3-5-sonnet-20241022-v2:0"
  contextWindow?: string;
  category?: string;
  contextWindowTokens?: number;
  capabilities?: string[];
  cloudProvider?: string;
  region?: string;
  routerModelId?: string;
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
  cloud_provider?: string;
  provider_model_id?: string;
  region?: string;
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
  guessed_model_id?: string;
  max_tokens?: number;
  retry_bedrock_model_id?: string;
  retry_model_id?: string;
  reference_context?: string[];
  requested_response_length?: 'SHORT' | 'MEDIUM' | 'LONG';
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
  pii_input_findings?: PIIFinding[];
  pii_output_findings?: PIIFinding[];
  pii_input_masked?: boolean;
  pii_output_masked?: boolean;
  toxicity_input_findings?: ToxicityFinding[];
  toxicity_output_findings?: ToxicityFinding[];
  toxicity_input_action?: string | null;
  toxicity_output_action?: string | null;
  prompt_injection_input_findings?: PromptInjectionFinding[];
  prompt_injection_input_action?: string | null;
  hallucination_status?: string | null;
  hallucination_confidence?: number | null;
  hallucination_explanation?: string | null;
  hallucination_findings?: HallucinationFinding[];
  hallucination_action?: string | null;
  conciseness_word_count?: number | null;
  conciseness_character_count?: number | null;
  conciseness_sentence_count?: number | null;
  conciseness_repetition_ratio?: number | null;
  conciseness_requested_length?: string | null;
  conciseness_findings?: ConcisenessFinding[];
  conciseness_action?: string | null;
  racial_bias_status?: string | null;
  racial_bias_confidence?: number | null;
  racial_bias_explanation?: string | null;
  racial_bias_findings?: RacialBiasFinding[];
  racial_bias_action?: string | null;
}

export interface PIIFinding {
  entity_type: string;
  count: number;
  max_score: number;
}

export interface ToxicityFinding {
  category: string;
  score: number;
  count: number;
}

export interface PromptInjectionFinding {
  category: string;
  score: number;
  label: string;
}

export interface HallucinationFinding {
  claim: string;
  status: string;
  confidence: number;
  explanation: string;
}

export interface HallucinationVerification {
  status: string;
  confidence: number;
  explanation: string;
  findings: HallucinationFinding[];
}

export interface ConcisenessFinding {
  code: string;
  message: string;
  actual?: number | null;
  allowed?: number | null;
}

export interface RacialBiasFinding {
  category: string;
  confidence: number;
  explanation: string;
}
