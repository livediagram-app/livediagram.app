import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ATTENDANCE_RETENTION_DAYS,
  ATTENDANCE_RETENTION_MS,
  ATTENDANCE_TAB_MAX,
  type TabAttendanceResponse,
} from '@livehuddle/api-schema';
import { collabKeyFor } from '@liveworkspace/api-kit/collab-key';
import { ANONYMISED_NAME, ANONYMISED_PERSON } from '@liveworkspace/index-app';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { sqliteD1, testShareLink, type SqliteD1 } from '../test-sqlite-d1';
import { joinVisit, leaveVisit } from '../db/tab-attendance';
import { anonymiseDocument } from '../document-room/document-anonymise';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// A tab's Attendance route (docs/specs/012-collaboration/tab-attendance.md "Who sees it", "The wire"): an Editor and a
// Participant read it, a Viewer is refused, a scoped link reads only its tab, a picture goes only to a signed-in
// reader, and a closed account's visits are anonymised.

const OWNER = 'guest_00000000-0000-4000-8000-000000000001';
const VISITOR = 'guest_00000000-0000-4000-8000-000000000002';
const PICTURE = 'https://lh3.googleusercontent.com/a/ada';
let sql: SqliteD1;

type Call = {
  method?: string;
  tab?: string;
  owner?: string | null;
  code?: string;
  account?: string;
};

function call({ method = 'GET', tab = 't1', owner = OWNER, code, account }: Call = {}) {
  return handleDocuments(
    makeTestRouteContext(method, `/api/documents/d1/tabs/${tab}/attendance`, {
      env: sql.env,
      owner,
      ...(account ? { accountUserId: account } : {}),
      ...(code ? { headers: { 'X-Share-Code': code } } : {}),
    }),
  );
}

beforeEach(async () => {
  sql = sqliteD1();
  sql.sql.exec(`
    INSERT INTO test_documents (id, owner_id, name, saved_at, created_at)
      VALUES ('d1', '${OWNER}', 'Studio', 1, 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Lobby', '{"elements":[]}', 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t2', 'Pod', '{"elements":[]}', 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't2', 1, 1);
  `);
  testShareLink(sql, 'd1', 'TAKE', 'participate');
  testShareLink(sql, 'd1', 'LOOK', 'view');
  testShareLink(sql, 'd1', 'EDIT', 'edit');
  testShareLink(sql, 'd1', 'TAB2', 'participate', 't2');
  const item = nodeItemSql(sql.sql);
  const now = Date.now();
  joinVisit(
    item,
    't1',
    await collabKeyFor(OWNER),
    { name: 'Owner', color: '#111', picture: null, guest: true },
    now - 60_000,
  );
  joinVisit(
    item,
    't1',
    await collabKeyFor(VISITOR),
    { name: 'Ada', color: '#0ea5e9', picture: PICTURE, guest: false },
    now - 30_000,
  );
  leaveVisit(item, 't1', await collabKeyFor(VISITOR), now - 10_000);
  joinVisit(
    item,
    't1',
    'k-old',
    { name: 'Gone', color: '#222', picture: null, guest: true },
    now - ATTENDANCE_RETENTION_MS - 9,
  );
  leaveVisit(item, 't1', 'k-old', now - ATTENDANCE_RETENTION_MS - 5);
  joinVisit(
    item,
    't2',
    'k-pod',
    { name: 'Pod person', color: '#333', picture: null, guest: true },
    now,
  );
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const body = async (res: Response): Promise<TabAttendanceResponse> => res.json();

describe('reading a tab’s Attendance', () => {
  it('gives the owner the tab’s visits newest first, none past retention, theirs marked', async () => {
    const res = await call();
    expect(res.status).toBe(200);
    const read = await body(res);
    expect(read.retentionDays).toBe(ATTENDANCE_RETENTION_DAYS);
    expect(read.perTabMax).toBe(ATTENDANCE_TAB_MAX);
    expect(read.visits.map((v) => [v.name, v.self, v.guest, v.leftAt === null])).toEqual([
      ['Ada', false, false, false],
      ['Owner', true, true, true],
    ]);
    // A guest reader is sent no picture; no visit carries a key or an id of a person.
    expect(read.visits[0]!.picture).toBeUndefined();
    expect(JSON.stringify(read)).not.toContain(VISITOR);
    expect(JSON.stringify(read)).not.toContain(await collabKeyFor(VISITOR));
  });

  it('sends a picture to a signed-in reader', async () => {
    const read = await body(await call({ account: 'user_1', owner: 'user_1', code: 'EDIT' }));
    expect(read.visits[0]!.picture).toBe(PICTURE);
  });

  it('lets an Editor and a Participant read it, and marks the Participant’s own visit', async () => {
    expect((await call({ owner: VISITOR, code: 'EDIT' })).status).toBe(200);
    const res = await call({ owner: VISITOR, code: 'TAKE' });
    expect(res.status).toBe(200);
    expect((await body(res)).visits.map((v) => v.self)).toEqual([true, false]);
  });

  it('refuses a Viewer, a stranger, a link scoped to another tab and no identity', async () => {
    expect((await call({ owner: VISITOR, code: 'LOOK' })).status).toBe(403);
    expect((await call({ owner: VISITOR })).status).toBe(403);
    expect((await call({ owner: VISITOR, code: 'TAB2' })).status).toBe(404);
    expect((await call({ owner: null })).status).toBe(400);
    expect(console.warn).toHaveBeenCalled();
  });

  it('lets a scoped link read its own tab', async () => {
    const res = await call({ owner: VISITOR, code: 'TAB2', tab: 't2' });
    expect((await body(res)).visits.map((v) => v.name)).toEqual(['Pod person']);
  });

  it('answers a tab or a document that is not there, and any other method', async () => {
    expect((await call({ tab: 'nope' })).status).toBe(404);
    expect(
      (
        await handleDocuments(
          makeTestRouteContext('GET', '/api/documents/zz/tabs/t1/attendance', {
            env: sql.env,
            owner: OWNER,
          }),
        )
      ).status,
    ).toBe(404);
    expect((await call({ method: 'POST' })).status).toBe(405);
  });

  it('logs counts only, never a name', async () => {
    await call();
    const logged = JSON.stringify(
      (console.info as unknown as { mock: { calls: unknown[][] } }).mock.calls,
    );
    expect(logged).toContain('[attendance] listed');
    expect(logged).not.toContain('Ada');
  });
});

describe('closing an account', () => {
  it('keeps their visits with no key, no name and no picture, and changes nothing a second time', async () => {
    const changed = await anonymiseDocument(sql.env, 'd1', VISITOR);
    expect(changed).toBeGreaterThan(0);
    const rows = sql.sql
      .prepare('SELECT person_key, name, picture FROM tab_attendance WHERE name = ?')
      .all(ANONYMISED_NAME);
    expect(rows).toEqual([{ person_key: ANONYMISED_PERSON, name: ANONYMISED_NAME, picture: null }]);
    expect(await anonymiseDocument(sql.env, 'd1', VISITOR)).toBe(0);
    // Everyone else's stay as they were.
    expect((await body(await call())).visits.map((v) => v.name)).toEqual([
      ANONYMISED_NAME,
      'Owner',
    ]);
  });

  it('goes with the tab', async () => {
    const res = await handleDocuments(
      makeTestRouteContext('DELETE', '/api/documents/d1/tabs/t2', { env: sql.env, owner: OWNER }),
    );
    expect(res.status).toBe(204);
    expect(
      sql.sql.prepare("SELECT COUNT(*) AS n FROM tab_attendance WHERE tab_id = 't2'").get(),
    ).toEqual({ n: 0 });
  });
});
