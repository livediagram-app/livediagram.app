import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestRouteContext } from './test-route-context';
import type { ProjectDTO } from '../types';

// Leaving a team library is its own event (docs/specs/013-workspace/team-shared-projects.md + docs/specs/013-workspace/timeline.md §4).
//
// It used to fall through to the `project_moved` arm, so pulling a project out
// of a shared library read "Moved to a Folder — Payments architecture →
// Unsorted", delivered to the MOVER only: `recordProjectMoved` resolves its
// audience from the project, which by then is personal. And when the mover is
// not the owner, docs/specs/013-workspace/team-shared-projects.md hands them ownership — so the previous owner and the
// whole team could lose a project with nothing in either feed.
//
// The empty-folder case was worse. A project sitting at the team-library root
// already has `folderId === null`, so moving it to personal Unsorted left
// `folderId !== existing.folderId` false and NO event was written at all.
const timeline = vi.hoisted(() => ({
  audienceForProject: vi.fn(async () => [{ scopeType: 'team', scopeId: 'team-1' }] as unknown[]),
  recordProjectMoved: vi.fn(async () => {}),
  recordTeamProjectAdded: vi.fn(async () => {}),
  recordTeamProjectRemoved: vi.fn(async () => {}),
}));
vi.mock('../timeline', () => timeline);

const db = vi.hoisted(() => ({
  getProject: vi.fn(),
  getFolder: vi.fn(),
  getMembership: vi.fn(async (..._args: unknown[]): Promise<{ status: string } | null> => ({
    status: 'joined',
  })),
  getParticipant: vi.fn(async () => ({ name: 'Bob' })),
  getTeam: vi.fn(async () => ({ id: 'team-1', name: 'Design' })),
  setProjectFolder: vi.fn(async () => true),
}));
vi.mock('../db', () => db);

import { handleProjectPlacement } from './project-placement-route';

const inTeam = (over: Partial<ProjectDTO> = {}) =>
  ({
    id: 'd1',
    ownerId: 'alice',
    teamId: 'team-1',
    folderId: 'team-folder',
    name: 'Payments architecture',
    tabs: [],
    ...over,
  }) as unknown as ProjectDTO;

function ctxWith(body: unknown, owner = 'bob') {
  const pending: Promise<unknown>[] = [];
  return {
    ctx: makeTestRouteContext('PUT', '/api/projects/d1/folder', {
      owner,
      accountUserId: owner,
      body,
      waitUntil: (p: Promise<unknown>) => void pending.push(p),
    }),
    settle: () => Promise.allSettled(pending),
  };
}

beforeEach(() => {
  for (const fn of Object.values(timeline)) fn.mockClear();
  db.getFolder.mockReset();
  db.getProject.mockReset();
});

describe('PUT /projects/:id/folder — leaving a team library', () => {
  it('records the removal, not a folder move', async () => {
    const before = inTeam();
    db.getProject
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(inTeam({ teamId: null, folderId: null, ownerId: 'bob' }));
    const { ctx, settle } = ctxWith({ folderId: null, teamId: null });
    expect((await handleProjectPlacement(ctx))?.status).toBe(204);
    await settle();
    expect(timeline.recordTeamProjectRemoved).toHaveBeenCalledTimes(1);
    expect(timeline.recordProjectMoved).not.toHaveBeenCalled();
  });

  it('records it even when the project sat at the team-library root', async () => {
    // folderId null -> null, so the old `folderId !== existing.folderId` test
    // was false and nothing was recorded anywhere.
    db.getProject
      .mockResolvedValueOnce(inTeam({ folderId: null }))
      .mockResolvedValueOnce(inTeam({ teamId: null, folderId: null, ownerId: 'bob' }));
    const { ctx, settle } = ctxWith({ folderId: null, teamId: null });
    await handleProjectPlacement(ctx);
    await settle();
    expect(timeline.recordTeamProjectRemoved).toHaveBeenCalledTimes(1);
  });

  it('resolves the audience from the OUTGOING team, before the move', async () => {
    // Resolved afterwards it would be the new personal owner alone, so the team
    // and the displaced owner would hear nothing.
    const before = inTeam();
    db.getProject
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(inTeam({ teamId: null, folderId: null, ownerId: 'bob' }));
    const { ctx, settle } = ctxWith({ folderId: null, teamId: null });
    await handleProjectPlacement(ctx);
    await settle();
    expect(timeline.audienceForProject).toHaveBeenCalledWith(expect.anything(), before);
    expect(timeline.recordTeamProjectRemoved).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'd1' }),
      'Design',
      'bob',
      [{ scopeType: 'team', scopeId: 'team-1' }],
      // Who holds it now — the part a reader of the team's copy needs.
      'Bob',
    );
  });

  it('still records a plain folder move inside personal files', async () => {
    db.getFolder.mockResolvedValue({ id: 'f2', name: 'Archive', teamId: null, ownerId: 'alice' });
    db.getProject
      .mockResolvedValueOnce(inTeam({ teamId: null, folderId: null }))
      .mockResolvedValueOnce(inTeam({ teamId: null, folderId: 'f2' }));
    const { ctx, settle } = ctxWith({ folderId: 'f2', teamId: null }, 'alice');
    await handleProjectPlacement(ctx);
    await settle();
    expect(timeline.recordProjectMoved).toHaveBeenCalledTimes(1);
    expect(timeline.recordTeamProjectRemoved).not.toHaveBeenCalled();
  });

  it('still records publishing INTO a team', async () => {
    db.getProject
      .mockResolvedValueOnce(inTeam({ teamId: null, folderId: null, ownerId: 'alice' }))
      .mockResolvedValueOnce(inTeam({ folderId: null }));
    const { ctx, settle } = ctxWith({ folderId: null, teamId: 'team-1' }, 'alice');
    await handleProjectPlacement(ctx);
    await settle();
    expect(timeline.recordTeamProjectAdded).toHaveBeenCalledTimes(1);
    expect(timeline.recordTeamProjectRemoved).not.toHaveBeenCalled();
  });
});

// A space's root is no bucket of its own (docs/specs/013-workspace/folders.md#the-root-and-the-retired-buckets):
// a move to it names the space, never Unsorted.
describe('PUT /projects/:id/folder — moving to a root', () => {
  it('names My Projects for the personal root', async () => {
    db.getProject
      .mockResolvedValueOnce(inTeam({ teamId: null, folderId: 'f2' }))
      .mockResolvedValueOnce(inTeam({ teamId: null, folderId: null }));
    const { ctx, settle } = ctxWith({ folderId: null, teamId: null }, 'alice');
    await handleProjectPlacement(ctx);
    await settle();
    expect(timeline.recordProjectMoved).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'd1' }),
      'My Projects',
      'alice',
    );
  });

  it('names the team for a team library root', async () => {
    db.getProject
      .mockResolvedValueOnce(inTeam({ folderId: 'team-folder' }))
      .mockResolvedValueOnce(inTeam({ folderId: null }));
    const { ctx, settle } = ctxWith({ folderId: null, teamId: 'team-1' }, 'alice');
    await handleProjectPlacement(ctx);
    await settle();
    expect(timeline.recordProjectMoved).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'd1' }),
      'Design',
      'alice',
    );
  });
});

// The folder is re-checked inside the placement write: one deleted after the route's own read files
// nothing, and the caller hears 404 rather than a project filed under a folder that is gone.
describe('placement into a folder deleted meanwhile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('404s when the write finds the folder gone, and records nothing', async () => {
    db.getProject.mockResolvedValue(inTeam());
    db.getFolder.mockResolvedValue({ id: 'f2', teamId: 'team-1', ownerId: 'alice' });
    db.setProjectFolder.mockResolvedValueOnce(false);
    const { ctx, settle } = ctxWith({ folderId: 'f2', teamId: 'team-1' });
    const res = await handleProjectPlacement(ctx);
    await settle();
    expect(res?.status).toBe(404);
    expect(timeline.recordProjectMoved).not.toHaveBeenCalled();
  });
});

describe('PUT /projects/:id/folder — a malformed body', () => {
  beforeEach(() => vi.clearAllMocks());

  it('400s a folderId or teamId that is not a string or null, and writes nothing', async () => {
    db.getProject.mockResolvedValue(inTeam());
    for (const body of [{ folderId: { a: 1 } }, { folderId: 'f2', teamId: [] }, { teamId: 4 }]) {
      const { ctx } = ctxWith(body);
      expect((await handleProjectPlacement(ctx))?.status).toBe(400);
    }
    expect(db.setProjectFolder).not.toHaveBeenCalled();
  });
});

// docs/specs/013-workspace/team-shared-projects.md: a team project moved to another team never stays owned by
// someone outside it, so the mover takes ownership when the owner isn't a joined member of the destination.
describe('PUT /projects/:id/folder — between teams', () => {
  const joinedIn =
    (pairs: string[]) =>
    async (...args: unknown[]) =>
      pairs.includes(`${String(args[1])}:${String(args[2])}`) ? { status: 'joined' } : null;

  afterEach(() => db.getMembership.mockImplementation(async () => ({ status: 'joined' })));

  it("hands ownership to the mover when the owner isn't in the destination team", async () => {
    db.getMembership.mockImplementation(joinedIn(['team-1:bob', 'team-2:bob', 'team-1:alice']));
    db.getProject.mockResolvedValue(inTeam({ folderId: null }));
    db.setProjectFolder.mockClear();
    const { ctx, settle } = ctxWith({ folderId: null, teamId: 'team-2' });
    const res = await handleProjectPlacement(ctx);
    await settle();
    expect(res?.ok).toBe(true);
    expect(db.setProjectFolder).toHaveBeenCalledWith(
      expect.anything(),
      'd1',
      null,
      'team-2',
      'bob',
    );
  });

  it('keeps the owner when they are in the destination team too', async () => {
    db.getMembership.mockImplementation(
      joinedIn(['team-1:bob', 'team-2:bob', 'team-1:alice', 'team-2:alice']),
    );
    db.getProject.mockResolvedValue(inTeam({ folderId: null }));
    db.setProjectFolder.mockClear();
    const { ctx, settle } = ctxWith({ folderId: null, teamId: 'team-2' });
    await handleProjectPlacement(ctx);
    await settle();
    expect(db.setProjectFolder).toHaveBeenCalledWith(
      expect.anything(),
      'd1',
      null,
      'team-2',
      undefined,
    );
  });
});
