'use client';

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { prefersReducedMotion } from './motion-preference';

// Dragging a phone sheet by its grab handle (docs/specs/007-editor/editor-app.md "Mobile chrome"). A sheet rests
// at its own height; dragged up past SHEET_SNAP_PX (or flicked up) it fills the screen below the editor's top
// bar, and stays there, its handle still across its top; dragged down from there past the same it returns to
// rest. Dragged down from rest past SHEET_DISMISS_PX (or flicked down) it closes; anything less springs back.
// While the finger is down the sheet follows it: taller or shorter, or (from rest, downwards) sliding down.
// Closing, it finishes its slide: from where the finger let go (or from rest, for a close by a button, the backdrop
// or Escape through `dismiss`) it carries on down off the screen by `transform` alone, eased out over
// SHEET_EXIT_MIN_MS to SHEET_EXIT_MAX_MS (quicker after a faster flick), or fades out over SHEET_EXIT_FADE_MS under
// reduced motion; only then is `onDismiss` called, once, on the sheet's `transitionend` or a timeout should that never
// come. A `beforeDismiss` that answers false (unsaved changes to ask about) keeps it open: it springs back.
export const SHEET_DISMISS_PX = 80;
export const SHEET_SNAP_PX = 48;
const FLICK_PX_PER_MS = 0.5;
// A full sheet keeps the editor's top bar (3.5rem) and the notch clear.
export const SHEET_FULL_HEIGHT = 'calc(100dvh - 3.5rem - env(safe-area-inset-top, 0px))';
// The exit's bounds (spec "Menus are bottom sheets on a phone"): a flick's pace is kept within them, so a fast flick
// is never a blink and a slow drag never drags on.
// The top is the motion ceiling (MOTION_CEILING_MS, docs/specs/004-interface-design/motion.md); a test holds it there.
export const SHEET_EXIT_MIN_MS = 180;
export const SHEET_EXIT_MAX_MS = 250;
// Under reduced motion: a short fade in place of the slide.
export const SHEET_EXIT_FADE_MS = 120;
// How long past the exit's own length the sheet waits for `transitionend` before it goes anyway.
const EXIT_FALLBACK_MS = 80;
// Ease-out: the sheet leaves at the finger's pace and settles off screen.
const EXIT_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** One property's exit transition. Its length comes from `sheetExitMs` or the fade, never past the ceiling, which
 * the motion guard can't read through a variable: useSheetDrag.test holds the bounds instead. */
export function sheetExitTransition(property: 'transform' | 'opacity', ms: number): string {
  return [property, `${ms}ms`, property === 'transform' ? EXIT_EASE : 'ease-out'].join(' ');
}

type Exit = { dy: number; ms: number; fade: boolean };

export type SheetDrag = {
  expanded: boolean;
  dragging: boolean;
  // Sliding out: the sheet is on its way off the screen and `onDismiss` comes when it is gone.
  exiting: boolean;
  // The sheet's inline style for its height and slide; merge it over the sheet's own.
  style: CSSProperties;
  // Close it as a swipe would, sliding out first: for a host's backdrop, Escape, close or Done. `sheet` is the
  // element that moves (for its transitionend); absent, the one the handle last measured. Answers false when
  // `beforeDismiss` kept it open. `then` runs in place of onDismiss once it is gone (a close button's own handler).
  dismiss: (sheet?: HTMLElement | null, then?: () => void) => boolean;
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

/** How long the exit slide takes: the distance left at the release's pace (px per ms), kept within the bounds. */
export function sheetExitMs(remaining: number, speed: number): number {
  if (!(speed > 0)) return SHEET_EXIT_MAX_MS;
  const ms = Math.max(0, remaining) / speed;
  return Math.round(Math.min(SHEET_EXIT_MAX_MS, Math.max(SHEET_EXIT_MIN_MS, ms)));
}

// The style while sliding out: from where it was let go to past its own height, or fading where it stands.
export function exitStyle(exit: Exit, expanded: boolean): CSSProperties {
  const height: CSSProperties = expanded ? { height: SHEET_FULL_HEIGHT, maxHeight: 'none' } : {};
  if (exit.fade)
    return {
      ...height,
      transform: `translateY(${exit.dy}px)`,
      opacity: 0,
      transition: sheetExitTransition('opacity', exit.ms),
      pointerEvents: 'none',
    };
  return {
    ...height,
    transform: 'translateY(calc(100% + 24px))',
    transition: sheetExitTransition('transform', exit.ms),
    pointerEvents: 'none',
  };
}

// `open` is for a host that stays mounted while closed (Dialog): each opening starts the sheet at rest again,
// never full height because it was left so last time.
export function useSheetDrag(
  onDismiss: () => void,
  open = true,
  beforeDismiss?: () => boolean,
): SheetDrag {
  // Where the press began (read by the handlers), and the drag as drawn (read by render).
  const start = useRef<{ y: number; t: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [live, setLive] = useState<{ dy: number; height: number; max: number } | null>(null);
  const [exit, setExit] = useState<Exit | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  // The element that moves (the handle's parent), the exit's timer and its listener, and whether it has finished.
  const sheetRef = useRef<HTMLElement | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);
  useEffect(() => () => cleanup.current?.(), []);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setExpanded(false);
      setLive(null);
      setExit(null);
    }
  }

  const end = () => {
    start.current = null;
    setLive(null);
  };

  // Slides it out from `dy`, then calls onDismiss once: on the sheet's transitionend, or after the fallback.
  const leave = (
    dy: number,
    speed: number,
    height: number,
    sheet: HTMLElement | null,
    then?: () => void,
  ) => {
    if (cleanup.current) return true;
    if (beforeDismiss && !beforeDismiss()) return false;
    const fade = prefersReducedMotion();
    const ms = fade ? SHEET_EXIT_FADE_MS : sheetExitMs(height - dy, speed);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      cleanup.current?.();
      (then ?? dismissRef.current)();
      // A host that stayed open (it asked something instead) gets its sheet back; one that closed never sees this.
      setExit(null);
    };
    const onEnd = (e: TransitionEvent) => {
      if (e.target === sheet) finish();
    };
    sheet?.addEventListener('transitionend', onEnd);
    const timer = setTimeout(finish, ms + EXIT_FALLBACK_MS);
    cleanup.current = () => {
      clearTimeout(timer);
      sheet?.removeEventListener('transitionend', onEnd);
      cleanup.current = null;
    };
    setExit({ dy, ms, fade });
    return true;
  };

  // While dragging: a sheet growing or shrinking takes an explicit height; one pulled down from rest slides.
  let style: CSSProperties;
  if (exit) style = exitStyle(exit, expanded);
  else if (live) {
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
    exiting: exit !== null,
    style,
    dismiss: (sheet, then) => {
      const el = sheet ?? sheetRef.current;
      return leave(0, 0, el?.getBoundingClientRect().height ?? 0, el, then);
    },
    handleProps: {
      onPointerDown: (e) => {
        const sheet = e.currentTarget.parentElement;
        sheetRef.current = sheet;
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
        const speed = moved / Math.max(1, e.timeStamp - at.t);
        const outcome = sheetRelease(expanded, moved, speed);
        const height = live?.height ?? 0;
        end();
        if (outcome === 'expand') setExpanded(true);
        else if (outcome === 'rest') setExpanded(false);
        else if (outcome === 'dismiss') leave(moved, speed, height, sheetRef.current);
      },
      onPointerCancel: end,
    },
  };
}
