// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchPrimarySelectionPaste } from './primary-selection-paste';

function release(button: number): void {
  // jsdom has no PointerEvent; the watcher only reads `button`.
  window.dispatchEvent(new MouseEvent('pointerup', { button }));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('watchPrimarySelectionPaste', () => {
  it('flags a paste fired by a middle-button release', () => {
    const watch = watchPrimarySelectionPaste(window);
    release(1);
    expect(watch.isPrimarySelectionPaste()).toBe(true);
    watch.dispose();
  });

  it('does not flag a paste after a primary-button release', () => {
    const watch = watchPrimarySelectionPaste(window);
    release(0);
    expect(watch.isPrimarySelectionPaste()).toBe(false);
    watch.dispose();
  });

  it('stops flagging once the release task has ended', () => {
    vi.useFakeTimers();
    const watch = watchPrimarySelectionPaste(window);
    release(1);
    vi.runAllTimers();
    expect(watch.isPrimarySelectionPaste()).toBe(false);
    watch.dispose();
  });

  it('ignores releases after disposal', () => {
    const watch = watchPrimarySelectionPaste(window);
    watch.dispose();
    release(1);
    expect(watch.isPrimarySelectionPaste()).toBe(false);
  });
});
