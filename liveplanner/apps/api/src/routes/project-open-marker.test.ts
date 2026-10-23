import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROJECT_OPEN_HEADER } from '@liveplanner/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';

// Where opens are recorded (docs/specs/013-workspace/explorer-home.md "Opens"; blueprint
// "Interfaces and contracts"): the tab read, only when the editor declares it an open, only after
// the read gate passed, and for whoever is reading, visitors included.

let db: SqliteD1;
let pending: Promise<unknown>[];

function seed() {
  db.sql.exec(`
    INSERT INTO projects (id, owner_id, name, shareable, saved_at, created_at)
      VALUES ('d1', 'owner', 'Payments', 1, 1, 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Tab 1', '{"elements":[]}', 1);
    INSERT INTO plan_tabs (plan_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
    INSERT INTO share_links (code, project_id, role, tab_id, created_at)
      VALUES ('CODE', 'd1', 'view', NULL, 1);
  `);
}

async function readTab(owner: string, headers: Record<string, string> = {}) {
  const res = await handleProjects(
    makeTestRouteContext('GET', '/api/projects/d1/tabs/t1', {
      env: db.env,
      owner,
      headers,
      waitUntil: (p) => void pending.push(p),
    }),
  );
  await Promise.all(pending);
  return res;
}

function opens() {
  return db.sql
    .prepare('SELECT owner_id, last_open_day FROM project_opens ORDER BY owner_id')
    .all();
}

beforeEach(() => {
  db = sqliteD1();
  pending = [];
  seed();
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the tab read and opens', () => {
  it("records the owner's marked open", async () => {
    const res = await readTab('owner', { [PROJECT_OPEN_HEADER]: '1' });
    expect(res.status).toBe(200);
    expect(opens()).toEqual([{ owner_id: 'owner', last_open_day: expect.any(String) }]);
  });

  it('records nothing for an unmarked read: a resync, a duplicate, an embed', async () => {
    expect((await readTab('owner')).status).toBe(200);
    expect(opens()).toEqual([]);
  });

  it("records a share-link visitor's open as the visitor's own", async () => {
    const res = await readTab('guest-visitor', {
      [PROJECT_OPEN_HEADER]: '1',
      'X-Share-Code': 'CODE',
    });
    expect(res.status).toBe(200);
    expect(opens()).toEqual([{ owner_id: 'guest-visitor', last_open_day: expect.any(String) }]);
  });

  it('records nothing when the read is refused', async () => {
    const res = await readTab('stranger', { [PROJECT_OPEN_HEADER]: '1' });
    expect(res.status).toBe(403);
    expect(opens()).toEqual([]);
  });
});
