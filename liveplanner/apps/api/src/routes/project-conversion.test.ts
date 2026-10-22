import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PROJECT_CONVERSION_HEADER } from '@liveplanner/api-schema';
import { makeTestRouteContext } from './test-route-context';
import type { ProjectDTO } from '../types';

// Offline Mode conversions must be recorded as themselves (docs/specs/006-project/offline-mode.md + docs/specs/013-workspace/timeline.md).
//
// Both conversions reuse ordinary endpoints — "take offline" is a plain
// DELETE /projects/:id, "sync" a plain POST /projects — so the worker cannot
// tell them apart from a real delete or a real create unless the editor says
// so. It didn't, so the feed reported that a project the owner had just moved
// into this browser was DELETED (in danger red), and that one they had just
// uploaded was newly CREATED. `project_offline` / `project_synced` existed the
// whole time, with tones, icons, renderers and a docs/specs/013-workspace/timeline.md table row; nothing
// emitted them.
//
// The route test next door deliberately leaves `../timeline` unmocked and
// passes no `waitUntil`, so its emits never run. This file mocks the emitters
// and supplies one, which is the only way to see WHICH event fires.
const timeline = vi.hoisted(() => ({
  audienceForProject: vi.fn(async () => [] as unknown[]),
  recordProjectCreated: vi.fn(async () => {}),
  recordProjectDuplicated: vi.fn(async () => {}),
  recordProjectOffline: vi.fn(async () => {}),
  recordProjectSynced: vi.fn(async () => {}),
  recordVisitorCopied: vi.fn(async () => {}),
}));
vi.mock('../timeline', () => timeline);

const db = vi.hoisted(() => ({
  listProjectsByOwner: vi.fn(),
  getProject: vi.fn(),
  upsertProjectMeta: vi.fn(async () => {}),
  deleteProject: vi.fn(async () => {}),
  trashProject: vi.fn(async () => true),
  purgeProjects: vi.fn(async () => 1),
  getTrashedProjectMeta: vi.fn(async () => null),
  getFolder: vi.fn(),
  setProjectFolder: vi.fn(),
  getMembership: vi.fn(),
  getTab: vi.fn(),
  upsertTab: vi.fn(),
  getParticipant: vi.fn(),
  createShareLink: vi.fn(),
  generateShareCode: vi.fn(() => 'CODE2345'),
  getShareLinkIncludingExpired: vi.fn(),
  extendShareLink: vi.fn(),
  reorderTabs: vi.fn(),
  countProjectsByOwner: vi.fn(async () => 1),
  copyProject: vi.fn(),
  listSharedWith: vi.fn(),
  seedTabs: vi.fn(async () => {}),
}));
vi.mock('../db', () => db);
vi.mock('../db/timeline', () => ({ markTimelineEventsDeletedBySource: vi.fn(async () => {}) }));
vi.mock('../auth/project-access', () => ({
  canReadProject: vi.fn(async () => true),
  canEditProject: vi.fn(async () => true),
}));

import { markTimelineEventsDeletedBySource } from '../db/timeline';
import { handleProjects } from './projects';

const OWNER = 'owner-1';
// Minimal DTO, as projects.test.ts does it — only the authz + emit branches read it.
const liveDoc = {
  id: 'd1',
  ownerId: OWNER,
  teamId: null,
  name: 'Doc',
  tabs: [],
} as unknown as ProjectDTO;

// Owned by someone ELSE, filed in a team library. The DELETE is reachable here
// by any joined member (docs/specs/013-workspace/team-shared-projects.md), and the Explorer offers Take Offline on a
// team-library row without checking who owns it.
const teamProject = {
  id: 'd1',
  ownerId: 'alice',
  teamId: 'team-1',
  name: 'Doc',
  tabs: [],
} as unknown as ProjectDTO;

// `ctx.waitUntil?.()` skips its argument when absent, so the background emit
// only happens if we hand one over — and we await the promises it collects.
function ctxWith(method: string, path: string, opts: Record<string, unknown> = {}) {
  const pending: Promise<unknown>[] = [];
  return {
    ctx: makeTestRouteContext(method, path, {
      owner: OWNER,
      waitUntil: (p: Promise<unknown>) => void pending.push(p),
      ...opts,
    }),
    settle: () => Promise.allSettled(pending),
  };
}

const conversion = (value: string) => ({ headers: { [PROJECT_CONVERSION_HEADER]: value } });

beforeEach(() => {
  for (const fn of Object.values(timeline)) fn.mockClear();
  db.getProject.mockReset();
  db.deleteProject.mockClear();
  db.trashProject.mockClear();
  vi.mocked(markTimelineEventsDeletedBySource).mockClear();
});

describe('DELETE /projects/:id — take offline vs real delete', () => {
  it('records the project as taken offline when the conversion is declared', async () => {
    db.getProject.mockResolvedValue(liveDoc);
    const { ctx, settle } = ctxWith('DELETE', '/api/projects/d1', conversion('offline'));
    expect((await handleProjects(ctx)).status).toBe(204);
    await settle();
    expect(timeline.recordProjectOffline).toHaveBeenCalledTimes(1);
  });

  it('records nothing for a real delete: the project goes to the Trash', async () => {
    // docs/specs/013-workspace/trash.md: its history is hidden while it waits
    // (and comes back on restore), so nothing is swept and no card is added.
    db.getProject.mockResolvedValue(liveDoc);
    const { ctx, settle } = ctxWith('DELETE', '/api/projects/d1');
    expect((await handleProjects(ctx)).status).toBe(204);
    await settle();
    expect(db.trashProject).toHaveBeenCalledWith(expect.anything(), 'd1', expect.any(Number));
    expect(vi.mocked(markTimelineEventsDeletedBySource)).not.toHaveBeenCalled();
    expect(timeline.recordProjectOffline).not.toHaveBeenCalled();
  });

  it('ignores an unrecognised conversion value rather than trusting it', async () => {
    // The header is client-supplied, so anything outside the two known values
    // has to fall back to the truthful default.
    db.getProject.mockResolvedValue(liveDoc);
    const { ctx, settle } = ctxWith('DELETE', '/api/projects/d1', conversion('nonsense'));
    await handleProjects(ctx);
    await settle();
    expect(timeline.recordProjectOffline).not.toHaveBeenCalled();
  });

  it('removes the server row on Take Offline, bypassing the Trash', async () => {
    db.getProject.mockResolvedValue(liveDoc);
    const { ctx, settle } = ctxWith('DELETE', '/api/projects/d1', conversion('offline'));
    await handleProjects(ctx);
    await settle();
    // Taking a project offline really does remove the server copy — only the
    // event that describes it changes.
    expect(db.deleteProject).toHaveBeenCalled();
    expect(db.trashProject).not.toHaveBeenCalled();
  });
});

describe("a non-owner cannot convert someone else's project", () => {
  // Narrowing the audience to the actor is right when the OWNER takes their
  // own project offline. When a teammate does it the project lands in THEIR
  // browser and leaves the owner's account for good — that is a deletion from
  // everyone else's side, and a deletion records nothing (docs/specs/013-workspace/timeline.md §3.5), so
  // the teammate must not get an owner-scoped "Taken Offline" card either.
  beforeEach(() => {
    db.getProject.mockResolvedValue(teamProject);
    db.getMembership.mockResolvedValue({ status: 'joined' });
  });

  it('treats a joined teammates declared conversion as a plain delete, to the team Trash', async () => {
    const { ctx, settle } = ctxWith('DELETE', '/api/projects/d1', {
      owner: 'bob',
      accountUserId: 'bob',
      ...conversion('offline'),
    });
    expect((await handleProjects(ctx)).status).toBe(204);
    await settle();
    expect(timeline.recordProjectOffline).not.toHaveBeenCalled();
    expect(db.trashProject).toHaveBeenCalledWith(expect.anything(), 'd1', expect.any(Number));
    expect(db.deleteProject).not.toHaveBeenCalled();
  });

  it('still honours the conversion when the owner does it on a team project', async () => {
    // Ownership is what gates it, not the absence of a team.
    const { ctx, settle } = ctxWith('DELETE', '/api/projects/d1', {
      owner: 'alice',
      accountUserId: 'alice',
      ...conversion('offline'),
    });
    await handleProjects(ctx);
    await settle();
    expect(timeline.recordProjectOffline).toHaveBeenCalledTimes(1);
  });
});

describe('POST /projects — sync vs genuine create', () => {
  const body = { id: 'd1', name: 'Doc' };

  it('records a sync when the conversion is declared', async () => {
    db.getProject.mockResolvedValueOnce(null).mockResolvedValueOnce(liveDoc);
    const { ctx, settle } = ctxWith('POST', '/api/projects', { body, ...conversion('sync') });
    expect((await handleProjects(ctx)).status).toBe(201);
    await settle();
    expect(timeline.recordProjectSynced).toHaveBeenCalledTimes(1);
    expect(timeline.recordProjectCreated).not.toHaveBeenCalled();
  });

  it('still records a genuine create when nothing is declared', async () => {
    db.getProject.mockResolvedValueOnce(null).mockResolvedValueOnce(liveDoc);
    const { ctx, settle } = ctxWith('POST', '/api/projects', { body });
    await handleProjects(ctx);
    await settle();
    expect(timeline.recordProjectCreated).toHaveBeenCalledTimes(1);
    expect(timeline.recordProjectSynced).not.toHaveBeenCalled();
  });

  it('emits neither when the POST resolved to an existing row', async () => {
    // docs/specs/013-workspace/timeline.md §4.2: a re-commit of an id the caller already owns is not an
    // event at all, and declaring a conversion must not smuggle one in.
    db.getProject.mockResolvedValue(liveDoc);
    const { ctx, settle } = ctxWith('POST', '/api/projects', { body, ...conversion('sync') });
    await handleProjects(ctx);
    await settle();
    expect(timeline.recordProjectSynced).not.toHaveBeenCalled();
    expect(timeline.recordProjectCreated).not.toHaveBeenCalled();
  });
});
