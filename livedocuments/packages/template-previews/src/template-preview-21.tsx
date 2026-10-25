import type { ReactElement } from 'react';
import type { TemplateKind } from '@livedocuments/templates';
import { pv } from '@liveworkspace/template-previews/motion';

// Group 21: the slide decks built from slide layouts (docs/specs/008-canvas/canvas-and-palette.md "Templates on
// pages"): Launch Keynote, Quarterly Review, Team Welcome and Workshop Kickoff. Each is three 16:9 slides fanned
// back to front: two pale slides of its body (a heading and a hint of the layout on each) behind its title slide on
// its own dark colours, with a hint of the motion it opens on (aurora lights, a mesh of colour, bokeh, waves) and the
// title's bars in white. Hover story: the motion drifts across the title slide. Static SVG preview tiles; TemplatePreview chains the groups with ??.

type Deck = {
  from: string;
  to: string;
  light: string;
  accent: string;
  motion: (id: string) => ReactElement;
  // What the middle slide shows: three numbers, a chart, cards or steps.
  body: 'stats' | 'chart' | 'cards' | 'steps';
};

const DECKS: Partial<Record<TemplateKind, Deck>> = {
  'launch-keynote': {
    from: '#0b1020',
    to: '#312e81',
    light: '#eef2ff',
    accent: '#6366f1',
    body: 'stats',
    motion: (id) => (
      <>
        <ellipse cx="34" cy="27" rx="16" ry="8" fill={`url(#${id}-g1)`} />
        <ellipse cx="55" cy="31" rx="13" ry="7" fill={`url(#${id}-g2)`} />
      </>
    ),
  },
  'quarterly-review': {
    from: '#082f49',
    to: '#1e3a8a',
    light: '#e0f2fe',
    accent: '#0284c7',
    body: 'chart',
    motion: (id) => (
      <>
        <circle cx="30" cy="36" r="10" fill={`url(#${id}-g1)`} />
        <circle cx="58" cy="26" r="11" fill={`url(#${id}-g2)`} />
      </>
    ),
  },
  'team-welcome': {
    from: '#4a044e',
    to: '#be185d',
    light: '#fdf2f8',
    accent: '#db2777',
    body: 'cards',
    motion: () => (
      <>
        {[
          [28, 28, 3],
          [36, 41, 2.2],
          [52, 25, 2.8],
          [60, 38, 3.4],
          [45, 34, 1.6],
        ].map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="white" opacity="0.28" />
        ))}
      </>
    ),
  },
  'workshop-kickoff': {
    from: '#042f2e',
    to: '#0f766e',
    light: '#f0fdfa',
    accent: '#0d9488',
    body: 'steps',
    motion: () => (
      <>
        <path
          d="M22 40 Q28 37 34 40 Q40 43 46 40 Q52 37 58 40 Q64 43 66 41 L66 45 L22 45 Z"
          fill="white"
          opacity="0.18"
        />
        <path
          d="M22 42 Q30 40 38 42 Q46 44 54 42 Q62 40 66 42 L66 45 L22 45 Z"
          fill="white"
          opacity="0.22"
        />
      </>
    ),
  },
};

// A pale slide of the deck's body, offset back.
function BodySlide({ x, y, d }: { x: number; y: number; d: Deck }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width="44"
        height="25"
        rx="1.6"
        fill="white"
        stroke="rgb(203 213 225)"
        strokeWidth="0.5"
      />
      <rect x={x + 1} y={y + 1} width="42" height="23" rx="1.2" fill={d.light} />
      <rect x={x + 4} y={y + 4} width="18" height="2" rx="0.6" fill="rgb(30 41 59)" />
      {d.body === 'stats'
        ? [0, 1, 2].map((i) => (
            <rect
              key={i}
              x={x + 4 + i * 13}
              y={y + 10}
              width="9"
              height="5"
              rx="0.8"
              fill={d.accent}
            />
          ))
        : d.body === 'chart'
          ? [5, 8, 11, 14].map((h, i) => (
              <rect
                key={i}
                x={x + 6 + i * 7}
                y={y + 21 - h}
                width="4"
                height={h}
                rx="0.6"
                fill={d.accent}
              />
            ))
          : d.body === 'cards'
            ? [0, 1, 2, 3].map((i) => (
                <rect
                  key={i}
                  x={x + 4 + (i % 2) * 18}
                  y={y + 9 + Math.floor(i / 2) * 7}
                  width="16"
                  height="5.5"
                  rx="1"
                  fill="white"
                  stroke={d.accent}
                  strokeWidth="0.4"
                />
              ))
            : [0, 1, 2, 3].map((i) => (
                <rect
                  key={i}
                  x={x + 4 + i * 9.5}
                  y={y + 12}
                  width="8"
                  height="4"
                  rx="2"
                  fill="white"
                  stroke={d.accent}
                  strokeWidth="0.5"
                />
              ))}
    </g>
  );
}

export function templatePreviewGroup21(kind: TemplateKind): ReactElement | null {
  const d = DECKS[kind];
  if (!d) return null;
  const id = `pv-${kind}`;
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={d.from} />
          <stop offset="1" stopColor={d.to} />
        </linearGradient>
        <radialGradient id={`${id}-g1`}>
          <stop offset="0" stopColor="#a5f3fc" stopOpacity="0.55" />
          <stop offset="1" stopColor="#a5f3fc" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-g2`}>
          <stop offset="0" stopColor="#f0abfc" stopOpacity="0.5" />
          <stop offset="1" stopColor="#f0abfc" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <rect x="20" y="20" width="48" height="27" rx="1.8" />
        </clipPath>
      </defs>
      <BodySlide x={8} y={4} d={d} />
      <BodySlide x={14} y={11} d={d} />
      {/* The title slide on its animated background, in front. */}
      <rect x="20" y="20" width="48" height="27" rx="1.8" fill={`url(#${id}-bg)`} />
      {/* Hover story: the background's motion drifts across the title slide. */}
      <g clipPath={`url(#${id}-clip)`}>
        <g className="pv-shift" style={pv({ '--pv-dx': '4px', '--pv-at': '200ms' })}>
          {d.motion(id)}
        </g>
      </g>
      <rect x="26" y="28" width="7" height="1.2" rx="0.4" fill="white" opacity="0.7" />
      <rect x="26" y="31" width="30" height="3.4" rx="0.8" fill="white" />
      <rect x="26" y="36.5" width="22" height="1.6" rx="0.6" fill="white" opacity="0.75" />
    </svg>
  );
}
