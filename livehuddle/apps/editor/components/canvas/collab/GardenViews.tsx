'use client';

import { useId } from 'react';
import {
  GARDEN_TONES,
  GRASS_BLADES,
  GRASS_TILES,
  gardenFenceParts,
  gardenPathParts,
  grassEdgePath,
  type FurniturePart,
  type ShapeElement,
} from '@livehuddle/document';
import { FurniturePartView } from './FurnitureView';

// A Garden Path, Grass and a Garden Fence (docs/specs/009-elements/office.md "Garden Path", "Grass", "Garden Fence"):
// drawn at their own size like a room, so a long path keeps round stones, a large lawn its tuft size and a long fence
// its picket spacing. The path's gravel and the lawn are the element's fill; the fence's pickets are white with the
// theme's stroke round them.

function GardenSizedView({
  parts,
  element,
  stroke,
  seat,
  label,
  animClass,
}: {
  parts: readonly FurniturePart[];
  element: ShapeElement;
  stroke: string;
  seat: string;
  label: string;
  animClass?: string;
}) {
  return (
    <div className={`pointer-events-none absolute inset-0 ${animClass ?? ''}`}>
      <svg
        viewBox={`0 0 ${element.width} ${element.height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
        role="img"
        aria-label={label}
      >
        {parts.map((p, i) => (
          <FurniturePartView key={i} part={p} seat={seat} stroke={stroke} />
        ))}
      </svg>
    </div>
  );
}

export function GardenPathView({
  element,
  stroke,
  floor,
  animClass,
}: {
  element: ShapeElement;
  stroke: string;
  floor: string;
  animClass?: string;
}) {
  return (
    <GardenSizedView
      parts={gardenPathParts(element.width, element.height)}
      element={element}
      stroke={stroke}
      seat={floor}
      label="Garden Path"
      animClass={animClass}
    />
  );
}

/**
 * Grass (docs/specs/009-elements/office.md "Grass"): a lawn in the element's fill with tufts painted over it through
 * two SVG pattern tiles, so a lawn of any size draws the same few strokes. No filters, nothing per frame.
 */
export function GrassView({
  element,
  floor,
  animClass,
}: {
  element: ShapeElement;
  floor: string;
  animClass?: string;
}) {
  // One pattern id per lawn on the page; React's id carries characters a url(#...) reference should not.
  const id = `grass-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const d = grassEdgePath(element.width, element.height);
  const B = GRASS_BLADES;
  return (
    <div className={`pointer-events-none absolute inset-0 ${animClass ?? ''}`}>
      <svg
        viewBox={`0 0 ${element.width} ${element.height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
        role="img"
        aria-label="Grass"
      >
        <defs>
          {GRASS_TILES.map((t, i) => (
            <pattern
              key={i}
              id={`${id}-${i}`}
              width={t.size}
              height={t.size}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={t.shade}
                fill="none"
                stroke={B.shade}
                strokeOpacity={B.shadeOpacity}
                strokeWidth={B.width}
                strokeLinecap="round"
              />
              <path
                d={t.light}
                fill="none"
                stroke={B.light}
                strokeOpacity={B.lightOpacity}
                strokeWidth={B.width}
                strokeLinecap="round"
              />
            </pattern>
          ))}
        </defs>
        <path
          d={d}
          fill={floor}
          stroke={B.shade}
          strokeOpacity={B.rimOpacity}
          strokeWidth={B.rimWidth}
        />
        {GRASS_TILES.map((_, i) => (
          <path key={i} d={d} fill={`url(#${id}-${i})`} />
        ))}
      </svg>
    </div>
  );
}

export function GardenFenceView({
  element,
  stroke,
  animClass,
}: {
  element: ShapeElement;
  stroke: string;
  animClass?: string;
}) {
  return (
    <GardenSizedView
      parts={gardenFenceParts(element.width, element.height)}
      element={element}
      stroke={stroke}
      seat={GARDEN_TONES.picket}
      label="Garden Fence"
      animClass={animClass}
    />
  );
}
