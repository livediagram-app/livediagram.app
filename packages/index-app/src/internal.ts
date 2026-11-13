// /api/internal/items/**: the index's doors into an app's items (liveworkspace/docs/specs/004-index/one-explorer-contracts.md).
// Server to server only: the caller sends `Authorization: Bearer <INDEX_KEY>`, compared in constant time; without
// INDEX_KEY configured every path here is a plain 404, as if it did not exist.
//
//   DELETE /api/internal/items/:id                          drop everything the item stores, end its sessions
//   POST   /api/internal/items/purge          {ids}          the same for up to BULK_PURGE_MAX items (a closed account)
//   POST   /api/internal/items/:id/revoke     {codes, reason?}  end the sessions of revoked or rescoped links
//   POST   /api/internal/items/:id/notices    {type, ...}    what happened, for an email (index-client notices.ts)
//   POST   /api/internal/items/:id/workbench-close {pairingId}  a workbench pairing's access ended: close its sessions
//                                                            in the item's room (liveworkspace/docs/specs/011-workbench/workbench.md)
//   POST   /api/internal/items/:id/standing {archived, trashed, at}  where the item stands at the index after an
//                                                            archive, move out, trash or restore (standing.ts in
//                                                            index-client); 200 and nothing done without a handler
//   POST   /api/internal/items/:id/connected-tabs {name, connection}  the index's reverse write of a connected tab
//                                                            (connected-tabs.ts): one tab at the end, `{ tabId }`
//   POST   /api/internal/items/:from/copy-to/:to  {tabId?, by?, code?, ip?, title?}  copy an item's content (or one
//                                                            tab) into a new item, for `by` (who copies) through link
//                                                            `code` (if any), from address `ip` (if known), named
//                                                            `title` (the new item's, at the index)
//   POST   /api/internal/people/:id/purge     {items}        a closed account: drop what the app keeps for the
//                                                            person, and anonymise them in up to 100 items
//   POST   /api/internal/people/:guest/merge  {into, legacy?}  a guest became an account: move what the app keeps
//                                                            for the guest to the account. With `legacy: true` (a
//                                                            returning guest of the old livediagram.app claiming
//                                                            its migrated work, docs/migration.md step 6) `into` may
//                                                            be a guest too
//   GET    /api/internal/items/:id/export?format=svg[&tab=][&code=][&appearance=]   the item drawn as a file, for liveworkspace's
//                                                            previews (liveworkspace/docs/specs/006-media/previews.md). Also takes the
//                                                            app's MEDIA_KEY (`exportKey`) and DRIVE_KEY (`driveKey`).
//   GET    /api/internal/items/:id/export?format=file       the item's whole-item envelope, the Drive mirror's file
//                                                            (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The apps")
//   GET    /api/internal/items/:id/export?format=csv|comments  the item's boards and sheets as CSV, or its comment
//                                                            threads, for the data export (data-export-door.ts,
//                                                            liveworkspace/docs/specs/003-accounts/data-export.md)
//   POST   /api/internal/items/import     {owner, folderId, name, file}  a new item for `owner` from a file: the
//                                                            Drive mirror's Import as a copy. Takes DRIVE_KEY too.
//   PUT    /api/internal/items/:id/migration  MigrationRoomPayload  an old livediagram.app document's part written
//                                                            into the item's room with its own times (docs/migration.md
//                                                            "The apps' migration door"). Takes MIGRATION_KEY too.
//   POST   /api/internal/items/community-states {posts}  where up to COMMUNITY_STATES_MAX Community posts' items stand,
//                                                            for the Community's sweep (liveworkspace/docs/specs/
//                                                            007-community/community.md "The sweep"). COMMUNITY_KEY
//                                                            (`communityKey`) alone.
//   PUT    /api/internal/people/:id/migration  MigrationPersonPayload  an old livediagram.app person's own data (their
//                                                            shape libraries) into the app's store for them
//                                                            (docs/migration.md "The person migration door").
//                                                            MIGRATION_KEY alone.
//
// The Drive key opens those two doors and nothing else; the migration key the two migration doors alone; the data
// export's key (DATA_EXPORT_KEY) the export door alone, in all four formats. The csv and comments formats take the
// index's key and the data export's, never the media or the Drive key.
// The app supplies what each does to its own content (`InternalItemHandlers`); a door with no handler is a 404.
import {
  COMMUNITY_STATES_MAX,
  isItemCommunityState,
  parseItemNotice,
  parseItemStanding,
  TITLE_MAX,
  type CommunityStateAnswer,
  type CommunityStateAsk,
  type IndexAppClient,
} from '@liveworkspace/index-client';
import { answerDataExport, isDataExportFormat } from './data-export-door';
import { BULK_PURGE_MAX, purgeEach } from './purge';
import { bearerMatches } from './timing-safe';
import {
  type Copier,
  type CopyOutcome,
  IP_TEXT,
  type InternalItemHandlers,
  type InternalItemsOptions,
  MAX_CODES,
} from './internal-contract';
import {
  badRequest,
  bodyOf,
  connectedTab,
  exportItem,
  importItem,
  json,
  migrateItem,
  migratePerson,
  notFound,
  personClosed,
  personMerged,
  validId,
} from './internal-doors';

export {
  EXPORT_APPEARANCES,
  EXPORT_FORMATS,
  IMPORT_MAX_BYTES,
  IMPORT_NAME_MAX,
  JOINED_TELEMETRY_TYPE,
  etagVersion,
  exportEtag,
} from './internal-contract';
export type {
  Copier,
  CopyOutcome,
  ExportAppearance,
  ExportFormat,
  ExportQuery,
  ExportResult,
  ImportInput,
  ImportResult,
  InternalItemHandlers,
  InternalItemsOptions,
} from './internal-contract';
export { MIGRATION_MAX_BYTES, PERSON_ITEMS_MAX } from './internal-doors';

// The telemetry type a `joined` notice is counted under: `<Noun>·Joined·Edit|Participate|View`, once per person and
// item (the index sends the notice the first time someone comes in through a link). Every app reports it from its
// `notice` handler with its own noun (Project, Document, Design).
export function isInternalItemsPath(pathname: string): boolean {
  return /^\/api\/internal\/(items|people)(\/|$)/.test(pathname);
}

// The most items one person purge names.
const EXPORT_PATH = /^\/api\/internal\/items\/[^/]+\/export$/;
const MIGRATION_PATH = /^\/api\/internal\/items\/[^/]+\/migration$/;
const PERSON_MIGRATION_PATH = /^\/api\/internal\/people\/[^/]+\/migration$/;
const IMPORT_PATH = '/api/internal/items/import';
const COMMUNITY_STATES_PATH = '/api/internal/items/community-states';

const SHARE_CODE = /^[A-Za-z0-9]{4,64}$/;

// An app's `communityStates` handler: the index's answer through the app's own index client, or a throw (the door's
// 503, which the sweep retries) when the app has no index configured.
export async function askIndexCommunityStates(
  client: Pick<IndexAppClient, 'communityStates'> | null,
  posts: CommunityStateAsk[],
): Promise<CommunityStateAnswer[]> {
  if (!client) throw new Error('index_unavailable');
  return client.communityStates(posts);
}

// POST /api/internal/items/community-states: the index's answer for up to COMMUNITY_STATES_MAX posts, checked both
// ways (a malformed answer is the index's failure, never passed on).
async function communityStates(
  request: Request,
  run: NonNullable<InternalItemHandlers['communityStates']>,
): Promise<Response> {
  const posts = (await bodyOf(request))?.['posts'];
  if (!Array.isArray(posts) || posts.length === 0 || posts.length > COMMUNITY_STATES_MAX) {
    return badRequest(`posts must be 1 to ${COMMUNITY_STATES_MAX} posts`);
  }
  const asks: CommunityStateAsk[] = [];
  for (const post of posts as unknown[]) {
    const p = post as Partial<CommunityStateAsk> | null;
    const code = p?.code;
    if (
      !p ||
      !validId(p.id) ||
      !validId(p.owner) ||
      typeof code !== 'string' ||
      !SHARE_CODE.test(code)
    )
      return badRequest('each post needs an id, a code and an owner');
    asks.push({ id: p.id, code, owner: p.owner });
  }
  let states: CommunityStateAnswer[];
  try {
    states = await run(asks);
  } catch (err) {
    // The sweep asks again on its next run.
    console.warn('[internal] community states failed', { error: String(err) });
    return json({ error: 'unavailable' }, 503);
  }
  if (!states.every((s) => validId(s.id) && isItemCommunityState(s.state))) {
    console.warn('[internal] community states malformed');
    return json({ error: 'unavailable' }, 503);
  }
  return json({ states });
}

export async function handleInternalItems(
  request: Request,
  {
    key,
    app,
    exportKey,
    driveKey,
    dataExportKey,
    migrationKey,
    communityKey,
    handlers,
    waitUntil = (p) => void p,
  }: InternalItemsOptions,
): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  if (!isInternalItemsPath(pathname)) return notFound();
  // The export door takes the index's, the media and the Drive key; the import door the index's and the Drive key;
  // the migration door the index's (its handoff of a browser's Local only parts) and the migration key; every other
  // door the index's alone.
  const exporting = EXPORT_PATH.test(pathname) && request.method === 'GET';
  const importing = pathname === IMPORT_PATH && request.method === 'POST';
  const migrating = MIGRATION_PATH.test(pathname) && request.method === 'PUT';
  const migratingPerson = PERSON_MIGRATION_PATH.test(pathname) && request.method === 'PUT';
  const sweeping = pathname === COMMUNITY_STATES_PATH && request.method === 'POST';
  const dataFormat = exporting ? url.searchParams.get('format') : null;
  const keys = exporting
    ? isDataExportFormat(dataFormat)
      ? [key, dataExportKey]
      : [key, exportKey, driveKey, dataExportKey]
    : importing
      ? [key, driveKey]
      : migrating
        ? [key, migrationKey]
        : migratingPerson
          ? [migrationKey]
          : sweeping
            ? [communityKey]
            : [key];
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
    if (migratingPerson) return migratePerson(request, person, app, handlers.migratePerson);
    return notFound();
  }
  // After `api/internal/items/`.
  const rest = parts.slice(4);
  const id = rest[0];
  if (!validId(id)) return notFound();

  if (sweeping)
    return handlers.communityStates
      ? communityStates(request, handlers.communityStates)
      : notFound();
  if (exporting && isDataExportFormat(dataFormat))
    return answerDataExport(id, dataFormat, handlers);
  if (exporting)
    return handlers.export ? exportItem(url, request, id, handlers.export) : notFound();
  if (importing) return handlers.import ? importItem(request, handlers.import) : notFound();
  if (migrating)
    return handlers.migrate ? migrateItem(request, id, app, handlers.migrate) : notFound();

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

  if (
    rest.length === 2 &&
    rest[1] === 'workbench-close' &&
    request.method === 'POST' &&
    handlers.workbenchClose
  ) {
    const pairingId = (await bodyOf(request))?.['pairingId'];
    if (!validId(pairingId)) return badRequest('pairingId must be a pairing id');
    const reached = await handlers.workbenchClose(id, pairingId).catch(() => false);
    return reached ? json({ ok: true }) : json({ ok: false }, 503);
  }

  if (rest.length === 2 && rest[1] === 'standing' && request.method === 'POST') {
    const standing = parseItemStanding(await bodyOf(request));
    if (!standing) return badRequest('invalid standing');
    // Only an app that works on its own clock for an item (liveplanner) acts on it; every other app confirms.
    if (!handlers.standing) return json({ ok: true });
    try {
      await handlers.standing(id, standing);
    } catch (err) {
      console.warn('[internal] standing failed', { error: String(err) });
      return json({ ok: false }, 503);
    }
    return json({ ok: true });
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

  if (
    rest.length === 2 &&
    rest[1] === 'connected-tabs' &&
    request.method === 'POST' &&
    handlers.connectedTab
  ) {
    return connectedTab(request, id, handlers.connectedTab);
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
    // The copy's name as the index titled it. Absent (an older index), blank or not text: the app starts the copy
    // as it always has.
    const title =
      typeof body['title'] === 'string' ? body['title'].trim().slice(0, TITLE_MAX) || null : null;
    let outcome: CopyOutcome;
    try {
      outcome = await handlers.copy(id, to, validId(tabId) ? tabId : null, copier, title);
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
