import { describe, expect, it, vi } from 'vitest';
import { createListeners } from './listeners';

describe('createListeners', () => {
  it('notifies every subscriber once, and no longer after it unsubscribes', () => {
    const listeners = createListeners();
    const a = vi.fn();
    const b = vi.fn();
    const offA = listeners.subscribe(a);
    listeners.subscribe(b);
    listeners.notify();
    offA();
    listeners.notify();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it('calls a listener that resubscribes while notified once per notify', () => {
    const listeners = createListeners();
    let off = () => {};
    const again = vi.fn(() => {
      off();
      off = listeners.subscribe(again);
    });
    off = listeners.subscribe(again);
    listeners.notify();
    expect(again).toHaveBeenCalledTimes(1);
  });

  it('drops every subscriber on clear', () => {
    const listeners = createListeners();
    const a = vi.fn();
    listeners.subscribe(a);
    listeners.clear();
    listeners.notify();
    expect(a).not.toHaveBeenCalled();
  });
});
