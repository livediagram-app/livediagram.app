// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type Item } from '@livediagram/items';
import { ItemTrailCrumbs } from './ItemTrailCrumbs';

// docs/specs/026-plan/plan-board.md "Open an item", Breadcrumb.

afterEach(cleanup);

const PERSON = { id: 'p', name: 'Sam', color: '#2563eb' };
const item = (key: number): Item => ({
  id: `i${key}`,
  type: key === 1 ? 'project' : 'task',
  key,
  rank: 'i',
  fields: { title: `Card ${key}` },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
});

function draw(keys: number[], mobile = false, onBack = vi.fn()) {
  const { container } = render(
    <ItemTrailCrumbs trail={keys.map(item)} types={ITEM_TYPES} mobile={mobile} onBack={onBack} />,
  );
  return { onBack, container };
}

describe('ItemTrailCrumbs', () => {
  it('draws nothing for a trail of one card', () => {
    expect(draw([1]).container.textContent).toBe('');
  });

  it('offers each earlier card as a step back, the current card left to the header', () => {
    const { onBack } = draw([1, 2, 3]);
    expect(screen.getByRole('navigation', { name: 'Card trail' })).toBeTruthy();
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Back to #1 Card 1',
      'Back to #2 Card 2',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Back to #1 Card 1' }));
    expect(onBack).toHaveBeenCalledWith('i1');
  });

  it('folds the crumbs past what fits into a menu that names how many and steps back to each', () => {
    const { onBack } = draw([1, 2, 3, 4, 5, 6]);
    expect(
      screen.getAllByRole('button', { name: /^Back to/ }).map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Back to #3 Card 3', 'Back to #4 Card 4', 'Back to #5 Card 5']);
    fireEvent.click(screen.getByRole('button', { name: '2 earlier cards' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Back to #1 Card 1' }));
    expect(onBack).toHaveBeenCalledWith('i1');
  });

  it('shows only the previous crumb on a phone', () => {
    draw([1, 2, 3], true);
    expect(
      screen.getAllByRole('button', { name: /^Back to/ }).map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Back to #2 Card 2']);
    expect(screen.getByRole('button', { name: '1 earlier card' })).toBeTruthy();
  });
});
