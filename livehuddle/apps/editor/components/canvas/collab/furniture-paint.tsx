'use client';

// How a piece's parts are painted (docs/specs/009-elements/furniture-art-style.md): the shaded illustration style,
// from @livehuddle/avatar/furniture-shading, which the headless export paints too. A drawing's lit parts share one
// gradient per material (useFurnitureLight), written once in its <defs> (FurnitureLightDefs); a part outside a lit
// drawing (none given) paints flat in the same colours, so nothing ever renders unpainted.

import { useId, useMemo } from 'react';
import {
  FURNITURE_GLINT,
  FURNITURE_LINE_STROKE,
  FURNITURE_RAIL_OPACITY,
  FURNITURE_RAIL_STROKE,
  FURNITURE_SHADOW,
  FURNITURE_WEAVE,
  type FurniturePart,
} from '@livehuddle/document';
import {
  FURNITURE_EDGE_STROKE,
  FURNITURE_SOFT_SHADOW,
  partShade,
  shadeKeys,
  tone,
  FURNITURE_LIGHT,
} from '@livehuddle/avatar/furniture-shading';

type Shade = { role: 'panel' | 'face'; color: string; index: number };

/** One drawing's light: the id its gradients are written under and each material's gradient. */
export type FurnitureLight = { prefix: string; shades: Map<string, Shade> };

export function useFurnitureLight(parts: readonly FurniturePart[], seat: string): FurnitureLight {
  const prefix = `fl${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const shades = useMemo(() => shadeKeys(parts, seat), [parts, seat]);
  return { prefix, shades };
}

/** The drawing's gradients and its soft contact shadow. */
export function FurnitureLightDefs({ light }: { light: FurnitureLight }) {
  const out = [];
  for (const s of light.shades.values()) {
    const shade = partShade(s.color, s.role);
    out.push(
      <linearGradient key={s.index} id={`${light.prefix}-${s.index}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={shade.top} />
        <stop offset="1" stopColor={shade.bottom} />
      </linearGradient>,
    );
  }
  return (
    <defs>
      {out}
      <radialGradient id={`${light.prefix}-shadow`}>
        {FURNITURE_SOFT_SHADOW.stops.map(([at, opacity]) => (
          <stop
            key={at}
            offset={at}
            stopColor={FURNITURE_SOFT_SHADOW.color}
            stopOpacity={opacity}
          />
        ))}
      </radialGradient>
    </defs>
  );
}

// An edge in a deeper shade of its own material: cached per colour, since many parts share one.
const edges = new Map<string, string>();
function edgeOf(color: string): string {
  let e = edges.get(color);
  if (e === undefined) {
    e = tone(color, FURNITURE_LIGHT.edge);
    if (edges.size > 512) edges.clear();
    edges.set(color, e);
  }
  return e;
}

export function FurniturePartView({
  part,
  seat,
  stroke,
  light,
}: {
  part: FurniturePart;
  seat: string;
  stroke: string;
  light?: FurnitureLight;
}) {
  const paint = (() => {
    switch (part.role) {
      case 'shadow':
        return light
          ? { fill: `url(#${light.prefix}-shadow)` }
          : { fill: FURNITURE_SHADOW.fill, opacity: FURNITURE_SHADOW.opacity };
      case 'panel':
      case 'face': {
        const color = part.fill ?? seat;
        const shade = light?.shades.get(`${part.role}|${color}`);
        return {
          fill: shade ? `url(#${light!.prefix}-${shade.index})` : color,
          stroke: edgeOf(color),
          strokeWidth: FURNITURE_EDGE_STROKE,
          strokeLinejoin: 'round' as const,
        };
      }
      case 'floor':
        return { fill: part.fill ?? seat };
      // A small unstroked mark in its own colour (docs/specs/009-elements/social-pieces.md).
      case 'mark':
        return { fill: part.fill ?? stroke };
      // Legs and posts: in their own material when they name one, else the piece's ink.
      case 'line':
        return {
          fill: 'none',
          stroke: part.fill ?? stroke,
          strokeWidth: FURNITURE_LINE_STROKE,
          strokeLinecap: 'round' as const,
        };
      case 'rail':
        return {
          fill: 'none',
          stroke: part.fill ?? stroke,
          strokeWidth: FURNITURE_RAIL_STROKE,
          opacity: FURNITURE_RAIL_OPACITY,
          strokeLinecap: 'round' as const,
        };
      case 'screen':
        return { fill: part.fill ?? stroke };
      case 'glint':
        return {
          fill: 'none',
          stroke: FURNITURE_GLINT.stroke,
          strokeWidth: FURNITURE_RAIL_STROKE,
          opacity: FURNITURE_GLINT.opacity,
          strokeLinecap: 'round' as const,
        };
      // A rug's woven pattern (docs/specs/009-elements/office.md "Rug types"): the stroke's tint, a white sheen, a dye.
      case 'tint':
        return { fill: stroke, opacity: FURNITURE_WEAVE.tint };
      case 'sheen':
        return { fill: FURNITURE_GLINT.stroke, opacity: FURNITURE_WEAVE.sheen };
      case 'dye':
        return { fill: part.fill ?? stroke, opacity: FURNITURE_WEAVE.dye };
    }
  })();
  switch (part.tag) {
    case 'rect':
      return <rect x={part.x} y={part.y} width={part.w} height={part.h} rx={part.rx} {...paint} />;
    case 'ellipse':
      return <ellipse cx={part.cx} cy={part.cy} rx={part.rx} ry={part.ry} {...paint} />;
    case 'path':
      return <path d={part.d} {...paint} />;
  }
}

/** A whole table of parts, lit: the drawings drawn to their size (a room, the garden, a pond, a pool). */
export function LitParts({
  parts,
  seat,
  stroke,
}: {
  parts: readonly FurniturePart[];
  seat: string;
  stroke: string;
}) {
  const light = useFurnitureLight(parts, seat);
  return (
    <>
      <FurnitureLightDefs light={light} />
      {parts.map((p, i) => (
        <FurniturePartView key={i} part={p} seat={seat} stroke={stroke} light={light} />
      ))}
    </>
  );
}
