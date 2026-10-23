import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_CONVERSION_HEADER } from '@livedesign/api-schema';
import { makeTestRouteContext } from './test-route-context';
import type { DesignDTO } from '../types';

// Offline Mode conversions must be recorded as themselves (docs/specs/006-design/offline-mode.md + docs/specs/013-workspace/timeline.md).
//
// Both conversions reuse ordinary endpoints — "take offline" is a plain
// DELETE /designs/:id, "sync" a plain POST /designs — so the worker cannot
// tell them apart from a real delete or a real create unless the editor says
// so. It didn't, so the feed reported that a design the owner had just moved
// into this browser was DELETED (in danger red), and that one they had just
// uploaded was newly CREATED. `design_offline` / `design_synced` existed the
// whole time, with tones, icons, renderers and a docs/specs/013-workspace/timeline.md table row; nothing
// emitted them.
//
// The route test next door deliberately leaves `../timeline` unmocked and
// passes no `waitUntil`, so its emits never run. This file mocks the emitters
// and supplies one, which is the only way to see WHICH event fires.
const timeline = vi.hoisted(() => ({
  audienceForDesign: vi.fn(async () => [] as unknown[]),
  recordDesignCreated: vi.fn(async () => {}),
  recordDesignDuplicated: vi.fn(async () => {}),
  recordDesignOffline: vi.fn(async () => {}),
  recordDesignSynced: vi.fn(async () => {}),
  recordVisitorCopied: vi.fn(async () => {}),
}));
vi.mock('../timeline', () => timeline);

const db = vi.hoisted(() => ({
  listDesignsByOwner: vi.fn(),
  getDesign: vi.fn(),
  upsertDesignMeta: vi.fn(async () => {}),
  deleteDesign: vi.fn(async () => {}),
  trashDesign: vi.fn(async () => true),
  purgeDesigns: vi.fn(async () => 1),
  getTrashedDesignMeta: vi.fn(async () => null),
  getFolder: vi.fn(),
  setDesignFolder: vi.fn(),
  getMembership: vi.fn(),
  getTab: vi.fn(),
  upsertTab: vi.fn(),
  getParticipant: vi.fn(),
  createShareLink: vi.fn(),
  generateShareCode: vi.fn(() => 'CODE2345'),
  getShareLinkIncludingExpired: vi.fn(),
  extendShareLink: vi.fn(),
  setDesignPresentation: vi.fn(),
  reorderTabs: vi.fn(),
  countDesignsByOwner: vi.fn(async () => 1),
  copyDesign: vi.fn(),
  listSharedWith: vi.fn(),
  seedTabs: vi.fn(async () => {}),
}));
vi.mock('../db', () => db);
vi.mock('../db/timeline', () => ({ markTimelineEventsDeletedBySource: vi.fn(async () => {}) }));
vi.mock('../auth/design-access', () => ({
  canReadDesign: vi.fn(async () => true),
  canEditDesign: vi.fn(async () => true),
}));

import { markTimelineEventsDeletedBySource } from '../db/timeline';
import { handleDesigns } from './designs';

const OWNER = 'owner-1';
// Minimal DTO, as designs.test.ts does it — only the authz + emit branches read it.
const liveDoc = {
  id: 'd1',
  ownerId: OWNER,
  teamId: null,
  name: 'Doc',
  tabs: [],
} as unknown as DesignDTO;

// Owned by someone ELSE, filed in a team library. The DELETE is reachable here
// by any joined member (docs/specs/013-workspace/team-shared-designs.md), and the Explorer offers Take Offline on a
// team-library row without checking who owns it.
const teamDesign = {
  id: 'd1',
  ownerId: 'alice',
  teamId: 'team-1',
  name: 'Doc',
  tabs: [],
} as unknown as DesignDTO;

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

const conversion = (value: string) => ({ headers: { [DESIGN_CONVERSION_HEADER]: value } });

beforeEach(() => {
  for (const fn of Object.values(timeline)) fn.mockClear();
  db.getDesign.mockReset();
  db.deleteDesign.mockClear();
  db.trashDesign.mockClear();
  vi.mocked(markTimelineEventsDeletedBySource).mockClear();
});

describe('DELETE /designs/:id — take offline vs real delete', () => {
  it('records the design as taken offline when the conversion is declared', async () => {
    db.getDesign.mockResolvedValue(liveDoc);
    const { ctx, settle } = ctxWith('DELETE', '/api/designs/d1', conversion('offline'));
    expect((await handleDesigns(ctx)).status).toBe(204);
    await settle();
    expect(timeline.recordDesignOffline).toHaveBeenCalledTimes(1);
  });

  it('records nothing for a real delete: the design goes to the Trash', async () => {
    // docs/specs/013-workspace/trash.md: its history is hidden while it waits
    // (and comes back on restore), so nothing is swept and no card is added.
    db.getDesign.mockResolvedValue(liveDoc);
    const { ctx, settle } = ctxWith('DELETE', '/api/designs/d1');
    expect((await handleDesigns(ctx)).status).toBe(204);
    await settle();
    expect(db.trashDesign).toHaveBeenCalledWith(expect.anything(), 'd1', expect.any(Number));
    expect(vi.mocked(markTimelineEventsDeletedBySource)).not.toHaveBeenCalled();
    expect(timeline.recordDesignOffline).not.toHaveBeenCalled();
  });

  it('ignores an unrecognised conversion value rather than trusting it', async () => {
    // The header is client-supplied, so anything outside the two known values
    // has to fall back to the truthful default.
    db.getDesign.mockResolvedValue(liveDoc);
    const { ctx, settle } = ctxWith('DELETE', '/api/designs/d1', conversion('nonsense'));
    await handleDesigns(ctx);
    await settle();
    expect(timeline.recordDesignOffline).not.toHaveBeenCalled();
  });

  it('removes the server row on Take Offline, bypassing the Trash', async () => {
    db.getDesign.mockResolvedValue(liveDoc);
    const { ctx, settle } = ctxWith('DELETE', '/api/designs/d1', conversion('offline'));
    await handleDesigns(ctx);
    await settle();
    // Taking a design offline really does remove the server copy — only the
    // event that describes it changes.
    expect(db.deleteDesign).toHaveBeenCalled();
    expect(db.trashDesign).not.toHaveBeenCalled();
  });
});

describe("a non-owner cannot convert someone else's design", () => {
  // Narrowing the audience to the actor is right when the OWNER takes their
  // own design offline. When a teammate does it the design lands in THEIR
  // browser and leaves the owner's account for good — that is a deletion from
  // everyone else's side, and a deletion records nothing (docs/specs/013-workspace/timeline.md §3.5), so
  // the teammate must not get an owner-scoped "Taken Offline" card either.
  beforeEach(() => {
    db.getDesign.mockResolvedValue(teamDesign);
    db.getMembership.mockResolvedValue({ status: 'joined' });
  });

  it('treats a joined teammates declared conversion as a plain delete, to the team Trash', async () => {
    const { ctx, settle } = ctxWith('DELETE', '/api/designs/d1', {
      owner: 'bob',
      clerkUserId: 'bob',
      ...conversion('offline'),
    });
    expect((await handleDesigns(ctx)).status).toBe(204);
    await settle();
    expect(timeline.recordDesignOffline).not.toHaveBeenCalled();
    expect(db.trashDesign).toHaveBeenCalledWith(expect.anything(), 'd1', expect.any(Number));
    expect(db.deleteDesign).not.toHaveBeenCalled();
  });

  it('still honours the conversion when the owner does it on a team design', async () => {
    // Ownership is what gates it, not the absence of a team.
    const { ctx, settle } = ctxWith('DELETE', '/api/designs/d1', {
      owner: 'alice',
      clerkUserId: 'alice',
      ...conversion('offline'),
    });
    await handleDesigns(ctx);
    await settle();
    expect(timeline.recordDesignOffline).toHaveBeenCalledTimes(1);
  });
});

describe('POST /designs — sync vs genuine create', () => {
  const body = { id: 'd1', name: 'Doc' };

  it('records a sync when the conversion is declared', async () => {
    db.getDesign.mockResolvedValueOnce(null).mockResolvedValueOnce(liveDoc);
    const { ctx, settle } = ctxWith('POST', '/api/designs', { body, ...conversion('sync') });
    expect((await handleDesigns(ctx)).status).toBe(201);
    await settle();
    expect(timeline.recordDesignSynced).toHaveBeenCalledTimes(1);
    expect(timeline.recordDesignCreated).not.toHaveBeenCalled();
  });

  it('still records a genuine create when nothing is declared', async () => {
    db.getDesign.mockResolvedValueOnce(null).mockResolvedValueOnce(liveDoc);
    const { ctx, settle } = ctxWith('POST', '/api/designs', { body });
    await handleDesigns(ctx);
    await settle();
    expect(timeline.recordDesignCreated).toHaveBeenCalledTimes(1);
    expect(timeline.recordDesignSynced).not.toHaveBeenCalled();
  });

  it('emits neither when the POST resolved to an existing row', async () => {
    // docs/specs/013-workspace/timeline.md §4.2: a re-commit of an id the caller already owns is not an
    // event at all, and declaring a conversion must not smuggle one in.
    db.getDesign.mockResolvedValue(liveDoc);
    const { ctx, settle } = ctxWith('POST', '/api/designs', { body, ...conversion('sync') });
    await handleDesigns(ctx);
    await settle();
    expect(timeline.recordDesignSynced).not.toHaveBeenCalled();
    expect(timeline.recordDesignCreated).not.toHaveBeenCalled();
  });
});
