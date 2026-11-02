// @vitest-environment jsdom
import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CommentReaction } from '@liveworkspace/model-core/comment-reactions';
import { useReactionTray } from './CommentReactions';
import {
  CommentReactionsProvider,
  ScopedAddReactionButton,
  ScopedCommentReactions,
  useCommentReactionScope,
  type CommentReactionScope,
} from './CommentReactionsContext';

const ana: CommentReaction = { emoji: 'thumbs-up', by: 'k-ana', name: 'Ana' };

function Row({ closed }: { closed?: boolean }) {
  const tray = useReactionTray();
  return (
    <>
      <ScopedAddReactionButton tray={tray} closed={closed} />
      <ScopedCommentReactions commentId="c1" reactions={[ana]} tray={tray} closed={closed} />
    </>
  );
}

const scope = (over: Partial<CommentReactionScope> = {}): CommentReactionScope => ({
  selfKey: 'k-me',
  selfName: 'Me',
  canReact: true,
  toggle: vi.fn(),
  ...over,
});

const chip = () => screen.getByRole('button', { name: 'Thumbs Up, 1' });
const trigger = () => screen.queryByRole('button', { name: 'Add Reaction' });

describe('CommentReactionsContext', () => {
  it('outside an editor: nobody, whose toggle does nothing', () => {
    const { result } = renderHook(() => useCommentReactionScope());
    expect(result.current).toMatchObject({ selfKey: null, canReact: false });
    expect(() => result.current.toggle('c1', 'eyes', true)).not.toThrow();
  });

  it('outside an editor: chips read-only, no trigger', () => {
    render(<Row />);
    expect(trigger()).toBeNull();
    expect(chip().getAttribute('aria-disabled')).toBe('true');
  });

  it("sends a press to the scope's toggle, named by the comment", () => {
    const value = scope();
    render(
      <CommentReactionsProvider value={value}>
        <Row />
      </CommentReactionsProvider>,
    );
    fireEvent.click(chip());
    expect(value.toggle).toHaveBeenCalledWith('c1', 'thumbs-up', true);
    expect(trigger()).not.toBeNull();
  });

  it('a resolved thread reads its reactions but takes none, and a Viewer neither', () => {
    const cases: [CommentReactionScope, boolean][] = [
      [scope(), true],
      [scope({ canReact: false }), false],
    ];
    for (const [value, closed] of cases) {
      const { unmount } = render(
        <CommentReactionsProvider value={value}>
          <Row closed={closed} />
        </CommentReactionsProvider>,
      );
      expect(trigger()).toBeNull();
      fireEvent.click(chip());
      expect(value.toggle).not.toHaveBeenCalled();
      unmount();
    }
  });
});
