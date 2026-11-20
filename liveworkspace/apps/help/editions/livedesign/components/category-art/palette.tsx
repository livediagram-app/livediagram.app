import type { ReactNode } from 'react';
import { Label } from '@liveworkspace/help-site/art/primitives';
import { Card, Stage } from '@liveworkspace/help-site/art/parts';

// The strip on a logo page, as Toolbar Layout lists it: Draw first, then Shapes, Write, Icons and Media. Each
// name's centre along the strip.
const CATEGORIES = [
  { name: 'Draw', x: 104 },
  { name: 'Shapes', x: 148 },
  { name: 'Write', x: 192 },
  { name: 'Icons', x: 232 },
  { name: 'Media', x: 272 },
];

const S = 'fill-none stroke-slate-500';

// Draw's four tools (Palette Tools): the Pen for precise paths, the Freehand pencil, the Shape Pen and the Polygon,
// each glyph drawn about its tile's centre.
const TOOLS: { name: string; glyph: (cx: number, cy: number) => ReactNode }[] = [
  {
    name: 'Pen',
    glyph: (cx, cy) => (
      <>
        <path
          d={`M${cx} ${cy - 9} L${cx + 6} ${cy + 1} L${cx} ${cy + 7} L${cx - 6} ${cy + 1} Z`}
          className={S}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        <path d={`M${cx} ${cy - 9} V${cy + 1}`} className={S} strokeWidth={1.2} />
        <circle cx={cx} cy={cy + 1} r={1.5} className="fill-slate-500" />
      </>
    ),
  },
  {
    name: 'Freehand',
    glyph: (cx, cy) => (
      <path
        d={`M${cx - 9} ${cy + 5} c3 -8 6 -8 8 -2 s5 4 9 -8`}
        className={S}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    ),
  },
  {
    name: 'Shape Pen',
    glyph: (cx, cy) => (
      <>
        <path
          d={`M${cx - 7} ${cy + 1} c0 -6 5 -9 9 -8 s5 6 3 9 -8 5 -12 -1`}
          className="fill-none stroke-slate-400"
          strokeWidth={1.2}
          strokeDasharray="2 2"
        />
        <circle cx={cx + 1} cy={cy} r={6} className={S} strokeWidth={1.4} />
      </>
    ),
  },
  {
    name: 'Polygon',
    glyph: (cx, cy) => (
      <path
        d={`M${cx} ${cy - 8} L${cx + 8} ${cy - 2} L${cx + 5} ${cy + 7} L${cx - 5} ${cy + 7} L${cx - 8} ${cy - 2} Z`}
        className={S}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    ),
  },
];

// Palette: the strip as it is on a logo page, with Draw open and the Pen chosen, drawing a curve on the artboard: the
// placed anchors, a handle being dragged out of the last one, and the path following it.
export function PaletteArt() {
  return (
    <Stage>
      <Card x={52} y={14} w={252} h={30} r={10}>
        {/* The tool picker, holding Select. */}
        <path
          d="M64 22 v13 l3.4 -3.1 2.2 4.6 2.2 -1 -2.1 -4.4 4.4 -0.3 Z"
          className="fill-slate-500"
        />
        <line x1={84} y1={21} x2={84} y2={37} className="stroke-slate-200" strokeWidth={1.2} />
        {CATEGORIES.map((c) => {
          const on = c.name === 'Draw';
          return (
            <Label
              key={c.name}
              x={c.x}
              y={29.5}
              anchor="middle"
              size={9.5}
              weight={on ? 700 : 500}
              tone={on ? 'accent' : 'body'}
            >
              {c.name}
            </Label>
          );
        })}
        <rect x={90} y={38} width={28} height={2.5} rx={1.2} className="fill-brand-500" />
      </Card>

      {/* The Draw panel. */}
      <Card x={52} y={52} w={124} h={110} r={10}>
        <Label x={64} y={64} size={9} weight={700} tone="muted">
          DRAW
        </Label>
        {TOOLS.map((t, i) => {
          const tx = 60 + (i % 2) * 56;
          const ty = 72 + Math.floor(i / 2) * 44;
          const on = t.name === 'Pen';
          return (
            <g key={t.name}>
              <rect
                x={tx}
                y={ty}
                width={52}
                height={40}
                rx={7}
                className={on ? 'fill-brand-50 stroke-brand-400' : 'fill-slate-50 stroke-slate-200'}
                strokeWidth={on ? 1.6 : 1}
              />
              {t.glyph(tx + 26, ty + 16)}
              <Label
                x={tx + 26}
                y={ty + 33}
                anchor="middle"
                size={7.5}
                weight={on ? 700 : 500}
                tone={on ? 'accent' : 'body'}
              >
                {t.name}
              </Label>
            </g>
          );
        })}
      </Card>

      {/* The logo artboard, the pen mid-curve. */}
      <Label x={206} y={60} size={8.5} weight={600} tone="muted">
        1024 x 1024 · Logo
      </Label>
      <Card x={206} y={68} w={140} h={140} r={4}>
        <circle
          cx={276}
          cy={138}
          r={50}
          className="fill-none stroke-sky-300"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <path
          d="M276 68 V208 M206 138 H346"
          className="fill-none stroke-sky-200"
          strokeWidth={0.8}
        />
      </Card>
      <path
        d="M236 168 C246 118 276 104 296 124 S318 174 326 150"
        className="fill-none stroke-brand-500"
        strokeWidth={3}
        strokeLinecap="round"
      />
      {/* The handle being dragged out of the last anchor. */}
      <line x1={312} y1={176} x2={340} y2={124} className="stroke-brand-400" strokeWidth={1.2} />
      <circle cx={312} cy={176} r={3} className="fill-brand-400" />
      <circle cx={340} cy={124} r={3} className="fill-brand-400" />
      {[
        [236, 168],
        [296, 124],
        [326, 150],
      ].map(([x, y]) => (
        <rect
          key={x}
          x={x! - 3.5}
          y={y! - 3.5}
          width={7}
          height={7}
          className="fill-white stroke-brand-600"
          strokeWidth={1.4}
        />
      ))}
      {/* The pen nib at the handle's end. */}
      <path
        d="M340 124 l10 -4 4 -10 -6 -4 -10 4 Z M340 124 l7 -7"
        className="fill-white stroke-slate-700"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </Stage>
  );
}
