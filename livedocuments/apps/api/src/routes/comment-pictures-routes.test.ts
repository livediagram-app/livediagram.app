import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestRouteContext } from './test-route-context';

// Comment author pictures (docs/specs/014-identity/profile-picture.md §5, §6): keyed by comment id,
// never exposing an author id, and empty for anyone not signed in.

const { db, gates } = vi.hoisted(() => ({
  db: { getDocument: vi.fn(), getTab: vi.fn(), getParticipant: vi.fn() },
  gates: { gateRead: vi.fn() },
}));
vi.mock('../db', () => db);
vi.mock('./context', async (orig) => ({
  ...(await orig<typeof import('./context')>()),
  gateRead: gates.gateRead,
}));

import { handleCommentPicturesRoute } from './comment-pictures-routes';

const ANN = 'https://img.clerk.com/ann';
const comment = (id: string, authorId?: string) => ({
  id,
  text: 't',
  createdAt: 1,
  authorName: 'A',
  authorColor: '#f00',
  ...(authorId ? { authorId } : {}),
});
const PATH = '/api/documents/d1/tabs/t1/comment-pictures';

beforeEach(() => {
  vi.clearAllMocks();
  db.getDocument.mockResolvedValue({ ownerId: 'user_ann', teamId: null });
  gates.gateRead.mockResolvedValue(true);
  db.getTab.mockResolvedValue({
    elements: [
      {
        id: 'e',
        commentThread: {
          resolved: false,
          comments: [comment('c1', 'user_ann'), comment('c2', 'user_bob'), comment('c3')],
        },
      },
    ],
  });
  db.getParticipant.mockImplementation(async (_env: unknown, id: string) =>
    id === 'user_ann' ? { id, pictureUrl: ANN } : { id, pictureUrl: null },
  );
});

describe('GET comment-pictures', () => {
  it('maps comment ids to their authors pictures for a signed-in reader, without author ids', async () => {
    const res = await handleCommentPicturesRoute(
      makeTestRouteContext('GET', PATH, { owner: 'user_bob', clerkUserId: 'user_bob' }),
    );
    const body = await res!.json();
    expect(body).toEqual({ pictures: { c1: ANN } });
    expect(JSON.stringify(body)).not.toContain('user_');
  });

  it('gives an anonymous share visitor nothing', async () => {
    const res = await handleCommentPicturesRoute(
      makeTestRouteContext('GET', PATH, { owner: 'guest-1' }),
    );
    expect(await res!.json()).toEqual({ pictures: {} });
    expect(db.getParticipant).not.toHaveBeenCalled();
  });

  it('refuses a reader without access', async () => {
    gates.gateRead.mockResolvedValue(false);
    const res = await handleCommentPicturesRoute(
      makeTestRouteContext('GET', PATH, { owner: 'user_eve', clerkUserId: 'user_eve' }),
    );
    expect(res!.status).toBe(403);
  });

  it('leaves every other path alone', async () => {
    expect(
      await handleCommentPicturesRoute(makeTestRouteContext('GET', '/api/documents/d1/tabs/t1')),
    ).toBeNull();
  });
});
