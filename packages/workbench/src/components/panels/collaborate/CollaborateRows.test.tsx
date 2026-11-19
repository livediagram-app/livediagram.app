// @vitest-environment jsdom

// The Collaborate panel's rows every editor shares (docs/specs/012-collaboration/assigned-actions.md §5): an
// action's round check completes or reopens it in place, and a comment row names its latest author.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ActionRowItem,
  CommentRowItem,
  type CollaborateActionRow as ActionRow,
  type CollaborateCommentRow as CommentRow,
} from './CollaborateRows';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const action = (status: ActionRow['status'] = 'open', mine = false): ActionRow => ({
  label: 'Payments API',
  actionName: 'Confirm the retry budget',
  status,
  assigneeName: 'Sam Lee',
  assigneeColor: '#ef4444',
  mine,
  createdAt: Date.now(),
});

const list = (node: ReactNode) => render(<ul>{node}</ul>);

describe('ActionRowItem', () => {
  it('completes an open action from its check, after the check has shown its fill', () => {
    vi.useFakeTimers();
    const onToggleDone = vi.fn();
    list(<ActionRowItem row={action()} index={0} onClick={() => {}} onToggleDone={onToggleDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark "Confirm the retry budget" done' }));
    expect(onToggleDone).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onToggleDone).toHaveBeenCalledWith(true);
  });

  it('reopens a done action', () => {
    vi.useFakeTimers();
    const onToggleDone = vi.fn();
    list(
      <ActionRowItem
        row={action('done')}
        index={0}
        onClick={() => {}}
        onToggleDone={onToggleDone}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reopen "Confirm the retry budget"' }));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onToggleDone).toHaveBeenCalledWith(false);
  });

  it('draws a static check for a read-only visitor', () => {
    list(<ActionRowItem row={action()} index={0} onClick={() => {}} />);
    expect(screen.queryByRole('button', { name: /done/ })).toBeNull();
  });

  it('opens the action when the row body is pressed', () => {
    const onClick = vi.fn();
    list(<ActionRowItem row={action()} index={0} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /Open the action/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('marks your own action with a You chip', () => {
    list(<ActionRowItem row={action('open', true)} index={0} onClick={() => {}} />);
    expect(screen.getByText('You')).toBeTruthy();
  });
});

describe('CommentRowItem', () => {
  const row: CommentRow = {
    label: 'Ledger DB',
    count: 3,
    latestAuthorName: 'Priya Shah',
    latestAuthorColor: '#db2777',
    latestText: 'Agreed, queue it.',
    latestAt: Date.now(),
    resolved: false,
  };

  it('prefixes the latest comment with its author and shows the thread count', () => {
    list(<CommentRowItem row={row} index={0} onClick={() => {}} />);
    expect(screen.getByText('Priya:')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });
});

describe('the rows’ other states', () => {
  it('wears slate, not green, on a Won’t Do action, and says so', () => {
    list(
      <ActionRowItem row={action('wont-do')} index={0} onClick={() => {}} onToggleDone={vi.fn()} />,
    );
    expect(screen.getByText(/Won’t Do · Payments API/)).toBeTruthy();
    const check = screen.getByRole('button', { name: 'Reopen "Confirm the retry budget"' });
    expect(check.firstElementChild!.className).toContain('bg-slate-400');
  });

  it('pops the check on the press in the shared collab-pop motion', () => {
    vi.useFakeTimers();
    list(<ActionRowItem row={action()} index={0} onClick={() => {}} onToggleDone={vi.fn()} />);
    const check = screen.getByRole('button', { name: /Mark/ });
    fireEvent.click(check);
    expect(check.firstElementChild!.className).toContain('collab-pop');
    expect(check.hasAttribute('disabled')).toBe(true);
  });

  it('draws a teammate’s action with their initials in their colour', () => {
    list(<ActionRowItem row={action()} index={0} onClick={() => {}} />);
    expect(screen.queryByText('You')).toBeNull();
    expect(screen.getByText('SL')).toBeTruthy();
  });

  it('names a one-comment thread without a count, dims a resolved one, and takes an editor’s own name', () => {
    const one: CommentRow = {
      label: 'Ledger DB',
      count: 1,
      latestAuthorName: 'Priya Shah',
      latestAuthorColor: '#db2777',
      latestText: 'Done.',
      latestAt: Date.now(),
      resolved: true,
    };
    const onClick = vi.fn();
    list(<CommentRowItem row={one} index={0} onClick={onClick} label="Budget!B4" />);
    expect(screen.getByText('Budget!B4').className).toContain('text-slate-400');
    expect(screen.queryByText('1')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open the comment thread on Budget!B4' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
