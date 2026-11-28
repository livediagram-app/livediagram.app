// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { thread } from '@/components/plan/threads/thread-test-kit';
import { FeedbackStrip } from '../review/FeedbackStrip';
import { BlockersSummary, blockersOf } from './BlockersSummary';
import {
  COMMENT_WORDS,
  personLine,
  personName,
  standupThreadOf,
  standupThreadTitle,
} from './standup-words';
import { withPersonOrder } from './PeopleOrderPart';
import { BlockedDialog } from './BlockedDialog';
import { StandupActionBar } from './StandupActionBar';

// docs/specs/026-plan/session-tabs.md "Stand-up": its words, the day's thread, the blockers and the comment strip.
afterEach(cleanup);

describe('Stand-up words', () => {
  it('names people, the person line and the day’s thread', () => {
    expect(personName(null)).toBe('Unassigned');
    expect(personName({ name: '' })).toBe('Someone');
    expect(personLine('Ana', 1, 3)).toBe('Ana · card 1 of 3');
    expect(personLine('Ana', 2, 3, 'Keys')).toBe('Ana · card 2 of 3 · Blocked: Keys');
    expect(standupThreadTitle(Date.UTC(2026, 10, 28, 12))).toBe('Stand-up, 28 Nov');
  });

  it('joins the newest open thread titled for today', () => {
    const title = 'Stand-up, 28 Nov';
    const old = thread('t-old', { title, updatedAt: 1 });
    const newer = thread('t-new', { title, updatedAt: 5 });
    const shut = thread('t-shut', { title, updatedAt: 9, resolved: true });
    const other = thread('t-other', { title: 'Design', updatedAt: 10 });
    expect(standupThreadOf([old, newer, shut, other], title)?.id).toBe('t-new');
    expect(standupThreadOf([other], title)).toBeNull();
  });

  it('keeps Board Order as no value', () => {
    const setup = { typeIds: ['t'], statuses: ['s'] };
    expect(withPersonOrder(setup, 'shuffled').personOrder).toBe('shuffled');
    expect(withPersonOrder({ ...setup, personOrder: 'alphabetical' }, 'board')).toEqual(setup);
  });
});

describe('BlockersSummary', () => {
  const item = (id: string, assignee?: { id: string; name: string; color: string }) =>
    ({
      id,
      type: 't',
      key: 3,
      rank: 'a',
      fields: { title: `Card ${id}`, ...(assignee ? { assignee } : {}) },
    }) as never;

  it('lists the flagged cards still on the plan in the order they were marked, each opening its card', () => {
    const items = new Map([
      ['a', item('a', { id: 'p-a', name: 'Ana', color: '#000000' })],
      ['b', item('b')],
    ]);
    const decided = {
      b: { outcome: 'flagged' as const, at: 1, by: '' },
      a: { outcome: 'flagged' as const, at: 5, by: '', reason: 'Keys' },
      gone: { outcome: 'flagged' as const, at: 2, by: '' },
      c: { outcome: 'discussed' as const, at: 3, by: '' },
    };
    expect(blockersOf(decided, items).map((x) => x.item.id)).toEqual(['b', 'a']);
    const onOpen = vi.fn();
    render(<BlockersSummary decided={decided} items={items} types={[]} onOpen={onOpen} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]!.textContent).toContain('Unassigned');
    expect(buttons[1]!.textContent).toContain('Ana · Keys');
    fireEvent.click(buttons[1]!);
    expect(onOpen).toHaveBeenCalledWith('a');
  });
});

describe('the comment strip', () => {
  it('draws nothing for someone who may not comment when it keeps no count', () => {
    const { container } = render(
      <FeedbackStrip cardRef="WI-1" canAdd={false} words={COMMENT_WORDS} onAdd={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('speaks in its own words with no count', () => {
    render(<FeedbackStrip cardRef="WI-1" canAdd words={COMMENT_WORDS} onAdd={vi.fn()} />);
    expect(screen.getByPlaceholderText('Add a note to WI-1')).toBeTruthy();
    expect(screen.getByText('Add Comment')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('StandupActionBar', () => {
  const props = {
    runs: true,
    holderName: 'You',
    name: 'Ana',
    line: 'Ana · card 1 of 2',
    cardRef: 'WI-1',
    flagged: false,
    stage: 'doing',
    stages: ['doing', 'done'],
    statusName: (id: string) => id.toUpperCase(),
    doneBy: null,
    timebox: { leftMs: 65_000, totalMs: 120_000, up: false },
    last: null,
    onBlocked: vi.fn(),
    onStage: vi.fn(),
    onDone: vi.fn(),
    onUndoDone: vi.fn(),
  };

  it('counts the person’s time down, then says time is up', () => {
    const { rerender } = render(<StandupActionBar {...props} />);
    expect(screen.getByRole('timer').textContent).toBe('1:05');
    rerender(<StandupActionBar {...props} timebox={{ leftMs: 0, totalMs: 120_000, up: true }} />);
    expect(screen.getByRole('timer').getAttribute('aria-label')).toBe('Time’s up');
  });

  it('names who runs the session for anyone else', () => {
    render(<StandupActionBar {...props} runs={false} holderName="Sam" />);
    expect(screen.getByRole('status').textContent).toBe('Sam is running this session');
  });
});

describe('BlockedDialog', () => {
  it('takes a typed reason, trimmed, and confirms only with one', () => {
    const onConfirm = vi.fn();
    const item = { id: 'a', type: 't', key: 1, rank: 'a', fields: { title: 'Card A' } } as never;
    render(<BlockedDialog item={item} cardRef="WI-1" onCancel={vi.fn()} onConfirm={onConfirm} />);
    const box = screen.getByRole('textbox', { name: /in the way/ });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: '  Sandbox keys  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark Blocked' }));
    expect(onConfirm).toHaveBeenCalledWith('Sandbox keys');
  });
});
