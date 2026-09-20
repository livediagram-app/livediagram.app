// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePhotoPicker } from './usePhotoPicker';

// Opening the file picker, once (spec/139 Phase 9).
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
  const clicks = vi.fn();
  const view = renderHook(() => usePhotoPicker({ canOpen: () => opts.canOpen !== false, onFile }));
  const input = { click: clicks, value: 'x', files: null } as unknown as HTMLInputElement;
  view.result.current.inputRef.current = input;
  return { api: () => view.result.current, onFile, clicks, input };
}

const file = () => new File([new Uint8Array([1])], 'wall.jpg', { type: 'image/jpeg' });

function change(input: HTMLInputElement, files: File[]) {
  return { target: Object.assign(input, { files, value: 'wall.jpg' }) } as never;
}

describe('usePhotoPicker', () => {
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
    act(() => h.api().open());
    expect(h.clicks).toHaveBeenCalledTimes(2);
  });

  it('opens again after the dialog was dismissed with no file', () => {
    const h = setup();
    act(() => h.api().open());
    // Cancelling the OS dialog fires no `change` at all; the window simply gets
    // its focus back. Without this the button would be dead ever after.
    act(() => window.dispatchEvent(new Event('focus')));
    act(() => h.api().open());
    expect(h.clicks).toHaveBeenCalledTimes(2);
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
