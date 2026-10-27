import type { Connection, GCPProject, Model, ModelResponse, PromptRequest } from '../types';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';

async function authHeaders(base: Record<string, string> = {}, userId?: string): Promise<Record<string, string>> {
  const headers = { ...base };
  // Retain the legacy header for AWS compatibility. The GCP backend ignores it
  // and derives identity from the verified Supabase bearer session.
  if (userId) headers['X-User-ID'] = userId;
  if (isSupabaseConfigured) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  return headers;
}

export async function fetchConnectionFromBackend(userId?: string): Promise<Connection | null> {
  try {
    const res = await fetch(`${API_BASE}/connection`, {
      method: 'GET',
      headers: await authHeaders({}, userId),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function testConnectionViaBackend(roleArn: string, userId?: string): Promise<Connection | null> {
  try {
    const res = await fetch(`${API_BASE}/connection/test`, {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }, userId),
      body: JSON.stringify({ roleArn, externalId: userId }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function resetConnectionViaBackend(userId?: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/connection/reset`, {
      method: 'POST',
      headers: await authHeaders({}, userId),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// GCP/Vertex AI API wrappers are retained for the paused integration phase.
// The active UI does not call these endpoints until GCP access is available.
export async function fetchGCPConnectionFromBackend(userId?: string): Promise<Connection | null> {
  try {
    const res = await fetch(`${API_BASE}/gcp/connection`, {
      headers: await authHeaders({}, userId),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function testGCPConnectionViaBackend(projectId: string, region: string, userId?: string): Promise<Connection | null> {
  try {
    const res = await fetch(`${API_BASE}/gcp/connection/test`, {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }, userId),
      body: JSON.stringify({ projectId, region }),
    });
    const data = await res.json().catch(() => null);
    return res.ok ? data : {
      provider: 'vertex-ai',
      status: 'failed',
      projectId,
      region,
      error: data?.detail || `GCP connection failed (${res.status})`,
    };
  } catch (error) {
    return {
      provider: 'vertex-ai',
      status: 'failed',
      projectId,
      region,
      error: error instanceof Error ? error.message : 'Unable to reach the backend',
    };
  }
}

export async function resetGCPConnectionViaBackend(userId?: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/gcp/connection/reset`, {
      method: 'POST',
      headers: await authHeaders({}, userId),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function startGCPAuthorization(
  projectId?: string,
  region?: string,
): Promise<{ provider: string; status: string; authorizationUrl: string }> {
  const params = new URLSearchParams();
  if (projectId) params.set('projectId', projectId);
  if (region) params.set('region', region);
  const query = params.toString();
  const res = await fetch(`${API_BASE}/gcp/connect${query ? `?${query}` : ''}`, {
    headers: await authHeaders(),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || `Unable to start Google authorization (${res.status})`);
  return data;
}

export async function fetchGCPProjectsFromBackend(userId?: string): Promise<GCPProject[]> {
  const res = await fetch(`${API_BASE}/gcp/projects`, { headers: await authHeaders({}, userId) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || `Unable to discover Google Cloud projects (${res.status})`);
  return data as GCPProject[];
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

export async function fetchGovernanceRules(userId?: string): Promise<Array<{ rule_type: string; mode: string; config: Record<string, unknown> }>> {
  try {
    const res = await fetch(`${API_BASE}/governance/rules`, { headers: await authHeaders({}, userId) });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function saveGovernanceRule(
  rule: { rule_type: string; mode: string; config: Record<string, unknown> },
  userId?: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/governance/rules`, {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }, userId),
      body: JSON.stringify(rule),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendPromptToBackend(req: PromptRequest, userId?: string): Promise<ModelResponse> {
  const res = await fetch(`${API_BASE}/prompt/route`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }, userId),
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ detail: 'Failed to process prompt' }));
    throw new Error(errData.detail || `Server error (${res.status})`);
  }

  return await res.json();
}
