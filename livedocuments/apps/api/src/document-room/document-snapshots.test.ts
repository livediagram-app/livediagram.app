// A document's snapshots (docs/specs/013-workspace/snapshots.md): snapshot, edit, revert gives the snapshot back with
// its tabs' ids, folders and deck; a sixth drops the oldest; only an Editor of the whole document sees them, a token is
// refused; a write from before the revert is fenced.
import { describe, expect, it, vi } from 'vitest';
import type { ShapeElement } from '@livedocuments/document';
import { SNAPSHOT_GENERATION_HEADER } from '@liveworkspace/snapshots';
import { getTab, upsertTab } from '../db/tabs';
import type { DocumentGrant as ItemGrant } from '../index-service';
import { makeTestRouteContext } from '../routes/test-route-context';
import { sqliteD1 } from '../test-sqlite-d1';
import type { DocumentEnv } from '../types';
import { initDocument, readDocumentHead } from './document-content';
import { serveDocumentSnapshots } from './document-snapshots';

const OWNER = 'user_ada';

const box = (id: string): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
});

const grantOf = (over: Partial<ItemGrant> = {}): ItemGrant => ({
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
  const env = { ...db.env, SNAPSHOT_REVERTED: reverted } as DocumentEnv;
  await initDocument(env, 'A', {
    name: 'Plan',
    ownerId: OWNER,
    teamId: null,
    source: null,
    savedAt: 1,
    createdAt: 1,
    presentation: null,
  });
  await upsertTab(env, 'A', { id: 't1', name: 'One', elements: [box('b1')] }, 0);
  await upsertTab(env, 'A', { id: 't2', name: 'Two', elements: [box('b2')] }, 1);
  db.sql.prepare("UPDATE document_tabs SET folder = 'Later' WHERE tab_id = 't2'").run();
  db.sql.prepare("UPDATE document SET presentation = '{\"decks\":[]}' WHERE id = 'A'").run();
  const send = (
    method: string,
    path: string,
    opts: {
      body?: unknown;
      grant?: ItemGrant | null;
      token?: boolean;
      headers?: Record<string, string>;
    } = {},
  ) => {
    const ctx = makeTestRouteContext(method, `/api/documents/A${path}`, {
      owner: OWNER,
      accountUserId: OWNER,
      env,
      body: opts.body,
      headers: opts.headers,
      grant: opts.grant === undefined ? grantOf() : opts.grant,
      token: opts.token ? { id: 'tok_1' } : null,
    });
    return serveDocumentSnapshots(ctx, async () => new Response('handled'));
  };
  return { db, env, send, reverted };
}

describe('document snapshots', () => {
  it('snapshot, edit, revert gives the snapshot back: tabs, ids, order, folders and deck', async () => {
    const { db, env, send, reverted } = await arrange();
    const taken = await send('POST', '/snapshots', { body: { name: 'Before' } });
    expect(taken.status).toBe(201);
    const { snapshot } = await taken.json<{ snapshot: { id: string } }>();

    // Edit: change a tab, delete one, add one, move the deck.
    await upsertTab(env, 'A', { id: 't1', name: 'Renamed', elements: [] }, 0);
    db.sql.prepare("DELETE FROM document_tabs WHERE tab_id = 't2'").run();
    await upsertTab(env, 'A', { id: 't3', name: 'New', elements: [box('b3')] }, 2);
    db.sql.prepare("UPDATE document SET presentation = NULL WHERE id = 'A'").run();
    const revBefore = (
      db.sql.prepare("SELECT rev FROM tabs WHERE id = 't1'").get() as { rev: number }
    ).rev;

    const res = await send('POST', `/snapshots/${snapshot.id}/revert`);
    expect(res.status).toBe(200);
    expect(reverted).toHaveBeenCalledWith(1);
    const t1 = await getTab(env, 'A', 't1');
    expect(t1).toMatchObject({ name: 'One' });
    expect(t1?.elements.map((e) => e.id)).toEqual(['b1']);
    expect((await getTab(env, 'A', 't2'))?.name).toBe('Two');
    const links = db.sql
      .prepare(
        'SELECT tab_id, folder FROM document_tabs WHERE document_id = ? ORDER BY order_index',
      )
      .all('A') as { tab_id: string; folder: string | null }[];
    expect(links).toEqual([
      { tab_id: 't1', folder: null },
      { tab_id: 't2', folder: 'Later' },
    ]);
    expect((await readDocumentHead(env, 'A')).presentation).toBe('{"decks":[]}');
    // The revision moved on, so a draft kept over the old one is never replayed.
    const revAfter = (
      db.sql.prepare("SELECT rev FROM tabs WHERE id = 't1'").get() as { rev: number }
    ).rev;
    expect(revAfter).toBeGreaterThan(revBefore);

    // The automatic snapshot holds the edit, so the revert can be undone.
    const list = await (
      await send('GET', '/snapshots')
    ).json<{
      snapshots: { id: string; kind: string }[];
    }>();
    expect(list.snapshots.map((s) => s.kind)).toEqual(['before-revert', 'manual']);
    await send('POST', `/snapshots/${list.snapshots[0]!.id}/revert`);
    expect((await getTab(env, 'A', 't3'))?.name).toBe('New');
    expect(await getTab(env, 'A', 't2')).toBeNull();
  });

  it('keeps the latest five: a sixth drops the oldest', async () => {
    const { send } = await arrange();
    for (let i = 0; i < 6; i += 1) await send('POST', '/snapshots', { body: { name: `n${i}` } });
    const list = await (
      await send('GET', '/snapshots')
    ).json<{
      snapshots: { name: string }[];
    }>();
    expect(list.snapshots.map((s) => s.name)).toEqual(['n5', 'n4', 'n3', 'n2', 'n1']);
  });

  it('only an Editor of the whole document sees them; a token is refused', async () => {
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
    const { snapshot } = await taken.json<{ snapshot: { id: string } }>();
    await send('POST', `/snapshots/${snapshot.id}/revert`);
    const stale = await send('PUT', '/tabs/t1', { headers: { [SNAPSHOT_GENERATION_HEADER]: '0' } });
    expect(stale.status).toBe(409);
    const fresh = await send('PUT', '/tabs/t1', { headers: { [SNAPSHOT_GENERATION_HEADER]: '1' } });
    expect(await fresh.text()).toBe('handled');
  });
});
