// The device sign-in page's trust boundary (liveworkspace/docs/specs/021-mcp/mcp.md "The app MCPs fold in"): which
// client a typed code belongs to, when and roughly where it started, and handing it the token or a refusal. The code
// a person types is the only capability; the MCP answers the same "unknown" for an expired, used or never-issued
// code. The origin is the one MCP this site trusts (mcp-connect.ts `mcpOrigin`), handed in.

import { formatUserCode, isUserCode, normaliseUserCode } from '@liveworkspace/api-kit/oauth';
import { formatRelativeTime } from '@liveworkspace/ui';

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

// A code's lookup: the session, a code the MCP does not know (its 404), or no answer worth trusting (a 429, a 5xx,
// no network), when the code may still be good and the person should try again shortly.
export type DeviceLookup =
  { kind: 'found'; session: DeviceSession } | { kind: 'unknown' } | { kind: 'unavailable' };

export type DeviceSessionClient = {
  fetchSession: (userCode: string) => Promise<DeviceLookup>;
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
        if (res.status === 404) return { kind: 'unknown' };
        if (!res.ok) return { kind: 'unavailable' };
        const session = parseDeviceSession(await res.json());
        return session ? { kind: 'found', session } : { kind: 'unknown' };
      } catch {
        return { kind: 'unavailable' };
      }
    },
    complete: (userCode, token, expiresAt) =>
      post('/oauth/device/complete', { userCode, token, ...(expiresAt ? { expiresAt } : {}) }),
    deny: (userCode) => post('/oauth/device/deny', { userCode }),
  };
}

// A country code as its English name ("IE" as "Ireland"), or the code when the browser has no name for it.
function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

function placeOf(place: DeviceStartedIn | null): string | null {
  if (!place) return null;
  const parts = [place.city, place.country ? countryName(place.country) : undefined].filter(
    Boolean,
  );
  return parts.join(', ');
}

/** The line under the approval warning: when the terminal started, and roughly where; null when the server gave
 *  neither. */
export function startedLine(session: DeviceSession, now: number): string | null {
  const when =
    session.startedAt === null ? null : formatRelativeTime(Math.max(0, now - session.startedAt));
  const where = placeOf(session.startedIn);
  if (when && where) return `Started ${when}, from near ${where}.`;
  if (when) return `Started ${when}.`;
  if (where) return `Started from near ${where}.`;
  return null;
}
