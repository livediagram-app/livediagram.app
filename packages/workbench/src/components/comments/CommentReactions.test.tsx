// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  CommentReaction,
  CommentReactionId,
} from '@liveworkspace/model-core/comment-reactions';
import {
  AddReactionButton,
  CommentReactions,
  useReactionTray,
  type ReactionDensity,
} from './CommentReactions';

const ana: CommentReaction = { emoji: 'thumbs-up', by: 'k-ana', name: 'Ana' };
const me: CommentReaction = { emoji: 'thumbs-up', by: 'k-me', name: 'Me' };
const eyes: CommentReaction = { emoji: 'eyes', by: 'k-ana', name: 'Ana' };

function Row({
  reactions,
  canReact = true,
  onToggle = () => {},
  density,
}: {
  reactions?: CommentReaction[];
  canReact?: boolean;
  onToggle?: (emoji: CommentReactionId, on: boolean) => void;
  density?: ReactionDensity;
}) {
  const tray = useReactionTray();
  return (
    <div>
      <button type="button">Elsewhere</button>
      {canReact ? <AddReactionButton tray={tray} density={density} /> : null}
      <CommentReactions
        reactions={reactions}
        selfKey="k-me"
        selfName="Me"
        canReact={canReact}
        onToggle={onToggle}
        tray={tray}
        density={density}
      />
    </div>
  );
}

const chip = (name: RegExp) => screen.getByRole('button', { name });
const trigger = () => screen.getByRole('button', { name: 'Add Reaction' });
const tray = () => screen.queryByRole('group', { name: 'Reactions' });

describe('CommentReactions', () => {
  it('draws nothing for a comment with none, until the tray opens', () => {
    const { container } = render(<Row />);
    expect(container.querySelector('[data-comment-reactions]')).toBeNull();
    fireEvent.click(trigger());
    expect(tray()).not.toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
  });

  it('shows a chip per emoji, in the fixed order, with counts, and yours pressed', () => {
    render(<Row reactions={[eyes, ana, me]} />);
    const chips = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') !== null && !b.closest('[role=group]'));
    expect(chips.map((c) => c.getAttribute('aria-label'))).toEqual(['Thumbs Up, 2', 'Eyes, 1']);
    expect(chip(/Thumbs Up, 2/).getAttribute('aria-pressed')).toBe('true');
    expect(chip(/Eyes, 1/).getAttribute('aria-pressed')).toBe('false');
  });

  it('says who reacted, you first', () => {
    render(<Row reactions={[ana, me]} />);
    expect(screen.getByText('You and Ana reacted', { selector: '[hidden]' })).toBeTruthy();
  });

  it('a chip toggles yours: off when it is yours, on when it is not', () => {
    const onToggle = vi.fn();
    render(<Row reactions={[ana, me, eyes]} onToggle={onToggle} />);
    fireEvent.click(chip(/Thumbs Up/));
    fireEvent.click(chip(/Eyes/));
    expect(onToggle.mock.calls).toEqual([
      ['thumbs-up', false],
      ['eyes', true],
    ]);
  });

  it('a pick from the tray toggles and closes it, and marks yours', () => {
    const onToggle = vi.fn();
    render(<Row reactions={[me]} onToggle={onToggle} density="comfortable" />);
    fireEvent.click(trigger());
    const group = tray()!;
    const thumbs = group.querySelector('[aria-label="Thumbs Up"]')!;
    expect(thumbs.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(group.querySelector('[aria-label="Hooray"]')!);
    expect(onToggle).toHaveBeenCalledWith('hooray', true);
    expect(tray()).toBeNull();
  });

  it('the trigger closes an open tray again', () => {
    render(<Row />);
    fireEvent.click(trigger());
    fireEvent.pointerDown(trigger());
    expect(tray()).not.toBeNull();
    fireEvent.click(trigger());
    expect(tray()).toBeNull();
  });

  it('moves along the tray with the arrows, Home and End', () => {
    render(<Row />);
    fireEvent.click(trigger());
    const buttons = Array.from(tray()!.querySelectorAll('button'));
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(tray()!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(buttons[5]);
    fireEvent.keyDown(tray()!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(tray()!, { key: 'End' });
    expect(document.activeElement).toBe(buttons[5]);
    fireEvent.keyDown(tray()!, { key: 'Home' });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(tray()!, { key: 'a' });
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('Escape closes it and hands focus back to the trigger', () => {
    render(<Row />);
    fireEvent.click(trigger());
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(tray()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('a press elsewhere closes it', () => {
    render(<Row />);
    fireEvent.click(trigger());
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(tray()).toBeNull();
  });

  it('a Viewer sees who reacted but presses nothing', () => {
    const onToggle = vi.fn();
    render(<Row reactions={[ana]} canReact={false} onToggle={onToggle} />);
    const c = chip(/Thumbs Up, 1/);
    expect(c.getAttribute('aria-disabled')).toBe('true');
    expect(c.getAttribute('aria-pressed')).toBeNull();
    fireEvent.click(c);
    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Add Reaction' })).toBeNull();
  });
});
