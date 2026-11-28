// The right-drag that turns the 3D camera freely (docs/specs/008-canvas/3d-view.md "Turning the camera"): a mouse's
// right button held and dragged across turns the floor with the hand, a quarter turn every 240 px, and up or down tilts
// the camera, a degree every 4 px, with no ease. A
// right press that never moves is still a right-click: the context menu is held while the button is down (a Mac opens
// it on the press) and opened as it comes up, and one that moved opens nothing (Windows opens it on the release).

/** How far across, in screen px, turns the camera a quarter turn. */
export const RIGHT_TURN_PX_PER_QUARTER = 240;
/** How far up or down, in screen px, tilts the camera one degree. */
export const RIGHT_TILT_PX_PER_DEG = 4;
/** How far a right press moves before it is a turn rather than a click. */
export const RIGHT_TURN_SLOP = 4;
/** How long after a turn's release a late context menu (Windows opens it on the release) is still swallowed. */
const LATE_MENU_MS = 300;

let turned = false;

/** Whether the last right press turned the camera (so it is no right-click). */
export function rightPressTurned(): boolean {
  return turned;
}

type Press = {
  id: number;
  x: number;
  y: number;
  start: number;
  startTilt: number;
  moved: boolean;
  menu: { target: EventTarget; x: number; y: number } | null;
};

export type RightTurnOptions = {
  /** Whether a press on this target is on the 3D view (not on a toolbar, menu or field over it). */
  inView: (target: EventTarget | null) => boolean;
  /** The camera's turn now, in quarters. */
  get: () => number;
  /** Sets the camera's turn, in quarters. */
  set: (quarters: number) => void;
  /** The camera's tilt now, in degrees (none: a drag only turns). */
  getTilt?: () => number;
  /** Sets the camera's tilt, in degrees. */
  setTilt?: (deg: number) => void;
  /** The drag became a turn. */
  onStart?: () => void;
  /** The turn was let go. */
  onEnd?: () => void;
  now?: () => number;
};

/** Listens on `target` (the window) for right-drags; answers what stops listening. */
export function attachRightTurn(target: Window, o: RightTurnOptions): () => void {
  const now = o.now ?? (() => performance.now());
  let press: Press | null = null;
  let swallowUntil = 0;
  let replaying = false;

  const down = (e: PointerEvent) => {
    if (e.button !== 2 || e.pointerType !== 'mouse' || !o.inView(e.target)) return;
    turned = false;
    press = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      start: o.get(),
      startTilt: o.getTilt?.() ?? 0,
      moved: false,
      menu: null,
    };
  };
  const move = (e: PointerEvent) => {
    const p = press;
    if (!p || e.pointerId !== p.id) return;
    const dx = e.clientX - p.x;
    if (!p.moved) {
      if (Math.hypot(dx, e.clientY - p.y) < RIGHT_TURN_SLOP) return;
      p.moved = true;
      turned = true;
      o.onStart?.();
    }
    // Dragging right carries the floor's near edge right: the floor turns anticlockwise on the screen.
    o.set(p.start - dx / RIGHT_TURN_PX_PER_QUARTER);
    // Dragging down lifts the camera toward overhead; up lowers it toward the floor.
    o.setTilt?.(p.startTilt - (e.clientY - p.y) / RIGHT_TILT_PX_PER_DEG);
  };
  const up = (e: PointerEvent) => {
    const p = press;
    if (!p || e.pointerId !== p.id) return;
    press = null;
    if (p.moved) {
      swallowUntil = now() + LATE_MENU_MS;
      o.onEnd?.();
      return;
    }
    if (e.type === 'pointercancel' || !p.menu) return;
    // A click after all: the menu held on the press opens now.
    replaying = true;
    try {
      p.menu.target.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: p.menu.x,
          clientY: p.menu.y,
          button: 2,
        }),
      );
    } finally {
      replaying = false;
    }
  };
  const menu = (e: MouseEvent) => {
    if (replaying) return;
    if (press) {
      // Held while the button is down: it may yet be a turn.
      e.preventDefault();
      e.stopPropagation();
      press.menu = e.target ? { target: e.target, x: e.clientX, y: e.clientY } : null;
      return;
    }
    if (now() < swallowUntil) {
      swallowUntil = 0;
      e.preventDefault();
      e.stopPropagation();
    }
  };

  target.addEventListener('pointerdown', down, true);
  target.addEventListener('pointermove', move, true);
  target.addEventListener('pointerup', up, true);
  target.addEventListener('pointercancel', up, true);
  target.addEventListener('contextmenu', menu, true);
  return () => {
    if (press?.moved) o.onEnd?.();
    press = null;
    target.removeEventListener('pointerdown', down, true);
    target.removeEventListener('pointermove', move, true);
    target.removeEventListener('pointerup', up, true);
    target.removeEventListener('pointercancel', up, true);
    target.removeEventListener('contextmenu', menu, true);
  };
}
