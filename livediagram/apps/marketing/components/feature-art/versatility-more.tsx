// The rest of the versatility feature illustrations: rotation and size, Zen mode
// and fonts (Markdown and Mermaid coming in are in ./diagram-text). Split from ./versatility (which re-exports them) to
// keep each file a readable size; built from the same parts, on the same 300 by 96 stage, with the
// same fa-c-* loops.

import { Frame } from './shared';
import {
  ArrowHead,
  Chip,
  LINK,
  MONO,
  MUTED_TEXT,
  Node,
  PANEL,
  PANEL_TEXT,
  SELECT,
  STAGE,
  Selection,
  delay,
} from './versatility-parts';

/* ──────────────── Rotation and size ──────────────── */

// Rotation and size: a selected shape turning to a preset 45 degrees and back, beside the panel
// where its width, height and angle are typed rather than dragged, the aspect ratio locked.
export function RotateArt() {
  const rows: [string, string][] = [
    ['W', '160'],
    ['H', '90'],
  ];
  return (
    <Frame canvas>
      <svg viewBox={STAGE} className="absolute inset-0 h-full w-full">
        {/* A width dimension under the resting shape. */}
        <g className="stroke-slate-400 dark:stroke-slate-500" strokeWidth="0.8">
          <path d="M56 84 H136 M56 81 V87 M136 81 V87" />
        </g>
        <rect className="fill-(--art-paper)" x="83" y="80" width="26" height="8" rx="2" />
        <text
          className={MUTED_TEXT}
          x="96"
          y="86"
          fontSize="5.6"
          fontWeight="600"
          textAnchor="middle"
        >
          160 px
        </text>
        <g className="fa-rotate" style={{ transformBox: 'view-box', transformOrigin: '96px 46px' }}>
          <Node x={56} y={24} w={80} h={44} label="Logo" tone="violet" size={9} />
          <Selection x={56} y={24} w={80} h={44} pad={4} />
          <circle
            className={`fill-white dark:fill-slate-900 ${SELECT}`}
            cx="96"
            cy="12"
            r="2.4"
            strokeWidth="1"
          />
          <path className={SELECT} d="M96 14.4 V20" strokeWidth="1" />
        </g>

        {/* The size and angle panel. */}
        <rect className={PANEL} x="196" y="8" width="94" height="80" rx="6" strokeWidth="1" />
        <text
          className={MUTED_TEXT}
          x="203"
          y="19"
          fontSize="5.8"
          fontWeight="700"
          letterSpacing="0.3"
        >
          SIZE
        </text>
        {rows.map(([k, v], i) => (
          <g key={k}>
            <rect
              className="fill-slate-50 stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700"
              x="203"
              y={24 + i * 15}
              width="60"
              height="11"
              rx="2.5"
              strokeWidth="0.7"
            />
            <text className={MUTED_TEXT} x="207" y={31.6 + i * 15} fontSize="6" fontWeight="600">
              {k}
            </text>
            <text
              className={PANEL_TEXT}
              x="259"
              y={31.6 + i * 15}
              fontSize="6.4"
              fontWeight="700"
              textAnchor="end"
            >
              {v}
            </text>
          </g>
        ))}
        {/* The aspect lock, joining the two fields. */}
        <path
          className="stroke-brand-500 dark:stroke-brand-300"
          d="M266 29.5 h4 v15 h-4"
          fill="none"
          strokeWidth="0.9"
        />
        <rect
          className="fill-brand-500 dark:fill-brand-300"
          x="273"
          y="34"
          width="8"
          height="6.5"
          rx="1.2"
        />
        <path
          className="stroke-brand-500 dark:stroke-brand-300"
          d="M274.8 34 v-1.6 a2.2 2.2 0 0 1 4.4 0 V34"
          fill="none"
          strokeWidth="0.9"
        />

        <text
          className={MUTED_TEXT}
          x="203"
          y="62"
          fontSize="5.8"
          fontWeight="700"
          letterSpacing="0.3"
        >
          ROTATE
        </text>
        {['0°', '45°', '90°', '180°'].map((a, i) => (
          <g key={a}>
            <rect
              className={
                i === 1
                  ? 'fill-brand-500'
                  : 'fill-slate-50 stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700'
              }
              x={203 + i * 20.5}
              y="67"
              width="18"
              height="13"
              rx="3"
              strokeWidth="0.7"
            />
            <text
              className={i === 1 ? 'fill-white' : PANEL_TEXT}
              x={212 + i * 20.5}
              y="75.6"
              fontSize="5.8"
              fontWeight="700"
              textAnchor="middle"
            >
              {a}
            </text>
          </g>
        ))}
      </svg>
    </Frame>
  );
}

/* ──────────────── Zen, fonts ──────────────── */

// Zen mode: the whole editor (header, palette strip, Explorer, the panel on the right and the tab
// bar) melts away around the diagram, leaving it, the zoom controls and the way back.
export function ZenModeArt() {
  return (
    <Frame canvas>
      <svg viewBox={STAGE} className="absolute inset-0 h-full w-full">
        <defs>
          <ArrowHead id="fac-zen-head" />
        </defs>
        <g className="fa-c-before">
          {/* Header. */}
          <rect
            className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-800"
            x="0"
            y="0"
            width="300"
            height="11"
            strokeWidth="0.8"
          />
          <circle className="fill-brand-500" cx="8" cy="5.5" r="2.4" />
          <rect
            className="fill-slate-300 dark:fill-slate-600"
            x="13"
            y="4"
            width="26"
            height="3"
            rx="1.5"
          />
          <rect className="fill-brand-500" x="272" y="2.5" width="22" height="6" rx="2" />
          {/* Palette strip. */}
          <rect className={PANEL} x="100" y="15" width="100" height="11" rx="3" strokeWidth="0.8" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <rect
              key={i}
              className="fill-slate-300 dark:fill-slate-600"
              x={106 + i * 12}
              y="18.5"
              width="5"
              height="4"
              rx="1"
            />
          ))}
          {/* Explorer and the right-hand panel. */}
          <rect className={PANEL} x="6" y="15" width="48" height="64" rx="4" strokeWidth="0.8" />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect
              key={i}
              className="fill-slate-200 dark:fill-slate-700"
              x="12"
              y={22 + i * 10}
              width={i % 2 ? 26 : 36}
              height="3.5"
              rx="1.5"
            />
          ))}
          <rect className={PANEL} x="246" y="15" width="48" height="64" rx="4" strokeWidth="0.8" />
          {[0, 1, 2].map((i) => (
            <rect
              key={i}
              className="fill-slate-200 dark:fill-slate-700"
              x="252"
              y={22 + i * 10}
              width="36"
              height="5"
              rx="1.5"
            />
          ))}
          {/* Tab bar. */}
          <rect
            className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-800"
            x="0"
            y="84"
            width="300"
            height="12"
            strokeWidth="0.8"
          />
          <rect
            className="fill-sky-100 dark:fill-sky-500/20"
            x="8"
            y="86.5"
            width="32"
            height="7"
            rx="2"
          />
          <rect
            className="fill-slate-200 dark:fill-slate-700"
            x="44"
            y="88"
            width="24"
            height="4"
            rx="2"
          />
        </g>

        {/* What stays: the diagram. */}
        <Node x={78} y={39} w={40} h={20} label="Idea" tone="amber" size={7} />
        <Node x={130} y={39} w={40} h={20} label="Draft" tone="sky" size={7} />
        <Node x={182} y={39} w={40} h={20} label="Ship" tone="emerald" size={7} />
        <path className={LINK} d="M118 49 H129" strokeWidth="1.3" markerEnd="url(#fac-zen-head)" />
        <path className={LINK} d="M170 49 H181" strokeWidth="1.3" markerEnd="url(#fac-zen-head)" />

        {/* Zen: the zoom controls and the way out. */}
        <g className="fa-c-after">
          <rect className={PANEL} x="232" y="76" width="58" height="13" rx="4" strokeWidth="0.8" />
          <text className={PANEL_TEXT} x="237" y="85" fontSize="6" fontWeight="600">
            − 100% +
          </text>
          <rect className="fill-brand-500" x="272" y="78.5" width="15" height="8" rx="2" />
          <path
            d="M276.5 81 l2 2 2-2 M276.5 85 l2-2 2 2"
            stroke="#fff"
            strokeWidth="0.8"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
      <Chip className="fa-c-after left-2 top-2">
        <kbd className="rounded border border-slate-300 px-1 font-mono text-[7px] dark:border-slate-600">
          Z
        </kbd>
        Zen mode
      </Chip>
    </Frame>
  );
}

// Fonts: the font picker with four of the eleven (sans, serif, mono, handwriting), the choice
// walking down the list while the heading on the canvas changes face in step.
export function FontsArt() {
  const fonts = [
    {
      label: 'Inter',
      family: 'Inter, ui-sans-serif, system-ui, sans-serif',
      weight: 700,
      size: 25,
    },
    { label: 'Lora', family: 'Lora, Georgia, ui-serif, serif', weight: 700, size: 25 },
    { label: 'Roboto Mono', family: `"Roboto Mono", ${MONO}`, weight: 600, size: 21 },
    {
      label: 'Caveat',
      family: 'Caveat, "Segoe Script", "Bradley Hand", cursive',
      weight: 700,
      size: 32,
    },
  ];
  return (
    <Frame canvas>
      <svg viewBox={STAGE} className="absolute inset-0 h-full w-full">
        <rect className={PANEL} x="10" y="6" width="96" height="84" rx="6" strokeWidth="1" />
        <text
          className={MUTED_TEXT}
          x="17"
          y="17"
          fontSize="5.8"
          fontWeight="700"
          letterSpacing="0.3"
        >
          FONT
        </text>
        {fonts.map((f, i) => (
          <g key={f.label}>
            <rect
              className={`fa-c-quarter ${i === 0 ? 'fa-c-first ' : ''}fill-sky-500/15 stroke-sky-500 dark:stroke-sky-400`}
              style={delay(i * 2)}
              x="14"
              y={22 + i * 17}
              width="88"
              height="15"
              rx="3"
              strokeWidth="0.9"
            />
            <text
              className={PANEL_TEXT}
              x="20"
              y={32.5 + i * 17}
              fontSize="9"
              fontWeight={f.weight}
              style={{ fontFamily: f.family }}
            >
              Aa
            </text>
            <text className={MUTED_TEXT} x="38" y={32 + i * 17} fontSize="6.4" fontWeight="600">
              {f.label}
            </text>
          </g>
        ))}

        {/* The heading on the canvas, in the chosen face. */}
        {fonts.map((f, i) => (
          <g
            key={f.label}
            className={`fa-c-quarter ${i === 0 ? 'fa-c-first' : ''}`}
            style={delay(i * 2)}
          >
            <text
              className="fill-slate-900 dark:fill-white"
              x="202"
              y="47"
              fontSize={f.size}
              fontWeight={f.weight}
              textAnchor="middle"
              style={{ fontFamily: f.family }}
            >
              Big ideas
            </text>
            <text
              className={MUTED_TEXT}
              x="202"
              y="64"
              fontSize="7"
              textAnchor="middle"
              style={{ fontFamily: f.family }}
            >
              Start with the why, then the how
            </text>
          </g>
        ))}
        <Selection x={126} y={24} w={152} h={48} pad={2} />
      </svg>
    </Frame>
  );
}
