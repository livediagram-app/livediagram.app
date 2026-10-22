// The drafting conventions drawn around the floor plan template
// (./template-builders-floorplan): dimension chains, a north arrow, a scale
// bar and the key. Kept apart from the plan itself because they are the
// sheet's furniture rather than the flat's, and every one of them is a plain
// canvas primitive the user can move or delete.
//
// All pure; every element lands on the scaffold layer, with the walls, so
// locking the shell pins the sheet too. See docs/specs/008-canvas/canvas-and-palette.md "Templates".

import {
  createArrow,
  createShape,
  createText,
  type ArrowElement,
  type Element,
  type LegendItem,
} from '@livediagram/document';
import { TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';

const MUTED = '#64748b';
const scaffold = { layerId: TEMPLATE_SCAFFOLD_LAYER_ID };

// How far a dimension line stands off the wall it measures, and how long its
// end ticks run. The ticks reach back towards the wall, the way extension
// lines do on a drawing.
const DIM_OFFSET = 30;
const TICK = 16;

const line = (x1: number, y1: number, x2: number, y2: number): ArrowElement => ({
  ...createArrow(x1, y1, x2, y2),
  arrowEnds: 'none',
  strokeWidth: 1,
  strokeColor: MUTED,
  ...scaffold,
});

// A run of dimensions along one wall. `stops` are the positions (px from
// `start`) where the chain breaks, including both ends; each span is labelled
// with its length in metres. `horizontal` chains sit above the wall at
// `wallAt` (a y); vertical ones sit left of it (an x).
export function dimensionChain(
  horizontal: boolean,
  wallAt: number,
  start: number,
  stops: readonly number[],
  pxPerM: number,
): Element[] {
  const at = wallAt - DIM_OFFSET;
  const out: Element[] = [];
  for (const s of stops) {
    const p = start + s;
    out.push(
      horizontal
        ? line(p, at - TICK / 2, p, at + TICK / 2)
        : line(at - TICK / 2, p, at + TICK / 2, p),
    );
  }
  for (let i = 0; i < stops.length - 1; i++) {
    const a = start + stops[i]!;
    const b = start + stops[i + 1]!;
    out.push({
      ...(horizontal ? createArrow(a, at, b, at) : createArrow(at, a, at, b)),
      arrowEnds: 'both',
      arrowheadSize: 'small',
      strokeWidth: 1,
      strokeColor: MUTED,
      label: `${((b - a) / pxPerM).toFixed(1)} m`,
      textColor: MUTED,
      ...scaffold,
    });
  }
  return out;
}

// A north arrow: an "N" over a ring with the arrow in it, top-left at (x, y).
export const NORTH_ARROW_H = 22 + 60;
export function northArrow(x: number, y: number): Element[] {
  const ring = 60;
  return [
    {
      ...createText(x, y),
      width: ring,
      height: 22,
      label: 'N',
      textSize: 'sm',
      textBold: true,
      ...scaffold,
    },
    {
      ...createShape('circle', x, y + 22),
      width: ring,
      height: ring,
      strokeWidth: 'thin',
      ...scaffold,
    },
    {
      ...createShape('icon', x + 14, y + 36),
      width: 32,
      height: 32,
      iconId: 'arrow-up',
      label: '',
      ...scaffold,
    },
  ];
}

// A 1 m scale bar with its caption, from (x, y).
export function scaleBar(x: number, y: number, pxPerM: number, caption: string): Element[] {
  return [
    {
      ...createArrow(x, y + 16, x + pxPerM, y + 16),
      arrowEnds: 'both',
      arrowheadSize: 'small',
      strokeWidth: 2,
      label: '1 m',
      ...scaffold,
    },
    {
      ...createText(x + pxPerM + 20, y),
      width: 520,
      height: 32,
      label: caption,
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
      ...scaffold,
    },
  ];
}

// The key: the colour zones as a Legend card, then the plan symbols as
// glyph + name rows, stacked down from (x, y).
export function planKey(
  x: number,
  y: number,
  w: number,
  zones: readonly LegendItem[],
  symbols: readonly [iconId: string, name: string][],
): Element[] {
  const heading = (hy: number, label: string): Element => ({
    ...createText(x, hy),
    width: w,
    height: 30,
    label,
    textSize: 'md',
    textBold: true,
    textAlignX: 'left',
    ...scaffold,
  });
  const legendH = zones.length * 26 + 24;
  const out: Element[] = [
    heading(y, 'Zones'),
    {
      ...createShape('legend', x, y + 36),
      width: w,
      height: legendH,
      legendItems: [...zones],
      textSize: 'md',
      ...scaffold,
    },
  ];
  const symTop = y + 36 + legendH + 20;
  out.push(heading(symTop, 'Symbols'));
  symbols.forEach(([iconId, name], i) => {
    const ry = symTop + 38 + i * 34;
    out.push(
      {
        ...createShape('icon', x + 4, ry),
        width: 28,
        height: 28,
        iconId,
        label: '',
        ...scaffold,
      },
      {
        ...createText(x + 44, ry + 2),
        width: w - 44,
        height: 24,
        label: name,
        textSize: 'sm',
        textAlignX: 'left',
        ...scaffold,
      },
    );
  });
  return out;
}
