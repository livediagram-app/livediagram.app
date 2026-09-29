import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestRouteContext } from './test-route-context';
import type { DocumentDTO } from '../types';

// Leaving a team library is its own event (docs/specs/013-workspace/team-shared-documents.md + docs/specs/013-workspace/timeline.md §4).
//
// It used to fall through to the `document_moved` arm, so pulling a diagram out
// of a shared library read "Moved to a Folder — Payments architecture →
// Unsorted", delivered to the MOVER only: `recordDocumentMoved` resolves its
// audience from the diagram, which by then is personal. And when the mover is
// not the owner, docs/specs/013-workspace/team-shared-documents.md hands them ownership — so the previous owner and the
// whole team could lose a diagram with nothing in either feed.
//
// The empty-folder case was worse. A diagram sitting at the team-library root
// already has `folderId === null`, so moving it to personal Unsorted left
// `folderId !== existing.folderId` false and NO event was written at all.
const timeline = vi.hoisted(() => ({
  audienceForDocument: vi.fn(async () => [{ scopeType: 'team', scopeId: 'team-1' }] as unknown[]),
  recordDocumentMoved: vi.fn(async () => {}),
  recordTeamDocumentAdded: vi.fn(async () => {}),
  recordTeamDocumentRemoved: vi.fn(async () => {}),
}));
vi.mock('../timeline', () => timeline);

const db = vi.hoisted(() => ({
  getDocument: vi.fn(),
  getFolder: vi.fn(),
  getMembership: vi.fn(async () => ({ status: 'joined' })),
  getParticipant: vi.fn(async () => ({ name: 'Bob' })),
  getTeam: vi.fn(async () => ({ id: 'team-1', name: 'Design' })),
  setDocumentFolder: vi.fn(async () => {}),
}));
vi.mock('../db', () => db);

import { handleDocumentPlacement } from './document-placement-route';

const inTeam = (over: Partial<DocumentDTO> = {}) =>
  ({
    id: 'd1',
    ownerId: 'alice',
    teamId: 'team-1',
    folderId: 'team-folder',
    name: 'Payments architecture',
    tabs: [],
    ...over,
  }) as unknown as DocumentDTO;

function ctxWith(body: unknown, owner = 'bob') {
  const pending: Promise<unknown>[] = [];
  return {
    ctx: makeTestRouteContext('PUT', '/api/documents/d1/folder', {
      owner,
      clerkUserId: owner,
      body,
      waitUntil: (p: Promise<unknown>) => void pending.push(p),
    }),
    settle: () => Promise.allSettled(pending),
  };
}

beforeEach(() => {
  for (const fn of Object.values(timeline)) fn.mockClear();
  db.getFolder.mockReset();
  db.getDocument.mockReset();
});

describe('PUT /documents/:id/folder — leaving a team library', () => {
  it('records the removal, not a folder move', async () => {
    const before = inTeam();
    db.getDocument
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(inTeam({ teamId: null, folderId: null, ownerId: 'bob' }));
    const { ctx, settle } = ctxWith({ folderId: null, teamId: null });
    expect((await handleDocumentPlacement(ctx))?.status).toBe(204);
    await settle();
    expect(timeline.recordTeamDocumentRemoved).toHaveBeenCalledTimes(1);
    expect(timeline.recordDocumentMoved).not.toHaveBeenCalled();
  });

  it('records it even when the diagram sat at the team-library root', async () => {
    // folderId null -> null, so the old `folderId !== existing.folderId` test
    // was false and nothing was recorded anywhere.
    db.getDocument
      .mockResolvedValueOnce(inTeam({ folderId: null }))
      .mockResolvedValueOnce(inTeam({ teamId: null, folderId: null, ownerId: 'bob' }));
    const { ctx, settle } = ctxWith({ folderId: null, teamId: null });
    await handleDocumentPlacement(ctx);
    await settle();
    expect(timeline.recordTeamDocumentRemoved).toHaveBeenCalledTimes(1);
  });

  it('resolves the audience from the OUTGOING team, before the move', async () => {
    // Resolved afterwards it would be the new personal owner alone, so the team
    // and the displaced owner would hear nothing.
    const before = inTeam();
    db.getDocument
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(inTeam({ teamId: null, folderId: null, ownerId: 'bob' }));
    const { ctx, settle } = ctxWith({ folderId: null, teamId: null });
    await handleDocumentPlacement(ctx);
    await settle();
    expect(timeline.audienceForDocument).toHaveBeenCalledWith(expect.anything(), before);
    expect(timeline.recordTeamDocumentRemoved).toHaveBeenCalledWith(
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
    db.getDocument
      .mockResolvedValueOnce(inTeam({ teamId: null, folderId: null }))
      .mockResolvedValueOnce(inTeam({ teamId: null, folderId: 'f2' }));
    const { ctx, settle } = ctxWith({ folderId: 'f2', teamId: null }, 'alice');
    await handleDocumentPlacement(ctx);
    await settle();
    expect(timeline.recordDocumentMoved).toHaveBeenCalledTimes(1);
    expect(timeline.recordTeamDocumentRemoved).not.toHaveBeenCalled();
  });

  it('still records publishing INTO a team', async () => {
    db.getDocument
      .mockResolvedValueOnce(inTeam({ teamId: null, folderId: null, ownerId: 'alice' }))
      .mockResolvedValueOnce(inTeam({ folderId: null }));
    const { ctx, settle } = ctxWith({ folderId: null, teamId: 'team-1' }, 'alice');
    await handleDocumentPlacement(ctx);
    await settle();
    expect(timeline.recordTeamDocumentAdded).toHaveBeenCalledTimes(1);
    expect(timeline.recordTeamDocumentRemoved).not.toHaveBeenCalled();
  });
});
