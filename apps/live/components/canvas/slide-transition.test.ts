// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  restartMove,
  sendOff,
  SETTLE_FAILSAFE_MS,
  snapshotOutgoing,
  whenScreenSettles,
} from './slide-transition';

// docs/specs/012-collaboration/presentation-mode.md "Motion": the outgoing slide leaves as the new one arrives, a
// move restarts its animation, and the first slide waits for the screen to settle.

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-slide-move');
  vi.useRealTimers();
});

function surface(width = 800, height = 450) {
  const el = document.createElement('div');
  el.setAttribute('data-canvas-a11y-root', '');
  el.innerHTML = '<svg><rect id="r" /></svg><p>Slide one</p>';
  el.getBoundingClientRect = () => ({ left: 10, top: 20, width, height }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

describe('snapshotOutgoing', () => {
  it('copies the surface, fixed where it stands, as no surface at all', () => {
    const ghost = snapshotOutgoing(surface(), 'slide')!;
    expect(ghost.textContent).toBe('Slide one');
    expect(ghost.hasAttribute('data-canvas-a11y-root')).toBe(false);
    expect(ghost.getAttribute('aria-hidden')).toBe('true');
    expect(ghost.style.position).toBe('fixed');
    expect(ghost.style.left).toBe('10px');
    expect(ghost.style.width).toBe('800px');
  });

  it('takes nothing for a cut, a missing surface or one with no size', () => {
    expect(snapshotOutgoing(surface(), 'none')).toBeNull();
    expect(snapshotOutgoing(null, 'slide')).toBeNull();
    expect(snapshotOutgoing(surface(0, 0), 'slide')).toBeNull();
  });
});

describe('sendOff', () => {
  it('leaves the way the deck moves and is gone once its own animation ends', () => {
    const ghost = snapshotOutgoing(surface(), 'slide')!;
    sendOff(ghost, 'forward');
    expect(ghost.getAttribute('data-slide-leave')).toBe('forward');
    expect(document.body.contains(ghost)).toBe(true);
    // One bubbling from inside the copy is not its own.
    ghost.querySelector('p')!.dispatchEvent(new Event('animationend', { bubbles: true }));
    expect(document.body.contains(ghost)).toBe(true);
    ghost.dispatchEvent(new Event('animationend'));
    expect(document.body.contains(ghost)).toBe(false);
  });

  it('is removed by the failsafe when the animation never ends', () => {
    vi.useFakeTimers();
    const ghost = snapshotOutgoing(surface(), 'slide')!;
    sendOff(ghost, 'back');
    vi.advanceTimersByTime(2000);
    expect(document.body.contains(ghost)).toBe(false);
  });
});

describe('restartMove', () => {
  it('sets the move afresh even when it travels the same way as the last', () => {
    const root = document.documentElement;
    const el = surface();
    const removed = vi.spyOn(root, 'removeAttribute');
    root.setAttribute('data-slide-move', 'forward');
    restartMove(root, el, 'forward');
    expect(removed).toHaveBeenCalledWith('data-slide-move');
    expect(root.getAttribute('data-slide-move')).toBe('forward');
  });
});

describe('whenScreenSettles', () => {
  it('is ready at once where there is no fullscreen to wait for', () => {
    const ready = vi.fn();
    whenScreenSettles(ready);
    expect(ready).toHaveBeenCalledOnce();
  });

  it('waits for fullscreen to land, then two frames, and can be cancelled', () => {
    vi.useFakeTimers();
    const root = document.documentElement as HTMLElement & { requestFullscreen?: unknown };
    const had = root.requestFullscreen;
    root.requestFullscreen = vi.fn();
    try {
      const ready = vi.fn();
      whenScreenSettles(ready);
      expect(ready).not.toHaveBeenCalled();
      document.dispatchEvent(new Event('fullscreenchange'));
      vi.advanceTimersByTime(50);
      expect(ready).toHaveBeenCalledOnce();

      const late = vi.fn();
      const cancel = whenScreenSettles(late);
      cancel();
      vi.advanceTimersByTime(SETTLE_FAILSAFE_MS + 100);
      expect(late).not.toHaveBeenCalled();

      // A refused or slow request still arrives, by the failsafe.
      const slow = vi.fn();
      whenScreenSettles(slow);
      vi.advanceTimersByTime(SETTLE_FAILSAFE_MS + 100);
      expect(slow).toHaveBeenCalledOnce();
    } finally {
      root.requestFullscreen = had;
    }
  });
});
