// The index's grant on a plan (liveworkspace/docs/one-explorer-contracts.md "Grants"): a ten-minute token naming
// the plan, the level and the tab, which the api and the plan's room check offline. The editor asks for it while
// the plan's code loads, keeps it until a minute before it lapses, and sends it with every request about that plan
// as `X-Index-Grant` (apiFetch adds it), and on the room's upgrade as the ticket.
//
// One request per plan per ten minutes: concurrent callers share the one in flight, and the open plan's grant is
// fetched again a minute before it lapses so a save never waits on it.
import { IndexError, type GrantResponse } from '@liveworkspace/index-client';
import { INDEX_GRANT_HEADER } from '@livedocuments/api-schema';
import { indexClient } from '../index-client';

// Fetched again this long before it lapses (the contract's renewal window).
export const GRANT_RENEW_BEFORE_MS = 60_000;
// A refusal is remembered this long, so a plan the person cannot open is not asked about on every request.
const REFUSAL_MEMORY_MS = 30_000;
// Plans held at once; the oldest goes first. A person has one or two open.
const MAX_HELD = 32;

export type PlanShare = { code: string; password?: string | null } | null;

type Held = {
  grant: GrantResponse | null;
  // When this answer stops being used: a minute before the grant lapses, or when a refusal is forgotten.
  until: number;
};

const held = new Map<string, Held>();
const inflight = new Map<string, Promise<GrantResponse | null>>();
const renewTimers = new Map<string, ReturnType<typeof setTimeout>>();
// Why the last request was refused, by key, for the callers that say so (a password prompt).
const refusals = new Map<string, string>();

const keyOf = (planId: string, share: PlanShare) => `${planId}|${share?.code ?? ''}`;

function remember(key: string, value: Held): void {
  held.delete(key);
  held.set(key, value);
  while (held.size > MAX_HELD) {
    const oldest = held.keys().next().value as string;
    held.delete(oldest);
    clearTimeout(renewTimers.get(oldest));
    renewTimers.delete(oldest);
  }
}

// A grant the editor already has (the create answers one), kept as if it had been fetched.
export function seedDocumentGrant(planId: string, grant: GrantResponse, share: PlanShare = null): void {
  remember(keyOf(planId, share), { grant, until: grant.expiresAt - GRANT_RENEW_BEFORE_MS });
}

// The grant the page asked for before its code loaded (app/pre-hydration-scripts.ts PLAN_GRANT_BOOT_SCRIPT), taken
// once, for the plan and link it was asked for.
type EarlyGrant = { id: string; share: string; p: Promise<GrantResponse | null> };
function takeEarlyGrant(planId: string, share: PlanShare): Promise<GrantResponse | null> | null {
  if (typeof window === 'undefined') return null;
  const early = (window as { __lpGrant?: EarlyGrant }).__lpGrant;
  if (!early || early.id !== planId || early.share !== (share?.code ?? '')) return null;
  (window as { __lpGrant?: EarlyGrant }).__lpGrant = undefined;
  return early.p;
}

async function fetchGrant(planId: string, share: PlanShare, key: string): Promise<GrantResponse | null> {
  const early = takeEarlyGrant(planId, share);
  if (early) {
    const grant = await early;
    if (grant) {
      remember(key, { grant, until: grant.expiresAt - GRANT_RENEW_BEFORE_MS });
      return grant;
    }
  }
  try {
    const grant = await indexClient.grant(
      planId,
      share ? { code: share.code, password: share.password ?? null } : null,
    );
    refusals.delete(key);
    remember(key, { grant, until: grant.expiresAt - GRANT_RENEW_BEFORE_MS });
    return grant;
  } catch (err) {
    if (err instanceof IndexError) {
      refusals.set(key, err.code);
      remember(key, { grant: null, until: Date.now() + REFUSAL_MEMORY_MS });
    }
    // A network failure is not remembered: the next request asks again.
    return null;
  }
}

// The grant on this plan, from what is held while it lasts, else one request (shared by every caller meanwhile).
// Null when the index refuses (no access, a password needed) or cannot be reached; the api then answers as it
// would to a caller with no grant.
export function documentGrant(
  planId: string,
  share: PlanShare = null,
  opts: { fresh?: boolean } = {},
): Promise<GrantResponse | null> {
  const key = keyOf(planId, share);
  const kept = held.get(key);
  if (!opts.fresh && kept && kept.until > Date.now()) return Promise.resolve(kept.grant);
  let pending = inflight.get(key);
  if (!pending) {
    pending = fetchGrant(planId, share, key).finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  return pending;
}

// The held grant, synchronously, while it has not lapsed: for the unload flush, which cannot wait for a request.
export function heldDocumentGrant(planId: string, share: PlanShare = null): string | null {
  const grant = held.get(keyOf(planId, share))?.grant;
  return grant && grant.expiresAt > Date.now() ? grant.grant : null;
}

// Why the index last refused this plan (`password_required`, `password_invalid`, `not_found`, ...), or null.
export function documentGrantRefusal(planId: string, share: PlanShare = null): string | null {
  return refusals.get(keyOf(planId, share)) ?? null;
}

// Keep the open plan's grant fresh: fetched again a minute before it lapses, for as long as the plan stays open.
// Answers the stop. One timer per plan, so a plan opened twice does not ask twice.
export function keepDocumentGrantFresh(planId: string, share: PlanShare = null): () => void {
  const key = keyOf(planId, share);
  let stopped = false;
  const arm = (grant: GrantResponse | null) => {
    if (stopped || !grant) return;
    clearTimeout(renewTimers.get(key));
    const wait = Math.max(1_000, grant.expiresAt - GRANT_RENEW_BEFORE_MS - Date.now());
    renewTimers.set(
      key,
      setTimeout(() => void documentGrant(planId, share, { fresh: true }).then(arm), wait),
    );
  };
  void documentGrant(planId, share).then(arm);
  return () => {
    stopped = true;
    clearTimeout(renewTimers.get(key));
    renewTimers.delete(key);
  };
}

// `/api/documents/<id>[/...]`, or an image read through a document (`/api/images/<image>?d=<id>`) → the document id,
// else null. The create (`POST /api/documents`) names no document in its path.
export function documentIdOfPath(apiBase: string, url: string): string | null {
  if (url.startsWith(`${apiBase}/images/`)) {
    const query = url.split('#')[0]!.split('?')[1];
    const d = query ? new URLSearchParams(query).get('d') : null;
    return d || null;
  }
  if (!url.startsWith(`${apiBase}/documents/`)) return null;
  const id = url.slice(apiBase.length + '/documents/'.length).split(/[/?#]/)[0];
  return id ? decodeURIComponent(id) : null;
}

// Adds the document's grant to a request about one document that does not carry one already, with the share code and
// password the request names.
export async function withDocumentGrant(
  apiBase: string,
  input: string,
  init: RequestInit | undefined,
): Promise<RequestInit | undefined> {
  const documentId = documentIdOfPath(apiBase, input);
  if (!documentId) return init;
  const headers = new Headers(init?.headers);
  if (headers.has(INDEX_GRANT_HEADER)) return init;
  const code = headers.get('X-Share-Code');
  const share = code ? { code, password: headers.get('X-Share-Password') } : null;
  const grant = await documentGrant(documentId, share);
  if (!grant) return init;
  headers.set(INDEX_GRANT_HEADER, grant.grant);
  return { ...init, headers };
}

export function resetDocumentGrantsForTests(): void {
  held.clear();
  inflight.clear();
  refusals.clear();
  for (const timer of renewTimers.values()) clearTimeout(timer);
  renewTimers.clear();
}
