// Feature illustration for Draw mode's dock (docs/specs/023-draw-mode/draw-mode.md): the drawing tools on their keys
// (the Fill bucket among them, docs/specs/023-draw-mode/fill-tool.md)
// and the shapes you pin beside them.

import {
  PANEL,
  SHADOW,
  Scene,
  TEXT_BODY,
  TEXT_MUTED,
} from '@liveworkspace/marketing-site/components/feature-art/canvas-marks';
import { Keycap } from './mode-parts';
import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';

// The Draw dock: the drawing tools with their keys, then the pinned shapes, one being dragged in from
// the Shapes flyout to pin it.
export function DrawDockArt() {
  const tools = [
    ['V', 'M3 2 L3 11 L5.6 8.6 L7.4 12.4 L9 11.8 L7.2 8 L10.6 7.8 Z'],
    ['1', 'M2 11 L9 4 L11 6 L4 13 Z'],
    ['2', 'M2 11 L9 4 L11 6 L4 13 Z'],
    ['3', 'M2 11 L9 4 L11 6 L4 13 Z'],
    ['T', 'M2 3 H11 M6.5 3 V12'],
    ['P', 'M2 12 C4 2 9 12 11 3'],
    [
      'F',
      'M2 7 L6.5 2.5 L11 7 L6.5 11.5 Z M9.5 8 C10.6 9.6 10.6 10.6 9.5 10.6 C8.4 10.6 8.4 9.6 9.5 8',
    ],
    ['E', 'M3 9 L7 4 L11 8 L8 12 H4 Z'],
  ] as const;
  const markers = ['#0f172a', '#0ea5e9', '#ec4899'];
  return (
    <Frame canvas>
      <Scene>
        <g className={SHADOW}>
          <rect className={PANEL} x="12" y="8" width="276" height="22" rx="6" strokeWidth="0.8" />
        </g>
        {tools.map(([key, d], i) => (
          <g key={`${key}-${i}`} transform={`translate(${18 + i * 18} 12)`}>
            {i === 1 ? (
              <rect
                className="fill-brand-500/15 dark:fill-brand-400/20"
                x="-2"
                y="-1"
                width="17"
                height="16"
                rx="3"
              />
            ) : null}
            <path
              d={d}
              className={
                i >= 1 && i <= 3 ? undefined : 'stroke-slate-600 dark:stroke-slate-300 fill-none'
              }
              fill={i >= 1 && i <= 3 ? markers[i - 1] : undefined}
              strokeWidth="1.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ))}
        <line
          className="stroke-slate-200 dark:stroke-slate-700"
          x1="164"
          x2="164"
          y1="11"
          y2="27"
          strokeWidth="0.8"
        />
        {/* Pinned shapes: an arrow, a rectangle, and the circle being pinned. */}
        <g
          transform="translate(170 12)"
          className="stroke-slate-600 dark:stroke-slate-300"
          fill="none"
          strokeWidth="1.1"
        >
          <path d="M2 11 L11 3 M6 3 H11 V8" />
          <rect x="20" y="3" width="11" height="9" rx="1" />
          <g className="fa-d-land" style={{ animationDelay: '0.5s' }}>
            <circle cx="45" cy="7.5" r="5" />
          </g>
        </g>
        <text className={TEXT_MUTED} x="250" y="22.4" fontSize="5.6" fontWeight="700">
          Shapes
        </text>
        {/* The keys, and the drawing underneath. */}
        <Keycap x={22} y={40} label="1" />
        <Keycap x={34} y={40} label="2" />
        <Keycap x={46} y={40} label="3" />
        <text className={TEXT_BODY} x="60" y="47.6" fontSize="5.4">
          three markers
        </text>
        <Keycap x={22} y={56} label="P" />
        <text className={TEXT_BODY} x="36" y="63.6" fontSize="5.4">
          path tool
        </text>
        <path
          className="fa-draw"
          d="M120 74 C140 46 170 82 196 54 S240 52 262 70"
          stroke="#0ea5e9"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
        />
        <circle
          cx="200"
          cy="64"
          r="9"
          fill="none"
          stroke="#0f172a"
          className="stroke-slate-800 dark:stroke-slate-100"
          strokeWidth="1.6"
        />
      </Scene>
    </Frame>
  );
}
