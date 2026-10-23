import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { Tab } from '@livedesign/design';
import { sqliteD1, testCopyDesign, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from '../routes/test-route-context';
import { handleDesigns } from '../routes/designs';
import { handleDesignSubresources } from '../routes/design-subresource-routes';
import { deleteTabRow, seedTabs, swapTabData, upsertTab } from './tabs';
import { tabStatsOfData } from './tab-stats';

// Every writer of `tabs.data` keeps `image_refs` in step with the body
// (docs/specs/009-elements/images.md, "Reference index"), in the design's own SQLite. A writer that
// forgets is how a placed image reads as unplaced to the media service's sweep, so each path is proven
// here against a real SQLite with the design's schema. A purged design's storage goes whole (its Durable
// Object's deleteAll), and the service hears it places nothing (media.test.ts).

const T0 = 1_700_000_000_000;

function liveDoc(sql: DatabaseSync, id: string, ownerId = 'owner') {
  sql
    .prepare(
      'INSERT INTO test_designs (id, owner_id, name, saved_at, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(id, ownerId, id, T0, T0);
}

const image = (id: string, imageId: string | null) => ({
  id,
  type: 'image',
  x: 0,
  y: 0,
  width: 100,
  height: 60,
  imageId,
});

const tabWith = (id: string, ...imageIds: (string | null)[]): Tab =>
  ({ id, name: id, elements: imageIds.map((iid, i) => image(`el-${i}`, iid)) }) as unknown as Tab;

function refs(sql: DatabaseSync, tabId: string): string[] {
  return sql
    .prepare('SELECT image_id FROM image_refs WHERE tab_id = ? ORDER BY image_id')
    .all(tabId)
    .map((r) => r.image_id as string);
}

function allRefs(sql: DatabaseSync): string[] {
  return sql
    .prepare('SELECT tab_id, image_id FROM image_refs ORDER BY tab_id, image_id')
    .all()
    .map((r) => `${r.tab_id as string}:${r.image_id as string}`);
}

function withDesign(ownerId = 'owner', id = 'A'): SqliteD1 {
  const db = sqliteD1();
  liveDoc(db.sql, id, ownerId);
  return db;
}

describe('upsertTab (autosave, realtime flush, comment and action routes)', () => {
  it('indexes the gallery images a tab places', async () => {
    const db = withDesign();
    await upsertTab(db.env, 'A', tabWith('t1', 'img-1', 'img-2', null), 0);
    expect(refs(db.sql, 't1')).toEqual(['img-1', 'img-2']);
  });

  it('replaces the set on the next save', async () => {
    const db = withDesign();
    await upsertTab(db.env, 'A', tabWith('t1', 'img-1', 'img-2'), 0);
    await upsertTab(db.env, 'A', tabWith('t1', 'img-2', 'img-3'), 0);
    expect(refs(db.sql, 't1')).toEqual(['img-2', 'img-3']);
  });

  it('drops every reference when the last image goes', async () => {
    const db = withDesign();
    await upsertTab(db.env, 'A', tabWith('t1', 'img-1'), 0);
    await upsertTab(db.env, 'A', tabWith('t1'), 0);
    expect(refs(db.sql, 't1')).toEqual([]);
  });

  it('never indexes a data URI', async () => {
    const db = withDesign();
    await upsertTab(db.env, 'A', tabWith('t1', 'data:image/png;base64,AAAA', 'img-1'), 0);
    expect(refs(db.sql, 't1')).toEqual(['img-1']);
  });

  it("leaves other tabs' references alone", async () => {
    const db = withDesign();
    await upsertTab(db.env, 'A', tabWith('t1', 'img-1'), 0);
    await upsertTab(db.env, 'A', tabWith('t2', 'img-1'), 1);
    await upsertTab(db.env, 'A', tabWith('t2'), 1);
    expect(allRefs(db.sql)).toEqual(['t1:img-1']);
  });
});

describe('seedTabs (create, JSON import, Offline Mode sync)', () => {
  it('indexes every seeded tab', async () => {
    const db = withDesign();
    await seedTabs(db.env, 'A', [tabWith('t1', 'img-1'), tabWith('t2', 'img-2', 'img-1')]);
    expect(allRefs(db.sql)).toEqual(['t1:img-1', 't2:img-1', 't2:img-2']);
  });

  it('replaces on a retried create', async () => {
    const db = withDesign();
    await seedTabs(db.env, 'A', [tabWith('t1', 'img-1')]);
    await seedTabs(db.env, 'A', [tabWith('t1', 'img-2')]);
    expect(refs(db.sql, 't1')).toEqual(['img-2']);
  });
});

describe('a copy (Copy to my files)', () => {
  it("indexes the copy's tabs from the copied bodies", async () => {
    const db = withDesign();
    await upsertTab(db.env, 'A', tabWith('t1', 'img-1'), 0);
    await upsertTab(db.env, 'A', tabWith('t2', 'img-2'), 1);
    const copy = await testCopyDesign(db.env, 'A', 'B', 'visitor', 'Copy of A');
    const copied = copy!.tabs.map((t) => t.id);
    expect(copied).toHaveLength(2);
    expect(copied.flatMap((id) => refs(db.sql, id)).sort()).toEqual(['img-1', 'img-2']);
  });

  it('indexes a copied tab even when the source was never indexed', async () => {
    const db = withDesign();
    await upsertTab(db.env, 'A', tabWith('t1', 'img-1'), 0);
    db.sql.exec('DELETE FROM image_refs');
    const copy = await testCopyDesign(db.env, 'A', 'B', 'visitor', 'Copy of A');
    expect(refs(db.sql, copy!.tabs[0]!.id)).toEqual(['img-1']);
  });
});

describe('swapTabData (participant writes)', () => {
  const body = (...imageIds: string[]) =>
    JSON.stringify({ elements: imageIds.map((iid, i) => image(`el-${i}`, iid)) });

  it('adds the new body references on a won swap', async () => {
    const db = withDesign();
    await upsertTab(db.env, 'A', tabWith('t1', 'img-1'), 0);
    const stored = db.sql.prepare('SELECT data FROM tabs WHERE id = ?').get('t1')!.data as string;
    expect(
      await swapTabData(
        db.env,
        'A',
        't1',
        stored,
        body('img-1', 'img-2'),
        tabStatsOfData(body('img-1', 'img-2')).stats,
      ),
    ).toBe(true);
    expect(refs(db.sql, 't1')).toEqual(['img-1', 'img-2']);
  });

  it('never deletes a reference, even on a lost swap', async () => {
    const db = withDesign();
    await upsertTab(db.env, 'A', tabWith('t1', 'img-1'), 0);
    expect(
      await swapTabData(db.env, 'A', 't1', 'stale', body(), tabStatsOfData(body()).stats),
    ).toBe(false);
    expect(refs(db.sql, 't1')).toEqual(['img-1']);
  });
});

describe('deleteTabRow', () => {
  it("prunes a dropped tab's references", async () => {
    const db = withDesign();
    await upsertTab(db.env, 'A', tabWith('t1', 'img-1'), 0);
    await deleteTabRow(db.env, 'A', 't1');
    expect(allRefs(db.sql)).toEqual([]);
  });
});

describe('routes that write tabs', () => {
  it('POST /api/designs with seeded tabs indexes them (import, Offline Mode sync)', async () => {
    const db = sqliteD1();
    const res = await handleDesigns(
      makeTestRouteContext('POST', '/api/designs', {
        env: db.env,
        owner: 'owner',
        body: { id: 'A', name: 'A', tabs: [tabWith('t1', 'img-1')] },
      }),
    );
    expect(res?.status).toBe(201);
    expect(refs(db.sql, 't1')).toEqual(['img-1']);
  });

  it('PUT /api/designs/:id/tabs/:tabId indexes the saved tab (autosave)', async () => {
    const db = withDesign();
    const res = await handleDesignSubresources(
      makeTestRouteContext('PUT', '/api/designs/A/tabs/t1', {
        env: db.env,
        owner: 'owner',
        body: { ...tabWith('t1', 'img-1'), orderIndex: 0 },
      }),
    );
    expect(res?.status).toBe(200);
    expect(refs(db.sql, 't1')).toEqual(['img-1']);
  });
});
