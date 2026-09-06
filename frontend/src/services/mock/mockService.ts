import type { Model, Connection, ModelResponse, PromptRequest } from '../../types';
import {
  fetchConnectionFromBackend,
  testConnectionViaBackend,
  resetConnectionViaBackend,
  fetchAllowedCatalog,
  routePrompt,
} from '../apiService';

export async function getConnection(userId?: string): Promise<Connection> {
  const backendConn = await fetchConnectionFromBackend(userId);
  if (backendConn) {
    return backendConn;
  }
  return { provider: 'aws-bedrock', status: 'not_connected' };
}

export async function testConnection(roleArn: string, userId?: string): Promise<Connection> {
  const backendResult = await testConnectionViaBackend(roleArn, userId);
  if (backendResult) {
    return backendResult;
  }
  throw new Error("Unable to connect to backend server. Please ensure the backend is running.");
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

  return [];
}

export async function resetConnection(userId?: string): Promise<void> {
  await resetConnectionViaBackend(userId);
}

export async function sendPrompt(request: PromptRequest, userId?: string): Promise<ModelResponse> {
  if (!request.prompt.trim()) throw new Error('Prompt cannot be empty');
  return await routePrompt(request, userId);
}
