import type { PointerEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { onMouseHover } from './hover-preview';

const ev = (pointerType: string) => ({ pointerType }) as unknown as PointerEvent;

describe('onMouseHover', () => {
  it('fires the preview for a mouse pointer', () => {
    const fn = vi.fn();
    onMouseHover(fn)(ev('mouse'));
    expect(fn).toHaveBeenCalledOnce();
  });

  it('does not fire for touch or pen (a tap is the commit, no preview flicker)', () => {
    const fn = vi.fn();
    onMouseHover(fn)(ev('touch'));
    onMouseHover(fn)(ev('pen'));
    expect(fn).not.toHaveBeenCalled();
  });
});
