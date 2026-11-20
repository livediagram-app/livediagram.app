import type { ReactNode } from 'react';
import { Arrow, Cursor, Label, SelectionBox, Shape } from '@liveworkspace/help-site/art/primitives';
import { Card, Stage } from '@liveworkspace/help-site/art/parts';
import {
  STRIP_W,
  Strip,
  StripGlyph,
  stripSlot,
} from '@/editions/livediagram/components/illustrations/editor-chrome';

const S = 'fill-none stroke-brand-500';

// One shape outline per tile, centred on (cx, cy).
const TILE_GLYPHS: ((cx: number, cy: number) => ReactNode)[] = [
  (cx, cy) => (
    <rect x={cx - 11} y={cy - 8} width={22} height={16} rx={1.5} className={S} strokeWidth={1.6} />
  ),
  (cx, cy) => (
    <rect x={cx - 11} y={cy - 8} width={22} height={16} rx={6} className={S} strokeWidth={1.6} />
  ),
  (cx, cy) => <ellipse cx={cx} cy={cy} rx={11} ry={8} className={S} strokeWidth={1.6} />,
  (cx, cy) => (
    <path
      d={`M${cx} ${cy - 10} L${cx + 12} ${cy} L${cx} ${cy + 10} L${cx - 12} ${cy} Z`}
      className="fill-violet-100 stroke-violet-500"
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
  ),
  (cx, cy) => (
    <path
      d={`M${cx} ${cy - 9} L${cx + 11} ${cy + 8} H${cx - 11} Z`}
      className={S}
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
  ),
  (cx, cy) => (
    <path
      d={`M${cx - 6} ${cy - 8} H${cx + 6} L${cx + 11} ${cy} L${cx + 6} ${cy + 8} H${cx - 6} L${cx - 11} ${cy} Z`}
      className={S}
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
  ),
  (cx, cy) => (
    <path
      d={`M${cx - 9} ${cy - 6} a9 3 0 0 1 18 0 v12 a9 3 0 0 1 -18 0 Z M${cx - 9} ${cy - 6} a9 3 0 0 0 18 0`}
      className={S}
      strokeWidth={1.6}
    />
  ),
  (cx, cy) => (
    <path
      d={`M${cx - 7} ${cy - 8} H${cx + 12} L${cx + 7} ${cy + 8} H${cx - 12} Z`}
      className={S}
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
  ),
  (cx, cy) => (
    <path
      d={`M${cx} ${cy - 10} l2.9 6 6.6 0.9 -4.8 4.6 1.2 6.5 -5.9 -3.1 -5.9 3.1 1.2 -6.5 -4.8 -4.6 6.6 -0.9 Z`}
      className="fill-amber-200 stroke-amber-500"
      strokeWidth={1.3}
      strokeLinejoin="round"
    />
  ),
];

// Palette: the strip with Shapes open, its flyout's grid of tiles, and a diamond on its way from the flyout to the
// canvas.
export function PaletteArt() {
  const sx = (400 - STRIP_W) / 2;
  const fx = stripSlot(sx, 'shapes') - 22;
  return (
    <Stage>
      <Strip x={sx} y={12} open="shapes" />

      {/* The Shapes flyout. */}
      <Card x={fx} y={44} w={170} h={140} r={7}>
        <rect x={fx + 8} y={51} width={18} height={18} rx={4.5} className="fill-brand-50" />
        <StripGlyph item="shapes" x={fx + 17} y={60} size={9} className="stroke-brand-700" />
        <Label x={fx + 32} y={60.5} size={10} weight={650} tone="strong">
          Shapes
        </Label>
        <line
          x1={fx}
          y1={76}
          x2={fx + 170}
          y2={76}
          className="stroke-slate-100"
          strokeWidth={0.75}
        />
        {TILE_GLYPHS.map((glyph, i) => {
          const tx = fx + 10 + (i % 3) * 52;
          const ty = 84 + Math.floor(i / 3) * 33;
          const on = i === 3;
          return (
            <g key={i}>
              <rect
                x={tx}
                y={ty}
                width={46}
                height={29}
                rx={5}
                className={on ? 'fill-brand-50 stroke-brand-300' : 'fill-slate-50 stroke-slate-100'}
                strokeWidth={0.75}
              />
              {glyph(tx + 23, ty + 14.5)}
            </g>
          );
        })}
      </Card>

      {/* Dragged onto the canvas. */}
      <Arrow from={[186, 96]} to={[262, 112]} kind="curved" dashed tone="muted" width={2} />
      <Shape
        x={272}
        y={96}
        w={78}
        h={64}
        kind="diamond"
        label="Decide"
        fill="fill-violet-100"
        stroke="stroke-violet-500"
      />
      <SelectionBox x={268} y={92} w={86} h={72} />
      <Cursor x={318} y={140} colour="violet" />

      <Shape x={262} y={176} w={52} h={26} label="" fill="fill-white" stroke="stroke-slate-300" />
      <Shape
        x={322}
        y={176}
        w={52}
        h={26}
        kind="stadium"
        fill="fill-emerald-100"
        stroke="stroke-emerald-400"
      />
    </Stage>
  );
}
