'use client';

import { useId } from 'react';
import { tabBackgroundStyle } from '@/lib/canvas-backgrounds';
import type { ThemeDefinition } from '@/lib/themes';

// The preview inside a theme card. Rather than a flat colour dot, it
// renders a miniature diagram scene — a titled node flowing into two
// others, with soft shadows, arrowheads and a faint grid — drawn in the
// theme's actual colours, so the card previews what a diagram in this
// theme looks like, not just its palette. Shared by the palette
// accordion, the welcome / template picker, and the Tab Appearance +
// Explorer theme surfaces so they can't drift.
//
// The scene adapts to the theme kind: a single-colour theme draws one
// cohesive look; a multi-colour theme (spec/29) gives each node a branch
// hue; a per-shape theme (UML, spec/42) gives each node its kind's
// colour, so the "different colour per shape" idea reads at a glance.

type Tri = { fill: string; stroke: string; text: string };

// Design-system defaults for a theme that defers its element colours
// (null = "use the built-in shape colours", e.g. Basic) so even those
// preview as a real cyan-on-white diagram rather than a blank box.
const DEFAULT_TRI: Tri = { fill: '#e0f2fe', stroke: '#0ea5e9', text: '#075985' };

function baseTri(theme: ThemeDefinition): Tri {
  return {
    fill: theme.elementFill ?? DEFAULT_TRI.fill,
    stroke: theme.elementStroke ?? DEFAULT_TRI.stroke,
    text: theme.elementText ?? DEFAULT_TRI.text,
  };
}

// Up to three node colour-triples for the scene. Palette themes cycle
// their branch hues; per-shape themes take their first few kind colours
// (each resolved over the base); a single-colour theme repeats its base.
function nodeColours(theme: ThemeDefinition): [Tri, Tri, Tri] {
  const base = baseTri(theme);
  if (theme.palette && theme.palette.length > 0) {
    const p = theme.palette;
    return [p[0]!, p[1 % p.length]!, p[2 % p.length]!];
  }
  if (theme.shapeColors) {
    const entries = Object.values(theme.shapeColors).slice(0, 3);
    const tris = entries.map((e) => ({
      fill: e?.fill ?? base.fill,
      stroke: e?.stroke ?? base.stroke,
      text: e?.text ?? base.text,
    }));
    return [tris[0] ?? base, tris[1] ?? base, tris[2] ?? base];
  }
  return [base, base, base];
}

export function ThemeSwatch({
  theme,
  size = 'sm',
  heightClass,
  realPattern = false,
}: {
  theme: ThemeDefinition;
  // 'sm' compact palette grid, 'md' welcome picker, 'lg' the Explorer
  // hero cards. `heightClass` overrides the height outright (used to make
  // the Basic quick-pick match the category sampler exactly).
  size?: 'sm' | 'md' | 'lg';
  heightClass?: string;
  // Render the theme's ACTUAL background pattern (grid / graph / dots /
  // waves / ...) edge-to-edge via the real canvas renderer, instead of
  // the lightweight faint-dot hint. Opt-in (the builder's big preview
  // uses it); the tiny card samplers keep the cheap hint.
  realPattern?: boolean;
}) {
  const boxH = heightClass ?? (size === 'lg' ? 'h-28' : size === 'md' ? 'h-20' : 'h-9');
  const [c0, c1, c2] = nodeColours(theme);
  const connector = theme.rootColor?.stroke ?? baseTri(theme).stroke;
  // The faint SVG dot hint only renders when NOT showing the real
  // pattern (and never for a blank backdrop).
  const showHint = !realPattern && theme.backgroundPattern !== 'blank';
  // The real edge-to-edge pattern lives on the container (the canvas
  // renderer's CSS background); the SVG then sits transparent on top.
  const containerStyle = realPattern
    ? tabBackgroundStyle(
        theme.backgroundPattern,
        { x: 0, y: 0 },
        theme.backgroundColor,
        theme.patternColor,
      )
    : undefined;
  // Unique per instance so multiple inline SVGs don't share (and clobber)
  // the same filter / marker ids.
  const uid = useId().replace(/:/g, '');
  const shadow = `shadow-${uid}`;
  const arrow = `arrow-${uid}`;

  return (
    <span
      aria-hidden
      style={containerStyle}
      className={`block ${boxH} w-full overflow-hidden rounded-md border border-slate-200 dark:border-slate-600`}
    >
      <svg
        viewBox="0 0 100 64"
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
        style={realPattern ? undefined : { backgroundColor: theme.backgroundColor }}
        role="img"
      >
        <defs>
          <filter id={shadow} x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow
              dx="0"
              dy="0.8"
              stdDeviation="0.9"
              floodColor="#0f172a"
              floodOpacity="0.18"
            />
          </filter>
          <marker
            id={arrow}
            viewBox="0 0 10 10"
            refX="7.5"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M1 1 L8.5 5 L1 9 Z" fill={connector} />
          </marker>
        </defs>

        {/* Faint dot grid hint (skipped when the real pattern renders, and
            for blank backdrops). */}
        {showHint ? (
          <g fill={theme.patternColor} opacity="0.55">
            {[10, 22, 34, 46, 58, 70, 82, 94].map((x) =>
              [10, 22, 34, 46, 58].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="0.7" />),
            )}
          </g>
        ) : null}

        {/* Connectors: gentle curves from node 1 into nodes 2 + 3, with
            arrowheads. Drawn before the nodes so the line ends tuck under. */}
        <g
          stroke={connector}
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
          markerEnd={`url(#${arrow})`}
        >
          <path d="M46 27 C 55 27, 55 20, 62 20" />
          <path d="M46 37 C 55 37, 55 45, 62 45" />
        </g>

        {/* Node 1: a titled card (header line + two body lines). */}
        <g filter={`url(#${shadow})`}>
          <rect
            x="9"
            y="16"
            width="37"
            height="32"
            rx="3.5"
            fill={c0.fill}
            stroke={c0.stroke}
            strokeWidth="1.6"
          />
          <rect x="13" y="21" width="23" height="4" rx="2" fill={c0.stroke} />
          <rect x="13" y="30" width="28" height="3" rx="1.5" fill={c0.text} opacity="0.7" />
          <rect x="13" y="37" width="19" height="3" rx="1.5" fill={c0.text} opacity="0.7" />
        </g>

        {/* Node 2: a pill / stadium (top right). */}
        <g filter={`url(#${shadow})`}>
          <rect
            x="63"
            y="12"
            width="29"
            height="16"
            rx="8"
            fill={c1.fill}
            stroke={c1.stroke}
            strokeWidth="1.6"
          />
        </g>

        {/* Node 3: a rounded box (bottom right). */}
        <g filter={`url(#${shadow})`}>
          <rect
            x="63"
            y="37"
            width="29"
            height="16"
            rx="3"
            fill={c2.fill}
            stroke={c2.stroke}
            strokeWidth="1.6"
          />
        </g>
      </svg>
    </span>
  );
}
