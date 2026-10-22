// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, cardTypesTakenOnTab } from '@livediagram/items';
import { setCardTypesTaken } from '@/hooks/plan/card-types-taken';
import { PaletteTile, type PaletteTileActions } from './PaletteTileGrid';
import { planCardTile } from './palette-plan-tiles';

// docs/specs/026-plan/plan-mode.md "The palette": a card tile no board on the tab takes is greyed out.
afterEach(() => {
  cleanup();
  act(() => setCardTypesTaken({ kind: 'all' }));
});

const task = ITEM_TYPES.find((t) => t.id === 'task')!;

function tile(over: Partial<ReturnType<typeof planCardTile>> = {}) {
  const addShape = vi.fn();
  const actions = { addShape, hasImage: false } as unknown as PaletteTileActions;
  render(
    <PaletteTile def={{ ...planCardTile(task), ...over }} actions={actions} pendingDraw={null} />,
  );
  return { addShape, button: screen.getByRole('button', { name: 'Add Task Card' }) };
}

describe('a palette card tile', () => {
  it('works while some board on the tab takes its type', () => {
    act(() => setCardTypesTaken(cardTypesTakenOnTab([{ addTypes: ['task'] }])));
    const { addShape, button } = tile();
    expect(button.getAttribute('aria-disabled')).toBeNull();
    expect(button.getAttribute('draggable')).toBe('true');
    fireEvent.click(button);
    expect(addShape).toHaveBeenCalled();
  });

  it('is greyed out, focusable and inert on a tab with no board', () => {
    act(() => setCardTypesTaken(cardTypesTakenOnTab([])));
    const { addShape, button } = tile();
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(button.getAttribute('draggable')).toBe('false');
    fireEvent.click(button);
    expect(addShape).not.toHaveBeenCalled();
  });

  it('is greyed out when no board on the tab shows its type', () => {
    act(() => setCardTypesTaken(cardTypesTakenOnTab([{ addTypes: ['note'] }, { archive: true }])));
    const { addShape, button } = tile();
    expect(button.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(button);
    expect(addShape).not.toHaveBeenCalled();
  });

  it('honours a static reason on any tile', () => {
    const { button } = tile({ disabled: { reason: 'Not here' } });
    expect(button.getAttribute('aria-disabled')).toBe('true');
  });
});
