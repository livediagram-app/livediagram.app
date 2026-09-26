import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DIAGRAM_CONVERSION_HEADER } from '@livediagram/api-schema';
import { makeTestRouteContext } from './test-route-context';
import type { DiagramDTO } from '../types';

// Offline Mode conversions must be recorded as themselves (docs/specs/006-diagram/offline-mode.md + docs/specs/013-workspace/timeline.md).
//
// Both conversions reuse ordinary endpoints — "take offline" is a plain
// DELETE /diagrams/:id, "sync" a plain POST /diagrams — so the worker cannot
// tell them apart from a real delete or a real create unless the editor says
// so. It didn't, so the feed reported that a diagram the owner had just moved
// into this browser was DELETED (in danger red), and that one they had just
// uploaded was newly CREATED. `diagram_offline` / `diagram_synced` existed the
// whole time, with tones, icons, renderers and a docs/specs/013-workspace/timeline.md table row; nothing
// emitted them.
//
// The route test next door deliberately leaves `../timeline` unmocked and
// passes no `waitUntil`, so its emits never run. This file mocks the emitters
// and supplies one, which is the only way to see WHICH event fires.
const timeline = vi.hoisted(() => ({
  audienceForDiagram: vi.fn(async () => [] as unknown[]),
  recordDiagramCreated: vi.fn(async () => {}),
  recordDiagramDuplicated: vi.fn(async () => {}),
  recordDiagramOffline: vi.fn(async () => {}),
  recordDiagramRenamed: vi.fn(async () => {}),
  recordDiagramSynced: vi.fn(async () => {}),
  recordVisitorCopied: vi.fn(async () => {}),
}));
vi.mock('../timeline', () => timeline);

const db = vi.hoisted(() => ({
  listDiagramsByOwner: vi.fn(),
  getDiagram: vi.fn(),
  upsertDiagramMeta: vi.fn(async () => {}),
  deleteDiagram: vi.fn(async () => {}),
  getFolder: vi.fn(),
  setDiagramFolder: vi.fn(),
  getMembership: vi.fn(),
  getTab: vi.fn(),
  upsertTab: vi.fn(),
  getParticipant: vi.fn(),
  listChangeLog: vi.fn(),
  insertChangeLogEntry: vi.fn(),
  createShareLink: vi.fn(),
  generateShareCode: vi.fn(() => 'CODE2345'),
  getShareLinkIncludingExpired: vi.fn(),
  extendShareLink: vi.fn(),
  setDiagramPresentation: vi.fn(),
  reorderTabs: vi.fn(),
  countDiagramsByOwner: vi.fn(async () => 1),
  copyDiagram: vi.fn(),
  listSharedWith: vi.fn(),
  seedTabs: vi.fn(async () => {}),
}));
vi.mock('../db', () => db);
vi.mock('../db/timeline', () => ({ markTimelineEventsDeletedBySource: vi.fn(async () => {}) }));
vi.mock('../auth/diagram-access', () => ({
  canReadDiagram: vi.fn(async () => true),
  canEditDiagram: vi.fn(async () => true),
}));

import { markTimelineEventsDeletedBySource } from '../db/timeline';
import { handleDiagrams } from './diagrams';

const OWNER = 'owner-1';
// Minimal DTO, as diagrams.test.ts does it — only the authz + emit branches read it.
const diagram = {
  id: 'd1',
  ownerId: OWNER,
  teamId: null,
  name: 'Doc',
  tabs: [],
} as unknown as DiagramDTO;

// Owned by someone ELSE, filed in a team library. The DELETE is reachable here
// by any joined member (docs/specs/013-workspace/team-shared-diagrams.md), and the Explorer offers Take Offline on a
// team-library row without checking who owns it.
const teamDiagram = {
  id: 'd1',
  ownerId: 'alice',
  teamId: 'team-1',
  name: 'Doc',
  tabs: [],
} as unknown as DiagramDTO;

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

const conversion = (value: string) => ({ headers: { [DIAGRAM_CONVERSION_HEADER]: value } });

beforeEach(() => {
  for (const fn of Object.values(timeline)) fn.mockClear();
  db.getDiagram.mockReset();
  db.deleteDiagram.mockClear();
});

describe('DELETE /diagrams/:id — take offline vs real delete', () => {
  it('records the diagram as taken offline when the conversion is declared', async () => {
    db.getDiagram.mockResolvedValue(diagram);
    const { ctx, settle } = ctxWith('DELETE', '/api/diagrams/d1', conversion('offline'));
    expect((await handleDiagrams(ctx)).status).toBe(204);
    await settle();
    expect(timeline.recordDiagramOffline).toHaveBeenCalledTimes(1);
  });

  it('records nothing for a real delete: the diagram leaves no card behind', async () => {
    // docs/specs/013-workspace/timeline.md §3.5: the history is swept and no tombstone follows. From the
    // feed's point of view the diagram never existed.
    db.getDiagram.mockResolvedValue(diagram);
    const { ctx, settle } = ctxWith('DELETE', '/api/diagrams/d1');
    expect((await handleDiagrams(ctx)).status).toBe(204);
    await settle();
    expect(vi.mocked(markTimelineEventsDeletedBySource)).toHaveBeenCalledWith(
      expect.anything(),
      'diagram',
      'd1',
    );
    expect(timeline.recordDiagramOffline).not.toHaveBeenCalled();
  });

  it('ignores an unrecognised conversion value rather than trusting it', async () => {
    // The header is client-supplied, so anything outside the two known values
    // has to fall back to the truthful default.
    db.getDiagram.mockResolvedValue(diagram);
    const { ctx, settle } = ctxWith('DELETE', '/api/diagrams/d1', conversion('nonsense'));
    await handleDiagrams(ctx);
    await settle();
    expect(timeline.recordDiagramOffline).not.toHaveBeenCalled();
  });

  it('deletes the server row either way', async () => {
    db.getDiagram.mockResolvedValue(diagram);
    const { ctx, settle } = ctxWith('DELETE', '/api/diagrams/d1', conversion('offline'));
    await handleDiagrams(ctx);
    await settle();
    // Taking a diagram offline really does remove the server copy — only the
    // event that describes it changes.
    expect(db.deleteDiagram).toHaveBeenCalled();
  });
});

describe("a non-owner cannot convert someone else's diagram", () => {
  // Narrowing the audience to the actor is right when the OWNER takes their
  // own diagram offline. When a teammate does it the diagram lands in THEIR
  // browser and leaves the owner's account for good — that is a deletion from
  // everyone else's side, and a deletion records nothing (docs/specs/013-workspace/timeline.md §3.5), so
  // the teammate must not get an owner-scoped "Taken Offline" card either.
  beforeEach(() => {
    db.getDiagram.mockResolvedValue(teamDiagram);
    db.getMembership.mockResolvedValue({ status: 'joined' });
  });

  it('treats a joined teammates declared conversion as a plain delete', async () => {
    const { ctx, settle } = ctxWith('DELETE', '/api/diagrams/d1', {
      owner: 'bob',
      clerkUserId: 'bob',
      ...conversion('offline'),
    });
    expect((await handleDiagrams(ctx)).status).toBe(204);
    await settle();
    expect(timeline.recordDiagramOffline).not.toHaveBeenCalled();
    expect(vi.mocked(markTimelineEventsDeletedBySource)).toHaveBeenCalledWith(
      expect.anything(),
      'diagram',
      'd1',
    );
  });

  it('still honours the conversion when the owner does it on a team diagram', async () => {
    // Ownership is what gates it, not the absence of a team.
    const { ctx, settle } = ctxWith('DELETE', '/api/diagrams/d1', {
      owner: 'alice',
      clerkUserId: 'alice',
      ...conversion('offline'),
    });
    await handleDiagrams(ctx);
    await settle();
    expect(timeline.recordDiagramOffline).toHaveBeenCalledTimes(1);
  });
});

describe('POST /diagrams — sync vs genuine create', () => {
  const body = { id: 'd1', name: 'Doc' };

  it('records a sync when the conversion is declared', async () => {
    db.getDiagram.mockResolvedValueOnce(null).mockResolvedValueOnce(diagram);
    const { ctx, settle } = ctxWith('POST', '/api/diagrams', { body, ...conversion('sync') });
    expect((await handleDiagrams(ctx)).status).toBe(201);
    await settle();
    expect(timeline.recordDiagramSynced).toHaveBeenCalledTimes(1);
    expect(timeline.recordDiagramCreated).not.toHaveBeenCalled();
  });

  it('still records a genuine create when nothing is declared', async () => {
    db.getDiagram.mockResolvedValueOnce(null).mockResolvedValueOnce(diagram);
    const { ctx, settle } = ctxWith('POST', '/api/diagrams', { body });
    await handleDiagrams(ctx);
    await settle();
    expect(timeline.recordDiagramCreated).toHaveBeenCalledTimes(1);
    expect(timeline.recordDiagramSynced).not.toHaveBeenCalled();
  });

  it('emits neither when the POST resolved to an existing row', async () => {
    // docs/specs/013-workspace/timeline.md §4.2: a re-commit of an id the caller already owns is not an
    // event at all, and declaring a conversion must not smuggle one in.
    db.getDiagram.mockResolvedValue(diagram);
    const { ctx, settle } = ctxWith('POST', '/api/diagrams', { body, ...conversion('sync') });
    await handleDiagrams(ctx);
    await settle();
    expect(timeline.recordDiagramSynced).not.toHaveBeenCalled();
    expect(timeline.recordDiagramCreated).not.toHaveBeenCalled();
  });
});
