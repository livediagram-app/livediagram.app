// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DIALOG_WATCH_MS, dialogOpenNow, subscribeDialogs } from './dialog-open';

// toasts.md "One place for everything that pops up": a notice waits while a dialog is open. The watch reads a burst of
// DOM changes (a drag on the canvas) a few times a second, never every frame.
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

const flush = () => Promise.resolve();

describe('subscribeDialogs', () => {
  it('tells the first change at once, a burst after it once, and nothing after the unsubscribe', async () => {
    vi.useFakeTimers();
    const heard = vi.fn();
    const off = subscribeDialogs(heard);
    document.body.appendChild(document.createElement('p'));
    await flush();
    expect(heard).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 20; i++) {
      document.body.appendChild(document.createElement('p'));
      await flush();
    }
    expect(heard).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(DIALOG_WATCH_MS);
    expect(heard).toHaveBeenCalledTimes(2);
    document.body.appendChild(document.createElement('p'));
    await flush();
    off();
    vi.advanceTimersByTime(DIALOG_WATCH_MS);
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('reads an open modal or <dialog>', () => {
    expect(dialogOpenNow()).toBe(false);
    const modal = document.createElement('div');
    modal.setAttribute('aria-modal', 'true');
    document.body.appendChild(modal);
    expect(dialogOpenNow()).toBe(true);
    modal.remove();
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.appendChild(dialog);
    expect(dialogOpenNow()).toBe(true);
  });
});
