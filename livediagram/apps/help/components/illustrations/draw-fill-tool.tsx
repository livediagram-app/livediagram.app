// The Fill tool for the Draw Mode article (docs/specs/023-draw-mode/fill-tool.md): what a press of the
// paint bucket fills. A shape takes the colour, a marker loop whose ends meet becomes a filled shape with
// its ink kept as the outline, and open ink fills nothing and shows the hint (real wording, from
// hooks/canvas/usePaintBucket.ts).

import { Scene, Label } from '@liveworkspace/help-site/art/primitives';
import { FillGlyph } from './editor-mode-switch';

const INK = {
  fill: 'none',
  className: 'stroke-slate-700',
  strokeWidth: 2.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** The bucket's cursor: a crosshair at the tip with the bucket beside it. */
function BucketCursor({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d="M-6 0 h12 M0 -6 v12"
        className="stroke-slate-800"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <g transform="translate(15 -12) scale(0.9)">
        <rect
          x={-10}
          y={-11}
          width={22}
          height={24}
          rx={5}
          className="fill-white stroke-slate-300"
        />
        <FillGlyph bar="fill-emerald-400" />
      </g>
    </g>
  );
}

/** Three presses of the Fill tool: a rectangle filled, a marker loop closed and filled under its ink,
 *  and an open squiggle that fills nothing, with the hint that says why. */
export function FillToolScene() {
  return (
    <Scene w={420} h={210}>
      {/* A shape takes the colour as its fill. */}
      <rect
        x={24}
        y={40}
        width={104}
        height={66}
        rx={6}
        className="fill-amber-400 stroke-slate-700"
        fillOpacity={0.55}
        strokeWidth={2}
      />
      <Label x={76} y={132} anchor="middle" size={10.5} tone="body">
        A shape: filled
      </Label>

      {/* A marker loop whose ends meet: filled under its ink. */}
      <path
        d="M168 76 c-4 -26 22 -42 50 -38 c26 4 40 22 34 44 c-6 22 -34 30 -56 24 c-18 -5 -26 -14 -28 -30 Z"
        className="fill-emerald-400"
        fillOpacity={0.55}
      />
      <path
        d="M168 76 c-4 -26 22 -42 50 -38 c26 4 40 22 34 44 c-6 22 -34 30 -56 24 c-18 -5 -26 -14 -26 -28"
        {...INK}
      />
      <BucketCursor x={212} y={74} />
      <Label x={210} y={132} anchor="middle" size={10.5} tone="body">
        A loop: filled
      </Label>

      {/* Open ink: nothing to fill. */}
      <path d="M300 92 c10 -40 26 -44 34 -14 s20 30 30 -6 s14 -26 26 -10" {...INK} />
      <Label x={346} y={132} anchor="middle" size={10.5} tone="body">
        Open ink: nothing
      </Label>

      {/* The hint a press that fills nothing shows. */}
      <rect
        x={34}
        y={152}
        width={352}
        height={32}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      <circle cx={52} cy={168} r={6} className="fill-brand-500" />
      <Label x={52} y={171.5} anchor="middle" size={9} weight={700} tone="onAccent">
        i
      </Label>
      <Label x={66} y={172} size={10.5} tone="body">
        Click inside a closed shape, or a loop whose ends meet, to fill it.
      </Label>
    </Scene>
  );
}
