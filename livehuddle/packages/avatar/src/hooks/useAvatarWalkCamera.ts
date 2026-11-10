// The camera in Avatar mode (useAvatarWalk.ts, docs/specs/008-canvas/avatar-mode.md "The camera"): the screen rects
// the loop reads each frame, the edge follow, the centred camera's step, and where the character appears on entry.
// Called by useAvatarWalk in its place, so its hooks run where they always did.

import { useInsertionEffect, useRef } from 'react';
import { centredCamera, followCorrection, type AvatarPoint } from '../walk';
import type { UseAvatarWalkOptions, WalkRects } from './avatarWalkTypes';

export function useAvatarWalkCamera({
  mainRef,
  wrapperRef,
  viewportOffset,
  readViewportOffset,
  viewportZoom,
  setViewportOffset,
}: Pick<
  UseAvatarWalkOptions<never>,
  | 'mainRef'
  | 'wrapperRef'
  | 'viewportOffset'
  | 'readViewportOffset'
  | 'viewportZoom'
  | 'setViewportOffset'
>) {
  // Camera follow. The loop can't take a functional state update (Canvas's prop
  // is a value setter), so it accumulates into this ref and remembers what it
  // wrote: a second frame before the commit then builds on the first instead of
  // overwriting it. A viewport change from ANYWHERE ELSE (pan, zoom, fit) won't
  // match what we last wrote, and is adopted.
  // The adoption runs in an insertion effect, before the loop's next frame can read the ref, rather
  // than during render.
  const offsetRef = useRef(viewportOffset ?? readViewportOffset?.() ?? { x: 0, y: 0 });
  const offsetWrittenRef = useRef<AvatarPoint | null>(null);
  const adoptOffset = (offset: AvatarPoint) => {
    const written = offsetWrittenRef.current;
    if (written === null || offset.x !== written.x || offset.y !== written.y) {
      offsetRef.current = offset;
    }
  };
  useInsertionEffect(() => {
    if (viewportOffset) adoptOffset(viewportOffset);
  }, [viewportOffset]);
  // From a reader: adopted when it changed since the last read, as the effect above adopts a new value.
  const lastReadRef = useRef<AvatarPoint | null>(null);
  const readOffset = () => {
    if (readViewportOffset) {
      const now = readViewportOffset();
      const last = lastReadRef.current;
      if (!last || last.x !== now.x || last.y !== now.y) {
        lastReadRef.current = now;
        adoptOffset(now);
      }
    }
    return offsetRef.current;
  };

  const mainNode = () => (mainRef && 'current' in mainRef ? mainRef.current : null);

  // Screen-space rects the loop needs. Read fresh each frame: the wrapper's
  // rect moves as the camera pans (including the pan this very hook applies).
  const rects = () => {
    const main = mainNode()?.getBoundingClientRect();
    const wrapper = wrapperRef.current?.getBoundingClientRect();
    return main && wrapper ? { main, wrapper } : null;
  };

  // Camera follow: when a point is within the follow margin of the view's edges (behind the bottom-right cluster, say),
  // move the view just far enough to bring it in. The correction is already in canvas px, so it applies straight to
  // the viewport offset (which is translated before the zoom scale).
  const follow = (at: AvatarPoint, r: WalkRects) => {
    const fix = followCorrection(
      {
        x: r.wrapper.left + at.x * viewportZoom - r.main.left,
        y: r.wrapper.top + at.y * viewportZoom - r.main.top,
      },
      { width: r.main.width, height: r.main.height },
      viewportZoom,
    );
    if (fix.x === 0 && fix.y === 0) return;
    const prev = readOffset();
    const nextOffset = { x: prev.x + fix.x, y: prev.y + fix.y };
    offsetRef.current = nextOffset;
    offsetWrittenRef.current = nextOffset;
    setViewportOffset(nextOffset);
  };

  // The centred camera (docs/specs/008-canvas/avatar-mode.md "The camera"): one step of the view after a move.
  const centreStep = (from: AvatarPoint, to: AvatarPoint, r: WalkRects) => {
    const prev = readOffset();
    const nextOffset = centredCamera(
      prev,
      from,
      to,
      { width: r.main.width, height: r.main.height },
      viewportZoom,
    );
    if (nextOffset.x === prev.x && nextOffset.y === prev.y) return;
    offsetRef.current = nextOffset;
    offsetWrittenRef.current = nextOffset;
    setViewportOffset(nextOffset);
  };

  // Where the avatar should appear when the mode is entered: the centre of
  // the visible viewport, in canvas coords.
  const viewportCentre = (): AvatarPoint | null => {
    const r = rects();
    if (!r) return null;
    return {
      x: (r.main.left + r.main.width / 2 - r.wrapper.left) / viewportZoom,
      y: (r.main.top + r.main.height / 2 - r.wrapper.top) / viewportZoom,
    };
  };

  return { rects, follow, centreStep, viewportCentre };
}
