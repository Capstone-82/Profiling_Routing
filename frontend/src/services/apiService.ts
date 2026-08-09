import type { Connection } from '../types';

const API_BASE = 'http://localhost:8000/api';

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
    // Backend unavailable or network error
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
    // Backend unavailable
    return null;
  }
}

export async function resetConnectionViaBackend(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/connection/reset`, {
      method: 'POST',
    });
    return res.ok;
  } catch {
    return false;
  }
}
