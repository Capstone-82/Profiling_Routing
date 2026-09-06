import type { Connection, Model, ModelResponse, PromptRequest } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';

export async function fetchConnectionFromBackend(userId?: string): Promise<Connection | null> {
  try {
    const headers: Record<string, string> = {};
    if (userId) headers['X-User-ID'] = userId;
    
    const res = await fetch(`${API_BASE}/connection`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data as Connection;
  } catch (err) {
    return null;
  }
}

export async function testConnectionViaBackend(roleArn: string, userId?: string): Promise<Connection | null> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (userId) headers['X-User-ID'] = userId;

    const res = await fetch(`${API_BASE}/connection/test`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ roleArn, externalId: userId }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data as Connection;
  } catch (err) {
    return null;
  }
}

export async function resetConnectionViaBackend(userId?: string): Promise<boolean> {
  try {
    const headers: Record<string, string> = {};
    if (userId) headers['X-User-ID'] = userId;
    const res = await fetch(`${API_BASE}/connection/reset`, {
      method: 'POST',
      headers,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchAllowedCatalog(): Promise<Model[]> {
  try {
    const res = await fetch(`${API_BASE}/prompt/catalog`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function sendPromptToBackend(req: PromptRequest, userId?: string): Promise<ModelResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (userId) headers['X-User-ID'] = userId;

  const res = await fetch(`${API_BASE}/prompt/route`, {
    method: 'POST',
    headers,
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ detail: 'Failed to process prompt' }));
    throw new Error(errData.detail || `Server error (${res.status})`);
  }

  return await res.json();
}
