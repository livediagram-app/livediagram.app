// Sitting facing a Screen frames it (docs/specs/008-canvas/avatar-mode.md "The camera", Work Tracker 1427): when you
// sit down in a room with a Screen ahead of your seat, the view glides out to show the Screen and you together;
// standing up puts back the zoom you had, centred on you, unless you zoomed while seated. Runs only on sitting down and
// standing up, never on a step.
import { useEffect, useRef, type Dispatch, type Ref, type SetStateAction } from 'react';
import type { Element } from '@livehuddle/document';
import type { AvatarPose } from '@livehuddle/avatar/pose';
import type { AvatarPoint } from '@livehuddle/avatar/walk';
import type { StateStore } from '@liveworkspace/workbench/lib/state-store';
import { glideViewport } from '@liveworkspace/workbench/lib/viewport-glide';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { SELF_MEDIA_ID } from '@/lib/calls/calls-media-store';
import { meetingLive } from '@/lib/office/meeting-live';
import { screenAhead, seatedScreenFrame, type FrameBox } from '@/lib/office/seated-screen-frame';

/** The glide out to the Screen on sitting down, in ms: unhurried, as the character settles. */
export const SEATED_FRAME_GLIDE_MS = 600;
// A zoom within this of the one the frame set is still the frame's (the store rounds nothing, but a float compare
// would be brittle).
const SAME_ZOOM = 0.001;

/** The Screens whose room you stand in now, as the Screens themselves work it out (meeting-live.ts). */
export function screensInYourRoom(elements: readonly Element[]): FrameBox[] {
  const out: FrameBox[] = [];
  for (const el of elements) {
    if (el.type !== 'shape' || el.shape !== 'screen') continue;
    const live = meetingLive(el.id);
    if (live && 'inside' in live && live.inside.some((p) => p.id === SELF_MEDIA_ID))
      out.push({ x: el.x, y: el.y, width: el.width, height: el.height });
  }
  return out;
}

export function useSeatedScreenFrame(input: {
  // Avatar mode is on.
  active: boolean;
  // The seat you sit in (null standing, or in a seat you stand in).
  seatedOn: string | null;
  poseStore: StateStore<AvatarPose>;
  elements: readonly Element[];
  mainRef: Ref<HTMLElement>;
  viewportZoom: number;
  readViewportOffset: () => AvatarPoint;
  setViewportOffset: (offset: AvatarPoint) => void;
  setViewportZoom: Dispatch<SetStateAction<number>>;
}): void {
  const latest = useLatest(input);
  // The zoom before the frame and the zoom it set, while a frame stands.
  const framedRef = useRef<{ before: number; set: number } | null>(null);
  const stopRef = useRef<() => void>(() => {});
  useEffect(() => () => stopRef.current(), []);

  const { active, seatedOn } = input;
  useEffect(() => {
    const l = latest.current;
    const main = l.mainRef && 'current' in l.mainRef ? l.mainRef.current : null;
    const set = { zoom: (z: number) => l.setViewportZoom(z), offset: l.setViewportOffset };
    if (!active) {
      // Leaving the mode frames the tab; nothing to put back.
      framedRef.current = null;
      stopRef.current();
      return;
    }
    if (!seatedOn) {
      const framed = framedRef.current;
      framedRef.current = null;
      if (!framed) return;
      stopRef.current();
      const pos = l.poseStore.get().pos;
      // Zoomed while seated: that zoom holds, and the walk's camera brings you back to the middle.
      if (!pos || !main || Math.abs(l.viewportZoom - framed.set) > SAME_ZOOM) return;
      // At once: the walk that stood you up moves the view from the next step.
      stopRef.current = glideViewport(
        { zoom: l.viewportZoom, offset: l.readViewportOffset() },
        {
          zoom: framed.before,
          offset: { x: main.offsetWidth / 2 - pos.x, y: main.offsetHeight / 2 - pos.y },
        },
        set,
        0,
      );
      return;
    }
    // After the sit has placed the character and turned it to face the way the seat faces.
    const frame = requestAnimationFrame(() => {
      const now = latest.current;
      const pose = now.poseStore.get();
      if (!pose.pos || !main) return;
      const screen = screenAhead(pose.pos, pose.facing, screensInYourRoom(now.elements));
      if (!screen) return;
      const to = seatedScreenFrame(
        pose.pos,
        screen,
        { width: main.offsetWidth, height: main.offsetHeight },
        now.viewportZoom,
      );
      // Moving seat to seat keeps the zoom you had before the first.
      framedRef.current = { before: framedRef.current?.before ?? now.viewportZoom, set: to.zoom };
      stopRef.current();
      stopRef.current = glideViewport(
        { zoom: now.viewportZoom, offset: now.readViewportOffset() },
        to,
        set,
        SEATED_FRAME_GLIDE_MS,
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [active, seatedOn, latest]);
}
