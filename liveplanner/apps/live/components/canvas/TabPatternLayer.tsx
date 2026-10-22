'use client';

// A tab's canvas style drawn as a layer of its own (docs/specs/008-canvas/canvas-and-palette.md "Canvas"): an animated
// pattern's moving overlay, or a static pattern's tile, over whatever colour sits under it. The canvas paints its own
// on `main`; this is for what covers the canvas (a form, a dashboard, a board filling its tab: CanvasCover) and the form
// link's page, so a tab's style reads the same wherever it is drawn. Pointer-transparent, and still under reduced
// motion as the canvas's is.
import { isAnimatedPattern, type BackgroundPattern } from '@liveplanner/project';
import { tabBackgroundStyle } from '@/lib/canvas-backgrounds';
import { AnimatedCanvasBackground } from './AnimatedCanvasBackground';

// The tile's origin: a covering layer never pans, so the pattern starts at its corner.
const ORIGIN = { x: 0, y: 0 };

export type TabPattern = {
  pattern: BackgroundPattern;
  // The pattern colour, in the viewer's half.
  color: string;
  // The pattern-size slider (1 = the pattern's own size).
  scale?: number;
  // An animated pattern's speed (1 = its own pace).
  speed?: number;
  // The canvas strength slider, fading the pattern (1 = full).
  opacity?: number;
};

export function TabPatternLayer({
  pattern,
  color,
  scale = 1,
  speed = 1,
  opacity = 1,
  className = 'absolute inset-0',
}: TabPattern & { className?: string }) {
  if (pattern === 'blank') return null;
  return (
    <div aria-hidden data-tab-pattern-layer="" className={`pointer-events-none ${className}`}>
      {isAnimatedPattern(pattern) ? (
        <AnimatedCanvasBackground
          variant={pattern}
          color={color}
          scale={scale}
          speed={speed}
          opacity={opacity}
        />
      ) : (
        <div
          className="absolute inset-0"
          // No colour of its own: what is under it shows between the tiles.
          style={tabBackgroundStyle(pattern, ORIGIN, 'transparent', color, opacity, scale)}
        />
      )}
    </div>
  );
}
