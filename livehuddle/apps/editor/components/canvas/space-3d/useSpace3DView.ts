'use client';

// The 3D view's state (docs/specs/008-canvas/3d-view.md; blueprint: 3d-view.md "Behaviour and state"): the Space is
// always 3D, `[` and `]` turn the camera, and the tilt a walking press is traced back through. Composed into the
// canvas, which draws the stage and the walls from it.

import { useEffect, useSyncExternalStore } from 'react';
import { isInMenuSurface } from '@liveworkspace/ui';
import { isTypingTarget } from '@liveworkspace/workbench/lib/typing-target';
import { walkInputBlocked } from '@livehuddle/avatar/walk-guard';
import { setSpace3DTiltNow } from '@/lib/space-3d/space-3d-preference';
import { space3DTurnKey } from '@/lib/space-3d/space-3d-key';
import {
  setSpace3DTilt,
  space3DTilt,
  setSpace3DTurn,
  space3DShowing,
  space3DTurn,
  turnQuarter,
  turnSpace3D,
} from '@/lib/space-3d/space-3d-turn';
import { attachRightTurn } from '@/lib/space-3d/right-turn-drag';
import { track } from '@/lib/telemetry';
import { SPACE_3D_TILT_DEG, SPACE_3D_TILT_RANGE } from '@/lib/space-3d/space-3d-camera';
import { loadSpace3DWalls } from '@/lib/editor-deferred-code';

/** How often a right-drag's turn reaches the app's state (the stage itself follows every move). */
const TURN_SYNC_MS = 150;
let liveTurn: number | null = null;
let liveTilt: number | null = null;
let synced = 0;

/** The turn and tilt reach the app's state a few times a second while a right-drag moves the stage directly. */
function sync(): void {
  const now = performance.now();
  if (now - synced <= TURN_SYNC_MS) return;
  synced = now;
  if (liveTurn !== null) setSpace3DTurn(liveTurn);
  if (liveTilt !== null) setSpace3DTilt(liveTilt);
}

/** The camera's quarter turns now (3d-view.md "Turning the camera"). */
export function useSpace3DTurn(): number {
  return useSyncExternalStore(space3DTurn.subscribe, space3DTurn.get, () => 0);
}

/** The camera's tilt now, in degrees. */
export function useSpace3DTilt(): number {
  return useSyncExternalStore(space3DTilt.subscribe, space3DTilt.get, space3DTilt.get);
}

/** Whether the 3D view shows now. */
export function useSpace3DShowing(): boolean {
  return useSyncExternalStore(space3DShowing.subscribe, space3DShowing.get, () => false);
}

/**
 * The 3D view, always (the owner, 2026-11-27: "remove the 2d mode entirely, 3d always, same with rotation"): tilted from
 * the first frame, with `[` and `]` turning the camera while you walk.
 */
export function useSpace3DView(walking: boolean): void {
  // The pieces turned on the plan read it, to stand as the camera sees them (3d-view.md "Turning the camera").
  useEffect(() => {
    space3DShowing.set(true);
    return () => space3DShowing.set(false);
  }, []);
  // What a walking press unprojects with: the view's tilt.
  useEffect(() => {
    setSpace3DTiltNow(space3DTilt.get());
    const off = space3DTilt.subscribe(() => setSpace3DTiltNow(space3DTilt.get()));
    return () => {
      off();
      setSpace3DTiltNow(0);
    };
  }, []);
  // The walls' code, fetched at once.
  useEffect(() => {
    void loadSpace3DWalls();
  }, []);
  // A mouse's right-drag turns the camera freely, in Edit or Walk (3d-view.md "Turning the camera"). While it turns, the
  // view follows the pointer with no ease (`data-space-turning`, space-3d.css).
  useEffect(
    () =>
      attachRightTurn(window, {
        inView: (t) =>
          t instanceof Element &&
          !!t.closest('[data-space-view]') &&
          !isInMenuSurface(t) &&
          !isTypingTarget(t),
        get: () => liveTurn ?? space3DTurn.get(),
        set: (q) => {
          // The turn goes straight onto the stage each move (no render), and the rest of the app (the walls cut
          // away, the arrows, what picks a side) catches up a few times a second and on the release.
          liveTurn = q;
          for (const el of document.querySelectorAll<HTMLElement>('[data-space-turn-target]'))
            el.style.setProperty('--space-turn', `${q * 90}deg`);
          sync();
        },
        getTilt: () => liveTilt ?? space3DTilt.get(),
        setTilt: (deg) => {
          const [lo, hi] = SPACE_3D_TILT_RANGE;
          liveTilt = Math.min(hi, Math.max(lo, deg));
          for (const el of document.querySelectorAll<HTMLElement>('[data-space-turn-target]'))
            el.style.setProperty('--space-tilt', `${liveTilt}deg`);
          setSpace3DTiltNow(liveTilt);
          sync();
        },
        onStart: () => document.documentElement.setAttribute('data-space-turning', ''),
        onEnd: () => {
          if (liveTurn !== null) setSpace3DTurn(liveTurn);
          if (liveTilt !== null) setSpace3DTilt(liveTilt);
          liveTurn = null;
          liveTilt = null;
          document.documentElement.removeAttribute('data-space-turning');
          track('Canvas', 'Used', 'Space3DTurn');
        },
      }),
    [],
  );
  // `[` and `]` turn the camera (3d-view.md "Turning the camera"), with the action keys' guards.
  useEffect(() => {
    if (!walking) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const turn = space3DTurnKey(e);
      if (turn === null) return;
      if (e.defaultPrevented || isTypingTarget(e.target) || walkInputBlocked()) return;
      if (isInMenuSurface(e.target)) return;
      e.preventDefault();
      turnSpace3D(turn);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [walking]);
}

/** The stage's style: the camera's tilt and turn as variables. */
export function space3DStageStyle(turn = 0, tilt = SPACE_3D_TILT_DEG): React.CSSProperties {
  return {
    ['--space-tilt' as string]: `${tilt}deg`,
    ['--space-stand' as string]: '-90deg',
    // The camera's quarter turns (3d-view.md "Turning the camera"), unbounded so a turn always goes the short way.
    ['--space-turn' as string]: `${turn * 90}deg`,
  };
}

/** The view's turned mark: set while the camera looks any way but up the screen (a built table then stands whole). */
export function space3DTurned(turn: number): '' | undefined {
  return turnQuarter(turn) !== 0 ? '' : undefined;
}
