import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MEDIA_REFS_SYNC_MAX } from '@liveworkspace/media';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { sqliteD1, testCopyPlan, type SqliteD1 } from '../test-sqlite-d1';
import {
  IMAGE_GRANTS_MAX,
  IMAGE_ID_MAX,
  copiedGrantsStatement,
  copiedImageGrants,
  planServesImage,
  recordImageGrant,
} from './image-grants';
import { forgetImageRefs } from './image-refs';
import { exportPlanCopy } from './plan-copy';
import { importProjectFile } from './project-file';

// Copying a plan keeps every picture (docs/specs/026-plan/item-types.md "Image fields", Copies; Work Item 215): the
// copy carries the source's grant for each picture its cards hold, serves them, and reports them in use under its
// own id, so neither plan dropping a picture lets the media sweep take the other's. The service is a recording fake
// behind `fetch`.

const SOURCE = 'source';
const COPY = 'copy';
const MEDIA_URL = 'https://media.test/api/media';

let synced: { documents: { document: string; images: string[] }[] }[];

beforeEach(() => {
  synced = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith('/app/refs')) {
        synced.push(JSON.parse(init?.body as string) as (typeof synced)[number]);
        return Response.json({ ok: true });
      }
      return Response.json({ error: 'not_found' }, { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const pic = (id: string) => ({ id, name: `${id}.png`, size: 100, type: 'image/png' });

// The last set the service heard for `plan`, or null when it never heard of it.
const lastSet = (plan: string): string[] | null => {
  for (let i = synced.length - 1; i >= 0; i--) {
    const doc = synced[i]!.documents.find((d) => d.document === plan);
    if (doc) return doc.images;
  }
  return null;
};

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
  const grant = (plan: string, id: string) => recordImageGrant(nodeItemSql(db.sql), plan, id, 1);
  const grants = (plan: string) =>
    (
      db.sql
        .prepare('SELECT image_id FROM card_image_grants WHERE plan_id = ? ORDER BY image_id')
        .all(plan) as { image_id: string }[]
    ).map((r) => r.image_id);
  const serves = (plan: string, id: string) => planServesImage(nodeItemSql(db.sql), plan, id);
  const copy = () => testCopyPlan(db.env, SOURCE, COPY, 'new-owner', 'Copy');
  return { ...db, card, edit, grant, grants, serves, copy };
}

// A source plan with one card of each kind of picture, every one uploaded for it, and an id pasted in from elsewhere.
function seeded() {
  const w = world();
  for (const id of ['single', 'g1', 'g2', 'att']) w.grant(SOURCE, id);
  w.card(SOURCE, 'a', { title: 'Design', cover: 'single', designs: ['g1', 'g2', 'pasted'] });
  w.card(SOURCE, 'b', { title: 'Shots', attachments: [pic('att')] });
  return w;
}

describe('a copied plan keeps its pictures', () => {
  it('carries the grant for each picture its cards hold, and serves them', async () => {
    const w = seeded();
    // A grant whose picture no card holds any more stays behind.
    w.grant(SOURCE, 'dropped');
    await w.copy();
    expect(w.grants(COPY)).toEqual(['att', 'g1', 'g2', 'single']);
    for (const id of ['single', 'g1', 'g2', 'att']) expect(w.serves(COPY, id)).toBe(true);
    // Never wider than the source: an id the source could not serve serves nothing in the copy either.
    expect(w.serves(SOURCE, 'pasted')).toBe(false);
    expect(w.serves(COPY, 'pasted')).toBe(false);
    expect(w.serves(COPY, 'dropped')).toBe(false);
  });

  it('reports them in use under its own id, once', async () => {
    const w = seeded();
    await w.copy();
    await w.flush();
    expect(lastSet(COPY)).toEqual(['att', 'g1', 'g2', 'single']);
    expect(synced.filter((s) => s.documents.some((d) => d.document === COPY))).toHaveLength(1);
  });

  it('keeps them when the original drops them, and the original keeps them when the copy does', async () => {
    const w = seeded();
    await w.copy();
    await w.flush();
    // The original drops its pictures: its own set empties, the copy's reference still holds every one.
    w.edit(SOURCE, 'a', { title: 'Design' });
    w.edit(SOURCE, 'b', { title: 'Shots' });
    await w.flush();
    expect(lastSet(SOURCE)).toEqual([]);
    expect(lastSet(COPY)).toEqual(['att', 'g1', 'g2', 'single']);
    expect(w.serves(COPY, 'single')).toBe(true);
    // The copy drops one: only the copy's reference moves.
    w.edit(SOURCE, 'a', { title: 'Design', cover: 'single' });
    await w.flush();
    w.edit(COPY, 'a', { title: 'Design', designs: ['g1', 'g2'] });
    await w.flush();
    expect(lastSet(COPY)).toEqual(['att', 'g1', 'g2']);
    expect(lastSet(SOURCE)).toEqual(['single']);
  });

  it('releases only its own references when the copy is purged', async () => {
    const w = seeded();
    await w.copy();
    await w.flush();
    const sent = w.sql.prepare('SELECT images FROM media_refs WHERE plan_id = ?').get(COPY) as {
      images: string;
    };
    await forgetImageRefs(w.env, COPY, sent.images);
    expect(synced.at(-1)).toEqual({ documents: [{ document: COPY, images: [] }] });
    expect(lastSet(SOURCE)).toEqual(['att', 'g1', 'g2', 'single']);
  });

  it('takes only the grants of the cards a tab-scoped copy carries', async () => {
    const w = seeded();
    expect(await copiedImageGrants(w.env, SOURCE, ['b'])).toEqual(['att']);
    expect(await copiedImageGrants(w.env, SOURCE, [])).toEqual([]);
    expect(await copiedImageGrants(w.env, SOURCE, null)).toEqual(['att', 'g1', 'g2', 'single']);
  });

  it('carries no grants from a plan that holds none', async () => {
    const w = world();
    w.card(SOURCE, 'a', { attachments: [pic('att')], cover: 'single' });
    const copy = await exportPlanCopy(w.env, SOURCE, null, null);
    expect(copy?.imageGrants).toBeUndefined();
  });

  it('brings no grants in from a Drive file, whatever it names', async () => {
    const w = seeded();
    const copy = (await exportPlanCopy(w.env, SOURCE, null, null))!;
    expect(copy.imageGrants).toEqual(['att', 'g1', 'g2', 'single']);
    await importProjectFile(w.env, 'from-file', { copy, name: 'From a file', ownerId: 'o' });
    expect(w.grants('from-file')).toEqual([]);
    expect(w.serves('from-file', 'single')).toBe(false);
  });
});

describe('copiedGrantsStatement', () => {
  it('writes nothing with no ids', () => {
    const { env } = world();
    expect(copiedGrantsStatement(env, COPY, undefined, 1)).toBeNull();
    expect(copiedGrantsStatement(env, COPY, ['', 'x'.repeat(IMAGE_ID_MAX + 1)], 1)).toBeNull();
  });

  it('drops ids past the longest, dedupes, caps at IMAGE_GRANTS_MAX and never overwrites a grant', async () => {
    const w = world();
    w.grant(COPY, 'held');
    const ids = ['held', 'held', 'x'.repeat(IMAGE_ID_MAX + 1)];
    for (let i = 0; i < IMAGE_GRANTS_MAX + 10; i++) ids.push(`p${i}`);
    await copiedGrantsStatement(w.env, COPY, ids, 99)!.run();
    expect(w.grants(COPY)).toHaveLength(IMAGE_GRANTS_MAX);
    const held = w.sql
      .prepare('SELECT created_at FROM card_image_grants WHERE plan_id = ? AND image_id = ?')
      .get(COPY, 'held') as { created_at: number };
    expect(held.created_at).toBe(1);
  });
});

describe('a copy of a plan of many pictures', () => {
  it('writes its grants in one statement, reports once, and stays within budget', async () => {
    const w = world();
    const total = MEDIA_REFS_SYNC_MAX;
    // 50 cards, each with a single picture, a Several Images list of 4 and 5 attachments: 500 pictures.
    for (let c = 0; c < total / 10; c++) {
      const own = (k: number) => `c${c}-${k}`;
      for (let k = 0; k < 10; k++) w.grant(SOURCE, own(k));
      w.card(SOURCE, `card${c}`, {
        cover: own(0),
        designs: [own(1), own(2), own(3), own(4)],
        attachments: [5, 6, 7, 8, 9].map((k) => pic(own(k))),
      });
    }
    const prepare = vi.spyOn(w.env.PLAN_DB, 'prepare');
    const cost = await cpuMsOfAsync(() => w.copy());
    const grantWrites = prepare.mock.calls.filter(([q]) =>
      String(q).includes('INSERT INTO card_image_grants'),
    );
    expect(grantWrites).toHaveLength(1);
    expect(w.grants(COPY)).toHaveLength(total);
    await w.flush();
    expect(lastSet(COPY)).toHaveLength(total);
    expect(synced.filter((s) => s.documents.some((d) => d.document === COPY))).toHaveLength(1);
    expect(cost).toBeLessThan(cpuBudgetMs(150));
  });
});
