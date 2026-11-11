// The index's internal doors into an app's items, one function each (./internal routes to them): a person merged
// or closed, an item exported or imported, a person's or an item's migration, and a connected tab's reverse write.
import { readConnectedTabWrite } from '@liveworkspace/index-client';
import type { ConnectedTabOutcome } from './connected-tabs';
import type {
  MigrationApp,
  MigrationDoorAnswer,
  MigrationPersonAnswer,
} from '@liveworkspace/migration';
import {
  MigrationTabTooLarge,
  parseMigrationPayload,
  parseMigrationPersonPayload,
} from './migration-door';
import { purgeEach } from './purge';
import {
  IMPORT_MAX_BYTES,
  IMPORT_NAME_MAX,
  type ImportResult,
  type InternalItemHandlers,
  MAX_ID,
  etagVersion,
  exportEtag,
  isExportAppearance,
  isExportFormat,
} from './internal-contract';

export function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID;
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
export const notFound = () => json({ error: 'not_found' }, 404);
export const badRequest = (message: string) => json({ error: 'bad_request', message }, 400);

export async function bodyOf(request: Request): Promise<Record<string, unknown> | null> {
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
export const PERSON_ITEMS_MAX = 100;
const PERSON_ID = /^(user|guest)_[A-Za-z0-9-]{1,64}$/;
const GUEST_ID = /^guest_[A-Za-z0-9-]{1,64}$/;
const USER_ID = /^user_[A-Za-z0-9-]{1,64}$/;

export async function personMerged(
  request: Request,
  guest: string,
  handlers: InternalItemHandlers,
) {
  if (!GUEST_ID.test(guest)) return notFound();
  const body = (await bodyOf(request)) ?? {};
  const into = body['into'];
  // A returning old guest (`legacy: true`) merges into whoever claims it, a guest or an account; any other merge is a
  // guest signing in, into an account.
  const legacy = body['legacy'] === true;
  if (legacy) {
    if (typeof into !== 'string' || !PERSON_ID.test(into) || into === guest)
      return badRequest('into must be another guest or an account id');
  } else if (typeof into !== 'string' || !USER_ID.test(into))
    return badRequest('into must be an account id');
  try {
    await handlers.personMerged?.(guest, into, { legacy });
  } catch (err) {
    // The index asks again (a merge is safe to do twice).
    console.warn('[internal] person merge failed', { error: String(err) });
    return json({ ok: false }, 503);
  }
  return json({ ok: true });
}

export async function personClosed(
  request: Request,
  person: string,
  handlers: InternalItemHandlers,
) {
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
export async function exportItem(
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
  const appearance = url.searchParams.get('appearance');
  if (appearance !== null && !isExportAppearance(appearance)) {
    return badRequest('appearance must be light or dark');
  }
  const result = await run(id, {
    format,
    tabId: tab,
    code,
    appearance,
    ifVersion: etagVersion(request.headers.get('If-None-Match')),
  });
  if (result.status === 'not_found') return notFound();
  const headers = new Headers({ ETag: exportEtag(result.version), 'Cache-Control': 'no-store' });
  if (result.status === 'unchanged') return new Response(null, { status: 304, headers });
  if (result.status === 'empty') return new Response(null, { status: 204, headers });
  headers.set('Content-Type', result.contentType);
  return new Response(result.body, { status: 200, headers });
}

// POST /api/internal/items/import: a new item from a file, or why not.
export async function importItem(
  request: Request,
  run: NonNullable<InternalItemHandlers['import']>,
): Promise<Response> {
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > IMPORT_MAX_BYTES) {
    console.warn('[internal] import refused', { reason: 'too_large', bytes: declared });
    return json({ error: 'too_large' }, 413);
  }
  const body = await bodyOf(request);
  if (!body) return badRequest('body must be a JSON object');
  const { owner, folderId, name, file } = body;
  if (typeof owner !== 'string' || !USER_ID.test(owner))
    return badRequest('owner must be an account id');
  if (folderId !== null && !validId(folderId))
    return badRequest('folderId must be a folder id or null');
  if (typeof name !== 'string' || !name.trim() || name.length > IMPORT_NAME_MAX)
    return badRequest('name must be a name');
  if (typeof file !== 'string' || !file) return badRequest('file must be the file text');
  let result: ImportResult;
  try {
    result = await run({ owner, folderId, name: name.trim(), file });
  } catch (err) {
    // The mirror asks again on its next pass.
    console.error('[internal] import failed', { error: String(err) });
    return json({ error: 'unavailable' }, 503);
  }
  if (result.status === 'invalid_file') {
    console.warn('[internal] import refused', { reason: 'invalid_file' });
    return json({ error: 'invalid_file' }, 400);
  }
  if (result.status === 'too_large') {
    console.warn('[internal] import refused', { reason: 'too_large' });
    return json({ error: 'too_large' }, 413);
  }
  console.info('[internal] imported', { id: result.id });
  return json({ id: result.id }, 201);
}

// The largest migration body the door reads: the same RPC message cap as the import door's.
export const MIGRATION_MAX_BYTES = IMPORT_MAX_BYTES;

// A migration door's body, read up to MIGRATION_MAX_BYTES and parsed as JSON, or the refusal to answer.
async function migrationBody(request: Request): Promise<{ body: unknown } | Response> {
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > MIGRATION_MAX_BYTES) {
    console.warn('[internal] migration refused', { reason: 'too_large', bytes: declared });
    return json({ error: 'too_large' }, 413);
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MIGRATION_MAX_BYTES) {
    console.warn('[internal] migration refused', { reason: 'too_large', bytes: bytes.byteLength });
    return json({ error: 'too_large' }, 413);
  }
  try {
    return { body: JSON.parse(new TextDecoder().decode(bytes)) as unknown };
  } catch {
    return badRequest('body must be JSON');
  }
}

// PUT /api/internal/people/:id/migration: what the app keeps for an old person beside their items.
export async function migratePerson(
  request: Request,
  person: string,
  app: MigrationApp | undefined,
  run: InternalItemHandlers['migratePerson'],
): Promise<Response> {
  if (!app || !run || !PERSON_ID.test(person)) return notFound();
  const read = await migrationBody(request);
  if (read instanceof Response) return read;
  const parsed = parseMigrationPersonPayload(read.body, app, person);
  if (!parsed.ok) {
    console.warn('[internal] person migration refused', { reason: 'invalid', error: parsed.error });
    return badRequest(parsed.error);
  }
  let answer: MigrationPersonAnswer;
  try {
    answer = await run(parsed.payload);
  } catch (err) {
    // The tool runs again; adding a library is safe to repeat.
    console.error('[internal] person migration failed', { error: String(err) });
    return json({ error: 'unavailable' }, 503);
  }
  console.info('[internal] person migrated', answer);
  return json(answer);
}

// PUT /api/internal/items/:id/migration: an old document's part into the item's room.
export async function migrateItem(
  request: Request,
  id: string,
  app: MigrationApp | undefined,
  run: NonNullable<InternalItemHandlers['migrate']>,
): Promise<Response> {
  if (!app) return notFound();
  const read = await migrationBody(request);
  if (read instanceof Response) return read;
  const parsed = parseMigrationPayload(read.body, app, id);
  if (!parsed.ok) {
    console.warn('[internal] migration refused', { reason: 'invalid', error: parsed.error });
    return badRequest(parsed.error);
  }
  let answer: MigrationDoorAnswer;
  try {
    answer = await run(parsed.payload);
  } catch (err) {
    if (err instanceof MigrationTabTooLarge) {
      console.warn('[internal] migration refused', {
        reason: 'tab_too_large',
        tabId: err.tabId,
        bytes: err.bytes,
      });
      return json(
        { error: 'tab_too_large', tabId: err.tabId, bytes: err.bytes, cap: err.cap },
        413,
      );
    }
    // The tool runs again; every write is safe to repeat.
    console.error('[internal] migration failed', { error: String(err) });
    return json({ error: 'unavailable' }, 503);
  }
  console.info('[internal] migrated', {
    written: answer.written.length,
    edited: answer.edited.length,
    meta: answer.meta,
  });
  return json(answer);
}

// POST /api/internal/items/:id/connected-tabs: the reverse tab, or why not. The index waits at most 5 s for it and
// takes the reverse back on anything but a 2xx.
export async function connectedTab(
  request: Request,
  id: string,
  run: NonNullable<InternalItemHandlers['connectedTab']>,
): Promise<Response> {
  const write = readConnectedTabWrite(await bodyOf(request));
  if (!write) return badRequest('invalid connected tab');
  let outcome: ConnectedTabOutcome;
  try {
    outcome = await run(id, write);
  } catch (err) {
    console.error('[internal] connected tab failed', { error: String(err) });
    return json({ error: 'unavailable' }, 503);
  }
  if (outcome === 'not_found') return notFound();
  if (outcome === 'connection_limit') {
    console.warn('[internal] connected tab refused', { reason: 'connection_limit' });
    return json({ error: 'connection_limit' }, 409);
  }
  console.info('[internal] connected tab', { made: outcome.made });
  return json({ tabId: outcome.tabId }, outcome.made ? 201 : 200);
}
