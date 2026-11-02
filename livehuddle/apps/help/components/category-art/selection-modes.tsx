import type { ReactNode } from 'react';
import { Label, Shape } from '@liveworkspace/help-site/art/primitives';
import { Card, Stage } from '@liveworkspace/help-site/art/parts';

const ICON = 'fill-none stroke-current';

// The picker's rows: each mode's glyph, drawn about its centre, and its name.
const MODES: { name: string; glyph: ReactNode }[] = [
  {
    name: 'Select',
    glyph: (
      <path d="M-4 -7 v13 l3.4 -3.1 2.2 4.6 2.2 -1 -2.1 -4.4 4.4 -0.3 Z" className="fill-current" />
    ),
  },
  {
    name: 'Hand',
    glyph: (
      <path
        d="M-4 6 c-2 -2 -4 -5 -4 -7 0 -1.2 1.6 -1.6 2.4 -0.4 L-4 1 V-6 a1.3 1.3 0 0 1 2.6 0 V-1 V-7.5 a1.3 1.3 0 0 1 2.6 0 V-1 V-6.5 a1.3 1.3 0 0 1 2.6 0 V0 V-4 a1.3 1.3 0 0 1 2.6 0 V2 c0 3 -2 5.5 -5 5.5 Z"
        className={ICON}
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
    ),
  },
  {
    name: 'Eraser',
    glyph: (
      <g transform="rotate(-40)">
        <rect x={-7} y={-4} width={14} height={8} rx={2} className={ICON} strokeWidth={1.5} />
        <line x1={-1} y1={-4} x2={-1} y2={4} className="stroke-current" strokeWidth={1.5} />
      </g>
    ),
  },
  {
    name: 'Laser',
    glyph: (
      <g>
        <circle r={2.6} className="fill-rose-500" />
        <path
          d="M0 -7 v2.5 M0 4.5 v2.5 M-7 0 h2.5 M4.5 0 h2.5"
          className="stroke-rose-400"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </g>
    ),
  },
  {
    name: 'Spotlight',
    glyph: (
      <g>
        <circle r={6.5} className={ICON} strokeWidth={1.5} />
        <circle r={2.8} className="fill-amber-400" />
      </g>
    ),
  },
  {
    name: 'Isometric',
    glyph: (
      <path
        d="M0 -7 L6.5 -3.5 V3.5 L0 7 L-6.5 3.5 V-3.5 Z M-6.5 -3.5 L0 0 L6.5 -3.5 M0 0 V7"
        className={ICON}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    ),
  },
];

// Selection Modes: the mode picker open with Select chosen, a marquee sweeping up two shapes, and the
// laser's fading trail across the canvas below.
export function SelectionModesArt() {
  return (
    <Stage>
      <Card x={22} y={22} w={122} h={178} r={12}>
        {MODES.map((m, i) => {
          const y = 31 + i * 27;
          const on = i === 0;
          return (
            <g key={m.name}>
              {on && (
                <rect
                  x={28}
                  y={y}
                  width={110}
                  height={23}
                  rx={6}
                  className="fill-brand-50 stroke-brand-200"
                  strokeWidth={1}
                />
              )}
              <g
                transform={`translate(42 ${y + 11.5})`}
                className={on ? 'text-brand-700' : 'text-slate-500'}
              >
                {m.glyph}
              </g>
              <Label
                x={58}
                y={y + 12}
                size={10.5}
                weight={on ? 700 : 500}
                tone={on ? 'accent' : 'body'}
              >
                {m.name}
              </Label>
            </g>
          );
        })}
      </Card>

      {/* A marquee drag catching two shapes. */}
      <rect
        x={176}
        y={34}
        width={196}
        height={92}
        rx={4}
        className="fill-brand-500/[0.07] stroke-brand-500"
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      <Shape x={190} y={52} w={74} h={40} label="Idea" />
      <Shape
        x={286}
        y={66}
        w={70}
        h={46}
        kind="circle"
        label="Test"
        fill="fill-emerald-100"
        stroke="stroke-emerald-400"
      />
      <path
        d="M369 123 v15 l3.8 -3.5 2.5 5.2 2.5 -1.1 -2.4 -5 5 -0.4 Z"
        className="fill-brand-500 stroke-white"
        strokeWidth={1.2}
      />

      {/* The laser's trail, fading from its tail to the bright dot. */}
      <path
        d="M188 186 C226 150 262 204 300 168 S352 160 360 170"
        className="fill-none stroke-rose-300"
        strokeWidth={5}
        strokeLinecap="round"
        opacity={0.35}
      />
      <path
        d="M232 178 C262 200 280 182 300 168 S352 160 360 170"
        className="fill-none stroke-rose-400"
        strokeWidth={3.5}
        strokeLinecap="round"
        opacity={0.7}
      />
      <circle cx={360} cy={170} r={9} className="fill-rose-400" opacity={0.3} />
      <circle cx={360} cy={170} r={4.5} className="fill-rose-500" />
    </Stage>
  );
}
