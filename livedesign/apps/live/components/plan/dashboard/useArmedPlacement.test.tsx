// @vitest-environment jsdom
// docs/specs/026-plan/plan-tabs.md "Filling a slot": an item pressed onto a Dashboard waits for a click; from the
// keyboard, Enter or Space places it where a press with no pointer would, and says where it went.
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAnnouncementSnapshot } from '@/lib/announcer';
import { useArmedPlacement } from './useArmedPlacement';

afterEach(() => vi.restoreAllMocks());

function setup() {
  const place = vi.fn();
  const page = document.createElement('div');
  const hook = renderHook(() =>
    useArmedPlacement({ pageRef: { current: page }, tabs: [], allowFor: () => undefined, place }),
  );
  return { ...hook, place };
}

const key = (k: string, target: EventTarget = window) =>
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  });

describe('a pressed item on a Dashboard', () => {
  it('goes to the first empty slot on Enter, said aloud, and is put away', () => {
    const { result, place } = setup();
    act(() => result.current.arm({ kind: 'note' }));
    expect(result.current.armed).toEqual({ kind: 'note' });
    key('Enter');
    expect(place).toHaveBeenCalledWith({ kind: 'note' }, null);
    expect(getAnnouncementSnapshot().message).toBe('Note placed in the first empty slot');
    expect(result.current.armed).toBeNull();
  });

  it('takes Space as Enter, and leaves typing alone', () => {
    const { result, place } = setup();
    act(() => result.current.arm({ kind: 'slot' }));
    const field = document.createElement('input');
    document.body.append(field);
    key(' ', field);
    expect(place).not.toHaveBeenCalled();
    key(' ');
    expect(place).toHaveBeenCalledWith({ kind: 'slot' }, null);
    expect(getAnnouncementSnapshot().message).toBe('Slot added to the last row with room');
    field.remove();
  });

  it('places nothing once Escape put it away', () => {
    const { result, place } = setup();
    act(() => result.current.arm({ kind: 'note' }));
    key('Escape');
    key('Enter');
    expect(place).not.toHaveBeenCalled();
  });
});
