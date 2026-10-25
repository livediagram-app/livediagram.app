import type { ReactNode } from 'react';
import { Label } from './primitives';
import { Card } from './parts';

// The palette's tool picker, opened: its tiles in three bands, the current tool tinted and a tool's key in its
// tile's corner. This is the picker of the editors whose pages are made in Pages mode (the Select article in their
// help: Edit holds Select, Hand and Format; Present holds Laser, Spotlight and Slide Deck; Preview holds Zen;
// livediagram's own picker keeps Isometric). Each glyph is drawn about its centre in `currentColor`, so the tile tints it.

const ICON = 'fill-none stroke-current';

const TOOL_GLYPHS: Record<string, ReactNode> = {
  Select: (
    <path d="M-4 -7 v13 l3.4 -3.1 2.2 4.6 2.2 -1 -2.1 -4.4 4.4 -0.3 Z" className="fill-current" />
  ),
  Hand: (
    <path
      d="M-4 6 c-2 -2 -4 -5 -4 -7 0 -1.2 1.6 -1.6 2.4 -0.4 L-4 1 V-6 a1.3 1.3 0 0 1 2.6 0 V-1 V-7.5 a1.3 1.3 0 0 1 2.6 0 V-1 V-6.5 a1.3 1.3 0 0 1 2.6 0 V0 V-4 a1.3 1.3 0 0 1 2.6 0 V2 c0 3 -2 5.5 -5 5.5 Z"
      className={ICON}
      strokeWidth={1.3}
      strokeLinejoin="round"
    />
  ),
  Format: (
    <g>
      <rect x={-6} y={-7} width={11} height={5} rx={1.5} className={ICON} strokeWidth={1.4} />
      <path d="M5 -4.5 h2 v4 h-7 v3" className={ICON} strokeWidth={1.4} strokeLinejoin="round" />
      <rect x={-1.5} y={2.5} width={3} height={5} rx={1} className="fill-current" />
    </g>
  ),
  Laser: (
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
  Spotlight: (
    <g>
      <circle r={6.5} className={ICON} strokeWidth={1.5} />
      <circle r={2.8} className="fill-amber-400" />
    </g>
  ),
  'Slide Deck': (
    <g>
      <rect x={-7} y={-5.5} width={14} height={9} rx={1.5} className={ICON} strokeWidth={1.4} />
      <path d="M-1.5 -3 l4 2 -4 2 Z" className="fill-current" />
      <path d="M0 3.5 v3 M-3 6.5 h6" className={ICON} strokeWidth={1.3} strokeLinecap="round" />
    </g>
  ),
  Zen: (
    <path d="M5.5 -3 A6.5 6.5 0 1 0 6.3 2" className={ICON} strokeWidth={2} strokeLinecap="round" />
  ),
};

const BANDS: { name: string; tools: { name: string; key?: string }[] }[] = [
  {
    name: 'EDIT',
    tools: [{ name: 'Select', key: 'V' }, { name: 'Hand', key: 'H' }, { name: 'Format' }],
  },
  {
    name: 'PRESENT',
    tools: [{ name: 'Laser', key: 'K' }, { name: 'Spotlight' }, { name: 'Slide Deck' }],
  },
  {
    name: 'PREVIEW',
    tools: [{ name: 'Zen', key: 'Z' }],
  },
];

/** The tool picker, 150 by 186 from (x, y), with `current` tinted. */
export function ToolPicker({
  x,
  y,
  current = 'Select',
}: {
  x: number;
  y: number;
  current?: string;
}) {
  return (
    <Card x={x} y={y} w={150} h={186} r={12}>
      {BANDS.map((band, b) => {
        const by = y + 10 + b * 58;
        return (
          <g key={band.name}>
            <Label x={x + 10} y={by + 4} size={7} weight={700} tone="muted">
              {band.name}
            </Label>
            {band.tools.map((tool, t) => {
              const tx = x + 8 + t * 46;
              const ty = by + 11;
              const on = tool.name === current;
              return (
                <g key={tool.name}>
                  <rect
                    x={tx}
                    y={ty}
                    width={42}
                    height={40}
                    rx={7}
                    className={
                      on ? 'fill-brand-50 stroke-brand-300' : 'fill-slate-50 stroke-slate-200'
                    }
                    strokeWidth={1}
                  />
                  <g
                    transform={`translate(${tx + 21} ${ty + 15})`}
                    className={on ? 'text-brand-700' : 'text-slate-500'}
                  >
                    {TOOL_GLYPHS[tool.name]}
                  </g>
                  <Label
                    x={tx + 21}
                    y={ty + 32}
                    anchor="middle"
                    size={6.5}
                    weight={on ? 700 : 500}
                    tone={on ? 'accent' : 'body'}
                  >
                    {tool.name}
                  </Label>
                  {tool.key && (
                    <Label
                      x={tx + 36}
                      y={ty + 7}
                      anchor="middle"
                      size={6}
                      weight={700}
                      tone="muted"
                    >
                      {tool.key}
                    </Label>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </Card>
  );
}
