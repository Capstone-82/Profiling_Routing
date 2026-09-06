import type { Model, Connection, ModelResponse, PromptRequest } from '../../types';
import {
  fetchConnectionFromBackend,
  testConnectionViaBackend,
  resetConnectionViaBackend,
  fetchAllowedCatalog,
  sendPromptToBackend,
} from '../apiService';

// ─── Maintained Hardcoded Allowed Bedrock Models Catalog ───────────────────────
export const MOCK_AVAILABLE_MODELS: Model[] = [
  {
    id: 'model-claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    providerModelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    contextWindow: '200K tokens',
    category: 'Quality-First',
  },
  {
    id: 'model-claude-3-5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'Anthropic',
    providerModelId: 'anthropic.claude-3-5-haiku-20241022-v1:0',
    contextWindow: '200K tokens',
    category: 'Speed & Economy',
  },
  {
    id: 'model-claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'Anthropic',
    providerModelId: 'anthropic.claude-3-opus-20240229-v1:0',
    contextWindow: '200K tokens',
    category: 'Quality-First',
  },
  {
    id: 'model-claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'Anthropic',
    providerModelId: 'anthropic.claude-3-haiku-20240307-v1:0',
    contextWindow: '200K tokens',
    category: 'Speed & Economy',
  },
  {
    id: 'model-nova-pro',
    name: 'Amazon Nova Pro',
    provider: 'Amazon',
    providerModelId: 'amazon.nova-pro-v1:0',
    contextWindow: '300K tokens',
    category: 'Balanced',
  },
  {
    id: 'model-nova-lite',
    name: 'Amazon Nova Lite',
    provider: 'Amazon',
    providerModelId: 'amazon.nova-lite-v1:0',
    contextWindow: '300K tokens',
    category: 'Speed & Economy',
  },
  {
    id: 'model-nova-micro',
    name: 'Amazon Nova Micro',
    provider: 'Amazon',
    providerModelId: 'amazon.nova-micro-v1:0',
    contextWindow: '128K tokens',
    category: 'Speed & Economy',
  },
  {
    id: 'model-llama3-3-70b',
    name: 'Llama 3.3 70B Instruct',
    provider: 'Meta',
    providerModelId: 'meta.llama3-3-70b-instruct-v1:0',
    contextWindow: '128K tokens',
    category: 'Balanced',
  },
  {
    id: 'model-llama3-1-8b',
    name: 'Llama 3.1 8B Instruct',
    provider: 'Meta',
    providerModelId: 'meta.llama3-1-8b-instruct-v1:0',
    contextWindow: '128K tokens',
    category: 'Speed & Economy',
  },
  {
    id: 'model-mistral-large',
    name: 'Mistral Large (2407)',
    provider: 'Mistral',
    providerModelId: 'mistral.mistral-large-2407-v1:0',
    contextWindow: '128K tokens',
    category: 'Quality-First',
  },
  {
    id: 'model-mistral-small',
    name: 'Mistral Small (2402)',
    provider: 'Mistral',
    providerModelId: 'mistral.mistral-small-2402-v1:0',
    contextWindow: '32K tokens',
    category: 'Speed & Economy',
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
  await new Promise(r => setTimeout(r, 1200));

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

export async function getAvailableModels(userId?: string): Promise<Model[]> {
  const backendCatalog = await fetchAllowedCatalog();
  if (backendCatalog.length > 0) {
    return backendCatalog;
  }

  const conn = await getConnection(userId);
  if (conn.availableModels && conn.availableModels.length > 0) {
    return conn.availableModels;
  }

  return MOCK_AVAILABLE_MODELS;
}

export async function resetConnection(userId?: string): Promise<void> {
  await resetConnectionViaBackend(userId).catch(() => {});
  localStorage.removeItem('cs_bedrock_connection');
}

// ─── Real Prompt Router (no offline fallback -- fails honestly if the backend is unreachable) ──

export async function sendPrompt(request: PromptRequest, userId?: string): Promise<ModelResponse> {
  if (!request.prompt.trim()) throw new Error('Prompt cannot be empty');
  return await sendPromptToBackend(request, userId);
}

