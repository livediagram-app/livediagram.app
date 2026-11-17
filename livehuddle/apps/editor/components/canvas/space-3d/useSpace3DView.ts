'use client';

// The 3D view's state (docs/specs/008-canvas/3d-view.md; blueprint: 3d-view.md "Behaviour and state"): wanted while
// you walk with it turned on, moved through its phases so the tilt animates in and out, Shift+3 while walking, and the
// tilt a walking press is traced back through. Composed into the canvas, which draws the stage and the walls from it.

import { useEffect, useState, useSyncExternalStore } from 'react';
import { isInMenuSurface } from '@liveworkspace/ui';
import { isTypingTarget } from '@liveworkspace/workbench/lib/typing-target';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';
import { walkInputBlocked } from '@livehuddle/avatar/walk-guard';
import {
  setSpace3DTiltNow,
  space3DPreference,
  toggleSpace3D,
} from '@/lib/space-3d/space-3d-preference';
import { nextSpace3DPhase, type Space3DPhase } from '@/lib/space-3d/space-3d-phase';
import { isSpace3DKey } from '@/lib/space-3d/space-3d-key';
import { SPACE_3D_TILT_DEG, SPACE_3D_TILT_MS } from '@/lib/space-3d/space-3d-camera';
import { loadSpace3DWalls } from '@/lib/editor-deferred-code';

/** The remembered choice, as it changes. */
export function useSpace3DPreference(): boolean {
  return useSyncExternalStore(space3DPreference.subscribe, space3DPreference.get, () => false);
}

export function useSpace3DView(walking: boolean): Space3DPhase {
  const want = useSpace3DPreference() && walking;
  const [phase, setPhase] = useState<Space3DPhase>('flat');
  // Moving on when the wish changes is a render-time update (no effect), so the first frame already shows it.
  // Starts unwanted, so a canvas that opens already walking with it on rises into it too.
  const [wanted, setWanted] = useState(false);
  if (wanted !== want) {
    setWanted(want);
    setPhase((p) => nextSpace3DPhase(p, want, { reducedMotion: prefersReducedMotion() }));
  }
  // `rising` waits two frames, so the flat start is styled before the tilt is asked for and the browser animates it;
  // `falling` waits out the tilt before the walls unmount.
  useEffect(() => {
    if (phase === 'rising') {
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() =>
          setPhase((p) => nextSpace3DPhase(p, true, { settled: true })),
        );
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }
    if (phase === 'falling') {
      const timer = setTimeout(
        () => setPhase((p) => nextSpace3DPhase(p, false, { settled: true })),
        SPACE_3D_TILT_MS,
      );
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [phase]);
  // What a walking press unprojects with: the tilt the view is heading to while it stands.
  useEffect(() => {
    setSpace3DTiltNow(phase === 'tilted' || phase === 'rising' ? SPACE_3D_TILT_DEG : 0);
  }, [phase]);
  useEffect(() => () => setSpace3DTiltNow(0), []);
  // The walls' code, fetched as soon as a walk will want it.
  useEffect(() => {
    if (want) void loadSpace3DWalls();
  }, [want]);
  // Shift+3 while walking (docs/specs/008-canvas/3d-view.md "Turning it on and off"), with the action keys' guards.
  useEffect(() => {
    if (!walking) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isSpace3DKey(e)) return;
      if (e.defaultPrevented || isTypingTarget(e.target) || walkInputBlocked()) return;
      if (isInMenuSurface(e.target)) return;
      e.preventDefault();
      toggleSpace3D();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [walking]);
  return phase;
}

/** The stage's style for a phase: no transform while flat, the camera's tilt as a variable otherwise. */
export function space3DStageStyle(phase: Space3DPhase): React.CSSProperties | undefined {
  if (phase === 'flat') return undefined;
  const up = phase === 'tilted';
  return {
    ['--space-tilt' as string]: up ? `${SPACE_3D_TILT_DEG}deg` : '0deg',
    ['--space-stand' as string]: up ? '-90deg' : '0deg',
  };
}
