// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAnnouncementSnapshot } from '@liveworkspace/workbench/lib/announcer';
import { placingFacing, resetPlacingFacing } from '@/lib/placing-facing';
import { usePlacingTurnKeys } from './usePlacingTurnKeys';

const PLANT: { kind: string | null } = { kind: 'plant' };
const SOFA: { kind: string | null } = { kind: 'sofa' };

// Space while placing (docs/specs/009-elements/furniture-facing.md "Turning while placing").

afterEach(() => {
  resetPlacingFacing();
  document.body.innerHTML = '';
});

function space(
  target: EventTarget = document.body,
  init: KeyboardEventInit = {},
  type = 'keydown',
) {
  const e = new KeyboardEvent(type, {
    code: 'Space',
    key: ' ',
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(e);
  return e;
}

describe('Space while a piece is placed', () => {
  it('turns it a quarter clockwise, and Shift+Space back, telling a screen reader', () => {
    renderHook(() => usePlacingTurnKeys('sofa'));
    space();
    expect(placingFacing('sofa')).toBe('e');
    expect(JSON.stringify(getAnnouncementSnapshot())).toContain('Facing left');
    space(document.body, { shiftKey: true });
    expect(placingFacing('sofa')).toBe('n');
  });

  it('does nothing else: neither the pan nor the label key hears the press or its release', () => {
    renderHook(() => usePlacingTurnKeys('sofa'));
    const heard = vi.fn();
    document.addEventListener('keydown', heard);
    document.addEventListener('keyup', heard);
    const down = space();
    const up = space(document.body, {}, 'keyup');
    expect(down.defaultPrevented).toBe(true);
    expect(up.defaultPrevented).toBe(true);
    expect(heard).not.toHaveBeenCalled();
    document.removeEventListener('keydown', heard);
    document.removeEventListener('keyup', heard);
  });

  it('turns once for a held key', () => {
    renderHook(() => usePlacingTurnKeys('sofa'));
    space();
    const repeat = space(document.body, { repeat: true });
    expect(repeat.defaultPrevented).toBe(true);
    expect(placingFacing('sofa')).toBe('e');
  });

  it('leaves a release it did not take alone', () => {
    renderHook(() => usePlacingTurnKeys('sofa'));
    expect(space(document.body, {}, 'keyup').defaultPrevented).toBe(false);
  });

  it('leaves a field, a menu, a modifier and another key their own', () => {
    renderHook(() => usePlacingTurnKeys('sofa'));
    const input = document.createElement('input');
    const menu = document.createElement('div');
    menu.setAttribute('data-menu-surface', '');
    document.body.append(input, menu);
    expect(space(input).defaultPrevented).toBe(false);
    expect(space(menu).defaultPrevented).toBe(false);
    space(document.body, { ctrlKey: true });
    space(document.body, { metaKey: true });
    space(document.body, { altKey: true });
    document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true }));
    expect(placingFacing('sofa')).toBe('n');
  });

  it('is not listened for while nothing that turns is placed', () => {
    const { rerender } = renderHook(
      ({ kind }: { kind: string | null }) => usePlacingTurnKeys(kind),
      {
        initialProps: PLANT,
      },
    );
    expect(space().defaultPrevented).toBe(false);
    rerender({ kind: null });
    expect(space().defaultPrevented).toBe(false);
  });

  it('forgets the turn when the placing ends or changes kind', () => {
    const { rerender } = renderHook(
      ({ kind }: { kind: string | null }) => usePlacingTurnKeys(kind),
      {
        initialProps: SOFA,
      },
    );
    space();
    rerender({ kind: 'bookshelf' });
    expect(placingFacing('sofa')).toBe('n');
    space();
    rerender({ kind: null });
    expect(placingFacing('bookshelf')).toBe('n');
  });
});
