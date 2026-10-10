'use client';

// Panning a Sheet's cells by hand (docs/specs/029-sheets/sheet.md "Panning"): the middle button, Space held with
// the left button, the right button dragged (a right press that does not move still opens the menu), and one finger
// on a touch screen all scroll the grid under the pointer. The canvas's Hand tool leaves a plain left press to the
// cells (Plan mode is always in Hand: a click selects, a drag selects a range).
// A drag past DRAG_START_PX is a pan; one that never moves is the press it would otherwise be (a tap selects, a
// right click opens the menu). A second finger ends the pan, so the canvas's pinch takes over.
import { useEffect, useState } from 'react';
import { useLatest } from '@/hooks/ui/useLatest';

// How far a press moves before it is a pan rather than a click.
export const PAN_START_PX = 4;

type Pan = {
  id: number;
  // The right button pans only once it moves; until then it is a right click.
  right: boolean;
  x0: number;
  y0: number;
  left0: number;
  top0: number;
  moved: boolean;
};

export type SheetPan = {
  // Starts a pan for this press when it is one; true when it took the press.
  begin: (e: React.PointerEvent, opts: { maximised: boolean }) => boolean;
  // A bare Space in the grid (not typing) is held for Space-drag instead of typing a space; it is typed on release
  // when no pan happened. True when the key was taken.
  onKeyDown: (e: React.KeyboardEvent) => boolean;
  onKeyUp: (e: React.KeyboardEvent, typeSpace: () => void) => boolean;
  // The grid lost the keys (focus moved, the window went): a held Space is let go, typing nothing.
  releaseSpace: () => void;
  // A click or a context menu that ended a pan is swallowed (a tap that panned selects nothing).
  swallowClick: () => boolean;
  swallowContextMenu: () => boolean;
  // The right button is down and may still become a pan: the menu waits for its release.
  rightPending: () => boolean;
  // Runs once the pending right press ends without a pan (the menu it held back).
  afterRightClick: (open: () => void) => void;
};

export function useSheetPan(scroller: () => HTMLElement | null): SheetPan {
  const latest = useLatest(scroller);
  // Built once: the window's listeners must be the same functions to come off again.
  const [api] = useState(() => createSheetPan(() => latest.current()));
  useEffect(() => api.dispose, [api]);
  return api;
}

function createSheetPan(scroller: () => HTMLElement | null): SheetPan & { dispose: () => void } {
  let pan: (Pan & { touch: boolean }) | null = null;
  let space = { down: false, used: false };
  let swallow = { click: false, menu: false };
  let heldMenu: (() => void) | null = null;

  const end = () => {
    const p = pan;
    pan = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    return p;
  };
  function onMove(e: PointerEvent) {
    const p = pan;
    const el = scroller();
    if (!p || !el || e.pointerId !== p.id) return;
    const dx = e.clientX - p.x0;
    const dy = e.clientY - p.y0;
    if (!p.moved && Math.hypot(dx, dy) < PAN_START_PX) return;
    p.moved = true;
    if (space.down) space.used = true;
    // The grid is drawn at the canvas's zoom: a screen pixel moves it by 1 / zoom of its own.
    const scale = el.offsetWidth ? el.getBoundingClientRect().width / el.offsetWidth : 1;
    el.scrollLeft = p.left0 - dx / scale;
    el.scrollTop = p.top0 - dy / scale;
    e.preventDefault();
  }
  function onUp(e: PointerEvent) {
    if (!pan || e.pointerId !== pan.id) return;
    const p = end()!;
    if (p.moved) {
      swallow = { click: true, menu: p.right };
      heldMenu = null;
      // Whatever follows this release (a click, a context menu) belongs to the pan.
      setTimeout(() => (swallow = { click: false, menu: false }), 0);
    } else if (p.right) {
      const open = heldMenu;
      heldMenu = null;
      open?.();
    }
  }

  return {
    dispose: () => void end(),
    begin: (e, { maximised }) => {
      const el = scroller();
      if (!el) return false;
      const touch = e.pointerType === 'touch';
      // A second finger: the canvas's pinch, not a pan, and not a selection either (taken, and nothing done).
      if (touch && pan?.touch) {
        end();
        e.stopPropagation();
        return true;
      }
      // Maximised, the grid scrolls natively under a finger.
      if (touch && maximised) return false;
      const middle = !touch && e.button === 1;
      const right = !touch && e.button === 2;
      const leftPan = !touch && e.button === 0 && space.down;
      if (!touch && !middle && !right && !leftPan) return false;
      e.stopPropagation();
      // The middle button's own autoscroll, the browser's drag, text selection: none of them.
      if (!right) e.preventDefault();
      end();
      pan = {
        id: e.pointerId,
        touch,
        right,
        x0: e.clientX,
        y0: e.clientY,
        left0: el.scrollLeft,
        top0: el.scrollTop,
        moved: false,
      };
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      return true;
    },
    onKeyDown: (e) => {
      if (e.key !== ' ' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return false;
      e.preventDefault();
      if (!e.repeat) space = { down: true, used: false };
      return true;
    },
    onKeyUp: (e, typeSpace) => {
      if (e.key !== ' ' || !space.down) return false;
      const { used } = space;
      space = { down: false, used: false };
      if (!used) typeSpace();
      return true;
    },
    releaseSpace: () => {
      space = { down: false, used: false };
    },
    swallowClick: () => swallow.click,
    swallowContextMenu: () => swallow.menu,
    rightPending: () => !!pan?.right && !pan.moved,
    afterRightClick: (open) => {
      heldMenu = open;
    },
  };
}
