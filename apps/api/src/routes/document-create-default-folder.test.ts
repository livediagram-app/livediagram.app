import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { setPlacementDefault } from '../db';
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

// Default folders on create against a real schema (docs/specs/013-workspace/default-folders.md): a
// create at the root of My documents with an intent lands in the person's default for it; an
// explicit place wins; a dangling default is skipped, logged, kept, and never fails the create.

let db: SqliteD1;
let logs: string[];

const DIAGRAM = { mode: 'diagram' };
const DRAW = { mode: 'draw' };
const KANBAN = { mode: 'diagram', boardType: 'kanban' };

function create(
  who: { owner: string; clerkUserId: string | null },
  extra: Record<string, unknown>,
) {
  return handleDocuments(
    makeTestRouteContext('POST', '/api/documents', {
      env: db.env,
      ...who,
      body: { id: 'd1', name: 'Doc', tabs: [{ id: 't1', name: 'Tab 1', elements: [] }], ...extra },
    }),
  );
}

const stored = () => storedPlacement(db);
const defaultsLeft = () =>
  db.sql.prepare('SELECT COUNT(*) AS n FROM placement_defaults').get() as { n: number };

beforeEach(async () => {
  db = sqliteD1();
  logs = [];
  const capture = (...args: unknown[]) => void logs.push(args.map(String).join(' '));
  vi.spyOn(console, 'info').mockImplementation(capture);
  vi.spyOn(console, 'warn').mockImplementation(capture);
  seedTeam(db, 't1', [{ userId: 'user_alice', status: 'joined' }]);
  seedFolder(db, 'diagrams', 'user_alice');
  seedFolder(db, 'picked', 'user_alice');
  seedFolder(db, 'team-sketches', 'user_alice', 't1');
  seedFolder(db, 'guest-sketches', 'guest-uuid');
  seedFolder(db, 'boards', 'user_alice');
  await setPlacementDefault(db.env, 'user_alice', 'mode:diagram', 'diagrams');
  await setPlacementDefault(db.env, 'user_alice', 'mode:draw', 'team-sketches');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /documents with default folders', () => {
  it('files a diagram in the diagram default when no place is sent', async () => {
    const res = await create(asUser('user_alice'), { intent: DIAGRAM });
    expect(res.status).toBe(201);
    expect(stored()).toEqual({ owner_id: 'user_alice', folder_id: 'diagrams', team_id: null });
    expect(logs).toContain(
      'placement: resolved scope=personal folder=set via=default key=mode:diagram',
    );
  });

  it('files a drawing in a team folder default, team_id in the same insert', async () => {
    const res = await create(asUser('user_alice'), { intent: DRAW });
    expect(res.status).toBe(201);
    expect(stored()).toEqual({ owner_id: 'user_alice', folder_id: 'team-sketches', team_id: 't1' });
    const body = (await res.json()) as { document: { teamId: string | null; folderId: string } };
    expect(body.document).toMatchObject({ teamId: 't1', folderId: 'team-sketches' });
    expect(logs).toContain('placement: resolved scope=team folder=set via=default key=mode:draw');
  });

  it('files a Kanban board in its board default before the mode default', async () => {
    await setPlacementDefault(db.env, 'user_alice', 'board:kanban', 'boards');
    const res = await create(asUser('user_alice'), { intent: KANBAN });
    expect(res.status).toBe(201);
    expect(stored()?.folder_id).toBe('boards');
    expect(logs).toContain(
      'placement: resolved scope=personal folder=set via=default key=board:kanban',
    );
  });

  it('files a Kanban board in the mode default when its board default dangles', async () => {
    await setPlacementDefault(db.env, 'user_alice', 'board:kanban', 'gone');
    const res = await create(asUser('user_alice'), { intent: KANBAN });
    expect(res.status).toBe(201);
    expect(stored()?.folder_id).toBe('diagrams');
    expect(logs).toContain('placement: default-skipped key=board:kanban reason=folder_missing');
    expect(logs).toContain(
      'placement: resolved scope=personal folder=set via=default key=mode:diagram',
    );
  });

  it('treats an explicit null placement at the root as no place', async () => {
    const res = await create(asUser('user_alice'), {
      teamId: null,
      folderId: null,
      intent: DIAGRAM,
    });
    expect(res.status).toBe(201);
    expect(stored()?.folder_id).toBe('diagrams');
  });

  it('files at the root when the create carries no intent', async () => {
    const res = await create(asUser('user_alice'), {});
    expect(res.status).toBe(201);
    expect(stored()).toEqual({ owner_id: 'user_alice', folder_id: null, team_id: null });
    expect(logs).toContain('placement: resolved scope=personal folder=root via=root');
  });

  it('lets an explicit folder win over the default', async () => {
    const res = await create(asUser('user_alice'), { folderId: 'picked', intent: DIAGRAM });
    expect(res.status).toBe(201);
    expect(stored()?.folder_id).toBe('picked');
    expect(logs).toContain('placement: resolved scope=personal folder=set via=explicit');
  });

  it("lets an explicit team's root win over the default", async () => {
    const res = await create(asUser('user_alice'), { teamId: 't1', intent: DIAGRAM });
    expect(res.status).toBe(201);
    expect(stored()).toEqual({ owner_id: 'user_alice', folder_id: null, team_id: 't1' });
  });

  it('skips a default whose folder was deleted, files at the root and keeps the default', async () => {
    db.sql.prepare("DELETE FROM folders WHERE id = 'diagrams'").run();
    const res = await create(asUser('user_alice'), { intent: DIAGRAM });
    expect(res.status).toBe(201);
    expect(stored()).toEqual({ owner_id: 'user_alice', folder_id: null, team_id: null });
    expect(logs).toContain('placement: default-skipped key=mode:diagram reason=folder_missing');
    expect(logs).toContain('placement: resolved scope=personal folder=root via=root');
    expect(defaultsLeft().n).toBe(2);
  });

  it('revives a default when its folder comes back under the same id', async () => {
    db.sql.prepare("DELETE FROM folders WHERE id = 'diagrams'").run();
    seedFolder(db, 'diagrams', 'user_alice');
    await create(asUser('user_alice'), { intent: DIAGRAM });
    expect(stored()?.folder_id).toBe('diagrams');
  });

  it('skips a default in a team the person has left', async () => {
    db.sql.prepare("DELETE FROM team_members WHERE user_id = 'user_alice'").run();
    const res = await create(asUser('user_alice'), { intent: DRAW });
    expect(res.status).toBe(201);
    expect(stored()).toEqual({ owner_id: 'user_alice', folder_id: null, team_id: null });
    expect(logs).toContain('placement: default-skipped key=mode:draw reason=team_not_joined');
  });

  it("files a guest in the guest's own default", async () => {
    await setPlacementDefault(db.env, 'guest-uuid', 'mode:draw', 'guest-sketches');
    const res = await create(asGuest('guest-uuid'), { intent: DRAW });
    expect(res.status).toBe(201);
    expect(stored()).toEqual({
      owner_id: 'guest-uuid',
      folder_id: 'guest-sketches',
      team_id: null,
    });
  });

  it.each([
    ['a string', 'mode:draw'],
    ['an unknown mode', { mode: 'pixel', kind: 'diagram' }],
    ['an unknown board type', { mode: 'draw', boardType: 'mindmap' }],
    ['a missing mode', { boardType: 'kanban' }],
  ])('refuses %s as an intent, writing nothing', async (_label, intent) => {
    const res = await create(asUser('user_alice'), { intent });
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe('intent_invalid');
    expect(stored()).toBeUndefined();
    expect(logs).toContain('placement: rejected reason=intent_invalid scope=personal');
  });

  it('keeps the stored place on a re-commit, whatever the intent', async () => {
    await create(asUser('user_alice'), { folderId: 'picked' });
    logs.length = 0;
    const res = await create(asUser('user_alice'), { intent: DIAGRAM });
    expect(res.status).toBe(201);
    expect(stored()?.folder_id).toBe('picked');
    expect(logs).toContain('placement: skipped reason=existing');
  });
});
