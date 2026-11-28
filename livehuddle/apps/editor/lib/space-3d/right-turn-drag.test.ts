// @vitest-environment jsdom
// 3d-view.md "Turning the camera": a mouse's right-drag turns the camera freely; a right press that never moves is a
// right-click, its menu held until the release; one that turned opens nothing.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  attachRightTurn,
  RIGHT_TILT_PX_PER_DEG,
  RIGHT_TURN_PX_PER_QUARTER,
  rightPressTurned,
} from './right-turn-drag';

const ptr = (
  type: string,
  x: number,
  o: { button?: number; pointerType?: string; y?: number } = {},
) =>
  Object.assign(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: o.y ?? 10,
      button: o.button ?? 2,
    }),
    { pointerId: 1, pointerType: o.pointerType ?? 'mouse' },
  );

let detach: () => void = () => {};
afterEach(() => detach());

function setup(inView = true) {
  let turn = 1;
  const onStart = vi.fn();
  const onEnd = vi.fn();
  const menus: MouseEvent[] = [];
  const el = document.createElement('div');
  document.body.append(el);
  el.addEventListener('contextmenu', (e) => menus.push(e));
  detach = attachRightTurn(window, {
    inView: () => inView,
    get: () => turn,
    set: (q) => (turn = q),
    onStart,
    onEnd,
    now: () => 0,
  });
  return { el, menus, onStart, onEnd, turn: () => turn };
}

describe('attachRightTurn', () => {
  it('tilts with the drag up or down, down lifting the camera toward overhead', () => {
    let tilt = 52;
    const el = document.createElement('div');
    document.body.append(el);
    detach = attachRightTurn(window, {
      inView: () => true,
      get: () => 0,
      set: () => {},
      getTilt: () => tilt,
      setTilt: (d) => (tilt = d),
      now: () => 0,
    });
    el.dispatchEvent(ptr('pointerdown', 100, { y: 100 }));
    el.dispatchEvent(ptr('pointermove', 100, { y: 100 + 10 * RIGHT_TILT_PX_PER_DEG }));
    expect(tilt).toBeCloseTo(42);
    el.dispatchEvent(ptr('pointermove', 100, { y: 100 - 10 * RIGHT_TILT_PX_PER_DEG }));
    expect(tilt).toBeCloseTo(62);
    el.dispatchEvent(ptr('pointerup', 100, { y: 60 }));
  });

  it('turns freely with the drag, right carrying the floor anticlockwise, and opens no menu', () => {
    const s = setup();
    s.el.dispatchEvent(ptr('pointerdown', 100));
    s.el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    s.el.dispatchEvent(ptr('pointermove', 100 + RIGHT_TURN_PX_PER_QUARTER / 2));
    expect(s.turn()).toBeCloseTo(0.5);
    expect(s.onStart).toHaveBeenCalledOnce();
    s.el.dispatchEvent(ptr('pointerup', 100 + RIGHT_TURN_PX_PER_QUARTER / 2));
    expect(s.onEnd).toHaveBeenCalledOnce();
    expect(rightPressTurned()).toBe(true);
    expect(s.menus).toHaveLength(0);
    // Windows opens the menu on the release: swallowed too.
    const late = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    s.el.dispatchEvent(late);
    expect(s.menus).toHaveLength(0);
  });

  it('keeps a press that never moved a right-click: its menu opens on the release', () => {
    const s = setup();
    s.el.dispatchEvent(ptr('pointerdown', 100));
    s.el.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 100 }),
    );
    s.el.dispatchEvent(ptr('pointermove', 102));
    expect(s.menus).toHaveLength(0);
    s.el.dispatchEvent(ptr('pointerup', 102));
    expect(s.menus).toHaveLength(1);
    expect(s.turn()).toBe(1);
    expect(rightPressTurned()).toBe(false);
  });

  it('leaves the left button, touch and presses off the view alone', () => {
    const s = setup();
    s.el.dispatchEvent(ptr('pointerdown', 100, { button: 0 }));
    s.el.dispatchEvent(ptr('pointermove', 400));
    s.el.dispatchEvent(ptr('pointerdown', 100, { pointerType: 'touch' }));
    s.el.dispatchEvent(ptr('pointermove', 400));
    expect(s.turn()).toBe(1);
    detach();
    const off = setup(false);
    off.el.dispatchEvent(ptr('pointerdown', 100));
    off.el.dispatchEvent(ptr('pointermove', 400));
    expect(off.turn()).toBe(1);
  });
});
