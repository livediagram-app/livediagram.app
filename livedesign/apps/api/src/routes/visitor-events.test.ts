import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestRouteContext } from './test-route-context';
import type { DesignDTO } from '../types';

// A "visitor" is somebody who arrived through a SHARE LINK (docs/specs/013-workspace/timeline.md §4.3).
//
// Both visitor-facing events keyed on `owner !== diagram.ownerId`, which is not
// that. The read gate also admits any joined member of the design's team
// (docs/specs/013-workspace/team-shared-designs.md), and a teammate presents no share code — so browsing your own
// team's library told the design's owner "opened by a visitor · Someone with
// the share link", filed under the sharing filter, for a design they had never
// shared a link for. Once per teammate per day, so up to eleven false bubbles a
// day per design in a twelve-person library. Duplicating one reported
// "copied by a visitor", which is flatly untrue.
//
// The honest test is whether a share code was presented at all.
const timeline = vi.hoisted(() => ({
  audienceForDesign: vi.fn(async () => [] as unknown[]),
  recordDesignCreated: vi.fn(async () => {}),
  recordDesignDuplicated: vi.fn(async () => {}),
  recordDesignOffline: vi.fn(async () => {}),
  recordDesignSynced: vi.fn(async () => {}),
  recordVisitorCopied: vi.fn(async () => {}),
  recordVisitorOpened: vi.fn(async () => {}),
  recordTabSave: vi.fn(async () => {}),
  recordCommentAdded: vi.fn(async () => {}),
}));
vi.mock('../timeline', () => timeline);

const db = vi.hoisted(() => ({
  getDesign: vi.fn(),
  getTab: vi.fn(),
  getParticipant: vi.fn(async () => null),
  getMembership: vi.fn(),
  copyDesign: vi.fn(),
  listSharedWith: vi.fn(async () => [] as unknown[]),
  upsertTab: vi.fn(async () => {}),
  deleteTabRow: vi.fn(),
  designsContainingTab: vi.fn(),
  linkTabToDesign: vi.fn(),
  tabLinkedToOwnedDesign: vi.fn(),
  getShareLink: vi.fn(async () => null),
}));
vi.mock('../db', () => db);
vi.mock('../db/timeline', () => ({ markTimelineEventsDeletedBySource: vi.fn(async () => {}) }));

const access = vi.hoisted(() => ({
  canReadDesign: vi.fn(async () => true),
  canEditDesign: vi.fn(async () => true),
  resolveDesignGrant: vi.fn(async () => ({ role: 'edit' as const, tabScope: null })),
}));
vi.mock('../auth/design-access', () => access);

import { handleDesignSubresources } from './design-subresource-routes';
import { handleDesigns } from './designs';

const TEAM_DESIGN = {
  id: 'd1',
  ownerId: 'alice',
  teamId: 'team-1',
  name: 'Payments architecture',
  tabs: [],
} as unknown as DesignDTO;

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
  db.getDesign.mockResolvedValue(TEAM_DESIGN);
  db.getTab.mockResolvedValue({ id: 't1', name: 'Tab', orderIndex: 0, elements: [] });
});

describe('GET /designs/:id/tabs/:tabId — who counts as a visitor', () => {
  const path = '/api/designs/d1/tabs/t1';

  it('records nothing for a joined teammate reading a team design', async () => {
    const { ctx, settle } = ctxWith('GET', path, { owner: 'bob', accountUserId: 'bob' });
    expect((await handleDesignSubresources(ctx))?.status).toBe(200);
    await settle();
    expect(timeline.recordVisitorOpened).not.toHaveBeenCalled();
  });

  it('records the open when a share code was presented', async () => {
    const { ctx, settle } = ctxWith('GET', path, { owner: 'stranger', ...SHARE });
    expect((await handleDesignSubresources(ctx))?.status).toBe(200);
    await settle();
    expect(timeline.recordVisitorOpened).toHaveBeenCalledTimes(1);
  });

  it('records nothing when the owner opens their own design, code or not', async () => {
    // The owner following their own share URL is not a visit.
    for (const extra of [{}, SHARE]) {
      timeline.recordVisitorOpened.mockClear();
      const { ctx, settle } = ctxWith('GET', path, { owner: 'alice', ...extra });
      await handleDesignSubresources(ctx);
      await settle();
      expect(timeline.recordVisitorOpened).not.toHaveBeenCalled();
    }
  });
});

describe('POST /designs/:id/copy — who counts as a visitor', () => {
  const path = '/api/designs/d1/copy';

  beforeEach(() => {
    db.copyDesign.mockResolvedValue({ ...TEAM_DESIGN, id: 'd2', ownerId: 'bob' });
  });

  it('records no visitor copy when a joined teammate duplicates a team design', async () => {
    const { ctx, settle } = ctxWith('POST', path, { owner: 'bob', accountUserId: 'bob', body: {} });
    await handleDesigns(ctx);
    await settle();
    expect(timeline.recordVisitorCopied).not.toHaveBeenCalled();
    // Their own "Diagram Duplicated" event is unaffected — they did copy it.
    expect(timeline.recordDesignDuplicated).toHaveBeenCalledTimes(1);
  });

  it('records a visitor copy when a share-code holder forks it', async () => {
    const { ctx, settle } = ctxWith('POST', path, { owner: 'stranger', body: {}, ...SHARE });
    await handleDesigns(ctx);
    await settle();
    expect(timeline.recordVisitorCopied).toHaveBeenCalledTimes(1);
  });
});
