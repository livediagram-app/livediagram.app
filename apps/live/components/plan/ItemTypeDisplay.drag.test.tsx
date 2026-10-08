// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, cardLayoutFields, typeCardLayout } from '@livediagram/items';
import { ItemTypeDisplay } from './ItemTypeDisplay';

// docs/specs/026-plan/item-types.md "Editing a type": Display. A chip dragged on the card: a copy follows the
// pointer, a bar marks where it lands, Available Fields takes it off, and Escape cancels.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const task = ITEM_TYPES.find((t) => t.id === 'task')!;

function display() {
  const onChange = vi.fn();
  render(<ItemTypeDisplay type={task} display={{}} onChange={onChange} />);
  return onChange;
}

const chip = (field: string) => document.querySelector<HTMLElement>(`[data-chip="${field}"]`)!;
const slotEl = (slot: string) => document.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
// What the pointer is over: jsdom has no layout, so each test says.
const pointAt = (el: Element) =>
  ((document as unknown as { elementsFromPoint: () => Element[] }).elementsFromPoint = () => [el]);

// A slot of the compact card other than the one holding `field`.
function otherSlot(field: string): string {
  const from = chip(field).closest<HTMLElement>('[data-slot]')!.dataset.slot;
  return [...document.querySelectorAll<HTMLElement>('[data-slot]')]
    .map((el) => el.dataset.slot!)
    .find((s) => s !== from)!;
}

function startDrag(field: string, over: Element) {
  pointAt(over);
  fireEvent.pointerDown(chip(field), { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
  fireEvent.pointerMove(chip(field), { clientX: 60, clientY: 60, pointerId: 1 });
}

describe('dragging a field on the card', () => {
  it('shows the field following the pointer and a bar where it lands, then moves it there', () => {
    const onChange = display();
    const to = otherSlot('due');
    startDrag('due', slotEl(to));
    expect(document.querySelector('[data-drop-marker]')!.closest('[data-slot]')).toBe(slotEl(to));
    expect(document.body.lastElementChild!.textContent).toBe('Due Date');
    fireEvent.pointerUp(chip('due'), { clientX: 60, clientY: 60, pointerId: 1 });
    const layout = onChange.mock.lastCall![0].compact;
    expect(layout[to]).toContain('due');
    expect(document.querySelector('[data-drop-marker]')).toBeNull();
  });

  // A pointer whose capture was lost (a touch, as the editor re-renders) releases over another part: the window
  // still hears it, so the drop lands rather than leaving the drag stuck.
  it('drops in another part when the release lands there, not on the chip', () => {
    const onChange = display();
    const to = otherSlot('due');
    startDrag('due', slotEl(to));
    fireEvent.pointerUp(slotEl(to), { clientX: 60, clientY: 60, pointerId: 1 });
    expect(onChange.mock.lastCall![0].compact[to]).toContain('due');
    expect(document.querySelector('[data-drop-marker]')).toBeNull();
  });

  it('takes a field off when it is dropped on Available Fields', () => {
    const onChange = display();
    startDrag('due', screen.getByRole('region', { name: 'Available Fields' }));
    expect(screen.getByText('Drop to take it off the card')).toBeTruthy();
    expect(document.querySelector('[data-drop-marker]')).toBeNull();
    fireEvent.pointerUp(chip('due'), { clientX: 60, clientY: 60, pointerId: 1 });
    const before = cardLayoutFields('compact', typeCardLayout(task, 'compact'));
    const after = cardLayoutFields('compact', onChange.mock.lastCall![0].compact);
    expect(after).toEqual(before.filter((f) => f !== 'due'));
  });

  it('changes nothing when dropped off both, or cancelled with Escape', () => {
    const onChange = display();
    startDrag('due', document.body);
    fireEvent.pointerUp(chip('due'), { clientX: 60, clientY: 60, pointerId: 1 });
    startDrag('due', slotEl(otherSlot('due')));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(document.querySelector('[data-drop-marker]')).toBeNull();
    fireEvent.pointerUp(chip('due'), { clientX: 60, clientY: 60, pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('treats a press that never moves as no drag', () => {
    const onChange = display();
    pointAt(slotEl(otherSlot('due')));
    fireEvent.pointerDown(chip('due'), { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(chip('due'), { clientX: 12, clientY: 11, pointerId: 1 });
    fireEvent.pointerUp(chip('due'), { clientX: 12, clientY: 11, pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('the card’s size', () => {
  it('fits the card to a narrow tab, within its bounds', async () => {
    const { cardZoomFor } = await import('./ItemTypeDisplay');
    expect(cardZoomFor(undefined)).toBe(1.4);
    expect(cardZoomFor(1000)).toBe(1.4);
    expect(cardZoomFor(392)).toBe(1);
    expect(cardZoomFor(200)).toBe(0.75);
  });
});
