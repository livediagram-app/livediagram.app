// /api/internal/items/**: the index's doors into an app's items (liveworkspace/docs/one-explorer-contracts.md).
// Server to server only: the caller sends `Authorization: Bearer <INDEX_KEY>`, compared in constant time; without
// INDEX_KEY configured every path here is a plain 404, as if it did not exist.
//
//   DELETE /api/internal/items/:id                          drop everything the item stores, end its sessions
//   POST   /api/internal/items/purge          {ids}          the same for up to BULK_PURGE_MAX items (a closed account)
//   POST   /api/internal/items/:id/revoke     {codes, reason?}  end the sessions of revoked or rescoped links
//   POST   /api/internal/items/:id/notices    {type, ...}    what happened, for an email (index-client notices.ts)
//   POST   /api/internal/items/:from/copy-to/:to  {tabId?}   copy an item's content (or one tab) into a new item
//   POST   /api/internal/people/:id/purge     {items}        a closed account: drop what the app keeps for the
//                                                            person, and anonymise them in up to 100 items
//
// The app supplies what each does to its own content (`InternalItemHandlers`); a door with no handler is a 404.

import { parseItemNotice, type ItemNotice } from '@liveworkspace/index-client';
import { BULK_PURGE_MAX, purgeEach } from './purge';
import { bearerMatches } from './timing-safe';

const MAX_ID = 200;
const MAX_CODES = 500;

export type CopyOutcome = { tabs: number; items: number } | 'not_found' | 'conflict';

export type InternalItemHandlers = {
  // Drop everything the item stores (its Durable Object, and anything the app keeps beside it).
  purge: (itemId: string) => Promise<unknown>;
  // End the sessions of these share codes; answers how many closed. `rescoped`: reload into what the link opens.
  revoke?: (itemId: string, codes: string[], reason: 'revoked' | 'rescoped') => Promise<number>;
  // Copy the content (or one tab of it) into a new item.
  copy?: (from: string, to: string, tabId: string | null) => Promise<CopyOutcome>;
  // A notice for the app's emails, run off the index's path (waitUntil).
  notice?: (itemId: string, notice: ItemNotice) => Promise<unknown>;
  // A closed account (the index's person purge): what the app keeps for the person beside their items (images,
  // their workbench, claims), dropped. Idempotent.
  personClosed?: (personId: string) => Promise<unknown>;
  // Their name off one item they worked in that outlives them (anonymise.ts). Idempotent.
  anonymise?: (itemId: string, personId: string) => Promise<unknown>;
};

export type InternalItemsOptions = {
  key: string | undefined;
  handlers: InternalItemHandlers;
  waitUntil?: (promise: Promise<unknown>) => void;
};

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const notFound = () => json({ error: 'not_found' }, 404);
const badRequest = (message: string) => json({ error: 'bad_request', message }, 400);

async function bodyOf(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

// Whether a path is one of these doors (`/api/internal/items...` or `/api/internal/people...`).
export function isInternalItemsPath(pathname: string): boolean {
  return /^\/api\/internal\/(items|people)(\/|$)/.test(pathname);
}

// The most items one person purge names.
export const PERSON_ITEMS_MAX = 100;
const PERSON_ID = /^(user|guest)_[A-Za-z0-9-]{1,64}$/;

async function personClosed(request: Request, person: string, handlers: InternalItemHandlers) {
  if (!PERSON_ID.test(person)) return notFound();
  const items = ((await bodyOf(request)) ?? {})['items'] ?? [];
  if (!Array.isArray(items) || items.length > PERSON_ITEMS_MAX || !items.every(validId)) {
    return badRequest(`items must be up to ${PERSON_ITEMS_MAX} item ids`);
  }
  await handlers.personClosed?.(person);
  const anonymise = handlers.anonymise;
  const { purged, unreached } = anonymise
    ? await purgeEach([...new Set(items)], (id) => anonymise(id, person))
    : { purged: [], unreached: [] };
  // The index asks again (every item is safe to do twice) until each was reached.
  return json(
    { ok: unreached.length === 0, anonymised: purged.length, unreached },
    unreached.length ? 503 : 200,
  );
}

export async function handleInternalItems(
  request: Request,
  { key, handlers, waitUntil = (p) => void p }: InternalItemsOptions,
): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  if (!key || !isInternalItemsPath(pathname)) return notFound();
  if (!(await bearerMatches(request, key))) return json({ error: 'unauthorized' }, 401);
  const parts = pathname.split('/');
  if (parts[3] === 'people') {
    const person = parts[4] ?? '';
    if (parts.length === 6 && parts[5] === 'purge' && request.method === 'POST') {
      return personClosed(request, person, handlers);
    }
    return notFound();
  }
  // After `api/internal/items/`.
  const rest = parts.slice(4);
  const id = rest[0];
  if (!validId(id)) return notFound();

  if (rest.length === 1 && request.method === 'DELETE') {
    await handlers.purge(id);
    return json({ ok: true });
  }

  if (rest.length === 1 && id === 'purge' && request.method === 'POST') {
    const ids = (await bodyOf(request))?.['ids'];
    if (!Array.isArray(ids) || ids.length > BULK_PURGE_MAX || !ids.every(validId)) {
      return badRequest(`ids must be up to ${BULK_PURGE_MAX} item ids`);
    }
    const { purged, unreached } = await purgeEach([...new Set(ids)], handlers.purge);
    return json({ ok: unreached.length === 0, purged, unreached });
  }

  if (rest.length === 2 && rest[1] === 'revoke' && request.method === 'POST' && handlers.revoke) {
    const body = await bodyOf(request);
    const codes = body?.['codes'];
    if (!Array.isArray(codes) || codes.length > MAX_CODES || !codes.every(validId)) {
      return badRequest('codes must be an array of share codes');
    }
    const reason = body?.['reason'] === 'rescoped' ? 'rescoped' : 'revoked';
    const closed = await handlers.revoke(id, codes, reason);
    return json({ ok: true, closed });
  }

  if (rest.length === 2 && rest[1] === 'notices' && request.method === 'POST' && handlers.notice) {
    const notice = parseItemNotice(await bodyOf(request));
    if (!notice) return badRequest('invalid notice');
    const run = handlers.notice;
    waitUntil(
      run(id, notice).catch((err: unknown) => {
        console.warn('[internal] notice failed', { type: notice.type, error: String(err) });
      }),
    );
    return json({ ok: true }, 202);
  }

  if (rest.length === 3 && rest[1] === 'copy-to' && request.method === 'POST' && handlers.copy) {
    const to = rest[2];
    if (!validId(to) || to === id) return badRequest('invalid copy target');
    const tabId = ((await bodyOf(request)) ?? {})['tabId'];
    if (tabId !== undefined && tabId !== null && !validId(tabId))
      return badRequest('invalid tabId');
    let outcome: CopyOutcome;
    try {
      outcome = await handlers.copy(id, to, validId(tabId) ? tabId : null);
    } catch (err) {
      console.error('[internal] copy-to failed', err);
      outcome = 'conflict';
    }
    if (outcome === 'not_found') return notFound();
    if (outcome === 'conflict') return json({ error: 'copy_conflict' }, 409);
    return json({ ok: true, ...outcome }, 201);
  }

  return notFound();
}
