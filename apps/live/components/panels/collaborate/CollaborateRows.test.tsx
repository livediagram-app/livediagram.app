// @vitest-environment jsdom

// The Collaborate panel's rows (docs/specs/012-collaboration/assigned-actions.md §5): an action's round check
// completes or reopens it in place, and a comment row names its latest author.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ActionRow, CommentRow } from '@/components/panels/CollaboratePanel';
import { ActionRowItem, CommentRowItem } from './CollaborateRows';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const action = (status: 'open' | 'done' = 'open', mine = false): ActionRow => ({
  elementId: 'el-1',
  actionId: 'a-1',
  label: 'Payments API',
  actionName: 'Confirm the retry budget',
  status,
  assigneeName: 'Sam Lee',
  mine,
  createdAt: Date.now(),
});

const list = (node: React.ReactNode) => render(<ul>{node}</ul>);

describe('ActionRowItem', () => {
  it('completes an open action from its check, after the check has shown its fill', () => {
    vi.useFakeTimers();
    const onToggleDone = vi.fn();
    list(<ActionRowItem row={action()} index={0} onClick={() => {}} onToggleDone={onToggleDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark "Confirm the retry budget" done' }));
    expect(onToggleDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(500));
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
    act(() => vi.advanceTimersByTime(500));
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
    elementId: 'el-2',
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
