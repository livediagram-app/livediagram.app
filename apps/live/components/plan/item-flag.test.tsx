// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isFlagged, type Item } from '@livediagram/items';
import { planPalette } from './plan-palette';
import { toggleFlag } from './item-flag';
import { PlanCardFace } from './PlanCardFace';

// docs/specs/026-plan/items.md "Flags".
const track = vi.fn();
vi.mock('@/lib/telemetry', () => ({ track: (...a: unknown[]) => track(...a) }));
vi.mock('./PlanContext', () => ({ usePlan: () => undefined }));

afterEach(cleanup);

const item = (fields: Item['fields']): Item =>
  ({
    id: 'item0001',
    type: 'task',
    key: 3,
    rank: 'i',
    fields: { title: 'Ship', ...fields },
    rev: 1,
    createdAt: 0,
    updatedAt: 0,
    createdBy: { id: 'p', name: 'Sam', color: '#2563eb' },
    updatedBy: { id: 'p', name: 'Sam', color: '#2563eb' },
  }) as Item;

describe('flags', () => {
  it('sets the flag, then clears it, and counts each', () => {
    const plan = { patchItem: vi.fn(), announce: vi.fn() };
    toggleFlag(plan, item({}));
    expect(plan.patchItem).toHaveBeenLastCalledWith('item0001', { set: { flagged: true } });
    expect(track).toHaveBeenLastCalledWith('Plan', 'Toggled', 'FlagOn');
    toggleFlag(plan, item({ flagged: true }));
    expect(plan.patchItem).toHaveBeenLastCalledWith('item0001', { clear: ['flagged'] });
    expect(plan.announce).toHaveBeenLastCalledWith('Flag removed');
    expect(track).toHaveBeenLastCalledWith('Plan', 'Toggled', 'FlagOff');
  });

  it('reads only true as flagged', () => {
    expect(isFlagged(item({ flagged: true }))).toBe(true);
    expect(isFlagged(item({ flagged: 'yes' }))).toBe(false);
  });

  it('marks a flagged card at every size', () => {
    for (const size of ['minimal', 'compact', 'detailed'] as const) {
      render(
        <PlanCardFace
          item={item({ flagged: true })}
          fields={[]}
          palette={planPalette('light', {})}
          size={size}
        />,
      );
      expect(screen.getByRole('img', { name: 'Flagged' })).toBeTruthy();
      cleanup();
    }
  });
});
