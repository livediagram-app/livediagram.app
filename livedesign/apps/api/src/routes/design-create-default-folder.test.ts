import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { setPlacementDefault } from '../db';
import { makeTestRouteContext } from './test-route-context';
import { handleDesigns } from './designs';
import {
  asGuest,
  asUser,
  errorOf,
  seedFolder,
  seedTeam,
  storedPlacement,
} from './placement-test-support';

// Default folders on create against a real schema (docs/specs/013-workspace/default-folders.md): a
// create at the root of My Work with an intent lands in the person's default for it; an
// explicit place wins; a dangling default is skipped, logged, kept, and never fails the create.

let db: SqliteD1;
let logs: string[];

const PAGES = { mode: 'pages' };

function create(
  who: { owner: string; clerkUserId: string | null },
  extra: Record<string, unknown>,
) {
  return handleDesigns(
    makeTestRouteContext('POST', '/api/designs', {
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
  await setPlacementDefault(db.env, 'user_alice', 'mode:pages', 'diagrams');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /designs with default folders', () => {
  it('files a design in the Pages default when no place is sent', async () => {
    const res = await create(asUser('user_alice'), { intent: PAGES });
    expect(res.status).toBe(201);
    expect(stored()).toEqual({ owner_id: 'user_alice', folder_id: 'diagrams', team_id: null });
    expect(logs).toContain(
      'placement: resolved scope=personal folder=set via=default key=mode:pages',
    );
  });

  it('files into a team folder default, team_id in the same insert', async () => {
    await setPlacementDefault(db.env, 'user_alice', 'mode:pages', 'team-sketches');
    const res = await create(asUser('user_alice'), { intent: PAGES });
    expect(res.status).toBe(201);
    expect(stored()).toEqual({ owner_id: 'user_alice', folder_id: 'team-sketches', team_id: 't1' });
    const body = (await res.json()) as { design: { teamId: string | null; folderId: string } };
    expect(body.design).toMatchObject({ teamId: 't1', folderId: 'team-sketches' });
    expect(logs).toContain('placement: resolved scope=team folder=set via=default key=mode:pages');
  });

  it('lets an explicit root of My Work win over the default', async () => {
    const res = await create(asUser('user_alice'), { folderId: null, intent: PAGES });
    expect(res.status).toBe(201);
    expect(stored()).toEqual({ owner_id: 'user_alice', folder_id: null, team_id: null });
    expect(logs).toContain('placement: resolved scope=personal folder=root via=explicit');
  });

  it('reads a null team beside an explicit null folder as the explicit root', async () => {
    await create(asUser('user_alice'), { teamId: null, folderId: null, intent: PAGES });
    expect(stored()?.folder_id).toBeNull();
  });

  it('reads a null team alone as no choice, where the default answers', async () => {
    await create(asUser('user_alice'), { teamId: null, intent: PAGES });
    expect(stored()?.folder_id).toBe('diagrams');
  });

  it('files at the root when the create carries no intent', async () => {
    const res = await create(asUser('user_alice'), {});
    expect(res.status).toBe(201);
    expect(stored()).toEqual({ owner_id: 'user_alice', folder_id: null, team_id: null });
    expect(logs).toContain('placement: resolved scope=personal folder=root via=root');
  });

  it('lets an explicit folder win over the default', async () => {
    const res = await create(asUser('user_alice'), { folderId: 'picked', intent: PAGES });
    expect(res.status).toBe(201);
    expect(stored()?.folder_id).toBe('picked');
    expect(logs).toContain('placement: resolved scope=personal folder=set via=explicit');
  });

  it("lets an explicit team's root win over the default", async () => {
    const res = await create(asUser('user_alice'), { teamId: 't1', intent: PAGES });
    expect(res.status).toBe(201);
    expect(stored()).toEqual({ owner_id: 'user_alice', folder_id: null, team_id: 't1' });
  });

  it('skips a default whose folder was deleted, files at the root and keeps the default', async () => {
    db.sql.prepare("DELETE FROM folders WHERE id = 'diagrams'").run();
    const res = await create(asUser('user_alice'), { intent: PAGES });
    expect(res.status).toBe(201);
    expect(stored()).toEqual({ owner_id: 'user_alice', folder_id: null, team_id: null });
    expect(logs).toContain('placement: default-skipped key=mode:pages reason=folder_missing');
    expect(logs).toContain('placement: resolved scope=personal folder=root via=root');
    expect(defaultsLeft().n).toBe(1);
  });

  it('revives a default when its folder comes back under the same id', async () => {
    db.sql.prepare("DELETE FROM folders WHERE id = 'diagrams'").run();
    seedFolder(db, 'diagrams', 'user_alice');
    await create(asUser('user_alice'), { intent: PAGES });
    expect(stored()?.folder_id).toBe('diagrams');
  });

  it('skips a default in a team the person has left', async () => {
    await setPlacementDefault(db.env, 'user_alice', 'mode:pages', 'team-sketches');
    db.sql.prepare("DELETE FROM team_members WHERE user_id = 'user_alice'").run();
    const res = await create(asUser('user_alice'), { intent: PAGES });
    expect(res.status).toBe(201);
    expect(stored()).toEqual({ owner_id: 'user_alice', folder_id: null, team_id: null });
    expect(logs).toContain('placement: default-skipped key=mode:pages reason=team_not_joined');
  });

  it("files a guest in the guest's own default", async () => {
    await setPlacementDefault(db.env, 'guest-uuid', 'mode:pages', 'guest-sketches');
    const res = await create(asGuest('guest-uuid'), { intent: PAGES });
    expect(res.status).toBe(201);
    expect(stored()).toEqual({
      owner_id: 'guest-uuid',
      folder_id: 'guest-sketches',
      team_id: null,
    });
  });

  it.each([
    ['a string', 'mode:pages'],
    ['an unknown mode', { mode: 'pixel', kind: 'diagram' }],
    ['the legacy whiteboard kind', { mode: 'pages', tabKind: 'whiteboard' }],
    ['a missing mode', { tabKind: 'diagram' }],
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
    const res = await create(asUser('user_alice'), { intent: PAGES });
    expect(res.status).toBe(201);
    expect(stored()?.folder_id).toBe('picked');
    expect(logs).toContain('placement: skipped reason=existing');
  });
});
