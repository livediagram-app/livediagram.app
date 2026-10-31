// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ShapeElement, Tab } from '@livediagram/document';
import { useCommentReactionScope } from './useCommentReactionScope';

// docs/specs/012-collaboration/comment-reactions.md: a reaction is one delta on the comment's element.
const shape = (id: string, commentIds: string[]): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...(commentIds.length
    ? {
        commentThread: {
          resolved: false,
          comments: commentIds.map((c) => ({
            id: c,
            text: c,
            createdAt: 1,
            authorName: 'A',
            authorColor: '#000',
          })),
        },
      }
    : {}),
});
const tab: Tab = { id: 't1', name: 'T', elements: [shape('plain', []), shape('host', ['c1'])] };

function scope(canReact: boolean) {
  const applyElementDelta = vi.fn();
  const { result, rerender } = renderHook(
    (props: { activeTab: Tab }) =>
      useCommentReactionScope({
        applyElementDelta,
        activeTab: props.activeTab,
        selfKey: 'k-me',
        selfName: 'Me',
        canReact,
      }),
    { initialProps: { activeTab: tab } },
  );
  return { result, rerender, applyElementDelta };
}

describe('useCommentReactionScope', () => {
  it("sends one delta to the comment's element, under this session's key and name", () => {
    const { result, applyElementDelta } = scope(true);
    expect(result.current).toMatchObject({ selfKey: 'k-me', selfName: 'Me', canReact: true });
    result.current.toggle('c1', 'eyes', true);
    expect(applyElementDelta).toHaveBeenCalledWith(
      'host',
      { kind: 'comment-react', commentId: 'c1', emoji: 'eyes', by: 'k-me', name: 'Me', on: true },
      't1',
    );
  });

  it('does nothing for a comment that is not on the tab', () => {
    const { result, applyElementDelta } = scope(true);
    result.current.toggle('gone', 'eyes', true);
    expect(applyElementDelta).not.toHaveBeenCalled();
  });

  it('sends nothing for a Viewer', () => {
    const { result, applyElementDelta } = scope(false);
    result.current.toggle('c1', 'eyes', true);
    expect(applyElementDelta).not.toHaveBeenCalled();
  });

  it('stays the same object while the canvas changes, and reads the tab at press time', () => {
    const { result, rerender, applyElementDelta } = scope(true);
    const first = result.current;
    const moved: Tab = { ...tab, elements: [shape('other', ['c1'])] };
    rerender({ activeTab: moved });
    expect(result.current).toBe(first);
    result.current.toggle('c1', 'heart', false);
    expect(applyElementDelta.mock.calls[0]![0]).toBe('other');
  });
});
