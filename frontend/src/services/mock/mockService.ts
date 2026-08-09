import type { Model, Connection, ModelResponse, PromptRequest } from '../../types';
import { fetchConnectionFromBackend, testConnectionViaBackend, resetConnectionViaBackend } from '../apiService';

// ─── Mock Models ─────────────────────────────────────────────────────────────
// These represent the allow-listed models returned by the connected provider.
// Task 2 will replace this with a real ListFoundationModels call.
export const MOCK_AVAILABLE_MODELS: Model[] = [
  {
    id: 'model-1',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    providerModelId: 'anthropic.claude-3-5-sonnet-20241022-v1:0',
    contextWindow: '200K tokens',
    category: 'Quality-First',
  },
  {
    id: 'model-2',
    name: 'Claude 3 Haiku',
    provider: 'Anthropic',
    providerModelId: 'anthropic.claude-3-haiku-20240307-v1:0',
    contextWindow: '200K tokens',
    category: 'Speed & Economy',
  },
  {
    id: 'model-3',
    name: 'Nova Pro',
    provider: 'Amazon',
    providerModelId: 'amazon.nova-pro-v1:0',
    contextWindow: '300K tokens',
    category: 'Balanced',
  },
  {
    id: 'model-4',
    name: 'Nova Lite',
    provider: 'Amazon',
    providerModelId: 'amazon.nova-lite-v1:0',
    contextWindow: '300K tokens',
    category: 'Speed & Economy',
  },
  {
    id: 'model-5',
    name: 'Llama 3.1 70B Instruct',
    provider: 'Meta',
    providerModelId: 'meta.llama3-1-70b-instruct-v1:0',
    contextWindow: '128K tokens',
    category: 'Balanced',
  },
];

// ─── Connection Service (FastAPI + Local Fallback) ────────────────────────────

export async function getConnection(userId?: string): Promise<Connection> {
  // Try backend endpoint first
  const backendConn = await fetchConnectionFromBackend(userId);
  if (backendConn && backendConn.status !== 'not_connected') {
    return backendConn;
  }

  // Load persisted connection from localStorage
  const saved = localStorage.getItem('cs_bedrock_connection');
  if (saved) {
    try { return JSON.parse(saved); }
    catch { localStorage.removeItem('cs_bedrock_connection'); }
  }
  return { provider: 'aws-bedrock', status: 'not_connected' };
}

export async function testConnection(roleArn: string, userId?: string): Promise<Connection> {
  // Try backend endpoint first
  const backendResult = await testConnectionViaBackend(roleArn, userId);
  if (backendResult) {
    localStorage.setItem('cs_bedrock_connection', JSON.stringify(backendResult));
    return backendResult;
  }

  // Fallback to client-side validation/mocking if backend server is not running
  if (!roleArn.trim().startsWith('arn:aws:iam::')) {
    const conn: Connection = {
      provider: 'aws-bedrock',
      status: 'failed',
      roleArn,
      error: 'Invalid Role ARN format. Expected: arn:aws:iam::<ACCOUNT_ID>:role/<ROLE_NAME>',
    };
    localStorage.setItem('cs_bedrock_connection', JSON.stringify(conn));
    return conn;
  }

  // Simulate async verification delay
  await new Promise(r => setTimeout(r, 1600));

  // Simulate failure if ARN contains "fail" keyword (for testing)
  if (roleArn.toLowerCase().includes('fail')) {
    const conn: Connection = {
      provider: 'aws-bedrock',
      status: 'failed',
      roleArn,
      error: 'AccessDeniedException: Unable to verify role. Check trust policy ExternalId and bedrock:InvokeModel permission.',
    };
    localStorage.setItem('cs_bedrock_connection', JSON.stringify(conn));
    return conn;
  }

  const conn: Connection = {
    provider: 'aws-bedrock',
    status: 'verified',
    roleArn,
    availableModels: MOCK_AVAILABLE_MODELS,
    verifiedAt: new Date().toISOString(),
  };
  localStorage.setItem('cs_bedrock_connection', JSON.stringify(conn));
  return conn;
}

export async function getAvailableModels(): Promise<Model[]> {
  const conn = await getConnection();
  return conn.availableModels || [];
}

export function resetConnection(): void {
  resetConnectionViaBackend().catch(() => {});
  localStorage.removeItem('cs_bedrock_connection');
}

// ─── Mock Prompt Router ───────────────────────────────────────────────────────
// Task 4 will replace this with real Bedrock InvokeModel + fallback dispatch.

export async function sendPrompt(request: PromptRequest): Promise<ModelResponse> {
  if (!request.prompt.trim()) throw new Error('Prompt cannot be empty');
  if (!request.selectedModelIds.length) throw new Error('Select at least one model');

  // Simulate routing delay (profiling + dispatch)
  await new Promise(r => setTimeout(r, 1800 + Math.random() * 800));

  // Simulate occasional error (1 in 8 chance, for UX testing)
  if (Math.random() < 0.125) {
    throw new Error('Bedrock InvokeModel: ThrottlingException on primary model. Retry after 30s.');
  }

  // Pick the first selected model as the "winner" from routing
  const allModels = MOCK_AVAILABLE_MODELS;
  const selected = allModels.filter(m => request.selectedModelIds.includes(m.id));
  const answered = selected[0] || allModels[0];

  const latency = 380 + Math.floor(Math.random() * 420);
  const tokens = 120 + Math.floor(Math.random() * 380);

  return {
    text: `This is a mocked model response from **${answered.name}**.\n\nThe real routing engine, Bedrock InvokeModel dispatch, profiling, and fallback logic will be connected in Task 4.\n\nYour prompt was:\n\n> ${request.prompt.substring(0, 200)}${request.prompt.length > 200 ? '…' : ''}`,
    model_used: answered.providerModelId,
    model_used_name: answered.name,
    fallback_used: false,
    tokens_used: tokens,
    estimated_cost: parseFloat((tokens * 0.000003).toFixed(6)),
    latency_ms: latency,
  };
}
