// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LONG_PRESS_MS } from '@/hooks/ui/useLongPress';
import {
  armPlainClick,
  isOnlySelected,
  isPlainClick,
  plainClickOutcome,
  type SelectionSnapshot,
} from './selection-click';

const sel = (selectedId: string | null, multi: string[] = []): SelectionSnapshot => ({
  selectedId,
  multiSelectedIds: new Set(multi),
});

describe('isOnlySelected', () => {
  it('holds for the single selection', () => {
    expect(isOnlySelected(sel('a'), 'a')).toBe(true);
  });

  it('holds for a multi-selection of one', () => {
    expect(isOnlySelected(sel(null, ['a']), 'a')).toBe(true);
  });

  it('fails for a member of a larger multi-selection', () => {
    expect(isOnlySelected(sel('a', ['a', 'b']), 'a')).toBe(false);
  });

  it('fails for an element that is not selected', () => {
    expect(isOnlySelected(sel('b'), 'a')).toBe(false);
    expect(isOnlySelected(sel(null), 'a')).toBe(false);
  });
});

describe('plainClickOutcome', () => {
  it('deselects the only selected element', () => {
    expect(plainClickOutcome(sel('a'), 'a')).toBe('deselect');
    expect(plainClickOutcome(sel(null, ['a']), 'a')).toBe('deselect');
  });

  it('selects a member of a multi-selection alone', () => {
    expect(plainClickOutcome(sel(null, ['a', 'b', 'c']), 'b')).toBe('select-alone');
  });

  it('selects a non-member alone rather than adding it', () => {
    expect(plainClickOutcome(sel(null, ['a', 'b']), 'c')).toBe('select-alone');
  });

  it('selects an element when nothing is selected', () => {
    expect(plainClickOutcome(sel(null), 'a')).toBe('select-alone');
  });
});

const press = { clientX: 100, clientY: 100, timeStamp: 1000, pointerId: 1, pointerType: 'mouse' };

describe('isPlainClick', () => {
  it('counts a release in place', () => {
    expect(isPlainClick(press, { ...press, timeStamp: 1100 })).toBe(true);
  });

  it('counts a release under the engage threshold', () => {
    expect(isPlainClick(press, { ...press, clientX: 102, clientY: 102 })).toBe(true);
  });

  it('rejects a release at or past the engage threshold (a drag)', () => {
    expect(isPlainClick(press, { ...press, clientX: 104 })).toBe(false);
  });

  it('rejects another pointer', () => {
    expect(isPlainClick(press, { ...press, pointerId: 2 })).toBe(false);
  });

  it('counts a slow mouse click', () => {
    expect(isPlainClick(press, { ...press, timeStamp: 1000 + LONG_PRESS_MS * 4 })).toBe(true);
  });

  it('rejects a touch held into a long-press (its context menu took it)', () => {
    const touch = { ...press, pointerType: 'touch' };
    expect(isPlainClick(touch, { ...touch, timeStamp: 1000 + LONG_PRESS_MS - 1 })).toBe(true);
    expect(isPlainClick(touch, { ...touch, timeStamp: 1000 + LONG_PRESS_MS })).toBe(false);
  });
});

describe('armPlainClick', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const release = (type: 'pointerup' | 'pointercancel', over: Partial<typeof press> = {}) => {
    const { timeStamp = 1100, ...rest } = over;
    const { timeStamp: _pressT, ...pointer } = press;
    const e = new Event(type);
    Object.assign(e, { ...pointer, ...rest });
    Object.defineProperty(e, 'timeStamp', { value: timeStamp });
    window.dispatchEvent(e);
  };

  it('fires on a release in place, once', () => {
    const onClick = vi.fn();
    armPlainClick(press, onClick);
    release('pointerup');
    release('pointerup');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire when the press dragged', () => {
    const onClick = vi.fn();
    armPlainClick(press, onClick);
    release('pointerup', { clientX: 140 });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not fire on a cancelled press, nor on a later release', () => {
    const onClick = vi.fn();
    armPlainClick(press, onClick);
    release('pointercancel');
    release('pointerup');
    expect(onClick).not.toHaveBeenCalled();
  });
});
