import { fireEvent, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dialogOpen, isSearchChord, isTypingTarget, useSearchShortcut } from './useSearchShortcut';

const press = (init: KeyboardEventInit, target: EventTarget = window) => {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('isSearchChord', () => {
  it('takes Cmd or Ctrl with K or a full stop, and nothing else', () => {
    const chord = (init: KeyboardEventInit) => isSearchChord(new KeyboardEvent('keydown', init));
    expect(chord({ key: 'k', metaKey: true })).toBe(true);
    expect(chord({ key: 'K', ctrlKey: true, shiftKey: true })).toBe(true);
    expect(chord({ key: '.', metaKey: true })).toBe(true);
    expect(chord({ key: '.', ctrlKey: true })).toBe(true);
    expect(chord({ key: 'k' })).toBe(false);
    expect(chord({ key: '.' })).toBe(false);
    expect(chord({ key: 'k', metaKey: true, altKey: true })).toBe(false);
    expect(chord({ key: 'j', metaKey: true })).toBe(false);
  });
});

describe('isTypingTarget', () => {
  it('knows text fields, text areas, selects and editable text', () => {
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    // jsdom does not compute isContentEditable from the attribute.
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    expect(isTypingTarget(document.createElement('input'))).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(document.createElement('select'))).toBe(true);
    expect(isTypingTarget(editable)).toBe(true);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(window)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('dialogOpen', () => {
  it('sees any aria-modal element in the page', () => {
    expect(dialogOpen()).toBe(false);
    document.body.innerHTML = '<div role="dialog" aria-modal="true"></div>';
    expect(dialogOpen()).toBe(true);
  });
});

describe('useSearchShortcut', () => {
  it('opens on Cmd/Ctrl+K and Cmd/Ctrl+., taking the key', () => {
    const open = vi.fn();
    renderHook(() => useSearchShortcut(open));
    expect(press({ key: 'k', metaKey: true }).defaultPrevented).toBe(true);
    expect(press({ key: '.', ctrlKey: true }).defaultPrevented).toBe(true);
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('leaves other keys alone', () => {
    const open = vi.fn();
    renderHook(() => useSearchShortcut(open));
    expect(press({ key: 'k' }).defaultPrevented).toBe(false);
    expect(press({ key: '.', metaKey: true, altKey: true }).defaultPrevented).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it('stands aside while typing in a field', () => {
    const open = vi.fn();
    renderHook(() => useSearchShortcut(open));
    const { getByRole } = render(<input aria-label="Filter" />);
    const e = press({ key: 'k', metaKey: true }, getByRole('textbox'));
    fireEvent.keyDown(getByRole('textbox'), { key: '.', ctrlKey: true });
    expect(e.defaultPrevented).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it('stands aside while a dialog is open', () => {
    const open = vi.fn();
    renderHook(() => useSearchShortcut(open));
    render(
      <div role="dialog" aria-modal="true">
        <button type="button">Close</button>
      </div>,
    );
    expect(press({ key: 'k', metaKey: true }).defaultPrevented).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it('stands aside for a key another handler already took', () => {
    const open = vi.fn();
    renderHook(() => useSearchShortcut(open));
    const taken = new KeyboardEvent('keydown', { key: 'k', metaKey: true, cancelable: true });
    taken.preventDefault();
    window.dispatchEvent(taken);
    expect(open).not.toHaveBeenCalled();
  });

  it('calls the latest handler and stops listening once unmounted', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(({ fn }) => useSearchShortcut(fn), {
      initialProps: { fn: first },
    });
    rerender({ fn: second });
    press({ key: 'k', metaKey: true });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    unmount();
    press({ key: 'k', metaKey: true });
    expect(second).toHaveBeenCalledTimes(1);
  });
});
