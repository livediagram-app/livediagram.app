// /api/internal/items/**: the index's doors into an app's items (liveworkspace/docs/one-explorer-contracts.md).
// Server to server only: the caller sends `Authorization: Bearer <INDEX_KEY>`, compared in constant time; without
// INDEX_KEY configured every path here is a plain 404, as if it did not exist.
//
//   DELETE /api/internal/items/:id                          drop everything the item stores, end its sessions
//   POST   /api/internal/items/purge          {ids}          the same for up to BULK_PURGE_MAX items (a closed account)
//   POST   /api/internal/items/:id/revoke     {codes, reason?}  end the sessions of revoked or rescoped links
//   POST   /api/internal/items/:id/notices    {type, ...}    what happened, for an email (index-client notices.ts)
//   POST   /api/internal/items/:from/copy-to/:to  {tabId?, by?, code?, ip?}  copy an item's content (or one tab)
//                                                            into a new item, for `by` (who copies) through link `code`
//                                                            (if any), from address `ip` (if known)
//   POST   /api/internal/people/:id/purge     {items}        a closed account: drop what the app keeps for the
//                                                            person, and anonymise them in up to 100 items
//   POST   /api/internal/people/:guest/merge  {into}         a guest became an account: move what the app keeps
//                                                            for the guest to the account
//   GET    /api/internal/items/:id/export?format=svg[&tab=][&code=]   the item drawn as a file, for liveworkspace's
//                                                            previews (liveworkspace/docs/previews.md) and, next, the
//                                                            Drive mirror. Also takes the app's MEDIA_KEY (`exportKey`).
//
// The app supplies what each does to its own content (`InternalItemHandlers`); a door with no handler is a 404.

import { parseItemNotice, type ItemNotice, type Level } from '@liveworkspace/index-client';
import { BULK_PURGE_MAX, purgeEach } from './purge';
import { bearerMatches } from './timing-safe';

// The telemetry type a `joined` notice is counted under: `<Noun>·Joined·Edit|Participate|View`, once per person and
// item (the index sends the notice the first time someone comes in through a link). Every app reports it from its
// `notice` handler with its own noun (Project, Document, Design).
export const JOINED_TELEMETRY_TYPE: Record<Level, 'View' | 'Participate' | 'Edit'> = {
  view: 'View',
  participate: 'Participate',
  edit: 'Edit',
};

const MAX_ID = 200;
const MAX_CODES = 500;

// Who copies an item, the link they came in by, and the address they copied from (the visitor's, as the index saw
// it; null when it did not know), for anything the app counts per network.
export type Copier = { by: string | null; code: string | null; ip: string | null };

// An address as the index forwards it: IPv4 or IPv6 text, nothing longer.
const IP_TEXT = /^[0-9A-Fa-f:.]{2,45}$/;

export type CopyOutcome = { tabs: number; items: number } | 'not_found' | 'conflict';

// ---------- The export door (liveworkspace/docs/previews.md "The export door") --------------------------------------

// What an item can be exported as. `svg`: the first tab (or `tabId`) drawn, the platform's previews. The Drive
// mirror adds its own formats here.
export const EXPORT_FORMATS = ['svg'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export type ExportQuery = {
  format: ExportFormat;
  // One tab, or null for the first.
  tabId: string | null;
  // The public link (a Community post's) the reader came in by: the app draws what that link may show, or refuses
  // (`not_found`) when it shows nothing now. Null for everyone else.
  code: string | null;
  // The version the caller already holds (`If-None-Match`): `unchanged` when it is still the content's, undrawn.
  ifVersion: number | null;
};

// `version`: the content's last save (epoch ms), sent back as the ETag.
export type ExportResult =
  | { status: 'ok'; body: string | Uint8Array; contentType: string; version: number }
  | { status: 'empty'; version: number }
  | { status: 'unchanged'; version: number }
  | { status: 'not_found' };

const isExportFormat = (value: unknown): value is ExportFormat =>
  typeof value === 'string' && (EXPORT_FORMATS as readonly string[]).includes(value);

// An ETag of a version, and the version an If-None-Match names (weak or strong, the first of a list).
export const exportEtag = (version: number): string => `"${version}"`;
export function etagVersion(header: string | null): number | null {
  const first = header?.split(',')[0]?.trim().replace(/^W\//, '');
  const match = first ? /^"(\d{1,16})"$/.exec(first) : null;
  return match ? Number(match[1]) : null;
}

export type InternalItemHandlers = {
  // Drop everything the item stores (its Durable Object, and anything the app keeps beside it).
  purge: (itemId: string) => Promise<unknown>;
  // End the sessions of these share codes; answers how many closed. `rescoped`: reload into what the link opens.
  revoke?: (itemId: string, codes: string[], reason: 'revoked' | 'rescoped') => Promise<number>;
  // Copy the content (or one tab of it) into a new item. `copier` says who copies (`by`, null from an index that
  // does not say) and the share link they came in by (`code`, null for their own or their team's item), so the
  // app can copy only what that person may read (another's comment authors, a published post's redactions).
  copy?: (from: string, to: string, tabId: string | null, copier: Copier) => Promise<CopyOutcome>;
  // A notice for the app's emails, run off the index's path (waitUntil).
  notice?: (itemId: string, notice: ItemNotice) => Promise<unknown>;
  // A closed account (the index's person purge): what the app keeps for the person beside their items (images,
  // their workbench, claims), dropped. Idempotent.
  personClosed?: (personId: string) => Promise<unknown>;
  // A guest became an account (the index's merge): what the app keeps for the guest beside their items (images,
  // a per-person store) moves to the account. Idempotent. An app with nothing to move leaves it out and the door
  // just confirms.
  personMerged?: (guestId: string, userId: string) => Promise<unknown>;
  // Their name off one item they worked in that outlives them (anonymise.ts). Idempotent.
  anonymise?: (itemId: string, personId: string) => Promise<unknown>;
  // The item drawn as a file (the export door). Read only: nothing is cached or written on the app's side.
  export?: (itemId: string, query: ExportQuery) => Promise<ExportResult>;
};

export type InternalItemsOptions = {
  key: string | undefined;
  // A second key the export door alone takes: the app's MEDIA_KEY, which liveworkspace's previews call it with.
  exportKey?: string | undefined;
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
const GUEST_ID = /^guest_[A-Za-z0-9-]{1,64}$/;
const USER_ID = /^user_[A-Za-z0-9-]{1,64}$/;

async function personMerged(request: Request, guest: string, handlers: InternalItemHandlers) {
  if (!GUEST_ID.test(guest)) return notFound();
  const into = ((await bodyOf(request)) ?? {})['into'];
  if (typeof into !== 'string' || !USER_ID.test(into))
    return badRequest('into must be an account id');
  try {
    await handlers.personMerged?.(guest, into);
  } catch (err) {
    // The index asks again (a merge is safe to do twice).
    console.warn('[internal] person merge failed', { error: String(err) });
    return json({ ok: false }, 503);
  }
  return json({ ok: true });
}

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

// GET /api/internal/items/:id/export: the item as a file, or why not.
async function exportItem(
  url: URL,
  request: Request,
  id: string,
  run: NonNullable<InternalItemHandlers['export']>,
): Promise<Response> {
  const format = url.searchParams.get('format') ?? 'svg';
  if (!isExportFormat(format)) return badRequest('unknown format');
  const tab = url.searchParams.get('tab');
  const code = url.searchParams.get('code');
  if ((tab !== null && !validId(tab)) || (code !== null && !validId(code))) {
    return badRequest('invalid tab or code');
  }
  const result = await run(id, {
    format,
    tabId: tab,
    code,
    ifVersion: etagVersion(request.headers.get('If-None-Match')),
  });
  if (result.status === 'not_found') return notFound();
  const headers = new Headers({ ETag: exportEtag(result.version), 'Cache-Control': 'no-store' });
  if (result.status === 'unchanged') return new Response(null, { status: 304, headers });
  if (result.status === 'empty') return new Response(null, { status: 204, headers });
  headers.set('Content-Type', result.contentType);
  return new Response(result.body, { status: 200, headers });
}

const EXPORT_PATH = /^\/api\/internal\/items\/[^/]+\/export$/;

export async function handleInternalItems(
  request: Request,
  { key, exportKey, handlers, waitUntil = (p) => void p }: InternalItemsOptions,
): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  if (!isInternalItemsPath(pathname)) return notFound();
  // The export door takes either key; every other door the index's alone.
  const exporting = EXPORT_PATH.test(pathname) && request.method === 'GET';
  const keys = exporting ? [key, exportKey] : [key];
  const present = keys.filter((k): k is string => Boolean(k));
  if (present.length === 0) return notFound();
  let allowed = false;
  for (const k of present) if (await bearerMatches(request, k)) allowed = true;
  if (!allowed) return json({ error: 'unauthorized' }, 401);
  const parts = pathname.split('/');
  if (parts[3] === 'people') {
    const person = parts[4] ?? '';
    if (parts.length === 6 && parts[5] === 'purge' && request.method === 'POST') {
      return personClosed(request, person, handlers);
    }
    if (parts.length === 6 && parts[5] === 'merge' && request.method === 'POST') {
      return personMerged(request, person, handlers);
    }
    return notFound();
  }
  // After `api/internal/items/`.
  const rest = parts.slice(4);
  const id = rest[0];
  if (!validId(id)) return notFound();

  if (exporting)
    return handlers.export ? exportItem(url, request, id, handlers.export) : notFound();

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
    const body = (await bodyOf(request)) ?? {};
    const tabId = body['tabId'];
    if (tabId !== undefined && tabId !== null && !validId(tabId))
      return badRequest('invalid tabId');
    const copier: Copier = {
      by: validId(body['by']) ? body['by'] : null,
      code: validId(body['code']) ? body['code'] : null,
      ip: typeof body['ip'] === 'string' && IP_TEXT.test(body['ip']) ? body['ip'] : null,
    };
    let outcome: CopyOutcome;
    try {
      outcome = await handlers.copy(id, to, validId(tabId) ? tabId : null, copier);
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
