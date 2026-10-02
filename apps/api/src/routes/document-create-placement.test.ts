import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';
import {
  asGuest,
  asUser,
  errorOf,
  seedFolder,
  seedTeam,
  storedPlacement,
} from './placement-test-support';

// Placement on create against a real schema (docs/specs/013-workspace/folders.md "Placement on
// create"): one write places the document, and an invalid placement is a named refusal that writes
// nothing, never a document filed somewhere else.

let db: SqliteD1;
let logs: string[];

function create(
  who: { owner: string; clerkUserId: string | null },
  placement: Record<string, unknown>,
  id = 'd1',
) {
  return handleDocuments(
    makeTestRouteContext('POST', '/api/documents', {
      env: db.env,
      ...who,
      body: {
        id,
        name: 'Doc',
        tabs: [{ id: `${id}-t1`, name: 'Tab 1', elements: [] }],
        ...placement,
      },
    }),
  );
}

const stored = (id = 'd1') => storedPlacement(db, id);

beforeEach(() => {
  db = sqliteD1();
  logs = [];
  const capture = (...args: unknown[]) => void logs.push(args.map(String).join(' '));
  vi.spyOn(console, 'info').mockImplementation(capture);
  vi.spyOn(console, 'warn').mockImplementation(capture);
  seedTeam(db, 't1', [
    { userId: 'user_alice', status: 'joined' },
    { userId: 'user_bob', status: 'invited' },
  ]);
  seedTeam(db, 't2', [{ userId: 'user_alice', status: 'joined' }]);
  seedTeam(db, 't3', [{ userId: 'user_carol', status: 'joined' }]);
  seedFolder(db, 'alice-folder', 'user_alice');
  seedFolder(db, 'carol-folder', 'user_carol');
  seedFolder(db, 'guest-folder', 'guest-uuid');
  seedFolder(db, 't1-folder', 'user_alice', 't1');
  seedFolder(db, 't2-folder', 'user_alice', 't2');
  seedFolder(db, 't3-folder', 'user_carol', 't3');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /documents placement', () => {
  it('files at the personal root when no placement is sent', async () => {
    const res = await create(asUser('user_alice'), {});
    expect(res.status).toBe(201);
    expect(stored()).toEqual({ owner_id: 'user_alice', folder_id: null, team_id: null });
    expect(logs).toContain('placement: resolved scope=personal folder=root via=root');
  });

  it("files into the caller's own personal folder", async () => {
    const res = await create(asUser('user_alice'), { folderId: 'alice-folder' });
    expect(res.status).toBe(201);
    expect(stored()).toEqual({ owner_id: 'user_alice', folder_id: 'alice-folder', team_id: null });
    expect(logs).toContain('placement: resolved scope=personal folder=set via=explicit');
  });

  it("files a guest into the guest's own personal folder", async () => {
    const res = await create(asGuest('guest-uuid'), { folderId: 'guest-folder' });
    expect(res.status).toBe(201);
    expect(stored()?.folder_id).toBe('guest-folder');
  });

  it('refuses a folder that does not exist, writing nothing', async () => {
    const res = await create(asUser('user_alice'), { folderId: 'gone' });
    expect(res.status).toBe(404);
    expect(await errorOf(res)).toBe('folder_not_found');
    expect(stored()).toBeUndefined();
    expect(logs).toContain('placement: rejected reason=folder_not_found scope=personal');
  });

  it("refuses someone else's personal folder as not found", async () => {
    const res = await create(asUser('user_alice'), { folderId: 'carol-folder' });
    expect(res.status).toBe(404);
    expect(await errorOf(res)).toBe('folder_not_found');
    expect(stored()).toBeUndefined();
  });

  it("files at a team's root, team_id in the same insert", async () => {
    const res = await create(asUser('user_alice'), { teamId: 't1' });
    expect(res.status).toBe(201);
    expect(stored()).toEqual({ owner_id: 'user_alice', folder_id: null, team_id: 't1' });
    const body = (await res.json()) as { document: { teamId: string | null } };
    expect(body.document.teamId).toBe('t1');
    expect(logs).toContain('placement: resolved scope=team folder=root via=root');
  });

  it("files into a team's folder", async () => {
    const res = await create(asUser('user_alice'), { teamId: 't1', folderId: 't1-folder' });
    expect(res.status).toBe(201);
    expect(stored()).toEqual({ owner_id: 'user_alice', folder_id: 't1-folder', team_id: 't1' });
    expect(logs).toContain('placement: resolved scope=team folder=set via=explicit');
  });

  it('refuses a team the caller was only invited to', async () => {
    const res = await create(asUser('user_bob'), { teamId: 't1' });
    expect(res.status).toBe(403);
    expect(await errorOf(res)).toBe('team_forbidden');
    expect(stored()).toBeUndefined();
    expect(logs).toContain('placement: rejected reason=team_forbidden scope=team');
  });

  it('refuses a team the caller is not in', async () => {
    const res = await create(asUser('user_alice'), { teamId: 't3' });
    expect(res.status).toBe(403);
    expect(await errorOf(res)).toBe('team_forbidden');
    expect(stored()).toBeUndefined();
  });

  it("refuses a guest asking for a team, even under a member's id", async () => {
    // The guest header carries Alice's id, but nothing verified it.
    const res = await create(asGuest('user_alice'), { teamId: 't1' });
    expect(res.status).toBe(403);
    expect(await errorOf(res)).toBe('team_forbidden');
    expect(stored()).toBeUndefined();
  });

  it('names a personal folder asked for in a team', async () => {
    const res = await create(asUser('user_alice'), { teamId: 't1', folderId: 'alice-folder' });
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe('folder_scope_mismatch');
    expect(stored()).toBeUndefined();
  });

  it("names another joined team's folder", async () => {
    const res = await create(asUser('user_alice'), { teamId: 't1', folderId: 't2-folder' });
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe('folder_scope_mismatch');
  });

  it('names a joined team folder asked for in Personal Space', async () => {
    const res = await create(asUser('user_alice'), { folderId: 't1-folder' });
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe('folder_scope_mismatch');
    expect(stored()).toBeUndefined();
  });

  it("hides a folder of a team the caller hasn't joined", async () => {
    const res = await create(asUser('user_alice'), { folderId: 't3-folder' });
    expect(res.status).toBe(404);
    expect(await errorOf(res)).toBe('folder_not_found');
  });

  it('refuses a malformed placement', async () => {
    const res = await create(asUser('user_alice'), { teamId: 42 });
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe('placement_invalid');
    expect(stored()).toBeUndefined();
    expect(logs).toContain('placement: rejected reason=placement_invalid scope=team');
  });

  it('keeps the stored placement on a re-commit', async () => {
    await create(asUser('user_alice'), { teamId: 't1', folderId: 't1-folder' });
    logs.length = 0;
    const res = await create(asUser('user_alice'), {});
    expect(res.status).toBe(201);
    expect(stored()).toEqual({ owner_id: 'user_alice', folder_id: 't1-folder', team_id: 't1' });
    expect(logs).toContain('placement: skipped reason=existing');
  });
});
