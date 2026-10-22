'use client';

import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';

// Dragging a phone sheet by its grab handle (docs/specs/007-editor/live-app.md "Mobile chrome"). A sheet rests
// at its own height; dragged up past SHEET_SNAP_PX (or flicked up) it fills the screen below the editor's top
// bar, and stays there, its handle still across its top; dragged down from there past the same it returns to
// rest. Dragged down from rest past SHEET_DISMISS_PX (or flicked down) it closes; anything less springs back.
// While the finger is down the sheet follows it: taller or shorter, or (from rest, downwards) sliding down.
export const SHEET_DISMISS_PX = 80;
export const SHEET_SNAP_PX = 48;
const FLICK_PX_PER_MS = 0.5;
// A full sheet keeps the editor's top bar (3.5rem) and the notch clear.
export const SHEET_FULL_HEIGHT = 'calc(100dvh - 3.5rem - env(safe-area-inset-top, 0px))';

export type SheetDrag = {
  expanded: boolean;
  dragging: boolean;
  // The sheet's inline style for its height and slide; merge it over the sheet's own.
  style: CSSProperties;
  handleProps: {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel: () => void;
  };
};

// What letting go does, from where the sheet rested and how far (dy, down positive) and fast it travelled.
export function sheetRelease(
  expanded: boolean,
  dy: number,
  speed: number,
): 'expand' | 'rest' | 'dismiss' | 'stay' {
  const flickUp = dy < -16 && speed < -FLICK_PX_PER_MS;
  const flickDown = dy > 16 && speed > FLICK_PX_PER_MS;
  if (expanded) return dy > SHEET_SNAP_PX || flickDown ? 'rest' : 'stay';
  if (dy < -SHEET_SNAP_PX || flickUp) return 'expand';
  if (dy > SHEET_DISMISS_PX || flickDown) return 'dismiss';
  return 'stay';
}

export function useSheetDrag(onDismiss: () => void): SheetDrag {
  // Where the press began (read by the handlers), and the drag as drawn (read by render).
  const start = useRef<{ y: number; t: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [live, setLive] = useState<{ dy: number; height: number; max: number } | null>(null);

  const end = () => {
    start.current = null;
    setLive(null);
  };

  // While dragging: a sheet growing or shrinking takes an explicit height; one pulled down from rest slides.
  let style: CSSProperties;
  if (live) {
    const { dy } = live;
    const height = Math.min(live.max, Math.max(live.height / 2, live.height - dy));
    style =
      expanded || dy < 0
        ? { height, maxHeight: 'none', transition: 'none' }
        : { transform: `translateY(${dy}px)`, transition: 'none' };
  } else {
    style = expanded
      ? {
          height: SHEET_FULL_HEIGHT,
          maxHeight: 'none',
          transition: 'height var(--transition-duration-short) ease',
        }
      : { transition: 'transform var(--transition-duration-micro) ease' };
  }

  return {
    expanded,
    dragging: live !== null,
    style,
    handleProps: {
      onPointerDown: (e) => {
        const sheet = e.currentTarget.parentElement;
        const height = sheet?.getBoundingClientRect().height ?? 0;
        // The tallest it can be: the full height, read off the screen as the sheet sits.
        const max = Math.max(height, (globalThis.innerHeight ?? height) - 56);
        start.current = { y: e.clientY, t: e.timeStamp };
        setLive({ dy: 0, height, max });
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
          // Not capturable: the drag still follows while over the handle.
        }
      },
      onPointerMove: (e) => {
        const at = start.current;
        if (!at) return;
        setLive((l) => (l ? { ...l, dy: e.clientY - at.y } : l));
      },
      onPointerUp: (e) => {
        const at = start.current;
        if (!at) return;
        const moved = e.clientY - at.y;
        const outcome = sheetRelease(expanded, moved, moved / Math.max(1, e.timeStamp - at.t));
        end();
        if (outcome === 'expand') setExpanded(true);
        else if (outcome === 'rest') setExpanded(false);
        else if (outcome === 'dismiss') onDismiss();
      },
      onPointerCancel: end,
    },
  };
}
