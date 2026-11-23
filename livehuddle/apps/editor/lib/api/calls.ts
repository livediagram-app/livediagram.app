// The calls mint route's client (docs/specs/012-collaboration/proximity-audio.md "The mint route"): every Realtime
// session, track, renegotiation and close goes through livehuddle's api, which holds the secrets. The browser proves
// who it is the usual way (its token, the share code it came in by); the api checks the grant on the Space.
import type {
  CallCloseRequest,
  CallLayerRequest,
  CallMinutesResponse,
  CallRenegotiateRequest,
  CallSessionResponse,
  CallTracksRequest,
  CallTracksResponse,
} from '@livehuddle/api-schema';
import { API_BASE, apiFetch, apiHeaders } from './core';

/** Who is asking about which Space. */
export type CallsCaller = { ownerId: string; documentId: string; shareCode: string | null };

/**
 * What a `calls_minutes_used` refusal says (docs/specs/012-collaboration/call-minutes.md "The wire"), as this person
 * may know it: the owner for someone signed in, the numbers for the owner and the owning team, the state for all.
 * `guest`: the Space's owner has no account, so there is nobody to name and no upgrade to offer.
 */
export type CallMinutesUsed = {
  owner: string | null;
  guest: boolean;
  used: number | null;
  limit: number | null;
};

/** The mint route refused or failed; `code` is its error code and `reason` its `calls_off` reason, when given. */
export class CallsApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly reason: string | null;
  /** The Space's owner has used the month's call minutes: the numbers the server answered, else null. */
  readonly minutesUsed: CallMinutesUsed | null;
  constructor(
    status: number,
    code: string | null,
    reason: string | null = null,
    minutesUsed: CallMinutesUsed | null = null,
  ) {
    super(`calls ${status}${code ? ` ${code}` : ''}${reason ? ` ${reason}` : ''}`);
    this.status = status;
    this.code = code;
    this.reason = reason;
    this.minutesUsed = minutesUsed;
  }

  /** The calls kill switch paused calls (docs/specs/016-platform/calls-kill-switch.md "Calls Paused"). */
  get paused(): boolean {
    return this.code === 'calls_off' && this.reason === 'paused';
  }

  /** Realtime dropped the session: the call renews it (proximity-audio.md "A session that expires"). */
  get sessionGone(): boolean {
    return this.status === 410 && this.code === 'calls_session_gone';
  }

  /** The kill switch allows audio alone: a camera or a screen was refused (video-and-screen-bubbles.md). */
  get audioOnly(): boolean {
    return this.code === 'calls_off' && this.reason === 'audio-only';
  }
}

// What a `calls_minutes_used` refusal says, or null for any other refusal. The numbers come as a pair or not at all.
function minutesUsedOf(err: Record<string, unknown>): CallMinutesUsed | null {
  const { error, owner, used, limit, guest } = err;
  if (error !== 'calls_minutes_used') return null;
  const numbers = typeof used === 'number' && typeof limit === 'number';
  return {
    owner: typeof owner === 'string' ? owner : null,
    guest: guest === true,
    used: numbers ? used : null,
    limit: numbers ? limit : null,
  };
}

async function send<T>(
  caller: CallsCaller,
  action: string,
  method: 'GET' | 'POST' | 'PUT',
  body?: unknown,
): Promise<T> {
  const url = `${API_BASE}/documents/${encodeURIComponent(caller.documentId)}/calls/${action}`;
  const res = await apiFetch(url, {
    method,
    headers: await apiHeaders(caller.ownerId, {
      share: caller.shareCode,
      body: body !== undefined,
    }),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    let code: string | null = null;
    let reason: string | null = null;
    let minutesUsed: CallMinutesUsed | null = null;
    try {
      const err = (await res.json()) as Record<string, unknown>;
      code = typeof err.error === 'string' ? err.error : null;
      reason = typeof err.reason === 'string' ? err.reason : null;
      minutesUsed = minutesUsedOf(err);
    } catch {
      // No body: the status says enough.
    }
    throw new CallsApiError(res.status, code, reason, minutesUsed);
  }
  return (await res.json()) as T;
}

export const apiCallSession = (caller: CallsCaller) =>
  send<CallSessionResponse>(caller, 'session', 'POST');

export const apiCallTracks = (caller: CallsCaller, body: CallTracksRequest) =>
  send<CallTracksResponse>(caller, 'tracks', 'POST', body);

export const apiCallRenegotiate = (caller: CallsCaller, body: CallRenegotiateRequest) =>
  send<{ ok: true }>(caller, 'renegotiate', 'PUT', body);

export const apiCallLayer = (caller: CallsCaller, body: CallLayerRequest) =>
  send<CallTracksResponse>(caller, 'layer', 'PUT', body);

export const apiCallClose = (caller: CallsCaller, body: CallCloseRequest) =>
  send<CallTracksResponse>(caller, 'close', 'PUT', body);

/** The Space's owner's call minutes this month (call-minutes.md "The wire"): `{ metered: false }` with Pro off. */
export const apiCallMinutes = (caller: CallsCaller) =>
  send<CallMinutesResponse>(caller, 'minutes', 'GET');
