// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { forgetPlanQueues, planQueue, subscribeHeldReview } from '@/lib/offline-queue/plan-queue';
import type { HeldWhy } from '@/lib/offline-queue/removal-held';
import { HeldRemovalsBanner } from './HeldRemovalsBanner';

// docs/specs/007-editor/offline-changes.md "Held for review": the Needs Review banner.

const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));

afterEach(() => {
  localStorage.clear();
  forgetPlanQueues();
  toast.success.mockClear();
});

// `n` cards held, one change each, all for `why`; in the plan `plan`.
const hold = (n: number, why?: HeldWhy, plan = 'p') => {
  const q = planQueue(plan, 'o');
  const ids: string[] = [];
  for (let i = 1; i <= n; i += 1) {
    const id = `${plan}-i${i}`;
    ids.push(id);
    q.add({ id, seq: i, store: 'items', write: { kind: 'delete', id: `${plan}-c${i}` } });
  }
  q.hold(ids, why ? (c) => ({ ...why, titles: [`Card ${c.id}`] }) : undefined);
};

describe('HeldRemovalsBanner', () => {
  it('shows nothing with nothing held, or to a read-only session', () => {
    const { container, rerender } = render(<HeldRemovalsBanner readOnly={false} />);
    expect(container.innerHTML).toBe('');
    act(() => hold(2));
    rerender(<HeldRemovalsBanner readOnly />);
    expect(container.innerHTML).toBe('');
    // The server render holds none.
    expect(renderToString(<HeldRemovalsBanner readOnly={false} />)).toBe('');
  });

  it('titles the count and says why in plain words, as a labelled region', () => {
    render(<HeldRemovalsBanner readOnly={false} />);
    act(() => hold(11, { reason: 'over-threshold', board: 'Sprint' }));
    const region = screen.getByRole('region', { name: '11 cards were about to be removed' });
    expect(region).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(
      '11 cards were about to be removed' +
        'That’s more of Sprint than usual in one go, so we paused it. Nothing is gone yet.',
    );
  });

  it('makes Keep Cards the primary button and names the removal, toasting what each did', () => {
    const reviews: string[] = [];
    subscribeHeldReview((r) => reviews.push(r));
    render(<HeldRemovalsBanner readOnly={false} />);
    act(() => hold(3));
    const keep = screen.getByRole('button', { name: 'Keep Cards' });
    const remove = screen.getByRole('button', { name: 'Remove 3 Cards' });
    expect(keep.className).toMatch(/bg-brand-700/);
    expect(remove.className).not.toMatch(/bg-brand-700/);
    // Reading order: the removal, then the safe choice at the end (under the thumb on a phone).
    expect(remove.compareDocumentPosition(keep) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(remove);
    expect(reviews).toEqual(['confirmed']);
    expect(toast.success).toHaveBeenLastCalledWith('Removed 3 cards');
    expect(screen.queryByRole('region')).toBeNull();
    act(() => hold(1, undefined, 'q'));
    expect(screen.getByRole('region', { name: '1 card was about to be removed' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep Card' }));
    expect(reviews).toEqual(['confirmed', 'kept']);
    expect(toast.success).toHaveBeenLastCalledWith('Kept 1 card');
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('shows the held cards on asking, grouped by board when there are several', () => {
    render(<HeldRemovalsBanner readOnly={false} />);
    act(() => {
      hold(2, { reason: 'empties-board', board: 'Sprint' });
      hold(1, { reason: 'over-threshold', board: 'Roadmap' }, 'r');
    });
    expect(screen.getByRole('status').textContent).toMatch(/That’s more cards than usual/);
    const toggle = screen.getByRole('button', { name: 'Show the 3 cards' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Would empty Sprint')).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.textContent).toBe('Hide the cards');
    const list = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(list.textContent).toBe('Would empty SprintCard p-i1Card p-i2From RoadmapCard r-i1');
    fireEvent.click(toggle);
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)).toBeNull();
  });

  it('lists a single board without a heading, and counts cards it kept no title for', () => {
    render(<HeldRemovalsBanner readOnly={false} />);
    act(() => hold(2));
    fireEvent.click(screen.getByRole('button', { name: 'Show the 2 cards' }));
    expect(screen.getByText('2 cards')).toBeTruthy();
    expect(screen.queryByText(/^From /)).toBeNull();
  });

  // A modal in the middle of the screen over a scrim, so the board never moves (owner, 2026-11-16).
  it('is a centred modal that fills a phone less its gutters and is 34 rem on a wide canvas', () => {
    render(<HeldRemovalsBanner readOnly={false} />);
    act(() => hold(27));
    const card = screen.getByRole('dialog');
    expect(card.getAttribute('aria-modal')).toBe('true');
    const cls = card.className.split(' ');
    expect(cls).toEqual(
      expect.arrayContaining([
        'fixed',
        'top-1/2',
        'left-1/2',
        'rounded-2xl',
        'w-[34rem]',
        'max-w-[calc(100vw-1.5rem)]',
      ]),
    );
    expect(cls).not.toContain('rounded-full');
    const keep = screen.getByRole('button', { name: 'Keep Cards' }).className.split(' ');
    expect(keep).toEqual(expect.arrayContaining(['flex-1', 'min-h-10', 'sm:flex-none']));
  });
});
