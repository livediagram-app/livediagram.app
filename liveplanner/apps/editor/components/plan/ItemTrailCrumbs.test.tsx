// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@liveplanner/items';
import { ItemTrailCrumbs } from './ItemTrailCrumbs';

// docs/specs/026-plan/plan-board.md "Open an item", Breadcrumb: the shared back bar, one step back at a time.

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

function draw(keys: number[], onBack = vi.fn()) {
  const { container } = render(<ItemTrailCrumbs trail={keys.map(item)} onBack={onBack} />);
  return { onBack, container };
}

describe('ItemTrailCrumbs', () => {
  it('draws nothing for a trail of one card', () => {
    expect(draw([1]).container.textContent).toBe('');
  });

  it('is the back bar to the card before, with this card as its chip', () => {
    const { onBack } = draw([1, 2, 3]);
    const nav = screen.getByRole('navigation', { name: 'Card trail' });
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(nav.contains(buttons[0]!)).toBe(true);
    expect(buttons[0]!.textContent).toBe('#2 Card 2#3');
    expect(buttons[0]!.className).toMatch(/\bsticky top-0\b/);
    fireEvent.click(buttons[0]!);
    expect(onBack).toHaveBeenCalledWith('i2');
  });
});
