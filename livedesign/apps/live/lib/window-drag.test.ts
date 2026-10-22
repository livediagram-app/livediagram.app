// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { followWindowDrag } from './window-drag';

const pointer = (type: string) => new Event(type) as PointerEvent;

describe('followWindowDrag', () => {
  it('hands every move on, then commits once on the release and stops listening', () => {
    const onMove = vi.fn();
    const onEnd = vi.fn();
    followWindowDrag(onMove, onEnd);
    window.dispatchEvent(pointer('pointermove'));
    window.dispatchEvent(pointer('pointerup'));
    window.dispatchEvent(pointer('pointermove'));
    window.dispatchEvent(pointer('pointerup'));
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onEnd.mock.calls).toEqual([[true]]);
  });

  it('ends uncommitted on a pointercancel, or by the stop it returns, once', () => {
    const cancelled = vi.fn();
    followWindowDrag(() => {}, cancelled);
    window.dispatchEvent(pointer('pointercancel'));
    expect(cancelled.mock.calls).toEqual([[false]]);
    const stopped = vi.fn();
    const stop = followWindowDrag(() => {}, stopped);
    stop();
    stop();
    window.dispatchEvent(pointer('pointerup'));
    expect(stopped.mock.calls).toEqual([[false]]);
  });

  // Escape is the drag's: swallowed in the capture phase, so a dialog round the drag does not close.
  it('ends uncommitted on Escape, before a bubbling listener hears it', () => {
    const onEnd = vi.fn();
    const outer = vi.fn();
    window.addEventListener('keydown', outer);
    followWindowDrag(() => {}, onEnd);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(onEnd).not.toHaveBeenCalled();
    const esc = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    window.dispatchEvent(esc);
    window.removeEventListener('keydown', outer);
    expect(onEnd.mock.calls).toEqual([[false]]);
    expect(esc.defaultPrevented).toBe(true);
    expect(outer).toHaveBeenCalledTimes(1);
  });
});
