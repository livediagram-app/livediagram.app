// @vitest-environment jsdom

// The Plan card on the canvas (docs/specs/026-plan/plan-board.md "The Plan card"): a click opens its item in Plan
// mode, but the release that ends a drag (moving the card on the canvas) does not.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livediagram/document';
import { ITEM_TYPES, type Item } from '@livediagram/items';
import { PlanProvider, type PlanContextValue } from './PlanContext';
import { PlanCardView } from './PlanCardView';

const person = { id: 'p', name: 'Sam', color: '#2563eb' };
const item: Item = {
  id: 'item-1',
  type: 'task',
  key: 3,
  rank: 'i',
  fields: { title: 'Ship it', status: 'todo' },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: person,
  updatedBy: person,
};
const card = {
  ...createShape('plan-card', 0, 0),
  id: 'card',
  planCard: { itemId: item.id },
} as ShapeElement;

function setup(planInput = true, element: ShapeElement = card) {
  const openItem = vi.fn();
  const plan = {
    items: new Map([[item.id, item]]),
    types: ITEM_TYPES,
    planInput,
    presence: new Map(),
    openItem,
  } as unknown as PlanContextValue;
  render(
    <PlanProvider value={plan}>
      <PlanCardView element={element} />
    </PlanProvider>,
  );
  return { openItem, face: screen.getByRole('button', { name: /Ship it/ }) };
}

afterEach(cleanup);

// Two presses in the double-press window, at one spot: what a double-click or double-tap sends.
function doublePress(face: HTMLElement, x = 10, y = 10) {
  for (const t of [1000, 1200]) {
    fireEvent.pointerDown(face, { clientX: x, clientY: y });
    fireEvent.click(face, { clientX: x, clientY: y, timeStamp: t });
  }
}

describe('PlanCardView', () => {
  it('opens its item on a double press, in Plan mode and out of it', () => {
    for (const planInput of [true, false]) {
      const { openItem, face } = setup(planInput);
      doublePress(face);
      expect(openItem).toHaveBeenCalledWith(item.id);
      cleanup();
    }
  });

  it('stays shut on a single click or tap, even in Plan mode', () => {
    const { openItem, face } = setup();
    fireEvent.pointerDown(face, { clientX: 10, clientY: 10 });
    fireEvent.click(face, { clientX: 10, clientY: 10, timeStamp: 1000 });
    expect(openItem).not.toHaveBeenCalled();
  });

  it('stays shut when a press moved the card', () => {
    const { openItem, face } = setup();
    fireEvent.pointerDown(face, { clientX: 10, clientY: 10 });
    fireEvent.click(face, { clientX: 10, clientY: 10, timeStamp: 1000 });
    // The second press drags the card away: a move, not the second half of a double.
    fireEvent.pointerDown(face, { clientX: 10, clientY: 10 });
    fireEvent.click(face, { clientX: 90, clientY: 40, timeStamp: 1200 });
    expect(openItem).not.toHaveBeenCalled();
  });

  it('draws at its own Card Size: Minimal leaves the number off, Detailed shows it', () => {
    setup(true, { ...card, planCard: { itemId: item.id, size: 'minimal' } } as ShapeElement);
    expect(screen.queryByText('#3')).toBeNull();
    cleanup();
    setup();
    expect(screen.getByText('#3')).toBeTruthy();
  });
});
