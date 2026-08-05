import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestRouteContext } from './test-route-context';
import type { DiagramDTO } from '../types';

// A "visitor" is somebody who arrived through a SHARE LINK (spec/138 §4.3).
//
// Both visitor-facing events keyed on `owner !== diagram.ownerId`, which is not
// that. The read gate also admits any joined member of the diagram's team
// (spec/35), and a teammate presents no share code — so browsing your own
// team's library told the diagram's owner "opened by a visitor · Someone with
// the share link", filed under the sharing filter, for a diagram they had never
// shared a link for. Once per teammate per day, so up to eleven false bubbles a
// day per diagram in a twelve-person library. Duplicating one reported
// "copied by a visitor", which is flatly untrue.
//
// The honest test is whether a share code was presented at all.
const timeline = vi.hoisted(() => ({
  audienceForDiagram: vi.fn(async () => [] as unknown[]),
  recordDiagramCreated: vi.fn(async () => {}),
  recordDiagramDeleted: vi.fn(async () => {}),
  recordDiagramDuplicated: vi.fn(async () => {}),
  recordDiagramOffline: vi.fn(async () => {}),
  recordDiagramRenamed: vi.fn(async () => {}),
  recordDiagramSynced: vi.fn(async () => {}),
  recordVisitorCopied: vi.fn(async () => {}),
  recordVisitorOpened: vi.fn(async () => {}),
  recordTabSave: vi.fn(async () => {}),
  recordCommentAdded: vi.fn(async () => {}),
}));
vi.mock('../timeline', () => timeline);

const db = vi.hoisted(() => ({
  getDiagram: vi.fn(),
  getTab: vi.fn(),
  getParticipant: vi.fn(async () => null),
  getMembership: vi.fn(),
  copyDiagram: vi.fn(),
  listSharedWith: vi.fn(async () => [] as unknown[]),
  upsertTab: vi.fn(async () => {}),
  deleteTabRow: vi.fn(),
  diagramsContainingTab: vi.fn(),
  linkTabToDiagram: vi.fn(),
  tabLinkedToOwnedDiagram: vi.fn(),
}));
vi.mock('../db', () => db);
vi.mock('../db/timeline', () => ({ markTimelineEventsDeletedBySource: vi.fn(async () => {}) }));

const access = vi.hoisted(() => ({
  canReadDiagram: vi.fn(async () => true),
  canEditDiagram: vi.fn(async () => true),
}));
vi.mock('../auth/diagram-access', () => access);

import { handleDiagramSubresources } from './diagram-subresource-routes';
import { handleDiagrams } from './diagrams';

const TEAM_DIAGRAM = {
  id: 'd1',
  ownerId: 'alice',
  teamId: 'team-1',
  name: 'Payments architecture',
  tabs: [],
} as unknown as DiagramDTO;

const SHARE = { headers: { 'X-Share-Code': 'CODE2345' } };

function ctxWith(method: string, path: string, opts: Record<string, unknown> = {}) {
  const pending: Promise<unknown>[] = [];
  return {
    ctx: makeTestRouteContext(method, path, {
      waitUntil: (p: Promise<unknown>) => void pending.push(p),
      ...opts,
    }),
    settle: () => Promise.allSettled(pending),
  };
}

beforeEach(() => {
  for (const fn of Object.values(timeline)) fn.mockClear();
  db.getDiagram.mockResolvedValue(TEAM_DIAGRAM);
  db.getTab.mockResolvedValue({ id: 't1', name: 'Tab', orderIndex: 0, elements: [] });
});

describe('GET /diagrams/:id/tabs/:tabId — who counts as a visitor', () => {
  const path = '/api/diagrams/d1/tabs/t1';

  it('records nothing for a joined teammate reading a team diagram', async () => {
    const { ctx, settle } = ctxWith('GET', path, { owner: 'bob', clerkUserId: 'bob' });
    expect((await handleDiagramSubresources(ctx))?.status).toBe(200);
    await settle();
    expect(timeline.recordVisitorOpened).not.toHaveBeenCalled();
  });

  it('records the open when a share code was presented', async () => {
    const { ctx, settle } = ctxWith('GET', path, { owner: 'stranger', ...SHARE });
    expect((await handleDiagramSubresources(ctx))?.status).toBe(200);
    await settle();
    expect(timeline.recordVisitorOpened).toHaveBeenCalledTimes(1);
  });

  it('records nothing when the owner opens their own diagram, code or not', async () => {
    // The owner following their own share URL is not a visit.
    for (const extra of [{}, SHARE]) {
      timeline.recordVisitorOpened.mockClear();
      const { ctx, settle } = ctxWith('GET', path, { owner: 'alice', ...extra });
      await handleDiagramSubresources(ctx);
      await settle();
      expect(timeline.recordVisitorOpened).not.toHaveBeenCalled();
    }
  });
});

describe('POST /diagrams/:id/copy — who counts as a visitor', () => {
  const path = '/api/diagrams/d1/copy';

  beforeEach(() => {
    db.copyDiagram.mockResolvedValue({ ...TEAM_DIAGRAM, id: 'd2', ownerId: 'bob' });
  });

  it('records no visitor copy when a joined teammate duplicates a team diagram', async () => {
    const { ctx, settle } = ctxWith('POST', path, { owner: 'bob', clerkUserId: 'bob', body: {} });
    await handleDiagrams(ctx);
    await settle();
    expect(timeline.recordVisitorCopied).not.toHaveBeenCalled();
    // Their own "Diagram Duplicated" event is unaffected — they did copy it.
    expect(timeline.recordDiagramDuplicated).toHaveBeenCalledTimes(1);
  });

  it('records a visitor copy when a share-code holder forks it', async () => {
    const { ctx, settle } = ctxWith('POST', path, { owner: 'stranger', body: {}, ...SHARE });
    await handleDiagrams(ctx);
    await settle();
    expect(timeline.recordVisitorCopied).toHaveBeenCalledTimes(1);
  });
});
