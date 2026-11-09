// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getAnnouncementSnapshot } from '@liveworkspace/workbench/lib/announcer';
import { createPlacingTurnKeys } from './usePlacingTurnKeys';

// Space while placing (docs/specs/009-elements/furniture-facing.md "Turning while placing").
function setup() {
  const turnPlacing = vi.fn((_kind: string, quarters: number) => (quarters > 0 ? 'e' : 'w'));
  const resetPlacingFacing = vi.fn();
  const usePlacingTurnKeys = createPlacingTurnKeys({
    turns: (kind) => kind === 'sofa',
    turnPlacing,
    resetPlacingFacing,
    facingAnnouncement: (f) => `Facing ${f}`,
  });
  return { turnPlacing, resetPlacingFacing, usePlacingTurnKeys };
}

function space(init: KeyboardEventInit = {}, type = 'keydown') {
  const e = new KeyboardEvent(type, { code: 'Space', bubbles: true, cancelable: true, ...init });
  document.body.dispatchEvent(e);
  return e;
}

describe('createPlacingTurnKeys', () => {
  it('turns the piece being placed and swallows the press and its release', () => {
    const h = setup();
    const { unmount } = renderHook(() => h.usePlacingTurnKeys('sofa'));
    expect(space().defaultPrevented).toBe(true);
    expect(space({}, 'keyup').defaultPrevented).toBe(true);
    space({ shiftKey: true });
    space({ repeat: true });
    expect(h.turnPlacing.mock.calls).toEqual([
      ['sofa', 1],
      ['sofa', -1],
    ]);
    expect(getAnnouncementSnapshot().message).toBe('Facing w');
    unmount();
    expect(h.resetPlacingFacing).toHaveBeenCalled();
  });

  it('leaves Space alone with a kind that does not turn, nothing placed, a modifier, or a field', () => {
    const h = setup();
    const initialProps: { kind: string | null } = { kind: 'plant' };
    const { rerender } = renderHook(
      ({ kind }: { kind: string | null }) => h.usePlacingTurnKeys(kind),
      { initialProps },
    );
    expect(space().defaultPrevented).toBe(false);
    rerender({ kind: null });
    expect(space().defaultPrevented).toBe(false);
    rerender({ kind: 'sofa' });
    expect(space({ metaKey: true }).defaultPrevented).toBe(false);
    expect(space({}, 'keyup').defaultPrevented).toBe(false);
    const input = document.createElement('input');
    document.body.appendChild(input);
    const e = new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true });
    input.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
    expect(h.turnPlacing).not.toHaveBeenCalled();
    input.remove();
  });
});
