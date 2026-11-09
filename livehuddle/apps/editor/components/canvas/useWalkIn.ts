// The canvas's half of opening walking (docs/specs/008-canvas/avatar-mode.md "Opening walking"): when a tab opens
// walking from its Walk In button, the character starts just below the button, as a press would put it (the whole
// figure clear of the button at the character's Size, avatarSpawnBelow). The view comes to that spot when it is off
// screen, and when it is on screen but inside the walk's follow margin of an edge (a Walk In near the bottom of a
// fitted board put the character behind the bottom-right cluster), it is nudged in by the camera follow's own
// correction (followCorrection), so the board barely moves. The spot is set in a layout effect, so it is in place
// before the walk's own entry (a passive effect in useAvatarWalk) reads it in the same commit; the view is judged once
// it has settled, after the tab's fit.
import { useLayoutEffect, type Ref, type RefObject } from 'react';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import {
  avatarSpawnBelow,
  followCorrection,
  viewportOffsetCentredOn,
  type AvatarPoint,
} from '@liveworkspace/avatar/walk';
import type { WalkIn } from '@/app/document/[id]/useOpenWalking';

// How long the view must hold still before the opening spot is judged against it (about 100ms), and the longest the
// judgement waits (about a second and a half), in frames.
export const WALK_IN_STILL_FRAMES = 6;
export const WALK_IN_MAX_FRAMES = 90;

export function useWalkIn({
  walkIn,
  scale,
  spawnAtRef,
  mainRef,
  wrapperRef,
  viewportZoom,
  readViewportOffset,
  setViewportOffset,
}: {
  walkIn: WalkIn | null | undefined;
  // The character's Size scale (avatarScale): a taller figure stands further below the button.
  scale: number;
  spawnAtRef: RefObject<AvatarPoint | null>;
  mainRef: Ref<HTMLElement>;
  wrapperRef: RefObject<HTMLElement | null>;
  viewportZoom: number;
  // The view's offset when the nudge is judged, which it adds to: read then, since a pan renders nothing.
  readViewportOffset: () => { x: number; y: number };
  setViewportOffset: (offset: { x: number; y: number }) => void;
}) {
  const seq = walkIn?.seq;
  // Read when the view is judged, once it has settled: the tab opens walking as it loads, and its fit (and a re-fit
  // when the Map appears) lands frames later, so the zoom the fit chose is the one that counts.
  const zoomRef = useLatest(viewportZoom);
  useLayoutEffect(() => {
    if (!walkIn) return;
    const feet = avatarSpawnBelow(walkIn.button, scale);
    spawnAtRef.current = feet;
    const bringIntoView = () => {
      const main = (
        mainRef && 'current' in mainRef ? mainRef.current : null
      )?.getBoundingClientRect();
      const wrapper = wrapperRef.current?.getBoundingClientRect();
      if (!main || !wrapper) return;
      const zoom = zoomRef.current;
      const sx = wrapper.left + feet.x * zoom;
      const sy = wrapper.top + feet.y * zoom;
      if (sx >= main.left && sx <= main.right && sy >= main.top && sy <= main.bottom) {
        const fix = followCorrection(
          { x: sx - main.left, y: sy - main.top },
          { width: main.width, height: main.height },
          zoom,
        );
        if (fix.x === 0 && fix.y === 0) return;
        const offset = readViewportOffset();
        setViewportOffset({ x: offset.x + fix.x, y: offset.y + fix.y });
        return;
      }
      setViewportOffset(
        viewportOffsetCentredOn(
          { ...feet, width: 0, height: 0 },
          { width: main.width, height: main.height },
        ),
      );
    };
    // Wait for the view to settle: the wrapper's box unchanged for WALK_IN_STILL_FRAMES frames in a row, or
    // WALK_IN_MAX_FRAMES at most, then judge it once.
    let frame = 0;
    let still = 0;
    let last = '';
    let handle = 0;
    const watch = () => {
      frame += 1;
      const box = wrapperRef.current?.getBoundingClientRect();
      // A canvas not yet measured is not a settled one: it keeps waiting, up to the cap.
      const now = box ? `${box.left},${box.top},${box.width}` : '';
      still = now !== '' && now === last ? still + 1 : 0;
      last = now;
      if (still >= WALK_IN_STILL_FRAMES || frame >= WALK_IN_MAX_FRAMES) bringIntoView();
      else handle = requestAnimationFrame(watch);
    };
    handle = requestAnimationFrame(watch);
    return () => cancelAnimationFrame(handle);
    // Once per opening: the sequence number is the request.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [seq]);
}
