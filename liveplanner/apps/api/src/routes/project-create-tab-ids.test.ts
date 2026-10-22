import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { PROJECT_CONVERSION_HEADER } from '@liveplanner/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { linkTabToProject, upsertTab } from '../db/tabs';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';

// A created project never writes into a tab another project holds
// (docs/specs/006-project/offline-mode.md, "Shared tabs fork"): a seeded tab
// whose id is already taken outside this project is created under a fresh id.
// That is what makes a synced-back offline copy a fork rather than an
// overwrite, and what stops a create from rewriting someone else's tab.

const T0 = 1_700_000_000_000;

function liveDoc(sql: DatabaseSync, id: string, ownerId: string) {
  sql
    .prepare(
      'INSERT INTO projects (id, owner_id, name, shareable, saved_at, created_at) VALUES (?, ?, ?, 0, ?, ?)',
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
  return handleProjects(
    makeTestRouteContext('POST', '/api/projects', { env: db.env, owner, body, headers }),
  );
}

function tabName(sql: DatabaseSync, id: string): string | undefined {
  return sql.prepare('SELECT name FROM tabs WHERE id = ?').get(id)?.name as string | undefined;
}

function linksOf(sql: DatabaseSync, tabId: string): string[] {
  return sql
    .prepare('SELECT project_id FROM project_tabs WHERE tab_id = ? ORDER BY project_id')
    .all(tabId)
    .map((r) => r.project_id as string);
}

function tabsOf(sql: DatabaseSync, projectId: string) {
  return sql
    .prepare(
      `SELECT t.id, t.name, t.data FROM project_tabs dt JOIN tabs t ON t.id = dt.tab_id
        WHERE dt.project_id = ? ORDER BY dt.order_index`,
    )
    .all(projectId)
    .map((r) => ({
      id: r.id as string,
      name: r.name as string,
      data: JSON.parse(r.data as string) as { elements: { link?: { tabId?: string } }[] },
    }));
}

async function seed(db: SqliteD1, projectId: string, id: string, name = id) {
  await upsertTab(db.env, projectId, { id, name, elements: [] }, 0);
}

describe('POST /api/projects with a tab id held elsewhere', () => {
  it('syncs an offline fork back as its own tab, leaving the shared one alone', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'A', 'owner');
    liveDoc(db.sql, 'B', 'owner');
    await seed(db, 'A', 'shared', 'Glossary');
    await seed(db, 'A', 'own');
    await linkTabToProject(db.env, 'B', 'shared');
    // Take Offline removed A from the server; `shared` lives on in B.
    await handleProjects(
      makeTestRouteContext('DELETE', '/api/projects/A', {
        env: db.env,
        owner: 'owner',
        headers: { [PROJECT_CONVERSION_HEADER]: 'offline' },
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
      },
      { [PROJECT_CONVERSION_HEADER]: 'sync' },
    );

    expect(res?.status).toBe(201);
    expect(tabName(db.sql, 'shared')).toBe('Glossary');
    expect(linksOf(db.sql, 'shared')).toEqual(['B']);
    const [fork, own] = tabsOf(db.sql, 'A');
    expect(fork!.id).not.toBe('shared');
    expect(fork!.name).toBe('Glossary, edited offline');
    // The copy's own navigation follows the fork.
    expect(own!.id).toBe('own');
    expect(own!.data.elements[0]?.link?.tabId).toBe(fork!.id);
  });

  it('never rewrites a tab in someone else’s project', async () => {
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

  it('keeps its tab ids when the same create is retried', async () => {
    const db = sqliteD1();
    const body = { id: 'N', name: 'N', tabs: [{ id: 'n1', name: 'One', elements: [] }] };

    await post(db, 'owner', body);
    await post(db, 'owner', body);

    expect(tabsOf(db.sql, 'N').map((t) => t.id)).toEqual(['n1']);
  });
});
