// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedocuments/document';

const api = vi.hoisted(() => ({
  apiAddComment: vi.fn(),
  apiDeleteComment: vi.fn(),
  apiSetThreadResolved: vi.fn(),
  apiReactToComment: vi.fn(async () => undefined),
}));
vi.mock('@/lib/api-client', () => api);

import { useCommentReactionScope } from './useCommentReactionScope';

// docs/specs/012-collaboration/comment-reactions.md: the scope every comment row reads.
const tab = {
  id: 't1',
  name: 'Main',
  elements: [
    {
      id: 'e1',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      commentThread: {
        resolved: false,
        comments: [{ id: 'c1', text: 'hi', createdAt: 1, authorName: 'A', authorColor: '#000' }],
      },
    },
  ],
} as unknown as Tab;

const base = {
  activeTab: tab,
  selfKey: 'k-me',
  selfName: 'Me',
  canReact: true,
  readOnly: false,
  documentId: 'doc',
  selfId: 'me',
  shareCode: null,
};

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => vi.clearAllMocks());

describe('useCommentReactionScope', () => {
  it("sends an Editor's reaction as one delta on the comment's element, and nothing to the endpoint", () => {
    const applyElementDelta = vi.fn();
    const { result } = renderHook(() => useCommentReactionScope({ ...base, applyElementDelta }));
    expect(result.current).toMatchObject({ selfKey: 'k-me', selfName: 'Me', canReact: true });
    result.current.toggle('c1', 'eyes', true);
    expect(applyElementDelta).toHaveBeenCalledWith(
      'e1',
      { kind: 'comment-react', commentId: 'c1', emoji: 'eyes', by: 'k-me', name: 'Me', on: true },
      't1',
    );
    expect(api.apiReactToComment).not.toHaveBeenCalled();
  });

  it("keeps a Participant's through the endpoint, and takes it back when refused", async () => {
    const applyElementDelta = vi.fn();
    const { result } = renderHook(() =>
      useCommentReactionScope({ ...base, readOnly: true, applyElementDelta }),
    );
    result.current.toggle('c1', 'eyes', true);
    await flush();
    expect(api.apiReactToComment).toHaveBeenCalledWith(
      'me',
      'doc',
      't1',
      'c1',
      { emoji: 'eyes', on: true, key: 'k-me' },
      null,
    );
    expect(applyElementDelta).toHaveBeenCalledTimes(1);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    api.apiReactToComment.mockRejectedValueOnce(new Error('403'));
    result.current.toggle('c1', 'eyes', false);
    await flush();
    expect(applyElementDelta).toHaveBeenLastCalledWith(
      'e1',
      expect.objectContaining({ kind: 'comment-react', on: true }),
      't1',
    );
  });

  it('does nothing for a Viewer, or for a comment that is not on the tab', () => {
    const applyElementDelta = vi.fn();
    const viewer = renderHook(() =>
      useCommentReactionScope({ ...base, canReact: false, applyElementDelta }),
    );
    viewer.result.current.toggle('c1', 'eyes', true);
    const editor = renderHook(() => useCommentReactionScope({ ...base, applyElementDelta }));
    editor.result.current.toggle('nope', 'eyes', true);
    expect(applyElementDelta).not.toHaveBeenCalled();
  });
});
