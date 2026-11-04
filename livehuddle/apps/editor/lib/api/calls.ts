// The calls mint route's client (docs/specs/012-collaboration/proximity-audio.md "The mint route"): every Realtime
// session, track, renegotiation and close goes through livehuddle's api, which holds the secrets. The browser proves
// who it is the usual way (its token, the share code it came in by); the api checks the grant on the Space.
import type {
  CallCloseRequest,
  CallRenegotiateRequest,
  CallSessionResponse,
  CallTracksRequest,
  CallTracksResponse,
} from '@livehuddle/api-schema';
import { API_BASE, apiFetch, apiHeaders } from './core';

/** Who is asking about which Space. */
export type CallsCaller = { ownerId: string; documentId: string; shareCode: string | null };

/** The mint route refused or failed; `code` is its error code and `reason` its `calls_off` reason, when given. */
export class CallsApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly reason: string | null;
  constructor(status: number, code: string | null, reason: string | null = null) {
    super(`calls ${status}${code ? ` ${code}` : ''}${reason ? ` ${reason}` : ''}`);
    this.status = status;
    this.code = code;
    this.reason = reason;
  }

  /** The calls kill switch paused calls (docs/specs/016-platform/calls-kill-switch.md "Calls Paused"). */
  get paused(): boolean {
    return this.code === 'calls_off' && this.reason === 'paused';
  }
}

async function send<T>(
  caller: CallsCaller,
  action: string,
  method: 'POST' | 'PUT',
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
    try {
      const err = (await res.json()) as { error?: unknown; reason?: unknown };
      code = typeof err.error === 'string' ? err.error : null;
      reason = typeof err.reason === 'string' ? err.reason : null;
    } catch {
      // No body: the status says enough.
    }
    throw new CallsApiError(res.status, code, reason);
  }
  return (await res.json()) as T;
}

export const apiCallSession = (caller: CallsCaller) =>
  send<CallSessionResponse>(caller, 'session', 'POST');

export const apiCallTracks = (caller: CallsCaller, body: CallTracksRequest) =>
  send<CallTracksResponse>(caller, 'tracks', 'POST', body);

export const apiCallRenegotiate = (caller: CallsCaller, body: CallRenegotiateRequest) =>
  send<{ ok: true }>(caller, 'renegotiate', 'PUT', body);

export const apiCallClose = (caller: CallsCaller, body: CallCloseRequest) =>
  send<CallTracksResponse>(caller, 'close', 'PUT', body);
