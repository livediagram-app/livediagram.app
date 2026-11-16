// A plan's snapshots (docs/specs/013-workspace/snapshots.md): snapshot, edit, revert gives the snapshot back (tabs with
// their ids and folders, card types, cards with their keys, Sheets with their cells); threads and rules are kept; a
// sixth drops the oldest; only an Editor of the whole plan sees them, a token is refused; a stale write is fenced.
import { describe, expect, it, vi } from 'vitest';
import { defaultCatalogue, type Item } from '@liveplanner/items';
import type { Element } from '@liveplanner/project';
import type { SheetJson } from '@liveplanner/sheets';
import { SNAPSHOT_GENERATION_HEADER } from '@liveworkspace/snapshots';
import { insertItems, listItems, readItem } from '../db/items';
import { insertSheetStatements } from '../db/sheets';
import { getTab, upsertTab } from '../db/tabs';
import type { PlanGrant } from '../index-service';
import { makeTestRouteContext } from '../routes/test-route-context';
import { sqliteD1 } from '../test-sqlite-d1';
import type { PlanEnv } from '../types';
import { readPlanHead, setPlanItemTypes } from './plan-content';
import { servePlanSnapshots } from './plan-snapshots';

const OWNER = 'user_ada';
const PERSON = { id: OWNER, name: 'Ada', color: '#123456' };

const box = (id: string): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
});

const card = (id: string, key: number, title: string): Item => ({
  id,
  type: 'task',
  key,
  rank: `a${key}`,
  fields: { title },
  rev: 1,
  createdAt: 10,
  updatedAt: 20,
  createdBy: PERSON,
  updatedBy: PERSON,
});

const sheet: SheetJson = {
  id: 'sheet0001',
  tabId: 't2',
  title: 'Budget',
  layout: { rows: ['r001'], cols: ['c001'] },
  cells: [{ r: 'r001', c: 'c001', i: { n: 42 } }],
  rev: 0,
  createdAt: 5,
  updatedAt: 5,
  updatedBy: PERSON,
};

const grantOf = (over: Partial<PlanGrant> = {}): PlanGrant => ({
  item: 'A',
  level: 'edit',
  tab: null,
  sub: OWNER,
  team: null,
  exp: 9_999_999_999,
  shareCode: null,
  token: 'signed',
  ...over,
});

async function arrange() {
  const db = sqliteD1({});
  const reverted = vi.fn();
  const env = { ...db.env, SNAPSHOT_REVERTED: reverted } as PlanEnv;
  db.sql.exec(
    `INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at) VALUES ('A', '${OWNER}', 'Roadmap', 0, 1, 1)`,
  );
  await upsertTab(env, 'A', { id: 't1', name: 'One', elements: [box('b1')] }, 0);
  await upsertTab(env, 'A', { id: 't2', name: 'Two', elements: [box('b2')] }, 1);
  db.sql.prepare("UPDATE plan_tabs SET folder = 'Later' WHERE tab_id = 't2'").run();
  await setPlanItemTypes(env, 'A', defaultCatalogue());
  await insertItems(env, 'A', [card('c1', 1, 'Write it'), card('c2', 2, 'Ship it')]);
  await env.PLAN_DB.batch(insertSheetStatements(env, 'A', sheet, 5));
  const send = (
    method: string,
    path: string,
    opts: {
      body?: unknown;
      grant?: PlanGrant | null;
      token?: boolean;
      headers?: Record<string, string>;
    } = {},
  ) => {
    const ctx = makeTestRouteContext(method, `/api/projects/A${path}`, {
      owner: OWNER,
      accountUserId: OWNER,
      env,
      body: opts.body,
      headers: opts.headers,
      grant: opts.grant === undefined ? grantOf() : opts.grant,
      token: opts.token ? { id: 'tok_1' } : null,
    });
    return servePlanSnapshots(ctx, async () => new Response('handled'));
  };
  return { db, env, send, reverted };
}

const cellInput = (db: ReturnType<typeof sqliteD1>) =>
  (
    db.sql.prepare("SELECT input FROM sheet_cells WHERE sheet_id = 'sheet0001'").get() as
      { input: string } | undefined
  )?.input;

describe('plan snapshots', () => {
  it('snapshot, edit, revert gives the snapshot back: tabs, card types, cards and Sheets', async () => {
    const { db, env, send, reverted } = await arrange();
    const taken = await send('POST', '/snapshots', { body: { name: 'Before' } });
    expect(taken.status).toBe(201);
    const { snapshot } = (await taken.json()) as { snapshot: { id: string } };

    // Edit everything: a tab renamed and one added, a card changed, one removed and one made, a cell changed, the
    // card types cleared.
    await upsertTab(env, 'A', { id: 't1', name: 'Renamed', elements: [] }, 0);
    await upsertTab(env, 'A', { id: 't3', name: 'New', elements: [] }, 2);
    db.sql
      .prepare('UPDATE items SET fields = \'{"title":"Changed"}\', rev = 5 WHERE id = \'c1\'')
      .run();
    db.sql.prepare("DELETE FROM items WHERE id = 'c2'").run();
    await insertItems(env, 'A', [card('c3', 3, 'New card')]);
    db.sql.prepare("UPDATE sheet_cells SET input = '{\"n\":7}' WHERE sheet_id = 'sheet0001'").run();
    db.sql.prepare("UPDATE plan SET item_types = NULL WHERE id = 'A'").run();

    const res = await send('POST', `/snapshots/${snapshot.id}/revert`);
    expect(res.status).toBe(200);
    expect(reverted).toHaveBeenCalledWith(1);
    expect((await getTab(env, 'A', 't1'))?.name).toBe('One');
    expect(await getTab(env, 'A', 't3')).toBeNull();
    const c1 = await readItem(env, 'A', 'c1');
    expect(c1?.fields).toEqual({ title: 'Write it' });
    // A card that lived through keeps moving forward, so a write from before is refused.
    expect(c1?.rev).toBeGreaterThan(5);
    expect((await readItem(env, 'A', 'c2'))?.key).toBe(2);
    expect(await readItem(env, 'A', 'c3')).toBeNull();
    expect((await listItems(env, 'A')).map((i) => i.id).sort()).toEqual(['c1', 'c2']);
    expect(cellInput(db)).toBe('{"n":42}');
    expect((await readPlanHead(env, 'A')).itemTypes).not.toBeNull();

    // The automatic snapshot holds the edit: reverting to it undoes the revert, the new card's key kept clear.
    const list = (await (await send('GET', '/snapshots')).json()) as {
      snapshots: { id: string; kind: string }[];
    };
    expect(list.snapshots[0]!.kind).toBe('before-revert');
    expect((await send('POST', `/snapshots/${list.snapshots[0]!.id}/revert`)).status).toBe(200);
    expect((await readItem(env, 'A', 'c3'))?.fields).toEqual({ title: 'New card' });
    expect(await readItem(env, 'A', 'c2')).toBeNull();
    expect(cellInput(db)).toBe('{"n":7}');
  });

  it('keeps the latest five: a sixth drops the oldest', async () => {
    const { send } = await arrange();
    for (let i = 0; i < 6; i += 1) await send('POST', '/snapshots', { body: { name: `n${i}` } });
    const list = (await (await send('GET', '/snapshots')).json()) as {
      snapshots: { name: string }[];
    };
    expect(list.snapshots.map((s) => s.name)).toEqual(['n5', 'n4', 'n3', 'n2', 'n1']);
  });

  it('only an Editor of the whole plan sees them; a token is refused', async () => {
    const { send } = await arrange();
    expect((await send('GET', '/snapshots')).status).toBe(200);
    for (const grant of [
      grantOf({ level: 'participate' }),
      grantOf({ level: 'view' }),
      grantOf({ tab: 't1' }),
      null,
    ]) {
      expect((await send('GET', '/snapshots', { grant })).status).toBe(404);
      expect((await send('POST', '/snapshots', { grant })).status).toBe(404);
    }
    expect((await send('POST', '/snapshots', { token: true })).status).toBe(403);
  });

  it('fences a write from before the revert and passes everything else on', async () => {
    const { send } = await arrange();
    const taken = await send('POST', '/snapshots', { body: {} });
    const { snapshot } = (await taken.json()) as { snapshot: { id: string } };
    await send('POST', `/snapshots/${snapshot.id}/revert`);
    const stale = await send('POST', '/items', { headers: { [SNAPSHOT_GENERATION_HEADER]: '0' } });
    expect(stale.status).toBe(409);
    const fresh = await send('POST', '/items', { headers: { [SNAPSHOT_GENERATION_HEADER]: '1' } });
    expect(await fresh.text()).toBe('handled');
  });
});
