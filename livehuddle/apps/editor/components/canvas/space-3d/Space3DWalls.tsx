'use client';

// The 3D view's floor layer (docs/specs/008-canvas/3d-view.md "What it shows", "Performance"; blueprint: 3d-view.md):
// inside the canvas's world layer, so it pans and zooms with the floor. The walls and roofs themselves are the 3D
// scene's (Real3DLayer, 3d-engine.md), which reads their colours from this layer's tokens; here the tab's floor is laid
// under the pieces and the Office Pods near the view are stood up, chosen again only when the view has moved far. Loaded
// the first time the canvas wants the 3D view.

import { useEffect, useMemo, useState, useRef, type CSSProperties } from 'react';
import { useViewportStore } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import type { Element } from '@livehuddle/document';
import {
  areaMovedFar,
  turnedArea,
  viewArea,
  type SpaceArea,
} from '@/lib/space-3d/space-3d-cutaway';
import { useStandingPieces } from './useStandingPieces';
import { arrivalIntroPlaying } from '@/lib/space-3d/arrival-intro';
import { useSpace3DTurn } from './useSpace3DView';
import { turnQuarter } from '@/lib/space-3d/space-3d-turn';
import { wallColourVars } from '@/lib/space-3d/space-3d-wall-colour';

export function Space3DWalls({
  elements,
  size,
  floor,
  wallColor,
  darkCanvas = false,
}: {
  elements: readonly Element[];
  size: { width: number; height: number };
  // The tab's background, its pattern in canvas px, laid on the floor under the pieces (3d-view.md "What it shows").
  floor?: CSSProperties;
  // The tab's wall colour, unset for the plaster, and whether the canvas is dark (evening light: 3d-view.md "Themes").
  wallColor?: string | undefined;
  darkCanvas?: boolean;
}) {
  const viewport = useViewportStore();
  // The camera's quarter turns (3d-view.md "Turning the camera"): turned, the area reaches every way.
  const turned = turnQuarter(useSpace3DTurn()) !== 0;
  const [ahead, setArea] = useState<SpaceArea>(() => viewArea(viewport.get(), size));
  // Turned, the same middle reaches as far ahead every way.
  const area = useMemo(() => (turned ? turnedArea(ahead) : ahead), [ahead, turned]);
  // The area follows the view, but only re-renders this layer when the view has moved far. An arrival's zoom in
  // (3d-view.md "Arriving") holds the area it started with, the whole Space, and the area is chosen again as it ends:
  // otherwise every frame of the zoom would re-render the floor and re-mark the standing pieces.
  useEffect(() => {
    const check = () => {
      if (arrivalIntroPlaying.get()) return;
      const next = viewArea(viewport.get(), size);
      setArea((prev) => (areaMovedFar(prev, next) ? next : prev));
    };
    check();
    const offView = viewport.subscribe(check);
    const offIntro = arrivalIntroPlaying.subscribe(check);
    return () => {
      offView();
      offIntro();
    };
  }, [viewport, size]);
  // The walls' colours (space-3d.css's plaster, or the tab's), which the 3D scene's walls are built in.
  const walls3DStyle = useMemo(
    () => wallColourVars(wallColor, darkCanvas) as CSSProperties | undefined,
    [wallColor, darkCanvas],
  );
  // The Office Pods in the same area stand their furniture up (3d-view.md "Pieces stand up"), marked on their boxes.
  const layer = useRef<HTMLDivElement>(null);
  useStandingPieces(layer, elements, area);
  return (
    <div
      ref={layer}
      aria-hidden
      data-space-walls=""
      className="pointer-events-none absolute left-0 top-0"
      style={walls3DStyle}
    >
      {floor ? (
        <div
          data-space-floor=""
          style={{
            ...floor,
            position: 'absolute',
            left: area.left,
            top: area.top,
            width: area.right - area.left,
            height: area.bottom - area.top,
            backgroundPosition: `${-area.left}px ${-area.top}px`,
          }}
        />
      ) : null}
    </div>
  );
}
