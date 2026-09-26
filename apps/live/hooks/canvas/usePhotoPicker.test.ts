// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePhotoPicker } from './usePhotoPicker';

// Opening the file picker, once (docs/specs/021-event-storming/event-storming.md Phase 9).
//
// This exists because of a Linux/GTK behaviour that costs the whole import:
// DOUBLE-CLICKING a file in the dialog closes it on the first click, and the
// second click of the pair lands on the PAGE underneath — on the very button
// that opened the dialog, which opens a new one. The chooser that was already
// returning a file is replaced, its `change` never arrives, and the author sees
// nothing happen at all. Selecting the file and pressing Open, one click, was
// always fine — which is exactly the difference the operator reported.

function setup(opts: { canOpen?: boolean } = {}) {
  const onFile = vi.fn();
  const onOpen = vi.fn();
  const clicks = vi.fn();
  const view = renderHook(() =>
    usePhotoPicker({ canOpen: () => opts.canOpen !== false, onFile, onOpen }),
  );
  const input = { click: clicks, value: 'x', files: null } as unknown as HTMLInputElement;
  view.result.current.inputRef.current = input;
  return { api: () => view.result.current, onFile, onOpen, clicks, input };
}

const file = () => new File([new Uint8Array([1])], 'wall.jpg', { type: 'image/jpeg' });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function change(input: HTMLInputElement, files: File[]) {
  return { target: Object.assign(input, { files, value: 'wall.jpg' }) } as never;
}

describe('usePhotoPicker', () => {
  it('tells its owner a pick has begun, so slow work can start while the author chooses', () => {
    const h = setup();
    act(() => {
      h.api().open();
      h.api().open();
    });
    expect(h.onOpen).toHaveBeenCalledTimes(1);
  });

  it('does not report a pick the board refused', () => {
    const h = setup({ canOpen: false });
    act(() => h.api().open());
    expect(h.onOpen).not.toHaveBeenCalled();
  });

  it('opens the picker on a click', () => {
    const h = setup();
    act(() => h.api().open());
    expect(h.clicks).toHaveBeenCalledTimes(1);
  });

  it('ignores the second click of a double-click, which would cancel the first', () => {
    const h = setup();
    act(() => {
      h.api().open();
      h.api().open();
    });
    expect(h.clicks).toHaveBeenCalledTimes(1);
  });

  it('opens again once the first pick has delivered its file', () => {
    const h = setup();
    act(() => h.api().open());
    act(() => h.api().onChange(change(h.input, [file()])));
    expect(h.onFile).toHaveBeenCalledTimes(1);
    act(() => void vi.advanceTimersByTime(600));
    act(() => h.api().open());
    expect(h.clicks).toHaveBeenCalledTimes(2);
  });

  it('opens again after the dialog was dismissed with no file', () => {
    const h = setup();
    act(() => h.api().open());
    // Cancelling the OS dialog fires no `change` at all; the window simply gets
    // its focus back. Without this the button would be dead ever after.
    act(() => window.dispatchEvent(new Event('focus')));
    act(() => void vi.advanceTimersByTime(600));
    act(() => h.api().open());
    expect(h.clicks).toHaveBeenCalledTimes(2);
  });

  // The one that matters, and the one the first version got wrong. Chrome on
  // Linux delivers the events in this order for a double-click:
  //   dialog closes → window FOCUS → the stray second click → change
  // so releasing the lock on focus releases it a moment BEFORE the click it
  // exists to ignore. The lock has to outlive the dialog closing.
  it('ignores a click that arrives in the instant after the dialog closes', () => {
    const h = setup();
    act(() => h.api().open());
    act(() => window.dispatchEvent(new Event('focus')));
    act(() => h.api().open());
    expect(h.clicks).toHaveBeenCalledTimes(1);
  });

  it('still delivers the file that was already on its way', () => {
    const h = setup();
    act(() => h.api().open());
    act(() => window.dispatchEvent(new Event('focus')));
    act(() => h.api().open());
    act(() => h.api().onChange(change(h.input, [file()])));
    expect(h.onFile).toHaveBeenCalledTimes(1);
  });

  it('clears the input so the SAME file can be picked twice', () => {
    const h = setup();
    act(() => h.api().open());
    act(() => h.api().onChange(change(h.input, [file()])));
    expect(h.input.value).toBe('');
  });

  it('does not open when the board cannot take a photo', () => {
    const h = setup({ canOpen: false });
    act(() => h.api().open());
    expect(h.clicks).not.toHaveBeenCalled();
  });
});
