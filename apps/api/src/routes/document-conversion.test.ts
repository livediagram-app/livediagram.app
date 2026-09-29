import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT_CONVERSION_HEADER } from '@livediagram/api-schema';
import { makeTestRouteContext } from './test-route-context';
import type { DocumentDTO } from '../types';

// Offline Mode conversions must be recorded as themselves (docs/specs/006-document/offline-mode.md + docs/specs/013-workspace/timeline.md).
//
// Both conversions reuse ordinary endpoints — "take offline" is a plain
// DELETE /documents/:id, "sync" a plain POST /documents — so the worker cannot
// tell them apart from a real delete or a real create unless the editor says
// so. It didn't, so the feed reported that a diagram the owner had just moved
// into this browser was DELETED (in danger red), and that one they had just
// uploaded was newly CREATED. `document_offline` / `document_synced` existed the
// whole time, with tones, icons, renderers and a docs/specs/013-workspace/timeline.md table row; nothing
// emitted them.
//
// The route test next door deliberately leaves `../timeline` unmocked and
// passes no `waitUntil`, so its emits never run. This file mocks the emitters
// and supplies one, which is the only way to see WHICH event fires.
const timeline = vi.hoisted(() => ({
  audienceForDocument: vi.fn(async () => [] as unknown[]),
  recordDocumentCreated: vi.fn(async () => {}),
  recordDocumentDuplicated: vi.fn(async () => {}),
  recordDocumentOffline: vi.fn(async () => {}),
  recordDocumentSynced: vi.fn(async () => {}),
  recordVisitorCopied: vi.fn(async () => {}),
}));
vi.mock('../timeline', () => timeline);

const db = vi.hoisted(() => ({
  listDocumentsByOwner: vi.fn(),
  getDocument: vi.fn(),
  upsertDocumentMeta: vi.fn(async () => {}),
  deleteDocument: vi.fn(async () => {}),
  trashDocument: vi.fn(async () => true),
  purgeDocuments: vi.fn(async () => 1),
  getTrashedDocumentMeta: vi.fn(async () => null),
  getFolder: vi.fn(),
  setDocumentFolder: vi.fn(),
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
  setDocumentPresentation: vi.fn(),
  reorderTabs: vi.fn(),
  countDocumentsByOwner: vi.fn(async () => 1),
  copyDocument: vi.fn(),
  listSharedWith: vi.fn(),
  seedTabs: vi.fn(async () => {}),
}));
vi.mock('../db', () => db);
vi.mock('../db/timeline', () => ({ markTimelineEventsDeletedBySource: vi.fn(async () => {}) }));
vi.mock('../auth/document-access', () => ({
  canReadDocument: vi.fn(async () => true),
  canEditDocument: vi.fn(async () => true),
}));

import { markTimelineEventsDeletedBySource } from '../db/timeline';
import { handleDocuments } from './documents';

const OWNER = 'owner-1';
// Minimal DTO, as documents.test.ts does it — only the authz + emit branches read it.
const liveDoc = {
  id: 'd1',
  ownerId: OWNER,
  teamId: null,
  name: 'Doc',
  tabs: [],
} as unknown as DocumentDTO;

// Owned by someone ELSE, filed in a team library. The DELETE is reachable here
// by any joined member (docs/specs/013-workspace/team-shared-documents.md), and the Explorer offers Take Offline on a
// team-library row without checking who owns it.
const teamDocument = {
  id: 'd1',
  ownerId: 'alice',
  teamId: 'team-1',
  name: 'Doc',
  tabs: [],
} as unknown as DocumentDTO;

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

const conversion = (value: string) => ({ headers: { [DOCUMENT_CONVERSION_HEADER]: value } });

beforeEach(() => {
  for (const fn of Object.values(timeline)) fn.mockClear();
  db.getDocument.mockReset();
  db.deleteDocument.mockClear();
  db.trashDocument.mockClear();
  vi.mocked(markTimelineEventsDeletedBySource).mockClear();
});

describe('DELETE /documents/:id — take offline vs real delete', () => {
  it('records the diagram as taken offline when the conversion is declared', async () => {
    db.getDocument.mockResolvedValue(liveDoc);
    const { ctx, settle } = ctxWith('DELETE', '/api/documents/d1', conversion('offline'));
    expect((await handleDocuments(ctx)).status).toBe(204);
    await settle();
    expect(timeline.recordDocumentOffline).toHaveBeenCalledTimes(1);
  });

  it('records nothing for a real delete: the diagram goes to the Trash', async () => {
    // docs/specs/013-workspace/trash.md: its history is hidden while it waits
    // (and comes back on restore), so nothing is swept and no card is added.
    db.getDocument.mockResolvedValue(liveDoc);
    const { ctx, settle } = ctxWith('DELETE', '/api/documents/d1');
    expect((await handleDocuments(ctx)).status).toBe(204);
    await settle();
    expect(db.trashDocument).toHaveBeenCalledWith(expect.anything(), 'd1', expect.any(Number));
    expect(vi.mocked(markTimelineEventsDeletedBySource)).not.toHaveBeenCalled();
    expect(timeline.recordDocumentOffline).not.toHaveBeenCalled();
  });

  it('ignores an unrecognised conversion value rather than trusting it', async () => {
    // The header is client-supplied, so anything outside the two known values
    // has to fall back to the truthful default.
    db.getDocument.mockResolvedValue(liveDoc);
    const { ctx, settle } = ctxWith('DELETE', '/api/documents/d1', conversion('nonsense'));
    await handleDocuments(ctx);
    await settle();
    expect(timeline.recordDocumentOffline).not.toHaveBeenCalled();
  });

  it('removes the server row on Take Offline, bypassing the Trash', async () => {
    db.getDocument.mockResolvedValue(liveDoc);
    const { ctx, settle } = ctxWith('DELETE', '/api/documents/d1', conversion('offline'));
    await handleDocuments(ctx);
    await settle();
    // Taking a diagram offline really does remove the server copy — only the
    // event that describes it changes.
    expect(db.deleteDocument).toHaveBeenCalled();
    expect(db.trashDocument).not.toHaveBeenCalled();
  });
});

describe("a non-owner cannot convert someone else's diagram", () => {
  // Narrowing the audience to the actor is right when the OWNER takes their
  // own diagram offline. When a teammate does it the diagram lands in THEIR
  // browser and leaves the owner's account for good — that is a deletion from
  // everyone else's side, and a deletion records nothing (docs/specs/013-workspace/timeline.md §3.5), so
  // the teammate must not get an owner-scoped "Taken Offline" card either.
  beforeEach(() => {
    db.getDocument.mockResolvedValue(teamDocument);
    db.getMembership.mockResolvedValue({ status: 'joined' });
  });

  it('treats a joined teammates declared conversion as a plain delete, to the team Trash', async () => {
    const { ctx, settle } = ctxWith('DELETE', '/api/documents/d1', {
      owner: 'bob',
      clerkUserId: 'bob',
      ...conversion('offline'),
    });
    expect((await handleDocuments(ctx)).status).toBe(204);
    await settle();
    expect(timeline.recordDocumentOffline).not.toHaveBeenCalled();
    expect(db.trashDocument).toHaveBeenCalledWith(expect.anything(), 'd1', expect.any(Number));
    expect(db.deleteDocument).not.toHaveBeenCalled();
  });

  it('still honours the conversion when the owner does it on a team diagram', async () => {
    // Ownership is what gates it, not the absence of a team.
    const { ctx, settle } = ctxWith('DELETE', '/api/documents/d1', {
      owner: 'alice',
      clerkUserId: 'alice',
      ...conversion('offline'),
    });
    await handleDocuments(ctx);
    await settle();
    expect(timeline.recordDocumentOffline).toHaveBeenCalledTimes(1);
  });
});

describe('POST /documents — sync vs genuine create', () => {
  const body = { id: 'd1', name: 'Doc' };

  it('records a sync when the conversion is declared', async () => {
    db.getDocument.mockResolvedValueOnce(null).mockResolvedValueOnce(liveDoc);
    const { ctx, settle } = ctxWith('POST', '/api/documents', { body, ...conversion('sync') });
    expect((await handleDocuments(ctx)).status).toBe(201);
    await settle();
    expect(timeline.recordDocumentSynced).toHaveBeenCalledTimes(1);
    expect(timeline.recordDocumentCreated).not.toHaveBeenCalled();
  });

  it('still records a genuine create when nothing is declared', async () => {
    db.getDocument.mockResolvedValueOnce(null).mockResolvedValueOnce(liveDoc);
    const { ctx, settle } = ctxWith('POST', '/api/documents', { body });
    await handleDocuments(ctx);
    await settle();
    expect(timeline.recordDocumentCreated).toHaveBeenCalledTimes(1);
    expect(timeline.recordDocumentSynced).not.toHaveBeenCalled();
  });

  it('emits neither when the POST resolved to an existing row', async () => {
    // docs/specs/013-workspace/timeline.md §4.2: a re-commit of an id the caller already owns is not an
    // event at all, and declaring a conversion must not smuggle one in.
    db.getDocument.mockResolvedValue(liveDoc);
    const { ctx, settle } = ctxWith('POST', '/api/documents', { body, ...conversion('sync') });
    await handleDocuments(ctx);
    await settle();
    expect(timeline.recordDocumentSynced).not.toHaveBeenCalled();
    expect(timeline.recordDocumentCreated).not.toHaveBeenCalled();
  });
});
