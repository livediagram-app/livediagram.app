// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureWorkbench, resetWorkbenchForTests } from '../../bindings';
import { testBindings } from '../../lib/testing/bindings';
import { storageEvent } from '../../lib/testing/storage-event';
import { useHideCursors } from './useHideCursors';

afterEach(() => {
  resetWorkbenchForTests();
  window.localStorage.clear();
});

// Each test binds a key of its own: the store keeps what it wrote for the page's life.
function bind(key: string) {
  const track = vi.fn();
  configureWorkbench(testBindings({ hideCursorsKey: key, track }));
  return track;
}

describe('useHideCursors', () => {
  it('is off until something turns it on', () => {
    bind('test:hide-cursors-a');
    expect(renderHook(() => useHideCursors()).result.current.hidden).toBe(false);
  });

  it("reads this device's stored choice under the editor's key", () => {
    bind('test:hide-cursors-b');
    window.localStorage.setItem('test:hide-cursors-b', 'true');
    expect(renderHook(() => useHideCursors()).result.current.hidden).toBe(true);
  });

  it('treats anything but true as off', () => {
    bind('test:hide-cursors-c');
    window.localStorage.setItem('test:hide-cursors-c', 'yes');
    expect(renderHook(() => useHideCursors()).result.current.hidden).toBe(false);
  });

  it('flips every reader at once, stores the choice, and reports it first', () => {
    const track = bind('test:hide-cursors-d');
    const settings = renderHook(() => useHideCursors());
    const modal = renderHook(() => useHideCursors());
    act(() => settings.result.current.setHidden(true));
    expect(modal.result.current.hidden).toBe(true);
    expect(window.localStorage.getItem('test:hide-cursors-d')).toBe('true');
    expect(track).toHaveBeenLastCalledWith('UI', 'Toggled', 'HideCursorsOn');
    act(() => modal.result.current.setHidden(false));
    expect(settings.result.current.hidden).toBe(false);
    expect(window.localStorage.getItem('test:hide-cursors-d')).toBe('false');
    expect(track).toHaveBeenLastCalledWith('UI', 'Toggled', 'HideCursorsOff');
  });

  it('follows a flip made in another tab', () => {
    bind('test:hide-cursors-e');
    const { result } = renderHook(() => useHideCursors());
    act(() => {
      window.localStorage.setItem('test:hide-cursors-e', 'true');
      window.dispatchEvent(storageEvent({ key: 'test:hide-cursors-e' }));
    });
    expect(result.current.hidden).toBe(true);
  });
});
