import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MEDIA_REFS_PER_DOCUMENT_MAX, MEDIA_REFS_SYNC_MAX } from '@liveworkspace/media';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { PlanEnv } from '../types';
import {
  UNCONFIRMED_REFS,
  copiedPlacedImages,
  noteCopyClaim,
  pushCopyClaims,
  unsentCopyClaims,
} from './copy-image-claims';
import { recordImageGrant } from './image-grants';
import { forgetImageRefs, pushImageRefs } from './image-refs';
import { IMAGE_RELEASE_GRACE_MS, planStillHolds, releaseDueImages } from './image-release';
import { exportPlanCopy, importPlanCopy } from './plan-copy';
import { drainOutbox } from './plan-outbox';

// A copy's pictures are vouched for by the plan it was copied from (docs/specs/026-plan/items.md "Images in use", "A
// copy is vouched for by its source"; liveworkspace/docs/specs/006-media/media.md "Unconfirmed references"; Work
// Tracker 1190). The media service is a fake behind `fetch` that keeps references, confirmed and unconfirmed, and
// answers a release as the real one does, so a picture it "deletes" is one the real service would have deleted.

const SOURCE = 'source';
const COPY = 'copy';
const MEDIA_URL = 'https://media.test/api/media';

type Entry = { document: string; images: string[] };
let refs: Map<string, Set<string>>;
let pending: Map<string, Set<string>>;
let deleted: string[];
// Documents whose own report the fake refuses, as a copy whose report keeps failing.
let refusing: Set<string>;
// Refuse every sync that vouches for a copy.
let refusePending: boolean;
let syncs: { documents: Entry[]; pending?: Entry[] }[];

const named = (id: string, within: Map<string, Set<string>>) =>
  [...within.values()].some((set) => set.has(id));

beforeEach(() => {
  refs = new Map();
  pending = new Map();
  deleted = [];
  refusing = new Set();
  refusePending = false;
  syncs = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(String(url));
      if (u.pathname.endsWith('/app/refs')) {
        const body = JSON.parse(init?.body as string) as { documents: Entry[]; pending?: Entry[] };
        if (body.documents.some((d) => refusing.has(d.document)))
          return Response.json({ error: 'down' }, { status: 503 });
        if (refusePending && body.pending?.length)
          return Response.json({ error: 'down' }, { status: 503 });
        syncs.push(body);
        for (const p of body.pending ?? [])
          if (!refs.get(p.document)?.size)
            pending.set(p.document, new Set([...(pending.get(p.document) ?? []), ...p.images]));
        for (const d of body.documents) {
          refs.set(d.document, new Set(d.images));
          pending.delete(d.document);
        }
        return Response.json({ ok: true });
      }
      if (u.pathname.endsWith('/release')) {
        const id = decodeURIComponent(u.pathname.split('/').at(-2)!);
        if (named(id, refs)) return Response.json({ released: false, reason: 'referenced' });
        if (named(id, pending)) return Response.json({ released: false, reason: 'unconfirmed' });
        deleted.push(id);
        return Response.json({ released: true });
      }
      return Response.json({ error: 'not_found' }, { status: 404 });
    }),
  );
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const pic = (id: string) => ({ id, name: `${id}.png`, size: 100, type: 'image/png' });

function world() {
  const db: SqliteD1 = sqliteD1({ MEDIA_KEY: 'k', MEDIA_URL });
  db.sql.prepare('INSERT INTO plan (id, saved_at, created_at) VALUES (?, 1, 1)').run(SOURCE);
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
  const claims = () =>
    db.sql
      .prepare('SELECT copy_id, images FROM copy_image_claims WHERE plan_id = ? ORDER BY copy_id')
      .all(SOURCE)
      .map((r) => ({ copy: r.copy_id as string, images: JSON.parse(r.images as string) }));
  const mediaRefs = (plan: string) =>
    (
      db.sql.prepare('SELECT images FROM media_refs WHERE plan_id = ?').get(plan) as
        { images: string } | undefined
    )?.images ?? null;
  // The copy as the index makes one (routes/internal-items.ts `copy`): the source's door notes what it holds
  // (plan-room-doors.ts exportCopy), then the copy lands.
  const copy = async (onlyTabId: string | null = null) => {
    const made = (await exportPlanCopy(db.env, SOURCE, onlyTabId, null))!;
    const ids = onlyTabId === null ? null : made.items.map((row) => String(row.id));
    await noteCopyClaim(
      db.env,
      SOURCE,
      COPY,
      await copiedPlacedImages(db.env, SOURCE, ids),
      Date.now(),
    );
    await importPlanCopy(db.env, COPY, made);
    return made;
  };
  const drain = (plan: string) => drainOutbox(db.env, plan, null);
  return { ...db, card, edit, claims, mediaRefs, copy, drain };
}

// A source holding two pictures, one on each card, both uploaded for it, and its report landed.
async function seeded() {
  const w = world();
  w.card(SOURCE, 'a', { title: 'Design', attachments: [pic('kept')] });
  w.card(SOURCE, 'b', { title: 'Shots', attachments: [pic('shared')] });
  await w.drain(SOURCE);
  expect(refs.get(SOURCE)).toEqual(new Set(['kept', 'shared']));
  return w;
}

describe('a copy whose own report keeps failing', () => {
  it('keeps the picture its source drops and releases after the grace', async () => {
    const w = await seeded();
    await w.copy();
    refusing.add(COPY);
    // The copy's report fails, and keeps failing past the grace.
    await w.drain(COPY);
    expect(refs.has(COPY)).toBe(false);
    // The source drops the picture; its report sends the copy's note first, then its own set.
    const start = Date.now();
    w.edit(SOURCE, 'b', { title: 'Shots' });
    await w.drain(SOURCE);
    expect(syncs.at(-2)).toEqual({
      documents: [],
      pending: [{ document: COPY, images: ['kept', 'shared'] }],
    });
    expect(refs.get(SOURCE)).toEqual(new Set(['kept']));
    expect(w.claims()).toEqual([]);
    const run = await releaseDueImages(w.env, SOURCE, start + IMAGE_RELEASE_GRACE_MS * 4);
    expect(run).toEqual({ released: 0, kept: 1, held: 0, retried: 0 });
    expect(deleted).toEqual([]);
    // The copy's report lands at last and still holds it: confirmed, so the source's word is dropped.
    refusing.clear();
    expect(await pushImageRefs(w.env, COPY)).toBe(true);
    expect(refs.get(COPY)).toEqual(new Set(['kept', 'shared']));
    expect(pending.has(COPY)).toBe(false);
  });

  it('lets the picture go once the copy itself reports it gone', async () => {
    const w = await seeded();
    await w.copy();
    w.edit(SOURCE, 'b', { title: 'Shots' });
    await w.drain(SOURCE);
    w.edit(COPY, 'b', { title: 'Shots' });
    await w.drain(COPY);
    expect(pending.has(COPY)).toBe(false);
    await releaseDueImages(w.env, SOURCE, Date.now() + IMAGE_RELEASE_GRACE_MS * 2);
    expect(deleted).toEqual(['shared']);
  });

  it('holds the picture while the note itself is not taken, retrying with the report', async () => {
    const w = await seeded();
    await w.copy();
    refusePending = true;
    w.edit(SOURCE, 'b', { title: 'Shots' });
    await w.drain(SOURCE);
    // The note is still here, and the source's own report waits behind it, so no grace started.
    expect(w.claims()).toEqual([{ copy: COPY, images: ['kept', 'shared'] }]);
    expect(refs.get(SOURCE)).toEqual(new Set(['kept', 'shared']));
    const outbox = w.sql
      .prepare("SELECT COUNT(*) AS n FROM outbox WHERE plan_id = ? AND kind = 'images'")
      .get(SOURCE) as { n: number };
    expect(outbox.n).toBe(1);
    // Even a release already due never asks for a picture a note names.
    expect(await planStillHolds(w.env, SOURCE, 'shared')).toBe(true);
    w.sql
      .prepare("UPDATE image_releases SET due_at = 1 WHERE plan_id = ? AND image_id = 'shared'")
      .run(SOURCE);
    expect(await releaseDueImages(w.env, SOURCE, Date.now())).toMatchObject({ held: 1 });
    expect(deleted).toEqual([]);
  });

  it('sends a note noted again meanwhile once more, and drops only what was sent', async () => {
    const w = await seeded();
    await w.copy();
    const media = vi.mocked(fetch);
    const real = media.getMockImplementation()!;
    // The copy is noted again while the first note's sync is in flight.
    media.mockImplementationOnce(async (url, init) => {
      await noteCopyClaim(w.env, SOURCE, COPY, ['kept'], Date.now() + 1);
      return real(url, init);
    });
    expect(await pushCopyClaims(w.env, SOURCE)).toBe(1);
    expect(w.claims()).toEqual([{ copy: COPY, images: ['kept'] }]);
    expect(await pushCopyClaims(w.env, SOURCE)).toBe(1);
    expect(w.claims()).toEqual([]);
  });
});

describe('what a copy is noted for', () => {
  it('notes the pictures a tab copy’s cards hold, and only those', async () => {
    const w = world();
    recordImageGrant(nodeItemSql(w.sql), SOURCE, 'photo', 1);
    w.card(SOURCE, 'a', { title: 'Design', photo: 'photo', attachments: [pic('att')] });
    w.card(SOURCE, 'b', { title: 'Other', attachments: [pic('elsewhere')] });
    expect(await copiedPlacedImages(w.env, SOURCE, ['a'])).toEqual(['att', 'photo']);
    expect(await copiedPlacedImages(w.env, SOURCE, null)).toEqual(['att', 'elsewhere', 'photo']);
  });

  it('notes nothing for a copy holding no picture, nor for the plan itself', async () => {
    const w = world();
    expect(await noteCopyClaim(w.env, SOURCE, COPY, [], 1)).toBe(false);
    expect(await noteCopyClaim(w.env, SOURCE, SOURCE, ['p'], 1)).toBe(false);
    expect(w.claims()).toEqual([]);
  });

  it('caps a note at what one document carries', async () => {
    const w = world();
    const many = Array.from({ length: MEDIA_REFS_PER_DOCUMENT_MAX + 5 }, (_, i) => `p${i}`);
    expect(await noteCopyClaim(w.env, SOURCE, COPY, many, 1)).toBe(true);
    expect(w.claims()[0]!.images).toHaveLength(MEDIA_REFS_PER_DOCUMENT_MAX);
  });

  it('sends nothing, and keeps the notes, without the media service', async () => {
    const w = world();
    const env = { ...w.env, MEDIA_KEY: undefined } as unknown as PlanEnv;
    await noteCopyClaim(w.env, SOURCE, COPY, ['p'], 1);
    expect(await pushCopyClaims(env, SOURCE)).toBe(0);
    expect(w.claims()).toHaveLength(1);
  });

  it('sends many copies in syncs of what one carries', async () => {
    const w = world();
    for (let i = 0; i < MEDIA_REFS_SYNC_MAX + 3; i++)
      await noteCopyClaim(w.env, SOURCE, `copy-${i}`, ['p'], 1);
    // A row that is not a list of ids vouches for none.
    w.sql.prepare("UPDATE copy_image_claims SET images = 'nope' WHERE copy_id = 'copy-0'").run();
    w.sql.prepare("UPDATE copy_image_claims SET images = '{}' WHERE copy_id = 'copy-1'").run();
    expect(await pushCopyClaims(w.env, SOURCE)).toBe(2);
    expect(syncs.map((s) => s.pending!.length)).toEqual([MEDIA_REFS_SYNC_MAX, 3]);
    expect(syncs[0]!.pending!.slice(0, 2).map((p) => p.images)).toEqual([[], []]);
    expect(w.claims()).toEqual([]);
  });
});

describe('the copy’s side', () => {
  it('owes its first report, so it sends even an empty set, which confirms its source’s word', async () => {
    const w = await seeded();
    await w.copy();
    expect(w.mediaRefs(COPY)).toBe(UNCONFIRMED_REFS);
    await w.drain(SOURCE);
    expect(pending.get(COPY)).toEqual(new Set(['kept', 'shared']));
    // The copy drops both before its first report lands.
    w.edit(COPY, 'a', { title: 'Design' });
    w.edit(COPY, 'b', { title: 'Shots' });
    await w.drain(COPY);
    expect(refs.get(COPY)).toEqual(new Set());
    expect(pending.has(COPY)).toBe(false);
  });

  it('owes nothing when it holds no picture', async () => {
    const w = world();
    w.card(SOURCE, 'a', { title: 'Plain' });
    await w.copy();
    expect(w.mediaRefs(COPY)).toBeNull();
  });

  it('tells the service it holds none when purged before it reported', async () => {
    const w = await seeded();
    await w.copy();
    await forgetImageRefs(w.env, COPY, w.mediaRefs(COPY));
    expect(syncs.at(-1)).toEqual({ documents: [{ document: COPY, images: [] }] });
  });
});

describe('a source purged with notes unsent', () => {
  it('sends them with its own empty set', async () => {
    const w = await seeded();
    await w.copy();
    const claims = unsentCopyClaims(nodeItemSql(w.sql));
    expect(claims).toEqual([{ document: COPY, images: ['kept', 'shared'] }]);
    await forgetImageRefs(w.env, SOURCE, w.mediaRefs(SOURCE), claims);
    expect(syncs.at(-1)).toEqual({
      documents: [{ document: SOURCE, images: [] }],
      pending: [{ document: COPY, images: ['kept', 'shared'] }],
    });
    expect(pending.get(COPY)).toEqual(new Set(['kept', 'shared']));
  });

  it('sends them alone for a source that never reported, and nothing with neither', async () => {
    const w = world();
    await forgetImageRefs(w.env, SOURCE, null, [{ document: COPY, images: ['p'] }]);
    expect(syncs.at(-1)).toEqual({ documents: [], pending: [{ document: COPY, images: ['p'] }] });
    await forgetImageRefs(w.env, SOURCE, null, []);
    expect(syncs).toHaveLength(1);
  });

  it('reads none from storage without the table', () => {
    const broken = {
      exec: () => {
        throw new Error('no such table: copy_image_claims');
      },
    };
    expect(unsentCopyClaims(broken)).toEqual([]);
  });
});

describe('the cost', () => {
  it('notes a full copy in one batch, and sends it in one sync, within budget', async () => {
    const w = world();
    for (let i = 0; i < 2_000; i++)
      w.card(SOURCE, `c${i}`, { title: `Card ${i}`, attachments: [pic(`p${i % 400}`)] });
    const ms = await cpuMsOfAsync(async () => {
      const images = await copiedPlacedImages(w.env, SOURCE, null);
      expect(images).toHaveLength(400);
      await noteCopyClaim(w.env, SOURCE, COPY, images, 1);
      expect(await pushCopyClaims(w.env, SOURCE)).toBe(1);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(500));
  });
});
