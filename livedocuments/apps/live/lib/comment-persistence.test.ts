import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  apiAddComment: vi.fn(async () => ({ id: 'server-1' })),
  apiDeleteComment: vi.fn(async () => undefined),
  apiSetThreadResolved: vi.fn(async () => undefined),
}));
vi.mock('@/lib/api-client', () => api);

import { commentPersisters } from './comment-persistence';

// docs/specs/008-canvas/canvas-and-palette.md "Comments" + docs/specs/013-workspace/share-roles.md: a read-only
// session (a Participant) has no autosave, so every surface that changes a thread (the anchored popover) keeps the change through the comment endpoints. The Comment panel once passed nothing, and a Participant's panel
// comment never left their screen.
const session = {
  readOnly: true,
  documentId: 'doc',
  tabId: 'tab',
  selfId: 'me',
  shareCode: 'CODE',
};

beforeEach(() => vi.clearAllMocks());

describe('commentPersisters', () => {
  it('writes a read-only session’s add, delete, resolve and reopen through the comment endpoints', async () => {
    const p = commentPersisters(session);
    await p.add('el', 'hi', undefined, 'B2')?.();
    expect(api.apiAddComment).toHaveBeenCalledWith(
      'me',
      'doc',
      'tab',
      'el',
      'hi',
      'CODE',
      undefined,
      'B2',
    );
    await p.remove('c1')?.();
    expect(api.apiDeleteComment).toHaveBeenCalledWith('me', 'doc', 'tab', 'c1', 'CODE');
    const thread = { comments: [{ id: 'first' }, { id: 'second' }] };
    await p.threadState(thread, true)?.();
    await p.threadState(thread, false)?.();
    expect(api.apiSetThreadResolved).toHaveBeenNthCalledWith(
      1,
      'me',
      'doc',
      'tab',
      'first',
      true,
      'CODE',
    );
    expect(api.apiSetThreadResolved).toHaveBeenNthCalledWith(
      2,
      'me',
      'doc',
      'tab',
      'first',
      false,
      'CODE',
    );
  });

  it('leaves an editor’s changes to the room and the autosave', () => {
    const p = commentPersisters({ ...session, readOnly: false });
    expect(p.add('el', 'hi')).toBeUndefined();
    expect(p.remove('c1')).toBeUndefined();
    expect(p.threadState({ comments: [{ id: 'first' }] }, true)).toBeUndefined();
  });

  it('has nothing to resolve on an empty thread, nor any endpoint without a document', () => {
    expect(commentPersisters(session).threadState({ comments: [] }, true)).toBeUndefined();
    expect(commentPersisters(session).threadState(undefined, true)).toBeUndefined();
    expect(commentPersisters({ ...session, documentId: null }).add('el', 'hi')).toBeUndefined();
  });
});
