// The canvas's half of opening walking (docs/specs/008-canvas/avatar-mode.md "Opening walking"): when a tab opens
// walking from its Walk In button, the character starts just below the button, as a press would put it (the whole
// figure clear of the button at the character's Size, avatarSpawnBelow), and the view comes to that spot when it is
// off screen. A layout effect, so the spot is in place before the walk's own entry
// (a passive effect in useAvatarWalk) reads it in the same commit.
import { useLayoutEffect, type Ref, type RefObject } from 'react';
import {
  avatarSpawnBelow,
  viewportOffsetCentredOn,
  type AvatarPoint,
} from '@liveworkspace/avatar/walk';
import type { WalkIn } from '@/app/document/[id]/useOpenWalking';

export function useWalkIn({
  walkIn,
  scale,
  spawnAtRef,
  mainRef,
  wrapperRef,
  viewportZoom,
  setViewportOffset,
}: {
  walkIn: WalkIn | null | undefined;
  // The character's Size scale (avatarScale): a taller figure stands further below the button.
  scale: number;
  spawnAtRef: RefObject<AvatarPoint | null>;
  mainRef: Ref<HTMLElement>;
  wrapperRef: RefObject<HTMLElement | null>;
  viewportZoom: number;
  setViewportOffset: (offset: { x: number; y: number }) => void;
}) {
  const seq = walkIn?.seq;
  useLayoutEffect(() => {
    if (!walkIn) return;
    const feet = avatarSpawnBelow(walkIn.button, scale);
    spawnAtRef.current = feet;
    const main = (
      mainRef && 'current' in mainRef ? mainRef.current : null
    )?.getBoundingClientRect();
    const wrapper = wrapperRef.current?.getBoundingClientRect();
    if (!main || !wrapper) return;
    const sx = wrapper.left + feet.x * viewportZoom;
    const sy = wrapper.top + feet.y * viewportZoom;
    if (sx >= main.left && sx <= main.right && sy >= main.top && sy <= main.bottom) return;
    setViewportOffset(
      viewportOffsetCentredOn(
        { ...feet, width: 0, height: 0 },
        { width: main.width, height: main.height },
        viewportZoom,
      ),
    );
    // Once per opening: the sequence number is the request.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [seq]);
}
