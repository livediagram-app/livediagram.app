// The documents (docs/migration.md, steps 2 to 4): each old document read raw, split by product, its parts' rooms
// written for the apps' migration doors, its pictures drawn, and its index rows (the item per part, favourites,
// recent opens, share links, password and Shared with me) and media references written.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type CrossReference,
  type MigrationApp,
  type MigrationRoomPayload,
  type MovedParts,
  type SplitHooks,
  type SplitResult,
} from '@liveworkspace/migration';
import { hasRetiredContent, splitOldDocument } from '@liveworkspace/migration/split';
import {
  hashPlainSharePassword,
  isHashedSharePassword,
  mediaOwnerOf,
  sha256Hex,
  siteOf,
  uuidFromSeed,
} from '../ids.ts';
import type { PictureDrawer } from '../pictures.ts';
import { DocumentReader, type OldDocument } from '../read-documents.ts';
import type { PlanContext } from './context.ts';
import { DAY_MS, KIND_OF, scopeOf } from './context.ts';
import type { JsonArrayFile, R2Entry, RoomFiles } from './files.ts';
import type { FolderInfo } from './folders.ts';
import { upgradeTab } from '../hooks.ts';
import { readHiddenFromRecent } from './recent-hidden.ts';
import { writeShares } from './shares.ts';

type Row = Record<string, string | number | null>;

// Most Used counts the days of the last USE_WINDOW_DAYS (liveworkspace/apps/index); older opens only make Recent.
const USE_WINDOW_DAYS = 90;
const ITEM_SOURCES = new Set(['ai', 'import', 'template']);
const RETIRED_MODES = new Set(['pages', 'illustrate', 'infographic', 'plan']);

export type SplitFn = (input: OldDocument['input'], hooks: SplitHooks) => SplitResult;

/** The first pass: which app keeps each document's id, for the splitter's links between documents. Only a
 *  document with Pages or Plan content (or no tabs at all) can be kept by another app than livediagram, so only
 *  those are split here. */
export function keptByPass(
  ctx: PlanContext,
  hooks: SplitHooks,
  split: SplitFn = splitOldDocument,
): Map<string, MigrationApp> {
  const kept = new Map<string, MigrationApp>();
  const reader = new DocumentReader(ctx.snapshot);
  for (const { id, bodies } of reader.tabBodies()) {
    const needsSplit =
      bodies.length === 0 ||
      bodies.some((data) => {
        try {
          return hasRetiredContent(JSON.parse(data));
        } catch {
          return false;
        }
      });
    if (!needsSplit) continue;
    const doc = reader.one(id);
    const app = doc ? split(doc.input, hooks).parts[0]?.app : undefined;
    if (app && app !== 'livediagram') kept.set(id, app);
  }
  return kept;
}

// An old `documents.source` as the index's (`ai`, `import`, `template`, or null for a person's): the MCP made
// documents for an AI tool.
const sourceOf = (source: string | null): string | null =>
  source === 'mcp' ? 'ai' : source && ITEM_SOURCES.has(source) ? source : null;

export type DocumentPassDeps = {
  hooks: SplitHooks;
  split?: SplitFn;
  drawPicture: PictureDrawer | null;
  folders: ReadonlyMap<string, FolderInfo>;
  rooms: RoomFiles;
  r2: JsonArrayFile;
  moved: JsonArrayFile;
};

export async function documentPass(ctx: PlanContext, deps: DocumentPassDeps): Promise<void> {
  const split = deps.split ?? splitOldDocument;
  const favourites = ctx.snapshot.prepare(
    'SELECT owner_id, created_at FROM favourites WHERE document_id = ? ORDER BY owner_id',
  );
  const opens = ctx.snapshot.prepare(
    'SELECT owner_id, last_opened_at FROM document_opens WHERE document_id = ? ORDER BY owner_id',
  );
  const tags = ctx.snapshot.prepare(
    'SELECT COUNT(*) AS n FROM document_tags WHERE document_id = ?',
  );
  const hiddenFromRecent = readHiddenFromRecent(ctx);
  const pictureIds = new Map<string, string>();

  for (const doc of new DocumentReader(ctx.snapshot).all()) {
    const { input, extra } = doc;
    const d = input.document;
    const result = split(input, deps.hooks);
    const parts = result.parts;
    if (parts.length === 0) {
      ctx.report.skip('document', d.id, 'nothing to copy');
      continue;
    }
    for (const note of result.notes) ctx.report.notes.push({ document: d.id, note });
    if (result.moved) deps.moved.push(result.moved satisfies MovedParts);
    ctx.report.add('documents');
    ctx.report.add(`parts.${parts.length}`);
    for (const p of parts) ctx.report.add(`parts.${p.app}`);

    await drawPictures(ctx, deps, doc, result.crossReferences, parts, pictureIds);
    for (const ref of result.crossReferences) ctx.report.crossReference(ref);

    const owner = parts[0]!.ownerId;
    if (!owner.startsWith('user_')) {
      const guest = d.ownerId;
      const seen = ctx.guestFirstSeen.get(guest);
      if (seen === undefined || d.createdAt < seen) ctx.guestFirstSeen.set(guest, d.createdAt);
    }
    const scope = scopeOf(owner, d.teamId);
    const folder =
      extra.folderId && deps.folders.get(extra.folderId)?.scope === scope ? extra.folderId : null;
    if (extra.folderId && !folder) ctx.report.add('items.folderDropped');
    const trashReason =
      d.trashedAt === null ? null : extra.trashReason === 'empty' ? 'empty' : 'deleted';
    const recorded =
      d.opensIn && !RETIRED_MODES.has(d.opensIn)
        ? `${d.opensIn}:${d.tabKind ?? ''}:${d.templateFamily ?? ''}`
        : null;
    for (const part of parts) {
      deps.rooms.write(part);
      ctx.sql.index.row({
        table: 'items',
        key: part.id,
        columns: [
          'id',
          'app',
          'kind',
          'owner_id',
          'team_id',
          'scope',
          'folder_id',
          'title',
          'source',
          'intent',
          'summary',
          'created_at',
          'updated_at',
          'trashed_at',
          'trash_reason',
        ],
        values: [
          part.id,
          part.app,
          KIND_OF[part.app],
          part.ownerId,
          part.teamId,
          scope,
          folder,
          part.name,
          sourceOf(d.source),
          part.app === 'livediagram' ? recorded : null,
          // Not '{}': the index's empty clean-up would take an imported item for one never written, between the
          // index step and its room's first summary push.
          '{"imported":"1"}',
          d.createdAt,
          d.savedAt,
          d.trashedAt,
          trashReason,
        ],
        conflict: ['id'],
        version: d.savedAt,
        guard: 'updated_at',
        update: [
          'owner_id',
          'team_id',
          'scope',
          'folder_id',
          'title',
          'updated_at',
          'trashed_at',
          'trash_reason',
        ],
      });
      ctx.report.add(`items.${part.app}`);
      // Every image the part places is referenced at once, so the media service's sweep of unplaced images never
      // sees an imported one as unused (step 4.2).
      for (const io of part.imageOwners) {
        ctx.sql.media.row({
          table: 'refs',
          key: `${siteOf(part.app)}|${part.id}|${io.imageId}`,
          columns: ['app', 'document', 'image_id'],
          values: [siteOf(part.app), part.id, io.imageId],
          conflict: ['app', 'document', 'image_id'],
          version: 1,
        });
      }
    }
    ctx.kept.set(d.id, {
      app: parts[0]!.app,
      scope,
      title: d.name,
      owner,
      trashed: d.trashedAt !== null,
      closed: d.teamId !== null || extra.sharePassword !== null,
    });

    for (const f of favourites.all(d.id) as Row[]) {
      const person = ctx.owners.ownerOf(String(f.owner_id));
      for (const part of parts) {
        ctx.sql.index.row({
          table: 'favourites',
          key: `${person}|${part.id}`,
          columns: ['person_id', 'item_id', 'created_at'],
          values: [person, part.id, Number(f.created_at)],
          conflict: ['person_id', 'item_id'],
          version: 1,
        });
      }
    }
    // Who hid the document from Recent: their open row says so, and someone who hid it without ever opening it
    // gets a row with no open (last_opened_at 0), as the index's own hide makes.
    const hiders = hiddenFromRecent.get(d.id);
    const openRows = (opens.all(d.id) as Row[]).map((o) => ({
      person: ctx.owners.ownerOf(String(o.owner_id)),
      at: Number(o.last_opened_at),
    }));
    for (const person of [...(hiders ?? [])].sort()) {
      if (!openRows.some((o) => o.person === person)) openRows.push({ person, at: 0 });
    }
    for (const { person, at } of openRows) {
      const hidden = hiders?.has(person) ? 1 : 0;
      if (hidden) ctx.report.add('opens.hidden', parts.length);
      const day = Math.floor(at / DAY_MS);
      for (const part of parts) {
        ctx.sql.index.row({
          table: 'opens',
          key: `${person}|${part.id}`,
          columns: ['person_id', 'item_id', 'last_opened_at', 'hidden'],
          values: [person, part.id, at, hidden],
          conflict: ['person_id', 'item_id'],
          version: at,
          guard: 'last_opened_at',
          update: ['last_opened_at', 'hidden'],
        });
        if (at > 0 && ctx.now - at <= USE_WINDOW_DAYS * DAY_MS) {
          ctx.sql.index.row({
            table: 'use_days',
            key: `${person}|${part.id}|${day}`,
            columns: ['person_id', 'item_id', 'day'],
            values: [person, part.id, day],
            conflict: ['person_id', 'item_id', 'day'],
            version: 1,
          });
        }
      }
    }
    writeShares(ctx, doc, parts, result.moved);
    if (extra.sharePassword) {
      const hash = isHashedSharePassword(extra.sharePassword)
        ? extra.sharePassword
        : hashPlainSharePassword(extra.sharePassword, d.id);
      if (hash !== extra.sharePassword) ctx.report.add('sharePasswords.hashedFromPlain');
      for (const part of parts) {
        ctx.sql.index.row({
          table: 'share_passwords',
          key: part.id,
          columns: ['item_id', 'hash', 'updated_at'],
          values: [part.id, hash, d.savedAt],
          conflict: ['item_id'],
          version: sha256Hex(hash),
        });
      }
    }
    const tagCount = Number((tags.get(d.id) as Row | undefined)?.n ?? 0);
    // The index has no tags: counted, so the rehearsal says how many go nowhere.
    if (tagCount) ctx.report.add('tags.notCarried', tagCount);
  }
}

/** Draws each picture slot's content, uploads it as the part owner's image, and points the slot at it. */
async function drawPictures(
  ctx: PlanContext,
  deps: DocumentPassDeps,
  doc: OldDocument,
  refs: readonly CrossReference[],
  parts: MigrationRoomPayload[],
  pictureIds: Map<string, string>,
): Promise<void> {
  const wanted = refs.filter((r) => r.picture);
  if (wanted.length === 0) return;
  const d = doc.input.document;
  // Each part's tabs, parsed once however many slots they hold, written back after.
  const parsed = new Map<string, Record<string, unknown>>();
  for (const ref of wanted) {
    const part = parts.find((p) => p.app === ref.from.app && p.id === ref.from.id);
    const tab = part?.tabs.find((t) => t.id === ref.from.tabId);
    if (!part || !tab) continue;
    const drawn = deps.drawPicture
      ? await deps.drawPicture(doc.input, ref.picture!, upgradeTab)
      : null;
    if (!drawn) {
      ctx.report.picturesMissing.push({ document: d.id, ...ref.picture! });
      continue;
    }
    const owner = mediaOwnerOf(part.ownerId, siteOf(part.app));
    const sha = createHash('sha256').update(drawn.png).digest('hex');
    // The same picture twice for one owner is one image (the media service keeps one per owner and bytes).
    let imageId = pictureIds.get(`${owner}|${sha}`);
    if (!imageId) {
      imageId = uuidFromSeed(
        `picture:${d.id}:${ref.from.app}:${ref.from.tabId}:${ref.from.elementId}`,
      );
      pictureIds.set(`${owner}|${sha}`, imageId);
      const file = `r2/pictures/${imageId}.png`;
      const version = JSON.stringify(sha);
      if (ctx.ledger.version('r2', 'objects', imageId) !== version) {
        mkdirSync(join(ctx.bundleDir, 'r2', 'pictures'), { recursive: true });
        writeFileSync(join(ctx.bundleDir, file), drawn.png);
        deps.r2.push({
          key: imageId,
          contentType: 'image/png',
          byteSize: drawn.png.length,
          sha256: sha,
          file,
          version,
        } satisfies R2Entry);
      }
      ctx.sql.media.row({
        table: 'images',
        key: imageId,
        columns: [
          'id',
          'owner',
          'app',
          'content_type',
          'byte_size',
          'width',
          'height',
          'sha256',
          'original_name',
          'created_at',
        ],
        values: [
          imageId,
          owner,
          siteOf(part.app),
          'image/png',
          drawn.png.length,
          drawn.width,
          drawn.height,
          sha,
          `${tab.name}.png`,
          d.savedAt,
        ],
        conflict: ['id'],
        version: sha,
      });
      ctx.report.add('pictures');
    }
    const key = `${part.app}|${part.id}|${tab.id}`;
    let body = parsed.get(key);
    if (!body) {
      body = JSON.parse(tab.data) as Record<string, unknown>;
      parsed.set(key, body);
    }
    const el = (
      Array.isArray(body.elements) ? (body.elements as Record<string, unknown>[]) : []
    ).find((e) => e.id === ref.from.elementId);
    if (el) el.imageId = imageId;
    if (!part.imageOwners.some((o) => o.imageId === imageId))
      part.imageOwners.push({ imageId, owner });
  }
  for (const [key, body] of parsed) {
    const [app, id, tabId] = key.split('|');
    const tab = parts.find((p) => p.app === app && p.id === id)?.tabs.find((t) => t.id === tabId);
    if (tab) tab.data = JSON.stringify(body);
  }
}
