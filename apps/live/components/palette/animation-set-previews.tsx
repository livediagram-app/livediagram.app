// The live miniatures for the Shape, Text, Sticky, Drawing, Media and Table animation tiles
// (docs/specs/028-animation/element-animations.md "The menu"). Each is a tiny element of its
// kind wearing the real animation classes and the variables the canvas sets, so a tile shows
// exactly what picking it does. AnimationPreviewTile freezes it on a telling frame
// (ANIMATION_PREVIEW_FRAME) and plays it on hover.

import type { CSSProperties } from 'react';
import type { AnimationSetId, PathElement } from '@livediagram/document';
import { PathSvg } from '@/components/canvas/path/PathSvg';
import { planTextAnimation, renderUnits } from '@/components/canvas/animated-words';
import { ANIMATION_CLASS_PREFIX } from '@/lib/animation-classes';

const ACCENT = '#0ea5e9';
const vars = (v: Record<string, string | number>) => v as CSSProperties;

// The variables every body miniature reads, scaled as if it were a modest canvas element so a
// ring or a hop reads at tile size without leaving the tile.
const BODY_VARS = vars({
  '--lvd-anim-speed': 1,
  '--lvd-anim-color': ACCENT,
  '--lvd-anim-size': 40,
  '--lvd-w': 120,
  '--lvd-h': 80,
});

// The Shape set's values that draw on the child layer.
const LAYERED = new Set(['pulse', 'glow', 'trace', 'gradient']);

// Motions that move the element: their miniature rests over a faint dashed ghost of where it
// started, an onion skin, so how far and which way it moves reads in a still frame.
const MOVES = new Set([
  'bounce',
  'wobble',
  'shake',
  'jelly',
  'float',
  'swing',
  'heartbeat',
  'breathe',
  'flutter',
  'sway',
  'wiggle',
  'lift',
  'drop',
  'slap',
]);

/** The frame each tile rests on, by set and value; anything unlisted rests at 0.3. */
export const ANIMATION_PREVIEW_FRAME: Readonly<Record<string, number>> = {
  'shape:pulse': 0.12,
  'shape:blink': 0.5,
  'shape:glow': 0.5,
  'shape:gradient': 0.45,
  'shape:breathe': 0.5,
  'shape:heartbeat': 0.3,
  'shape:shimmer': 0.06,
  'shape:highlight': 0.38,
  'shape:bounce': 0.32,
  'shape:wobble': 0.14,
  'shape:shake': 0.04,
  'shape:jelly': 0.15,
  'shape:float': 0.5,
  'shape:swing': 0.15,
  'text:typewriter': 0.22,
  'text:words': 0.22,
  'text:cascade': 0.2,
  'text:focus': 0.18,
  'text:scramble': 0.25,
  'text:highlighter': 0.24,
  'text:underline': 0.24,
  'text:wave': 0.22,
  'text:shine': 0.2,
  'text:flicker': 0.01,
  'text:glow': 0.5,
  'text:bounce': 0.32,
  'text:float': 0.5,
  'sticky:flutter': 0.12,
  'sticky:sway': 0.25,
  'sticky:lift': 0.5,
  'sticky:wiggle': 0.04,
  'sticky:pulse': 0.12,
  'sticky:drop': 0.19,
  'sticky:slap': 0.1,
  'sticky:glow': 0.5,
  'sticky:highlight': 0.38,
  'drawing:draw': 0.25,
  'drawing:dash': 0.5,
  'drawing:boil': 0.1,
  'drawing:ink': 0.5,
  'drawing:glow': 0.5,
  'drawing:shimmer': 0.15,
  'media:kenburns': 0.5,
  'media:zoom': 0.5,
  'media:pan': 0.25,
  'media:tilt': 0.25,
  'media:develop': 0.15,
  'media:focus': 0.15,
  'media:wipe': 0.2,
  'media:iris': 0.2,
  'media:sheen': 0.12,
  'table:rows': 0.22,
  'table:columns': 0.22,
  'table:cells': 0.22,
  'table:header': 0.12,
  'table:pulse': 0.12,
  'table:glow': 0.5,
};

export function previewFrame(set: string, value: string | null): number {
  return value ? (ANIMATION_PREVIEW_FRAME[`${set}:${value}`] ?? 0.3) : 0;
}

/** The miniature for one option of a set; `null` is the still element (None). */
export function AnimationSetPreview({ set, value }: { set: AnimationSetId; value: string | null }) {
  switch (set) {
    case 'text':
      return <TextPreview value={value} />;
    case 'sticky':
      return <StickyPreview value={value} />;
    case 'drawing':
      return <DrawingPreview value={value} />;
    case 'media':
      return <MediaPreview value={value} />;
    case 'table':
      return <TablePreview value={value} />;
    default:
      return <ShapePreview value={value} />;
  }
}

// A Shape value on a body (a Shape tile, a kept value, or a sticky / table's shared motions):
// the wrapper class plus, for the ring / halo / light / gradient, the child layer.
function shapeClass(value: string | null): string {
  return value ? `lvd-anim-${value}` : '';
}
function Layer({ value }: { value: string | null }) {
  return value && LAYERED.has(value) ? <span className="lvd-anim-layer" /> : null;
}

// The still outline a moving miniature started from.
function Ghost({ className }: { className: string }) {
  return <span className={`absolute border-dashed opacity-40 ${className}`} />;
}

function ShapePreview({ value }: { value: string | null }) {
  return (
    <>
      {value && MOVES.has(value) ? (
        <Ghost className="h-[20px] w-[32px] rounded-[5px] border-[1.5px] border-sky-500" />
      ) : null}
      <span
        className={`relative block h-[20px] w-[32px] rounded-[5px] border-[1.5px] border-sky-500 bg-sky-50 dark:bg-sky-500/15 ${shapeClass(value)}`}
        style={vars({ ...BODY_VARS, '--lvd-anim-bg': '#f0f9ff' })}
      >
        <Layer value={value} />
      </span>
    </>
  );
}

// The words a Text miniature animates: two words for Words, one otherwise.
function TextPreview({ value }: { value: string | null }) {
  const text = value === 'words' ? 'Hi there' : 'Hello';
  if (!value) return <span className="text-[13px] font-semibold leading-none">{text}</span>;
  const plan = planTextAnimation([text], value as never, 'tile');
  return (
    <span
      // Scramble's stand-ins need a concrete ink (a letter's own colour fades as it resolves).
      className={`lvd-tx ${ANIMATION_CLASS_PREFIX.text}${plan.animation} whitespace-nowrap text-[13px] font-semibold leading-none [--lvd-tx-color:#334155] dark:[--lvd-tx-color:#e2e8f0]`}
      style={vars({
        '--lvd-text-n': plan.count,
        '--lvd-text-speed': 1,
        '--lvd-anim-color': ACCENT,
        '--lvd-tx-mark': '#facc15',
      })}
    >
      {renderUnits(text, plan, { next: 0 })}
    </span>
  );
}

const STICKY_SHAPE = new Set(['pulse', 'glow', 'highlight']);
const STICKY_LAYERED = new Set(['peel', 'lift', 'slap']);

function StickyPreview({ value }: { value: string | null }) {
  const cls = !value
    ? ''
    : STICKY_SHAPE.has(value)
      ? shapeClass(value)
      : `${ANIMATION_CLASS_PREFIX.sticky}${value}`;
  return (
    <>
      {value && MOVES.has(value) ? (
        <Ghost className="h-[24px] w-[24px] border border-amber-500" />
      ) : null}
      <span
        className={`relative block h-[24px] w-[24px] bg-amber-200 shadow-[0_1px_2px_rgb(15_23_42/0.25)] ${cls}`}
        style={vars({ ...BODY_VARS, '--lvd-anim-size': 24, '--lvd-anim-bg': '#fde68a' })}
      >
        <span className="absolute left-[4px] right-[6px] top-[6px] h-[2px] rounded bg-amber-900/30" />
        <span className="absolute left-[4px] right-[9px] top-[11px] h-[2px] rounded bg-amber-900/30" />
        {value && (STICKY_LAYERED.has(value) || LAYERED.has(value)) ? (
          <span className="lvd-anim-layer" />
        ) : null}
      </span>
    </>
  );
}

// A small zig-zag path, drawn by the real path renderer so its masks and overlays are the
// canvas's own.
function DrawingPreview({ value }: { value: string | null }) {
  const path = {
    id: `tile-${value ?? 'none'}`,
    type: 'path',
    x: 0,
    y: 0,
    width: 38,
    height: 22,
    closed: false,
    strokeWidth: 'thick',
    nodes: [
      { nx: 0, ny: 0.9, mode: 'corner' },
      { nx: 0.33, ny: 0.1, mode: 'corner' },
      { nx: 0.66, ny: 0.9, mode: 'corner' },
      { nx: 1, ny: 0.1, mode: 'corner' },
    ],
    ...(value ? { animation: value } : {}),
  } as unknown as PathElement;
  return (
    <span className="relative block h-[22px] w-[38px]" style={BODY_VARS}>
      <PathSvg element={path} fill="transparent" stroke={ACCENT} />
    </span>
  );
}

// A little landscape: sky, sun and hills, as a picture to pan, develop and wipe.
const PICTURE = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 40'><defs><linearGradient id='s' x2='0' y2='1'><stop offset='0' stop-color='#38bdf8'/><stop offset='1' stop-color='#bae6fd'/></linearGradient></defs><rect width='60' height='40' fill='url(#s)'/><circle cx='44' cy='12' r='6' fill='#fde047'/><path d='M0 30 Q15 18 30 28 T60 24 V40 H0Z' fill='#22c55e'/><path d='M0 36 Q20 28 40 34 T60 32 V40 H0Z' fill='#15803d'/></svg>`,
)}`;

function MediaPreview({ value }: { value: string | null }) {
  return (
    <span
      className={`relative block h-[26px] w-[38px] overflow-hidden rounded-[4px] ${value ? `${ANIMATION_CLASS_PREFIX.media}${value}` : ''}`}
      style={BODY_VARS}
    >
      <img src={PICTURE} alt="" draggable={false} className="block h-full w-full" />
    </span>
  );
}

const TABLE_SHAPE = new Set(['pulse', 'glow']);

function TablePreview({ value }: { value: string | null }) {
  const cls = !value
    ? ''
    : TABLE_SHAPE.has(value)
      ? shapeClass(value)
      : `${ANIMATION_CLASS_PREFIX.table}${value}`;
  return (
    <span
      className={`relative grid h-[24px] w-[38px] grid-cols-3 grid-rows-3 overflow-hidden rounded-[3px] border border-slate-400/70 bg-white dark:bg-slate-900 ${cls}`}
      style={vars({ ...BODY_VARS, '--lvd-rows': 3, '--lvd-cols': 3 })}
    >
      {[0, 1, 2].flatMap((r) =>
        [0, 1, 2].map((c) => (
          <span
            key={`${r}${c}`}
            className={`lvd-tbl-cell relative flex items-center justify-center border-slate-300/70 ${
              c < 2 ? 'border-r' : ''
            } ${r < 2 ? 'border-b' : ''} ${r === 0 ? 'bg-slate-200 dark:bg-slate-700' : ''}`}
            data-first-row={r === 0 ? '' : undefined}
            style={vars({ '--lvd-r': r, '--lvd-c': c })}
          >
            <span className="h-[2px] w-[6px] rounded bg-slate-400" />
          </span>
        )),
      )}
      {value && TABLE_SHAPE.has(value) ? <span className="lvd-anim-layer" /> : null}
    </span>
  );
}
