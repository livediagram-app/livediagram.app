import { afterEach, describe, expect, it, vi } from 'vitest';
import { onPageHide } from './page-hide';

// A minimal event target that records the phase each listener asked for and
// dispatches the way the DOM does at the target: capture listeners first, then
// bubble listeners, each in registration order.
function makeTarget() {
  const listeners: Array<{ type: string; fn: () => void; capture: boolean }> = [];
  const captureOf = (opts?: boolean | AddEventListenerOptions) =>
    typeof opts === 'boolean' ? opts : !!opts?.capture;
  return {
    addEventListener(type: string, fn: () => void, opts?: boolean | AddEventListenerOptions) {
      listeners.push({ type, fn, capture: captureOf(opts) });
    },
    removeEventListener(type: string, fn: () => void, opts?: boolean | AddEventListenerOptions) {
      const i = listeners.findIndex(
        (l) => l.type === type && l.fn === fn && l.capture === captureOf(opts),
      );
      if (i >= 0) listeners.splice(i, 1);
    },
    fire(type: string) {
      const matching = listeners.filter((l) => l.type === type);
      for (const l of matching.filter((m) => m.capture)) l.fn();
      for (const l of matching.filter((m) => !m.capture)) l.fn();
    },
    count: () => listeners.length,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('onPageHide', () => {
  it('runs before a bubble-phase flush that registered first', () => {
    const win = makeTarget();
    const doc = Object.assign(makeTarget(), { visibilityState: 'visible' });
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', doc);
    const order: string[] = [];
    // The engine's flush, attached long before the host's listener.
    win.addEventListener('pagehide', () => order.push('flush'));
    onPageHide(() => order.push('emit'));
    win.fire('pagehide');
    expect(order).toEqual(['emit', 'flush']);
  });

  it('fires on the tab going hidden, not on it becoming visible', () => {
    const win = makeTarget();
    const doc = Object.assign(makeTarget(), { visibilityState: 'visible' });
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', doc);
    const cb = vi.fn();
    onPageHide(cb);
    doc.fire('visibilitychange');
    expect(cb).not.toHaveBeenCalled();
    doc.visibilityState = 'hidden';
    doc.fire('visibilitychange');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes both listeners', () => {
    const win = makeTarget();
    const doc = Object.assign(makeTarget(), { visibilityState: 'hidden' });
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', doc);
    const cb = vi.fn();
    const off = onPageHide(cb);
    off();
    win.fire('pagehide');
    doc.fire('visibilitychange');
    expect(cb).not.toHaveBeenCalled();
    expect(win.count() + doc.count()).toBe(0);
  });

  it('is a no-op outside the browser', () => {
    expect(() => onPageHide(() => {})()).not.toThrow();
  });
});
