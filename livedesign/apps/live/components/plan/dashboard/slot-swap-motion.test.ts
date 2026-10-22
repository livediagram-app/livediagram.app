// @vitest-environment jsdom
// docs/specs/026-plan/plan-tabs.md "Dashboard on a phone": Move Up and Move Down glide the two cards past each other.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOTION_MS } from '@livedesign/tailwind-config/motion';
import { swapSlotsWithMotion } from './slot-swap-motion';

function slotAt(id: string, top: number) {
  const el = document.createElement('div');
  el.setAttribute('data-dashboard-slot', id);
  el.getBoundingClientRect = () =>
    ({ top, left: 16, bottom: top + 300, right: 374, width: 358, height: 300 }) as DOMRect;
  el.animate = vi.fn();
  el.scrollIntoView = vi.fn();
  document.body.append(el);
  return el;
}

beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  document.documentElement.classList.remove('reduce-motion');
});

describe('a slot moved up or down the stack', () => {
  it('slides each card from where the other was, the moved one above, then shows it', () => {
    const a = slotAt('a', 100);
    const b = slotAt('b', 420);
    const apply = vi.fn();
    swapSlotsWithMotion('a', 'b', apply);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(vi.mocked(b.animate).mock.calls[0]).toMatchObject([
      [{ transform: 'translate(0px, -320px)', zIndex: 2 }, { transform: 'none' }],
      { duration: MOTION_MS.long },
    ]);
    expect(vi.mocked(a.animate).mock.calls[0]?.[0]).toMatchObject([
      { transform: 'translate(0px, 320px)', zIndex: 1 },
      expect.anything(),
    ]);
    expect(b.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
  });

  it('swaps at once under reduced motion, still showing the moved slot', () => {
    document.documentElement.classList.add('reduce-motion');
    const a = slotAt('a', 100);
    const b = slotAt('b', 420);
    const apply = vi.fn();
    swapSlotsWithMotion('a', 'b', apply);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(a.animate).not.toHaveBeenCalled();
    expect(b.animate).not.toHaveBeenCalled();
    expect(b.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' });
  });

  it('still swaps when a slot is not on the page', () => {
    const apply = vi.fn();
    swapSlotsWithMotion('a', 'missing', apply);
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
