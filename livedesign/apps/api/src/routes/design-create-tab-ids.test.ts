import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { DESIGN_CONVERSION_HEADER } from '@livedesign/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { linkTabToDesign, upsertTab } from '../db/tabs';
import { makeTestRouteContext } from './test-route-context';
import { handleDesigns } from './designs';

// A created design never writes into a tab another design holds
// (docs/specs/006-design/offline-mode.md, "Shared tabs fork"): a seeded tab
// whose id is already taken outside this design is created under a fresh id.
// That is what makes a synced-back offline copy a fork rather than an
// overwrite, and what stops a create from rewriting someone else's tab.

const T0 = 1_700_000_000_000;

function liveDoc(sql: DatabaseSync, id: string, ownerId: string) {
  sql
    .prepare(
      'INSERT INTO designs (id, owner_id, name, shareable, saved_at, created_at) VALUES (?, ?, ?, 0, ?, ?)',
    )
    .run(id, ownerId, id, T0, T0);
}

const square = (id: string, linkTo?: string) => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 60,
  ...(linkTo ? { link: { kind: 'tab', tabId: linkTo } } : {}),
});

function post(db: SqliteD1, owner: string, body: unknown, headers: Record<string, string> = {}) {
  return handleDesigns(
    makeTestRouteContext('POST', '/api/designs', { env: db.env, owner, body, headers }),
  );
}

function tabName(sql: DatabaseSync, id: string): string | undefined {
  return sql.prepare('SELECT name FROM tabs WHERE id = ?').get(id)?.name as string | undefined;
}

function linksOf(sql: DatabaseSync, tabId: string): string[] {
  return sql
    .prepare('SELECT design_id FROM design_tabs WHERE tab_id = ? ORDER BY design_id')
    .all(tabId)
    .map((r) => r.design_id as string);
}

function tabsOf(sql: DatabaseSync, designId: string) {
  return sql
    .prepare(
      `SELECT t.id, t.name, t.data FROM design_tabs dt JOIN tabs t ON t.id = dt.tab_id
        WHERE dt.design_id = ? ORDER BY dt.order_index`,
    )
    .all(designId)
    .map((r) => ({
      id: r.id as string,
      name: r.name as string,
      data: JSON.parse(r.data as string) as { elements: { link?: { tabId?: string } }[] },
    }));
}

async function seed(db: SqliteD1, designId: string, id: string, name = id) {
  await upsertTab(db.env, designId, { id, name, elements: [] }, 0);
}

describe('POST /api/designs with a tab id held elsewhere', () => {
  it('syncs an offline fork back as its own tab, leaving the shared one alone', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'A', 'owner');
    liveDoc(db.sql, 'B', 'owner');
    await seed(db, 'A', 'shared', 'Glossary');
    await seed(db, 'A', 'own');
    await linkTabToDesign(db.env, 'B', 'shared');
    // Take Offline removed A from the server; `shared` lives on in B.
    await handleDesigns(
      makeTestRouteContext('DELETE', '/api/designs/A', {
        env: db.env,
        owner: 'owner',
        headers: { [DESIGN_CONVERSION_HEADER]: 'offline' },
      }),
    );

    const res = await post(
      db,
      'owner',
      {
        id: 'A',
        name: 'A',
        tabs: [
          { id: 'shared', name: 'Glossary, edited offline', elements: [square('g')] },
          { id: 'own', name: 'own', elements: [square('s', 'shared')] },
        ],
        presentation: JSON.stringify({
          decks: [{ slides: [{ id: 's1', tabId: 'shared', elementIds: ['g'] }] }],
        }),
      },
      { [DESIGN_CONVERSION_HEADER]: 'sync' },
    );

    expect(res?.status).toBe(201);
    expect(tabName(db.sql, 'shared')).toBe('Glossary');
    expect(linksOf(db.sql, 'shared')).toEqual(['B']);
    const [fork, own] = tabsOf(db.sql, 'A');
    expect(fork!.id).not.toBe('shared');
    expect(fork!.name).toBe('Glossary, edited offline');
    // The copy's own navigation and deck follow the fork.
    expect(own!.id).toBe('own');
    expect(own!.data.elements[0]?.link?.tabId).toBe(fork!.id);
    const deck = db.sql.prepare("SELECT presentation FROM designs WHERE id = 'A'").get();
    expect(JSON.parse(deck!.presentation as string)).toHaveProperty(
      ['decks', 0, 'slides', 0, 'tabId'],
      fork!.id,
    );
  });

  it('never rewrites a tab in someone else’s design', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'V', 'victim');
    await seed(db, 'V', 'vt', 'Plans');

    const res = await post(db, 'attacker', {
      id: 'X',
      name: 'X',
      tabs: [{ id: 'vt', name: 'Overwritten', elements: [] }],
    });

    expect(res?.status).toBe(201);
    expect(tabName(db.sql, 'vt')).toBe('Plans');
    expect(linksOf(db.sql, 'vt')).toEqual(['V']);
    expect(tabsOf(db.sql, 'X').map((t) => t.name)).toEqual(['Overwritten']);
  });

  it('keeps the deck a synced offline copy carries', async () => {
    const db = sqliteD1();
    const deck = JSON.stringify({
      decks: [{ slides: [{ id: 's1', tabId: 'n1', elementIds: [] }] }],
    });

    await post(db, 'owner', {
      id: 'N',
      name: 'N',
      tabs: [{ id: 'n1', name: 'One', elements: [] }],
      presentation: deck,
    });

    const row = db.sql.prepare("SELECT presentation FROM designs WHERE id = 'N'").get();
    expect(row!.presentation).toBe(deck);
  });

  it('keeps its tab ids when the same create is retried', async () => {
    const db = sqliteD1();
    const body = { id: 'N', name: 'N', tabs: [{ id: 'n1', name: 'One', elements: [] }] };

    await post(db, 'owner', body);
    await post(db, 'owner', body);

    expect(tabsOf(db.sql, 'N').map((t) => t.id)).toEqual(['n1']);
  });
});
