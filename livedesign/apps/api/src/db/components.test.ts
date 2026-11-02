import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { MAX_COMPONENTS, type DesignComponent, type Tab } from '@livedesign/design';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { exportDesignCopy, importDesignCopy } from '../design-room/design-content';
import {
  componentInsertStatements,
  componentTabIds,
  componentUpsertLaterStatements,
  componentUsedOutside,
  putComponent,
  readComponentRow,
  readComponents,
  readComponentsById,
  swapComponent,
  touchDesignSaved,
} from './components';
import { tabStatsOfData } from './tab-stats';
import { deleteTabRow, seedTabs, swapTabData, tabWriteStatements, upsertTab } from './tabs';

// The component library's store and its reference index (docs/specs/009-elements/blueprints/components.md "Data
// and persistence"), on a real SQLite with the design's schema. Every writer of `tabs.data` keeps `component_refs`
// in step with the body, beside `image_refs`: a ref this misses is a main a tab-scoped visitor cannot draw.

const T0 = 1_700_000_000_000;

function withDesign(id = 'A'): SqliteD1 {
  const db = sqliteD1();
  db.sql
    .prepare(
      'INSERT INTO test_designs (id, owner_id, name, saved_at, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(id, 'owner', id, T0, T0);
  return db;
}

const main = (
  id: string,
  updatedAt = 10,
  over: Partial<DesignComponent> = {},
): DesignComponent => ({
  id,
  name: `Main ${id}`,
  width: 100,
  height: 40,
  elements: [{ id: 'e1', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 40 }],
  updatedAt,
  ...over,
});

const instance = (id: string, componentId: string) => ({
  id,
  type: 'shape',
  shape: 'instance',
  componentId,
  x: 0,
  y: 0,
  width: 100,
  height: 40,
});

const tabUsing = (id: string, ...componentIds: string[]): Tab =>
  ({
    id,
    name: id,
    elements: componentIds.map((c, i) => instance(`i-${i}`, c)),
  }) as unknown as Tab;

function refs(sql: DatabaseSync): string[] {
  return sql
    .prepare('SELECT tab_id, component_id FROM component_refs ORDER BY tab_id, component_id')
    .all()
    .map((r) => `${r.tab_id as string}:${r.component_id as string}`);
}

describe('the library store', () => {
  it('reads every main, or only those the given tabs use', async () => {
    const db = withDesign();
    await putComponent(db.env, main('c1'));
    await putComponent(db.env, main('c2'));
    await putComponent(db.env, main('c3'));
    await upsertTab(db.env, 'A', tabUsing('t1', 'c1'), 0);
    await upsertTab(db.env, 'A', tabUsing('t2', 'c2', 'c2'), 1);
    expect((await readComponents(db.env)).map((m) => m.id)).toEqual(['c1', 'c2', 'c3']);
    expect((await readComponents(db.env, { tabIds: ['t1'] })).map((m) => m.id)).toEqual(['c1']);
    expect((await readComponents(db.env, { tabIds: ['t1', 't2'] })).map((m) => m.id)).toEqual([
      'c1',
      'c2',
    ]);
    expect(await readComponents(db.env, { tabIds: [] })).toEqual([]);
    expect((await readComponentsById(db.env, ['c3', 'nope'])).map((m) => m.id)).toEqual(['c3']);
    expect(await readComponentsById(db.env, [])).toEqual([]);
    expect(await componentTabIds(db.env, 'c2')).toEqual(['t2']);
  });

  it('skips a row that no longer reads as a main', async () => {
    const db = withDesign();
    db.sql.exec(`INSERT INTO components (id, data, updated_at) VALUES ('x', 'not json', 1)`);
    db.sql.exec(`INSERT INTO components (id, data, updated_at) VALUES ('y', '{"id":"y"}', 1)`);
    expect(await readComponents(db.env)).toEqual([]);
    expect(await readComponentRow(db.env, 'x')).toBeNull();
    expect(await readComponentRow(db.env, 'nope')).toBeNull();
  });

  it('creates and replaces a main, refusing a new one past MAX_COMPONENTS', async () => {
    const db = withDesign();
    for (let i = 0; i < MAX_COMPONENTS; i += 1) {
      expect(await putComponent(db.env, main(`c${i}`))).toBe(true);
    }
    expect(await putComponent(db.env, main('one-more'))).toBe(false);
    expect(await putComponent(db.env, main('c0', 20, { name: 'Renamed' }))).toBe(true);
    expect((await readComponentRow(db.env, 'c0'))?.main.name).toBe('Renamed');
  });

  it('swaps a main only while it is stored as read', async () => {
    const db = withDesign();
    await putComponent(db.env, main('c1'));
    const row = (await readComponentRow(db.env, 'c1'))!;
    expect(await swapComponent(db.env, main('c1', 11, { name: 'B' }), row.data)).toBe(true);
    expect(await swapComponent(db.env, main('c1', 12, { name: 'C' }), row.data)).toBe(false);
    expect((await readComponentRow(db.env, 'c1'))?.main.name).toBe('B');
  });

  it('takes a carried main only where it is later, within the cap', async () => {
    const db = withDesign();
    await putComponent(db.env, main('c1', 10, { name: 'Mine' }));
    await db.env.DESIGN_DB.batch(
      componentUpsertLaterStatements(db.env, [
        main('c1', 5, { name: 'Older' }),
        main('c2', 5, { name: 'New' }),
      ]),
    );
    expect((await readComponentRow(db.env, 'c1'))?.main.name).toBe('Mine');
    expect((await readComponentRow(db.env, 'c2'))?.main.name).toBe('New');
    await db.env.DESIGN_DB.batch(
      componentUpsertLaterStatements(db.env, [main('c1', 11, { name: 'Later' })]),
    );
    expect((await readComponentRow(db.env, 'c1'))?.main.name).toBe('Later');
  });

  it('inserts a whole library, and nothing for none', async () => {
    const db = withDesign();
    expect(componentInsertStatements(db.env, [])).toEqual([]);
    await db.env.DESIGN_DB.batch(componentInsertStatements(db.env, [main('c1', 7), main('c2', 8)]));
    expect(await readComponents(db.env)).toEqual([main('c1', 7), main('c2', 8)]);
    expect(db.sql.prepare("SELECT updated_at FROM components WHERE id = 'c2'").get()).toEqual({
      updated_at: 8,
    });
  });

  it("moves the design's last save", async () => {
    const db = withDesign();
    await touchDesignSaved(db.env, 'A', T0 + 5);
    expect(db.sql.prepare("SELECT saved_at FROM design WHERE id = 'A'").get()).toEqual({
      saved_at: T0 + 5,
    });
  });

  it('knows whether a tab other than one uses a main', async () => {
    const db = withDesign();
    await upsertTab(db.env, 'A', tabUsing('t1', 'c1'), 0);
    expect(await componentUsedOutside(db.env, 'c1', 't1')).toBe(false);
    expect(await componentUsedOutside(db.env, 'c9', 't1')).toBe(false);
    await upsertTab(db.env, 'A', tabUsing('t2', 'c1'), 1);
    expect(await componentUsedOutside(db.env, 'c1', 't1')).toBe(true);
  });
});

describe('component_refs on every tab write', () => {
  it('upsertTab and every tabWriteStatements batch (save, changeset, shared tab in) replace the set', async () => {
    const db = withDesign();
    await upsertTab(db.env, 'A', tabUsing('t1', 'c1', 'c2'), 0);
    expect(refs(db.sql)).toEqual(['t1:c1', 't1:c2']);
    await db.env.DESIGN_DB.batch(
      tabWriteStatements(db.env, 'A', tabUsing('t1', 'c2', 'c3'), 0, { advance: true }),
    );
    expect(refs(db.sql)).toEqual(['t1:c2', 't1:c3']);
    await upsertTab(db.env, 'A', tabUsing('t1'), 0);
    expect(refs(db.sql)).toEqual([]);
  });

  it('seedTabs indexes every seeded tab', async () => {
    const db = withDesign();
    await seedTabs(db.env, 'A', [tabUsing('t1', 'c1'), tabUsing('t2', 'c2')]);
    expect(refs(db.sql)).toEqual(['t1:c1', 't2:c2']);
  });

  it('swapTabData only ever adds', async () => {
    const db = withDesign();
    await upsertTab(db.env, 'A', tabUsing('t1', 'c1'), 0);
    const stored = db.sql.prepare("SELECT data FROM tabs WHERE id = 't1'").get()!.data as string;
    const next = JSON.stringify({ elements: [instance('i-9', 'c2')] });
    await swapTabData(db.env, 'A', 't1', stored, next, tabStatsOfData(next).stats);
    expect(refs(db.sql)).toEqual(['t1:c1', 't1:c2']);
  });

  it("deleteTabRow prunes the tab's refs", async () => {
    const db = withDesign();
    await upsertTab(db.env, 'A', tabUsing('t1', 'c1'), 0);
    await upsertTab(db.env, 'A', tabUsing('t2', 'c1'), 1);
    await deleteTabRow(db.env, 'A', 't1');
    expect(refs(db.sql)).toEqual(['t2:c1']);
  });
});

describe('a copy of a design', () => {
  it('carries the whole library and indexes the copied tabs', async () => {
    const source = withDesign('A');
    await putComponent(source.env, main('c1'));
    await putComponent(source.env, main('c2'));
    await upsertTab(source.env, 'A', tabUsing('t1', 'c1'), 0);
    await upsertTab(source.env, 'A', tabUsing('t2'), 1);
    const copy = (await exportDesignCopy(source.env, 'A', null, null))!;
    expect(copy.components?.map((m) => m.id)).toEqual(['c1', 'c2']);
    // In production the copy is another design's own store.
    const target = sqliteD1();
    await importDesignCopy(target.env, 'B', copy);
    expect((await readComponents(target.env)).map((m) => m.id)).toEqual(['c1', 'c2']);
    const copiedT1 = copy.tabs[0]!.id;
    expect(refs(target.sql)).toEqual([`${copiedT1}:c1`]);
  });

  it("takes only the copied tab's mains for a one-tab copy, and none when there are none", async () => {
    const source = withDesign('A');
    await putComponent(source.env, main('c1'));
    await putComponent(source.env, main('c2'));
    await upsertTab(source.env, 'A', tabUsing('t1', 'c1'), 0);
    await upsertTab(source.env, 'A', tabUsing('t2'), 1);
    const one = (await exportDesignCopy(source.env, 'A', 't1', 'visitor'))!;
    expect(one.components?.map((m) => m.id)).toEqual(['c1']);
    const none = (await exportDesignCopy(source.env, 'A', 't2', 'visitor'))!;
    expect(none).not.toHaveProperty('components');
    const target = sqliteD1();
    await importDesignCopy(target.env, 'B', none);
    expect(await readComponents(target.env)).toEqual([]);
  });

  it("redacts other people's comment authors, and a Community copy's threads", async () => {
    const source = withDesign('A');
    const thread = {
      id: 'th',
      comments: [{ id: 'k', authorId: 'someone', text: 'hi', createdAt: 1 }],
    };
    const withThread = main('c1', 10, {
      elements: [{ ...main('c1').elements[0]!, commentThread: thread } as never],
    });
    await putComponent(source.env, withThread);
    const visitor = (await exportDesignCopy(source.env, 'A', null, 'visitor'))!;
    const comment = (visitor.components![0]!.elements[0] as { commentThread?: typeof thread })
      .commentThread?.comments[0];
    expect(comment?.authorId).toBeUndefined();
    const owner = (await exportDesignCopy(source.env, 'A', null, 'owner'))!;
    expect(owner.components).toEqual([withThread]);
    const community = (await exportDesignCopy(source.env, 'A', null, 'visitor', true))!;
    expect(community.components![0]!.elements[0]).not.toHaveProperty('commentThread');
  });
});
