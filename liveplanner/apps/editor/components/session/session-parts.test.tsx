// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Item, ItemTypeDef } from '@liveplanner/items';
import { SessionActionBar, clockOf } from './SessionActionBar';
import { SessionComplete } from './SessionComplete';
import { SessionFacilitatorChip } from './SessionFacilitatorChip';
import { SEGMENTS_MAX, SessionProgress } from './SessionProgress';
import { SessionSidebar } from './SessionSidebar';
import { isTypingTarget, useSessionKeys } from './useSessionKeys';
import type { SessionBaton } from './useSessionFacilitator';

// docs/specs/026-plan/session-tabs.md "The page", "Facilitator", "Share roles": what each role sees of a session.
afterEach(cleanup);

const work: ItemTypeDef = {
  id: 'work',
  label: 'Work',
  newTitle: 'New work',
  glyph: 'task',
  color: '#7c3aed',
  fields: ['title', 'status'],
};
const card = (id: string, extra = {}): Item => ({
  id,
  type: 'work',
  key: 7,
  rank: id,
  fields: { title: `Card ${id}`, status: 'backlog', ...extra },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: { id: 'p', name: 'P', color: '#000' },
  updatedBy: { id: 'p', name: 'P', color: '#000' },
});

describe('SessionActionBar', () => {
  const base = {
    item: card('a'),
    decision: undefined,
    holderName: 'Sam',
    targetName: 'Ready',
    statusName: 'Backlog',
    timebox: null,
    onDecide: vi.fn(),
    onUndo: vi.fn(),
  };

  it('the facilitator gets Skip, Flag, where Refined takes the card, the time left and Refined', () => {
    const onDecide = vi.fn();
    render(
      <SessionActionBar
        {...base}
        runs
        onDecide={onDecide}
        timebox={{ leftMs: 61_000, totalMs: 120_000, up: false }}
      />,
    );
    expect(screen.getByText('Ready').parentElement?.textContent).toBe('Moves to Ready');
    expect(screen.getByLabelText('1:01 left')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Skip/ }));
    fireEvent.click(screen.getByRole('button', { name: /Flag/ }));
    expect(onDecide.mock.calls).toEqual([['skipped'], ['flagged']]);
  });

  it('a flagged card has no Flag; a card with no later stage stays; time up reads amber', () => {
    render(
      <SessionActionBar
        {...base}
        runs
        item={card('a', { flagged: true })}
        targetName={null}
        timebox={{ leftMs: 0, totalMs: 60_000, up: true }}
      />,
    );
    expect(screen.queryByRole('button', { name: /Flag/ })).toBeNull();
    expect(screen.getByText(/its type has no later stage/).textContent).toContain(
      'Stays in Backlog',
    );
    expect(screen.getByLabelText('Time’s up')).toBeTruthy();
  });

  it('a Participant or Viewer sees who runs it, never an action', () => {
    render(<SessionActionBar {...base} runs={false} />);
    expect(screen.getByRole('status').textContent).toBe('Sam is running this session');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    cleanup();
    render(<SessionActionBar {...base} runs={false} holderName={null} />);
    expect(screen.getByRole('status').textContent).toBe('Nobody is running this session');
  });

  it('a decided card reads its outcome, with Undo Outcome for the facilitator alone', () => {
    const onUndo = vi.fn();
    const decision = { outcome: 'refined' as const, at: 1, by: 'Sam' };
    render(<SessionActionBar {...base} runs decision={decision} onUndo={onUndo} />);
    expect(screen.getByRole('group', { name: 'Outcome' }).textContent).toContain('Refined by Sam');
    fireEvent.click(screen.getByRole('button', { name: 'Undo Outcome' }));
    expect(onUndo).toHaveBeenCalled();
    cleanup();
    render(<SessionActionBar {...base} runs={false} decision={{ ...decision, by: '' }} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('group').textContent).toBe('Refined');
  });

  it('says the time as minutes and seconds', () => {
    expect([clockOf(0), clockOf(59_001), clockOf(600_000)]).toEqual(['0:00', '1:00', '10:00']);
  });
});

describe('SessionSidebar', () => {
  it('lists the queue, marks the room’s card and greys a decided one with its outcome', () => {
    const onOpen = vi.fn();
    render(
      <SessionSidebar
        label="Refinement"
        list={[card('a'), card('b'), card('c')]}
        types={[work]}
        decided={{ a: { outcome: 'skipped', at: 1, by: 'Sam' } }}
        currentId="b"
        shownId="c"
        onOpen={onOpen}
      />,
    );
    const rows = screen.getAllByRole('option');
    expect(rows.map((r) => r.getAttribute('aria-current'))).toEqual([null, 'step', null]);
    expect(rows[2]!.getAttribute('aria-selected')).toBe('true');
    expect(within(rows[0]!).getByText('Skipped')).toBeTruthy();
    expect(rows[0]!.className).toContain('opacity-60');
    fireEvent.click(rows[0]!);
    fireEvent.keyDown(rows[2]!, { key: 'Enter' });
    fireEvent.keyDown(rows[2]!, { key: ' ' });
    expect(onOpen.mock.calls).toEqual([['a'], ['c'], ['c']]);
    fireEvent.keyDown(rows[2]!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(rows[1]);
    fireEvent.keyDown(rows[1]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rows[2]);
    fireEvent.keyDown(rows[2]!, { key: 'x' });
    expect(onOpen).toHaveBeenCalledTimes(3);
  });
});

describe('SessionProgress', () => {
  it('names how far through it is, a segment per card, the room’s card filling as its time runs', () => {
    const { container } = render(
      <SessionProgress
        label="Refinement"
        list={[card('a'), card('b'), card('c')]}
        decided={{ a: { outcome: 'flagged', at: 1, by: '' } }}
        currentId="b"
        timebox={{ leftMs: 30_000, totalMs: 60_000, up: false }}
      />,
    );
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-label')).toBe('Refinement progress, 1 of 3 decided');
    expect(bar.children).toHaveLength(3);
    expect(container.querySelector('[style*="width: 50%"]')).toBeTruthy();
  });

  it('turns amber when time is up, and is one bar past SEGMENTS_MAX cards', () => {
    const many = Array.from({ length: SEGMENTS_MAX + 1 }, (_, i) => card(`c${i}`));
    render(
      <SessionProgress
        label="Refinement"
        list={many}
        decided={undefined}
        currentId="c0"
        timebox={{ leftMs: 0, totalMs: 60_000, up: true }}
      />,
    );
    expect(screen.getByRole('progressbar').children).toHaveLength(1);
    cleanup();
    render(
      <SessionProgress
        label="Refinement"
        list={[card('a')]}
        decided={undefined}
        currentId="a"
        timebox={{ leftMs: 0, totalMs: 60_000, up: true }}
      />,
    );
    expect(screen.getByRole('progressbar').hasAttribute('data-timebox-up')).toBe(true);
    cleanup();
    render(
      <SessionProgress label="R" list={[]} decided={undefined} currentId={null} timebox={null} />,
    );
    expect(screen.getByRole('progressbar').getAttribute('aria-valuemax')).toBe('0');
  });
});

describe('SessionComplete', () => {
  it('counts each outcome, with Review Skipped and Start Again for the facilitator', () => {
    const onReview = vi.fn();
    const onAgain = vi.fn();
    render(
      <SessionComplete
        empty={false}
        decided={{
          a: { outcome: 'refined', at: 1, by: '' },
          b: { outcome: 'refined', at: 2, by: '' },
          c: { outcome: 'skipped', at: 3, by: '' },
        }}
        runs
        onReviewSkipped={onReview}
        onStartAgain={onAgain}
      />,
    );
    expect(screen.getByRole('heading').textContent).toBe('Session Complete');
    expect(screen.getAllByRole('definition').map((d) => d.textContent)).toEqual(['2', '1', '0']);
    fireEvent.click(screen.getByRole('button', { name: 'Review Skipped' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Again' }));
    expect([onReview, onAgain].map((f) => f.mock.calls.length)).toEqual([1, 1]);
    cleanup();
    render(
      <SessionComplete
        empty={false}
        decided={undefined}
        runs={false}
        onReviewSkipped={null}
        onStartAgain={onAgain}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    cleanup();
    // Nothing skipped: Start Again alone.
    render(
      <SessionComplete
        empty={false}
        decided={undefined}
        runs
        onReviewSkipped={null}
        onStartAgain={onAgain}
      />,
    );
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Start Again']);
  });

  it('an empty set-up says so, with Session Settings for an Editor', () => {
    const onSettings = vi.fn();
    render(
      <SessionComplete
        empty
        decided={undefined}
        runs
        onReviewSkipped={null}
        onStartAgain={vi.fn()}
        onSettings={onSettings}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Session Settings' }));
    expect(onSettings).toHaveBeenCalled();
    cleanup();
    render(
      <SessionComplete
        empty
        decided={undefined}
        runs={false}
        onReviewSkipped={null}
        onStartAgain={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('SessionFacilitatorChip', () => {
  const SAM = { id: 'k-sam', name: 'Sam', color: '#0ea5e9' };
  const ALI = { id: 'k-ali', name: 'Ali', color: '#dc2626' };
  const baton = (over: Partial<SessionBaton>): SessionBaton => ({
    holder: null,
    mine: false,
    canFacilitate: false,
    canTakeOver: false,
    editors: [],
    take: vi.fn(),
    handOver: vi.fn(),
    stepDown: vi.fn(),
    ...over,
  });

  it('nobody holding it: Facilitate for an Editor, words for everyone else', () => {
    const b = baton({ canFacilitate: true });
    render(<SessionFacilitatorChip baton={b} />);
    fireEvent.click(screen.getByRole('button', { name: 'Facilitate' }));
    expect(b.take).toHaveBeenCalled();
    cleanup();
    render(<SessionFacilitatorChip baton={baton({})} />);
    expect(screen.getByText('Nobody facilitating')).toBeTruthy();
  });

  it('someone else holding it: their name, and Take Over once they have been away', () => {
    const b = baton({ holder: ALI, canTakeOver: true });
    render(<SessionFacilitatorChip baton={b} />);
    expect(screen.getByText('Ali is facilitating')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Take Over' }));
    expect(b.take).toHaveBeenCalled();
  });

  it('the facilitator’s menu hands over to an Editor in the room, or steps down', () => {
    const b = baton({ holder: SAM, mine: true, editors: [ALI] });
    render(<SessionFacilitatorChip baton={b} />);
    fireEvent.click(screen.getByRole('button', { name: /You are facilitating/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Ali' }));
    expect(b.handOver).toHaveBeenCalledWith(ALI);
    fireEvent.click(screen.getByRole('button', { name: /You are facilitating/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Step Down' }));
    expect(b.stepDown).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /You are facilitating/ }));
    expect(screen.getByRole('button', { name: 'Step Down' })).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'Step Down' })).toBeNull();
    cleanup();
    render(<SessionFacilitatorChip baton={baton({ holder: SAM, mine: true })} />);
    fireEvent.click(screen.getByRole('button', { name: /You are facilitating/ }));
    expect(screen.getByText('No other Editor is here to hand over to.')).toBeTruthy();
  });
});

describe('useSessionKeys', () => {
  function Keys(props: { on: boolean; spy: (k: string) => void }) {
    useSessionKeys({
      on: props.on,
      refine: () => props.spy('r'),
      skip: () => props.spy('s'),
      flag: () => props.spy('f'),
      next: () => props.spy('j'),
      previous: () => props.spy('k'),
    });
    return <input aria-label="field" />;
  }

  it('R, S, F, J and K act outside fields, never with a modifier, a repeat or while off', () => {
    const spy = vi.fn<(k: string) => void>();
    const { rerender } = render(<Keys on spy={spy} />);
    for (const key of ['r', 'S', 'f', 'j', 'k', 'x']) fireEvent.keyDown(window, { key });
    fireEvent.keyDown(window, { key: 'r', metaKey: true });
    fireEvent.keyDown(window, { key: 'r', repeat: true });
    fireEvent.keyDown(screen.getByLabelText('field'), { key: 'r' });
    expect(spy.mock.calls.map((c) => c[0])).toEqual(['r', 's', 'f', 'j', 'k']);
    rerender(<Keys on={false} spy={spy} />);
    fireEvent.keyDown(window, { key: 'r' });
    expect(spy).toHaveBeenCalledTimes(5);
  });

  it('knows typing from a command', () => {
    const div = document.createElement('div');
    div.contentEditable = 'true';
    Object.defineProperty(div, 'isContentEditable', { value: true });
    const inDialog = document.createElement('button');
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.append(inDialog);
    expect([
      isTypingTarget(null),
      isTypingTarget(div),
      isTypingTarget(inDialog),
      isTypingTarget(document.createElement('textarea')),
      isTypingTarget(document.createElement('button')),
    ]).toEqual([false, true, true, true, false]);
  });
});
