import type { ReactNode } from 'react';
import { Arrow, Cursor, Label, SelectionBox, Shape } from '@/components/illustrations/primitives';
import { Card, Stage } from './parts';

const TABS = ['Shapes', 'Draw', 'Build', 'Concepts', 'Icons', 'Tech'];
// Each tab's centre, spaced by its label's width.
const TAB_X = [117, 158, 195, 241, 288, 325];

const S = 'fill-none stroke-slate-500';

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

// Palette: the strip of categories with Shapes open, its grid of tiles, and a diamond on its way from the
// panel to the canvas.
export function PaletteArt() {
  return (
    <Stage>
      <Card x={40} y={14} w={320} h={30} r={10}>
        <path
          d="M54 22 v13 l3.4 -3.1 2.2 4.6 2.2 -1 -2.1 -4.4 4.4 -0.3 Z"
          className="fill-slate-500"
        />
        <line x1={84} y1={21} x2={84} y2={37} className="stroke-slate-200" strokeWidth={1.2} />
        {TABS.map((t, i) => (
          <Label
            key={t}
            x={TAB_X[i]!}
            y={29.5}
            anchor="middle"
            size={9.5}
            weight={i === 0 ? 700 : 500}
            tone={i === 0 ? 'accent' : 'body'}
          >
            {t}
          </Label>
        ))}
        <rect x={100} y={38} width={34} height={2.5} rx={1.2} className="fill-brand-500" />
      </Card>

      {/* The Shapes panel. */}
      <Card x={48} y={52} w={170} h={132} r={10}>
        <Label x={60} y={64} size={9} weight={700} tone="muted">
          SHAPES
        </Label>
        {TILE_GLYPHS.map((glyph, i) => {
          const tx = 58 + (i % 3) * 52;
          const ty = 74 + Math.floor(i / 3) * 34;
          const on = i === 3;
          return (
            <g key={i}>
              <rect
                x={tx}
                y={ty}
                width={46}
                height={30}
                rx={6}
                className={on ? 'fill-brand-50 stroke-brand-400' : 'fill-slate-50 stroke-slate-200'}
                strokeWidth={on ? 1.6 : 1}
              />
              {glyph(tx + 23, ty + 15)}
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
