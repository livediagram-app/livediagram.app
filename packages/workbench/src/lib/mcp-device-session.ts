// The device sign-in page's trust boundary (docs/specs/015-api/blueprints/cli.md "The device grant", CLI36): which
// client a typed code belongs to, when and roughly where it started, and handing it the token or a refusal. The code
// a person types is the only capability; the MCP answers the same "unknown" for an expired, used or never-issued
// code. The origin is the editor's trusted MCP origin (its lib/mcp-config.ts), handed in.

import { formatUserCode, isUserCode, normaliseUserCode } from '@liveworkspace/api-kit/oauth';

// Where the grant started, as Cloudflare placed the caller: a city and an ISO country code, either of which may be
// missing.
export type DeviceStartedIn = { city?: string; country?: string };

export type DeviceSession = {
  clientName: string;
  // Epoch ms the terminal started the grant, or null when the server did not say.
  startedAt: number | null;
  startedIn: DeviceStartedIn | null;
};

// What a person typed, as the code the server knows, or null when it cannot be one.
export function userCodeOf(typed: string): string | null {
  const code = normaliseUserCode(typed);
  return isUserCode(code) ? formatUserCode(code) : null;
}

const field = (from: unknown, key: string): unknown =>
  typeof from === 'object' && from !== null ? Reflect.get(from, key) : undefined;

const text = (from: unknown, key: string): string | undefined => {
  const v = field(from, key);
  return typeof v === 'string' && v ? v : undefined;
};

function startedInOf(body: unknown): DeviceStartedIn | null {
  const place = field(body, 'startedIn');
  const city = text(place, 'city');
  const country = text(place, 'country');
  if (!city && !country) return null;
  return { ...(city ? { city } : {}), ...(country ? { country } : {}) };
}

// Narrow the lookup's untrusted body: no name is no session; a missing time or place is shown as nothing.
export function parseDeviceSession(body: unknown): DeviceSession | null {
  const clientName = text(body, 'clientName');
  if (!clientName) return null;
  const startedAt = field(body, 'startedAt');
  return {
    clientName,
    startedAt: typeof startedAt === 'number' && Number.isFinite(startedAt) ? startedAt : null,
    startedIn: startedInOf(body),
  };
}

export type DeviceSessionClient = {
  fetchSession: (userCode: string) => Promise<DeviceSession | null>;
  complete: (userCode: string, token: string, expiresAt: number | null) => Promise<boolean>;
  deny: (userCode: string) => Promise<boolean>;
};

export function deviceSessionClient(mcpOrigin: string): DeviceSessionClient {
  const post = async (path: string, body: unknown): Promise<boolean> => {
    try {
      const res = await fetch(`${mcpOrigin}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return res.ok;
    } catch {
      return false;
    }
  };
  return {
    fetchSession: async (userCode) => {
      try {
        const res = await fetch(
          `${mcpOrigin}/oauth/device/session/${encodeURIComponent(userCode)}`,
        );
        if (!res.ok) return null;
        return parseDeviceSession(await res.json());
      } catch {
        return null;
      }
    },
    complete: (userCode, token, expiresAt) =>
      post('/oauth/device/complete', { userCode, token, ...(expiresAt ? { expiresAt } : {}) }),
    deny: (userCode) => post('/oauth/device/deny', { userCode }),
  };
}
