import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MEDIA_REFS_PER_DOCUMENT_MAX as MEDIA_REFS_PER_PROJECT_MAX } from '@liveworkspace/media';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { PlanEnv } from '../types';
import {
  ImportClaimRefused,
  UNCONFIRMED_REFS,
  attachedImageIds,
  claimImportedImages,
  copiedPlacedImages,
} from './copy-image-claims';
import { recordImageGrant } from './image-grants';
import { pushImageRefs } from './image-refs';
import { IMAGE_RELEASE_GRACE_MS, releaseDueImages } from './image-release';
import { drainOutbox } from './plan-outbox';
import { exportProjectFile, importProjectFile, readProjectFile } from './project-file';
import { MEDIA_URL, stubMediaRefs, type FakeMediaRefs } from './test-media-refs';

// A plan made from a plan file vouches for itself (docs/specs/026-plan/items.md "A plan file vouches for itself";
// liveworkspace/docs/specs/006-media/media.md "Unconfirmed references"; Work Tracker 1254): it can name another
// plan's pictures with no source to note them, so the import sends them as its own unconfirmed references before it
// lands. The media service is the fake in test-media-refs.ts, which answers a release as the real one does.

const ORIGINAL = 'original';
const IMPORTED = 'imported';

let media: FakeMediaRefs;

beforeEach(() => {
  media = stubMediaRefs();
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const pic = (id: string) => ({ id, name: `${id}.png`, size: 100, type: 'image/png' });
const row = (fields: unknown) => ({
  fields: typeof fields === 'string' ? fields : JSON.stringify(fields),
});

function world() {
  const db: SqliteD1 = sqliteD1({ MEDIA_KEY: 'k', MEDIA_URL });
  db.sql
    .prepare("INSERT INTO plan (id, saved_at, created_at, name) VALUES (?, 1, 1, 'Roadmap')")
    .run(ORIGINAL);
  let key = 0;
  const card = (plan: string, id: string, fields: Record<string, unknown>) => {
    key += 1;
    db.sql
      .prepare(
        `INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, 'task', ?, 'a', ?, 1, 1, 1, '{}', '{}')`,
      )
      .run(plan, id, key, JSON.stringify(fields));
  };
  const edit = (plan: string, id: string, fields: Record<string, unknown>) =>
    db.sql
      .prepare('UPDATE items SET fields = ? WHERE plan_id = ? AND id = ?')
      .run(JSON.stringify(fields), plan, id);
  const held = (plan: string) =>
    (db.sql.prepare('SELECT COUNT(*) AS n FROM items WHERE plan_id = ?').get(plan) as { n: number })
      .n;
  const mediaRefs = (plan: string) =>
    (
      db.sql.prepare('SELECT images FROM media_refs WHERE plan_id = ?').get(plan) as
        { images: string } | undefined
    )?.images ?? null;
  // The original's file, read and imported as both doors do (routes/project-file-route.ts, routes/internal-file.ts).
  const importFile = async (env: PlanEnv = db.env) => {
    const file = await exportProjectFile(db.env, ORIGINAL, null);
    if (file.status !== 'ok') throw new Error(file.status);
    const read = readProjectFile(String(file.body));
    if (!read.ok) throw new Error(read.failure);
    await importProjectFile(env, IMPORTED, { ...read.content, name: 'Copy', ownerId: 'user_ada' });
  };
  const drain = (plan: string) => drainOutbox(db.env, plan, null);
  return { ...db, card, edit, held, mediaRefs, importFile, drain };
}

// An original holding two pictures, one on each card, both uploaded for it, and its report landed.
async function seeded() {
  const w = world();
  w.card(ORIGINAL, 'a', { title: 'Design', attachments: [pic('kept')] });
  w.card(ORIGINAL, 'b', { title: 'Shots', attachments: [pic('shared')] });
  await w.drain(ORIGINAL);
  expect(media.refs.get(ORIGINAL)).toEqual(new Set(['kept', 'shared']));
  return w;
}

describe('an imported plan whose own report keeps failing', () => {
  it('keeps a picture its original plan releases', async () => {
    const w = await seeded();
    await w.importFile();
    // Its word reached the service before its content landed, and its first report is owed.
    expect(media.syncs.at(-1)).toEqual({
      documents: [],
      pending: [{ document: IMPORTED, images: ['kept', 'shared'] }],
    });
    expect(w.mediaRefs(IMPORTED)).toBe(UNCONFIRMED_REFS);
    // Its own report fails, and keeps failing past the grace.
    media.refusing.add(IMPORTED);
    await w.drain(IMPORTED);
    expect(media.refs.has(IMPORTED)).toBe(false);
    // The original drops the picture and asks for it to go once the grace is over: the service keeps it.
    const start = Date.now();
    w.edit(ORIGINAL, 'b', { title: 'Shots' });
    await w.drain(ORIGINAL);
    expect(media.refs.get(ORIGINAL)).toEqual(new Set(['kept']));
    const run = await releaseDueImages(w.env, ORIGINAL, start + IMAGE_RELEASE_GRACE_MS * 4);
    expect(run).toMatchObject({ released: 0, kept: 1 });
    expect(media.deleted).toEqual([]);
    // Its own report lands at last and still holds it: confirmed, so its own word is dropped.
    media.refusing.clear();
    expect(await pushImageRefs(w.env, IMPORTED)).toBe(true);
    expect(media.refs.get(IMPORTED)).toEqual(new Set(['kept', 'shared']));
    expect(media.pending.has(IMPORTED)).toBe(false);
  });

  it('lets the picture go once the imported plan itself reports it gone', async () => {
    const w = await seeded();
    await w.importFile();
    w.edit(ORIGINAL, 'b', { title: 'Shots' });
    await w.drain(ORIGINAL);
    w.edit(IMPORTED, 'b', { title: 'Shots' });
    await w.drain(IMPORTED);
    await releaseDueImages(w.env, ORIGINAL, Date.now() + IMAGE_RELEASE_GRACE_MS * 2);
    expect(media.deleted).toEqual(['shared']);
  });
});

describe('the import’s claim', () => {
  it('lands nothing when the service refuses it, so the import is tried again', async () => {
    const w = await seeded();
    media.refusePending = true;
    await expect(w.importFile()).rejects.toBeInstanceOf(ImportClaimRefused);
    expect(w.held(IMPORTED)).toBe(0);
    expect(w.mediaRefs(IMPORTED)).toBeNull();
    // Tried again once the service is back, it lands.
    media.refusePending = false;
    await w.importFile();
    expect(w.held(IMPORTED)).toBe(2);
    expect(media.pending.get(IMPORTED)).toEqual(new Set(['kept', 'shared']));
  });

  it('sends nothing for a file holding no picture, or without the service', async () => {
    const w = world();
    w.card(ORIGINAL, 'a', { title: 'Plain' });
    await w.importFile();
    expect(media.syncs).toEqual([]);
    expect(w.held(IMPORTED)).toBe(1);
    const bare = { ...w.env, MEDIA_KEY: undefined } as unknown as PlanEnv;
    expect(await claimImportedImages(bare, IMPORTED, [row({ attachments: [pic('p')] })])).toBe(
      false,
    );
    expect(media.syncs).toEqual([]);
  });

  it('names what the imported plan’s own report sends, and caps it at what one plan’s carries', async () => {
    const w = await seeded();
    // An Image field value the original holds a grant for is not the import's: a file brings no grants.
    recordImageGrant(nodeItemSql(w.sql), ORIGINAL, 'granted', 1);
    w.card(ORIGINAL, 'c', { title: 'Photo', photo: 'granted' });
    expect(await copiedPlacedImages(w.env, ORIGINAL, null)).toContain('granted');
    await w.importFile();
    expect(await copiedPlacedImages(w.env, IMPORTED, null)).toEqual(
      media.syncs.at(-1)!.pending![0]!.images,
    );
    const many = Array.from({ length: MEDIA_REFS_PER_PROJECT_MAX + 5 }, (_, i) => pic(`p${i}`));
    expect(await claimImportedImages(w.env, 'big', [row({ attachments: many })])).toBe(true);
    expect(media.syncs.at(-1)!.pending![0]!.images).toHaveLength(MEDIA_REFS_PER_PROJECT_MAX);
  });
});

describe('attachedImageIds', () => {
  it('reads each Attachments entry’s text id, sorted and once, as the plan’s report reads them', () => {
    expect(
      attachedImageIds([
        row({ attachments: [pic('b'), pic('a'), { id: 7 }, null, 'x'] }),
        row({ attachments: [pic('a')] }),
        // An object of entries counts its values, as SQLite's json_each walks them.
        row({ attachments: { one: pic('c') } }),
        row({ attachments: 'none' }),
        row({ attachments: null }),
        row('{"attachments": not json'),
        row({ title: 'no attachments' }),
        { fields: 3 },
        {},
      ]),
    ).toEqual(['a', 'b', 'c']);
  });

  it('reads a full plan’s cards within budget', () => {
    const items = Array.from({ length: 5_000 }, (_, i) =>
      row({ title: `Card ${i}`, attachments: [pic(`p${i % 400}`), pic(`q${i % 300}`)] }),
    );
    let ids: string[] = [];
    const ms = cpuMsOf(() => {
      ids = attachedImageIds(items);
    });
    expect(ids).toHaveLength(700);
    expect(ms).toBeLessThan(cpuBudgetMs(200));
  });
});
