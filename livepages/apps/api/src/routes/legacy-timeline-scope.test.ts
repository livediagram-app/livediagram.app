import { makeTestRouteContext } from './test-route-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// An old client asks the timeline for `scope=diagram:<id>`; it is read as the document scope until
// the sunset (docs/specs/015-api/public-api-and-tokens.md §3.8). Same harness as timeline.test.ts.
const { store } = vi.hoisted(() => ({
  store: {
    readTimeline: vi.fn(),
    getScopeState: vi.fn(),
    markScopeSeen: vi.fn(),
    countUnseen: vi.fn(),
    dismissTimelineEventForScope: vi.fn(),
    dismissTimelineEventsForScope: vi.fn(),
    DISMISS_BATCH_MAX: 200,
  },
}));
vi.mock('../db/timeline', () => store);
vi.mock('../timeline', () => ({ backfillUserScope: vi.fn() }));
const { db } = vi.hoisted(() => ({ db: { getMembership: vi.fn(), getDocument: vi.fn() } }));
vi.mock('../db', () => db);
const { gate } = vi.hoisted(() => ({ gate: { gateRead: vi.fn() } }));
vi.mock('./context', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, gateRead: gate.gateRead };
});

import { handleTimeline } from './timeline';

beforeEach(() => {
  store.readTimeline.mockReset();
  store.readTimeline.mockResolvedValue({ items: [], nextCursor: null });
  store.getScopeState.mockResolvedValue(null);
  db.getDocument.mockResolvedValue({ id: 'd-1', ownerId: 'owner-1', teamId: null });
  gate.gateRead.mockResolvedValue(true);
});

describe('the timeline with an old scope', () => {
  it('serves scope=diagram:<id> as the document scope', async () => {
    const res = await handleTimeline(
      makeTestRouteContext('GET', '/api/timeline?scope=diagram:d-1', { owner: 'owner-1' }),
    );
    expect(res.status).toBe(200);
    expect(store.readTimeline).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ scope: { scopeType: 'document', scopeId: 'd-1' } }),
    );
  });
});
