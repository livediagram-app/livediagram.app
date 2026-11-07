import type { ReactNode } from 'react';
import { Label, Shape } from '@liveworkspace/help-site/art/primitives';
import { Card, Stage } from '@liveworkspace/help-site/art/parts';
import { Character } from './character';

const ICON = 'fill-none stroke-current';

// The Edit | Walk toggle's two sides, stacked: each one's glyph, drawn about its centre, and its name.
const MODES: { name: string; glyph: ReactNode }[] = [
  {
    name: 'Edit',
    glyph: (
      <path d="M-4 -7 v13 l3.4 -3.1 2.2 4.6 2.2 -1 -2.1 -4.4 4.4 -0.3 Z" className="fill-current" />
    ),
  },
  {
    name: 'Walk',
    // Footprints (lucide's, at half scale), Avatar mode's glyph everywhere.
    glyph: (
      <g
        transform="translate(-6 -6) scale(0.5)"
        className={ICON}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z" />
        <path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z" />
        <path d="M16 17h4M4 13h4" />
      </g>
    ),
  },
];

// Edit or Walk: the toggle with Edit on over a character waiting to walk, and a marquee sweeping up two shapes.
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
        {/* Below the toggle, a character and the trail it will walk once Walk is on. */}
        <path
          d="M46 182 q30 -40 74 -52"
          className="stroke-brand-300"
          strokeWidth={1.5}
          fill="none"
          strokeDasharray="3 4"
          strokeLinecap="round"
        />
        <Character x={46} y={176} shirt="fill-brand-500" />
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
    </Stage>
  );
}
