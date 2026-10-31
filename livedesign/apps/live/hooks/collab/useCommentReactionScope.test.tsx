// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Tab } from '@livedesign/design';
import { useCommentReactionScope } from './useCommentReactionScope';

// docs/specs/012-collaboration/comment-reactions.md: a reaction is one delta on the comment's own element.
const tab = {
  id: 't1',
  name: 'T',
  elements: [
    { id: 'plain', type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10 },
    {
      id: 'host',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      commentThread: {
        resolved: false,
        comments: [{ id: 'c1', text: 'hi', createdAt: 1, authorName: 'Bea', authorColor: '#f00' }],
      },
    },
  ],
} as unknown as Tab;

function scope(canReact: boolean) {
  const applyElementDelta = vi.fn();
  const { result, rerender } = renderHook(
    (props: { tab: Tab }) =>
      useCommentReactionScope({
        applyElementDelta,
        activeTab: props.tab,
        selfKey: 'k-me',
        selfName: 'Me',
        canReact,
      }),
    { initialProps: { tab } },
  );
  return { applyElementDelta, result, rerender };
}

describe('useCommentReactionScope', () => {
  it("sends the reaction to the comment's element, under this session's key and name", () => {
    const { applyElementDelta, result } = scope(true);
    expect(result.current).toMatchObject({ selfKey: 'k-me', selfName: 'Me', canReact: true });
    result.current.toggle('c1', 'eyes', true);
    expect(applyElementDelta).toHaveBeenCalledWith(
      'host',
      { kind: 'comment-react', commentId: 'c1', emoji: 'eyes', by: 'k-me', name: 'Me', on: true },
      't1',
    );
  });

  it('sends nothing for an unknown comment, or a session that may not react', () => {
    const editor = scope(true);
    editor.result.current.toggle('nope', 'eyes', true);
    expect(editor.applyElementDelta).not.toHaveBeenCalled();
    const viewer = scope(false);
    viewer.result.current.toggle('c1', 'eyes', true);
    expect(viewer.applyElementDelta).not.toHaveBeenCalled();
  });

  it('keeps the same scope while the canvas changes', () => {
    const { result, rerender } = scope(true);
    const first = result.current;
    rerender({ tab: { ...tab, elements: [...tab.elements] } });
    expect(result.current).toBe(first);
  });
});
