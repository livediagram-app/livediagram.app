// The device sign-in page's trust boundary (docs/specs/015-api/blueprints/cli.md "The device grant", CLI36): which
// client a typed code belongs to, and handing it the token or a refusal. The code a person types is the only
// capability; the MCP answers the same "unknown" for an expired, used or never-issued code.

import { normaliseUserCode, formatUserCode, isUserCode } from '@livediagram/api-schema';
import { MCP_ORIGIN } from './mcp-config';

// What a person typed, as the code the server knows, or null when it cannot be one.
export function userCodeOf(typed: string): string | null {
  const code = normaliseUserCode(typed);
  return isUserCode(code) ? formatUserCode(code) : null;
}

export async function fetchDeviceSession(userCode: string): Promise<{ clientName: string } | null> {
  try {
    const res = await fetch(`${MCP_ORIGIN}/oauth/device/session/${encodeURIComponent(userCode)}`);
    if (!res.ok) return null;
    const body: unknown = await res.json();
    const clientName =
      typeof body === 'object' && body !== null ? Reflect.get(body, 'clientName') : undefined;
    return typeof clientName === 'string' && clientName ? { clientName } : null;
  } catch {
    return null;
  }
}

async function post(path: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(`${MCP_ORIGIN}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const completeDevice = (userCode: string, token: string, expiresAt: number | null) =>
  post('/oauth/device/complete', { userCode, token, ...(expiresAt ? { expiresAt } : {}) });

export const denyDevice = (userCode: string) => post('/oauth/device/deny', { userCode });
