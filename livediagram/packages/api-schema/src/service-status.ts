// Live service status (docs/specs/009-elements/live-status.md "Reading an answer"): what one check of a shape's
// status URL tells a viewer. The room reduces each answer to one of four states and a short reason, and drops the
// bytes, so nothing a URL answers ever reaches a browser but the state. Pure: the room's rounds (the api) and the
// badge (the editor) share the shapes and the constants.

import type { PublicFetchResult } from '@liveworkspace/api-kit/public-fetch';

export type ServiceState = 'up' | 'degraded' | 'down' | 'unknown';

export type ServiceStatusReason =
  // The body said so (a Statuspage indicator or a health word).
  | 'reported'
  // Not 2xx (the code in `httpStatus`).
  | 'http_status'
  | 'timeout'
  | 'unreachable'
  | 'unresolved'
  // The URL redirects; rounds follow none.
  | 'redirect'
  // The address check refused it (private, internal, not https).
  | 'refused'
  // Past the round's cap on distinct URLs.
  | 'too_many_sources';

export type ServiceStatus = {
  state: ServiceState;
  // When the room checked it (ms since the epoch).
  checkedAt: number;
  reason?: ServiceStatusReason;
  httpStatus?: number;
};

// A round about once a minute while the document is open.
export const STATUS_POLL_MS = 60_000;
// A state older than three rounds reads Unknown, so a room that stopped checking never leaves a green dot behind.
export const STATUS_STALE_MS = 3 * STATUS_POLL_MS;
// The distinct URLs one round checks; any beyond read Unknown.
export const STATUS_SOURCES_MAX = 25;
// One check's deadline over the whole exchange, and the most of its body read.
export const STATUS_TIMEOUT_MS = 5_000;
export const STATUS_BODY_MAX = 64 * 1024;
// How soon after a save the room looks for a URL it hasn't checked yet, so a new binding's badge appears in seconds.
export const STATUS_BIND_DELAY_MS = 3_000;

// The system op the room sends each session (docs/specs/015-api/api.md "service-status"): the latest check of each
// status URL bound on the tabs the session may see, keyed by the URL.
export type ServiceStatusOp = { kind: 'service-status'; statuses: Record<string, ServiceStatus> };

// Atlassian Statuspage's `status.indicator`.
const INDICATORS: Record<string, ServiceState> = {
  none: 'up',
  minor: 'degraded',
  maintenance: 'degraded',
  major: 'down',
  critical: 'down',
};

// Health words: the IETF health check draft's pass / warn / fail, Spring Boot's UP / DOWN, and the common rest.
const WORDS: Record<string, ServiceState> = {
  ok: 'up',
  up: 'up',
  pass: 'up',
  healthy: 'up',
  operational: 'up',
  green: 'up',
  online: 'up',
  warn: 'degraded',
  warning: 'degraded',
  degraded: 'degraded',
  partial: 'degraded',
  minor: 'degraded',
  maintenance: 'degraded',
  yellow: 'degraded',
  fail: 'down',
  down: 'down',
  unhealthy: 'down',
  major: 'down',
  critical: 'down',
  outage: 'down',
  error: 'down',
  red: 'down',
  offline: 'down',
};

const WORD_FIELDS = ['status', 'state', 'health'] as const;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const lookUp = (table: Record<string, ServiceState>, word: string): ServiceState =>
  Object.hasOwn(table, word.trim().toLowerCase()) ? table[word.trim().toLowerCase()]! : 'up';

/** What a 2xx body says: a Statuspage indicator, a health word, or Up for anything else. */
export function readStatusBody(bytes: Uint8Array): ServiceState {
  const text = new TextDecoder().decode(bytes).trim();
  if (!text.startsWith('{')) return 'up';
  // Text opening with `{` parses to an object or not at all.
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return 'up';
  }
  if (isRecord(body.status) && typeof body.status.indicator === 'string') {
    return lookUp(INDICATORS, body.status.indicator);
  }
  for (const field of WORD_FIELDS) {
    const word = body[field];
    if (typeof word === 'string') return lookUp(WORDS, word);
  }
  return 'up';
}

/** One check, reduced to the state a viewer sees (docs/specs/009-elements/live-status.md "Reading an answer"). */
export function classifyStatusAnswer(result: PublicFetchResult, checkedAt: number): ServiceStatus {
  if (result.ok) {
    const state = readStatusBody(result.bytes);
    return state === 'up' ? { state, checkedAt } : { state, checkedAt, reason: 'reported' };
  }
  switch (result.reason) {
    // The size cap is checked only after a 2xx: the service answered.
    case 'too_large':
      return { state: 'up', checkedAt };
    case 'http_status':
      return {
        state: 'down',
        checkedAt,
        reason: 'http_status',
        ...(result.status === undefined ? {} : { httpStatus: result.status }),
      };
    case 'timeout':
    case 'unreachable':
    case 'unresolved':
      return { state: 'down', checkedAt, reason: result.reason };
    case 'too_many_redirects':
      return { state: 'unknown', checkedAt, reason: 'redirect' };
    case 'private_address':
    case 'invalid_url':
    case 'not_https':
      return { state: 'unknown', checkedAt, reason: 'refused' };
  }
}

/** The state a viewer sees at `now`: Unknown once it is older than `STATUS_STALE_MS`. */
export function currentServiceState(status: ServiceStatus | undefined, now: number): ServiceState {
  if (status === undefined || now - status.checkedAt > STATUS_STALE_MS) return 'unknown';
  return status.state;
}
