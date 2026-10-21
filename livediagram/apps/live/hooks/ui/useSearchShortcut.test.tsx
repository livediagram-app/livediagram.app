// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSearchShortcut } from './useSearchShortcut';
import { writeLocalStorageValue } from './useLocalStorageValue';
import { modalClosed, modalOpened } from '@/lib/modal-guard';

const SHORTCUTS_KEY = 'livediagram:v2:shortcuts-enabled';

function press(
  key: string,
  init: KeyboardEventInit = { metaKey: true },
  target: EventTarget = window,
) {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(e);
  });
  return e;
}

afterEach(() => {
  writeLocalStorageValue(SHORTCUTS_KEY, 'true');
  document.body.innerHTML = '';
});

// The Search panel shortcut off the editor (docs/specs/007-editor/command-palette.md "Shortcut").
describe('useSearchShortcut', () => {
  it('opens search on Cmd+K, Ctrl+K and Cmd+.', () => {
    const open = vi.fn();
    renderHook(() => useSearchShortcut(open));
    expect(press('k').defaultPrevented).toBe(true);
    press('K', { ctrlKey: true });
    press('.', { metaKey: true });
    expect(open).toHaveBeenCalledTimes(3);
  });

  it('ignores the plain key and other chords', () => {
    const open = vi.fn();
    renderHook(() => useSearchShortcut(open));
    press('k', {});
    press('j', { metaKey: true });
    press('k', { metaKey: true, altKey: true });
    expect(open).not.toHaveBeenCalled();
  });

  it('leaves text fields alone', () => {
    const open = vi.fn();
    renderHook(() => useSearchShortcut(open));
    const input = document.createElement('input');
    document.body.appendChild(input);
    expect(press('k', { metaKey: true }, input).defaultPrevented).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it('stands down while a dialog is open', () => {
    const open = vi.fn();
    renderHook(() => useSearchShortcut(open));
    modalOpened();
    try {
      press('k');
    } finally {
      modalClosed();
    }
    expect(open).not.toHaveBeenCalled();
  });

  it('respects the Keyboard Shortcuts setting', () => {
    writeLocalStorageValue(SHORTCUTS_KEY, 'false');
    const open = vi.fn();
    renderHook(() => useSearchShortcut(open));
    press('k');
    expect(open).not.toHaveBeenCalled();
  });
});
