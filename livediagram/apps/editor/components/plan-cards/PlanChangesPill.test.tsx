// @vitest-environment jsdom
// Changes to the plan (make-plan-cards.md "Changes to the plan"): a pill counting the offers, Review opening the list,
// Apply and Apply All sending them as the person, Dismiss hiding one, a refusal said on its row.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IndexError } from '@liveworkspace/index-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const toast = vi.hoisted(() => ({ success: vi.fn() }));
const track = vi.hoisted(() => vi.fn());
vi.mock('@liveworkspace/workbench/hooks/ui/useToast', () => ({ useToast: () => toast }));
vi.mock('@liveworkspace/workbench/lib/index-client', () => ({ indexClient: {} }));
vi.mock('@/lib/telemetry', () => ({ track }));

import { PlanChangesPill, setPlanChanges } from './PlanChangesPill';
import type { PlanChangeOffer } from '@/lib/plan-cards/plan-changes';

const block: PlanChangeOffer = {
  key: 'block:a>b',
  edit: { kind: 'block', card: 'b', blocker: 'a' },
  words: 'Build waits on Design',
};
const move: PlanChangeOffer = {
  key: 'move:b>done',
  edit: { kind: 'move', card: 'b', column: 'Done' },
  words: 'Build moves to Done',
};

function show(offers: PlanChangeOffer[]) {
  const onDismiss = vi.fn();
  act(() => setPlanChanges({ planId: 'P', offers, onDismiss }));
  return onDismiss;
}

afterEach(() => {
  act(() => setPlanChanges(null));
  cleanup();
  vi.clearAllMocks();
});

describe('PlanChangesPill', () => {
  it('shows nothing without offers', () => {
    const { container } = render(<PlanChangesPill client={{ applyPlanEdits: vi.fn() }} />);
    expect(container.innerHTML).toBe('');
    show([]);
    expect(container.innerHTML).toBe('');
  });

  it('counts the offers; Review lists them; Apply sends one as the person and Dismiss hides one', async () => {
    const applyPlanEdits = vi.fn().mockResolvedValue({ results: [{ status: 'applied' }] });
    render(<PlanChangesPill client={{ applyPlanEdits }} />);
    const onDismiss = show([block, move]);
    expect(screen.getByText('2 changes to the plan')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'PlanChange');
    fireEvent.click(screen.getAllByRole('button', { name: 'Apply' })[0]!);
    await waitFor(() => expect(onDismiss).toHaveBeenCalledWith('block:a>b'));
    expect(applyPlanEdits).toHaveBeenCalledWith('P', [block.edit]);
    expect(toast.success).toHaveBeenCalledWith('Changed the plan');
    expect(track).toHaveBeenCalledWith('UI', 'Created', 'PlanChange');
    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[1]!);
    expect(onDismiss).toHaveBeenCalledWith('move:b>done');
    expect(track).toHaveBeenCalledWith('UI', 'Closed', 'PlanChange');
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByRole('button', { name: 'Apply All' })).toBeNull();
  });

  it('applies all at once, keeping a refused one with its reason', async () => {
    const applyPlanEdits = vi.fn().mockResolvedValue({
      results: [{ status: 'applied' }, { status: 'refused', reason: 'That card is gone' }],
    });
    render(<PlanChangesPill client={{ applyPlanEdits }} />);
    show([block, move, { ...move, key: 'extra' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply All' }));
    expect(await screen.findByText('That card is gone')).toBeTruthy();
    expect(toast.success).toHaveBeenCalledWith('Changed the plan');
    expect(track).toHaveBeenCalledWith('UI', 'Refused', 'PlanChange');
  });

  it('says why when the plan refuses or cannot be reached', async () => {
    const cases: [unknown, string][] = [
      [new IndexError(403, 'forbidden'), 'You can view this plan but not change it.'],
      [
        new IndexError(429, 'rate_limited'),
        'That is a lot of changes at once. Try again in a minute.',
      ],
      [new Error('offline'), "The plan couldn't be reached just now. Try again."],
    ];
    for (const [err, words] of cases) {
      const applyPlanEdits = vi.fn().mockRejectedValue(err);
      render(<PlanChangesPill client={{ applyPlanEdits }} />);
      show([block]);
      expect(screen.getByText('1 change to the plan')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Review' }));
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
      expect(await screen.findByText(words)).toBeTruthy();
      cleanup();
    }
  });

  it('applies two at once with one toast', async () => {
    const applyPlanEdits = vi
      .fn()
      .mockResolvedValue({ results: [{ status: 'applied' }, { status: 'applied' }] });
    render(<PlanChangesPill client={{ applyPlanEdits }} />);
    show([block, move]);
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply All' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Made 2 changes to the plan'));
  });
});
