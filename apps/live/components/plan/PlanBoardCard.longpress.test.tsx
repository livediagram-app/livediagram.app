// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@livediagram/items';
import { LONG_PRESS_MS } from '@/hooks/ui/useLongPress';
import { PlanBoardCard } from './PlanBoardCells';
import { planPalette } from './plan-palette';

// docs/specs/026-plan/plan-board.md "On a phone": a finger held on a card opens its menu, at the finger.
vi.mock('./PlanContext', () => ({ usePlan: () => null }));
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const item = {
  id: 'c1',
  type: 'task',
  key: 1,
  rank: 'a',
  fields: { title: 'Ship it', status: 'todo' },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: { id: 'p', name: 'P', color: '#000' },
  updatedBy: { id: 'p', name: 'P', color: '#000' },
} as unknown as Item;

function card(onLongPress?: (it: Item, at: { x: number; y: number }) => void) {
  const onPress = vi.fn();
  render(
    <PlanBoardCard
      item={item}
      palette={planPalette('light')}
      placeholderBefore={undefined}
      lifted={false}
      done={false}
      setupFields={[]}
      cardSize="compact"
      faceDown={false}
      presence={undefined}
      interactive
      onPress={onPress}
      onOpen={() => {}}
      onKey={() => {}}
      onMenu={() => {}}
      {...(onLongPress ? { onLongPress } : {})}
    />,
  );
  return { onPress, el: screen.getByRole('listitem') };
}

describe('holding a card', () => {
  it('opens its menu at the finger, the press still reaching the drag', () => {
    const onLongPress = vi.fn();
    const { onPress, el } = card(onLongPress);
    fireEvent.pointerDown(el, { pointerType: 'touch', button: 0, clientX: 30, clientY: 40 });
    expect(onPress).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS + 10));
    expect(onLongPress).toHaveBeenCalledWith(item, { x: 30, y: 40 });
  });

  it('does nothing for a mouse, or without a handler', () => {
    const onLongPress = vi.fn();
    const { el } = card(onLongPress);
    fireEvent.pointerDown(el, { pointerType: 'mouse', button: 0, clientX: 30, clientY: 40 });
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS + 10));
    expect(onLongPress).not.toHaveBeenCalled();
    cleanup();
    const { el: bare } = card();
    fireEvent.pointerDown(bare, { pointerType: 'touch', button: 0, clientX: 30, clientY: 40 });
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS + 10));
  });
});
