// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { forgetPlanQueues, planQueue, subscribeHeldReview } from '@/lib/offline-queue/plan-queue';
import { HeldRemovalsBanner } from './HeldRemovalsBanner';

// docs/specs/007-editor/offline-changes.md "Held for review": the Needs Review banner.

afterEach(() => {
  localStorage.clear();
  forgetPlanQueues();
});

const hold = (n: number) => {
  const q = planQueue('p', 'o');
  for (let i = 1; i <= n; i += 1) {
    q.add({ id: `i${i}`, seq: i, store: 'items', write: { kind: 'delete', id: `c${i}` } });
  }
  q.hold(Array.from({ length: n }, (_, i) => `i${i + 1}`));
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

  it('counts the held removals and offers Keep Cards and Remove Anyway', () => {
    const reviews: string[] = [];
    subscribeHeldReview((r) => reviews.push(r));
    render(<HeldRemovalsBanner readOnly={false} />);
    act(() => hold(3));
    expect(screen.getByRole('status').textContent).toBe(
      '3 card removals are held: they would take too many cards off a board, or empty it.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove Anyway' }));
    expect(reviews).toEqual(['confirmed']);
    expect(screen.queryByRole('status')).toBeNull();
    act(() => hold(1));
    fireEvent.click(screen.getByRole('button', { name: 'Keep Cards' }));
    expect(reviews).toEqual(['confirmed', 'kept']);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
