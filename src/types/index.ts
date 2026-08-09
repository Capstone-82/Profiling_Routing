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
  id: string;           // internal UUID
  name: string;         // display name, e.g. "Claude 3.5 Sonnet"
  provider: string;     // "Anthropic" | "Amazon" | "Meta" | "Mistral"
  providerModelId: string; // e.g. "anthropic.claude-3-5-sonnet-20241022-v1:0"
  contextWindow?: string;
  category?: string;
}

// ─── Responses ───────────────────────────────────
export interface PromptRequest {
  prompt: string;
  selectedModelIds: string[];
}

export interface ModelResponse {
  text: string;
  model_used: string;        // providerModelId of answering model
  model_used_name: string;   // display name
  fallback_used: boolean;
  fallback_from?: string;
  tokens_used?: number;
  estimated_cost?: number;
  latency_ms?: number;
}
