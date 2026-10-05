// Agent presence (docs/specs/024-agents/agent-presence.md "Presence", blueprint "REST" and "Room"): an agent's
// presence on one tab, set by `PUT .../tabs/:tabId/presence` or refreshed by its changesets, kept by the document's
// room and sent to editors in the `presence` frame's `agents`. The request rule lives here so the CLI checks a
// request with the rule the api applies; resolving focus refs stays in the api.

import type { ShareRole } from './index';

export const AGENT_PRESENCE_TTL_MS = 30_000;
export const AGENT_PRESENCE_MAX_TTL_MS = 120_000;
// One second: below it an entry cannot reach a screen (PR5).
export const AGENT_PRESENCE_MIN_TTL_MS = 1_000;
export const AGENT_PRESENCE_STATUS_MAX = 80;
export const AGENT_PRESENCE_FOCUS_MAX = 20;
// Keeps `agents` under 96 KiB of a 256 KiB frame (PR12).
export const AGENT_PRESENCE_ROOM_MAX = 32;

export const AGENT_PRESENCE_REQUEST_CODES = [
  'invalid_body',
  'invalid_status',
  'status_too_long',
  'invalid_focus',
  'too_many_focus',
  'ttl_out_of_range',
] as const;
export type AgentPresenceRequestCode = (typeof AGENT_PRESENCE_REQUEST_CODES)[number];

// The PUT body, parsed: status trimmed (null for none), focus as given (refs, prefixes or ids), ttl in ms.
export type AgentPresenceRequest = { status: string | null; focus: string[]; ttlMs: number };

// What the PUT answers (PR10).
export type AgentPresenceResult = {
  tabId: string;
  status: string | null;
  focus: string[];
  expiresAt: number;
};

// One agent on the `presence` frame, as one recipient sees it.
export type AgentPresence = {
  // Room-minted per entry, stable while it lives.
  id: string;
  name: string;
  color: string;
  // The level the gates resolve for its token on the document (PR27).
  role: ShareRole;
  tabId: string;
  status?: string;
  focus: string[];
  // Presence ids in this frame's participants that are the same person.
  joins: string[];
  // The recipient's own session is the same person.
  self?: true;
  // Frame-local ordinal; equal for entries of one person.
  person: number;
};

// C0 controls and DEL (PR33).
const isControl = (ch: string) => {
  const code = ch.codePointAt(0)!;
  return code < 0x20 || code === 0x7f;
};

const refuse = (code: AgentPresenceRequestCode) => ({ ok: false as const, code });

// Every limit refuses rather than cuts (PR6); unknown fields are ignored.
export function parseAgentPresenceRequest(
  body: unknown,
): { ok: true; value: AgentPresenceRequest } | { ok: false; code: AgentPresenceRequestCode } {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    return refuse('invalid_body');
  const { status, focus, ttl } = body as Record<string, unknown>;
  if (status !== undefined && typeof status !== 'string') return refuse('invalid_status');
  const trimmed = typeof status === 'string' ? status.trim() : '';
  const points = [...trimmed];
  if (points.some(isControl)) return refuse('invalid_status');
  if (points.length > AGENT_PRESENCE_STATUS_MAX) return refuse('status_too_long');
  if (
    focus !== undefined &&
    (!Array.isArray(focus) || !focus.every((f) => typeof f === 'string' && f !== ''))
  )
    return refuse('invalid_focus');
  const refs = (focus ?? []) as string[];
  if (refs.length > AGENT_PRESENCE_FOCUS_MAX) return refuse('too_many_focus');
  const ttlMs = ttl === undefined ? AGENT_PRESENCE_TTL_MS : ttl;
  if (
    typeof ttlMs !== 'number' ||
    !Number.isInteger(ttlMs) ||
    ttlMs < AGENT_PRESENCE_MIN_TTL_MS ||
    ttlMs > AGENT_PRESENCE_MAX_TTL_MS
  )
    return refuse('ttl_out_of_range');
  return { ok: true, value: { status: trimmed === '' ? null : trimmed, focus: refs, ttlMs } };
}
