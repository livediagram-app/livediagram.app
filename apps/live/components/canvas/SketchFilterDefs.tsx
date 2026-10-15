'use client';

// The shared filter Sketch palette tiles are drawn through (palette-tile-finish.ts): two low-frequency
// displacements, merged, so a glyph's lines wander and double like the canvas's two-pass strokes. Rendered once by the editor, never per
// tile. Seeded, so every tile wobbles the same way on every load.
import { SKETCH_TILE_FILTER_ID } from '@/components/palette/palette-tile-finish';

export function SketchFilterDefs() {
  return (
    <svg width="0" height="0" aria-hidden className="pointer-events-none absolute">
      <filter id={SKETCH_TILE_FILTER_ID} x="-15%" y="-15%" width="130%" height="130%">
        {/* Two passes, each wandering its own way, merged: the double stroke the canvas draws. */}
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.12"
          numOctaves="2"
          seed="7"
          result="n1"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="n1"
          scale="3"
          xChannelSelector="R"
          yChannelSelector="G"
          result="p1"
        />
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.1"
          numOctaves="2"
          seed="23"
          result="n2"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="n2"
          scale="3"
          xChannelSelector="G"
          yChannelSelector="R"
          result="p2"
        />
        <feMerge>
          <feMergeNode in="p1" />
          <feMergeNode in="p2" />
        </feMerge>
      </filter>
    </svg>
  );
}
