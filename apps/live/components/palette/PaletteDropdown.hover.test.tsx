// @vitest-environment jsdom
// openOnHover (the Sheet toolbar's category switcher): a resting mouse opens the menu, leaving both it and the
// trigger closes it, a finger never does, and hovering never changes the value.
import { act, createEvent, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DROPDOWN_HOVER_CLOSE_MS,
  DROPDOWN_HOVER_OPEN_MS,
  PaletteDropdown,
} from './PaletteDropdown';

const options = [
  { id: 'text', label: 'Text' },
  { id: 'cells', label: 'Cells' },
];

// React reads pointer enter / leave off pointerover / pointerout, with their pointerType.
function pointer(el: Element, type: 'pointerOver' | 'pointerOut', pointerType: string) {
  const e = createEvent[type](el);
  Object.defineProperty(e, 'pointerType', { value: pointerType });
  fireEvent(el, e);
}

const menu = () => screen.queryByRole('listbox');

describe('a dropdown that opens on hover', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const show = (openOnHover = true) => {
    const onChange = vi.fn();
    render(
      <PaletteDropdown
        ariaLabel="Toolbar category"
        value="text"
        options={options}
        onChange={onChange}
        openOnHover={openOnHover}
      />,
    );
    return { onChange, trigger: screen.getByRole('button', { name: 'Toolbar category' }) };
  };

  it('opens for a resting mouse, stays open on the way into the menu, and closes after leaving both', () => {
    const { onChange, trigger } = show();
    pointer(trigger, 'pointerOver', 'mouse');
    act(() => vi.advanceTimersByTime(DROPDOWN_HOVER_OPEN_MS - 1));
    expect(menu()).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(menu()).toBeTruthy();
    // Out of the trigger and into the menu: still open.
    pointer(trigger, 'pointerOut', 'mouse');
    pointer(menu()!, 'pointerOver', 'mouse');
    act(() => vi.advanceTimersByTime(DROPDOWN_HOVER_CLOSE_MS));
    expect(menu()).toBeTruthy();
    pointer(menu()!, 'pointerOut', 'mouse');
    act(() => vi.advanceTimersByTime(DROPDOWN_HOVER_CLOSE_MS));
    expect(menu()).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores a passing mouse and a finger, and a click opens rather than toggles', () => {
    const { trigger } = show();
    pointer(trigger, 'pointerOver', 'mouse');
    pointer(trigger, 'pointerOut', 'mouse');
    act(() => vi.advanceTimersByTime(DROPDOWN_HOVER_OPEN_MS * 2));
    expect(menu()).toBeNull();
    pointer(trigger, 'pointerOver', 'touch');
    act(() => vi.advanceTimersByTime(DROPDOWN_HOVER_OPEN_MS * 2));
    expect(menu()).toBeNull();
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(menu()).toBeTruthy();
  });

  it('stays click-to-open without it', () => {
    const { trigger } = show(false);
    pointer(trigger, 'pointerOver', 'mouse');
    act(() => vi.advanceTimersByTime(DROPDOWN_HOVER_OPEN_MS * 2));
    expect(menu()).toBeNull();
  });
});
