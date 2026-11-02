// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type PlanCardRef, type ShapeElement } from '@liveplanner/project';
import { track } from '@/lib/telemetry';
import { PlanCardMenuSection } from './PlanCardMenuSection';

// docs/specs/026-plan/plan-board.md "The Plan card": a card on the canvas sets its own Card Size, one element edit.
const plan: Record<string, unknown> = {};
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => plan }));
vi.mock('@liveworkspace/workbench/components/primitives/MenuFlyoutSection', () => ({
  MenuFlyoutSection: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(cleanup);

const card = (planCard: PlanCardRef) =>
  ({ ...createShape('plan-card', 0, 0), id: 'card', planCard }) as ShapeElement;

function show(planCard: PlanCardRef, canEdit = true, open = true) {
  for (const key of Object.keys(plan)) delete plan[key];
  Object.assign(plan, { canEdit, updateCard: vi.fn() });
  const onToggle = vi.fn<(id: string) => void>();
  const view = render(
    <PlanCardMenuSection
      element={card(planCard)}
      flyoutProps={{}}
      sectionProps={(id) => ({ open, onToggle: () => onToggle(id) })}
    />,
  );
  return { ...view, onToggle };
}

describe('PlanCardMenuSection', () => {
  it('holds Card Size in a row that stays shut until opened', () => {
    const { onToggle } = show({ itemId: 'item0001' }, true, false);
    const row = screen.getByRole('button', { name: 'Card Size' });
    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('radio', { name: 'Minimal' })).toBeNull();
    fireEvent.click(row);
    expect(onToggle).toHaveBeenCalledWith('plan-card-size');
  });

  it('offers the two sizes, Detailed by default', () => {
    show({ itemId: 'item0001' });
    for (const name of ['Minimal', 'Detailed']) {
      expect(screen.getByRole('radio', { name })).toBeTruthy();
    }
    expect(screen.getByRole('radio', { name: 'Detailed' }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('stores a smaller size on the card and drops Detailed, the default', () => {
    show({ itemId: 'item0001' });
    fireEvent.click(screen.getByRole('radio', { name: 'Minimal' }));
    expect(plan['updateCard']).toHaveBeenCalledWith('card', {
      itemId: 'item0001',
      size: 'minimal',
    });
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'PlanCardSize');
    cleanup();
    show({ itemId: 'item0001', size: 'minimal' });
    fireEvent.click(screen.getByRole('radio', { name: 'Detailed' }));
    expect(plan['updateCard']).toHaveBeenCalledWith('card', { itemId: 'item0001' });
  });

  it('changes nothing when the size picked is the one it has', () => {
    show({ itemId: 'item0001', size: 'minimal' });
    fireEvent.click(screen.getByRole('radio', { name: 'Minimal' }));
    expect(plan['updateCard']).not.toHaveBeenCalled();
  });

  // docs/specs/026-plan/plan-board.md "The Plan card": the sizes are Minimal and Detailed, and an older card's
  // retired Compact reads as Detailed.
  it('offers Minimal and Detailed only, a Compact card showing as Detailed', () => {
    show({ itemId: 'item0001', size: 'compact' } as unknown as PlanCardRef);
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['Minimal', 'Detailed']);
    expect(screen.getByRole('radio', { name: 'Detailed' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Detailed' }));
    expect(plan['updateCard']).not.toHaveBeenCalled();
  });

  it('is not offered to someone who cannot edit', () => {
    const { container } = show({ itemId: 'item0001' }, false);
    expect(container.textContent).toBe('');
  });
});
