// Feature illustrations: templates and themes and tidy editing (the Diagrams category's canvas
// cards; tab links and folders are in ./tabs; the Collaborate cards live in ./together). Each is a small mock of the editor
// surface its card describes, plain SVG on the card's 300 by 96 stage (Scene in ./canvas-parts),
// composed across the full width. Motion runs on one shared 6s timeline
// (app/feature-art/canvas.css, the canvas and collaboration block): pieces are drawn where they end up and staggered
// with --d, and every one settles to its finished frame under reduced motion.

import {
  Box,
  Glyph,
  ON_CANVAS,
  Panel,
  Pill,
  Pointer,
  Scene,
  TEXT,
  YOU,
  at,
  from,
} from './canvas-parts';

/* ───────────────────────── Templates and themes ───────────────────────── */

// The three themes the Themes card cycles through: a paper, an ink and a name each, light and dark.
const THEMES = [
  {
    name: 'Default',
    paper: 'fill-(--art-paper)',
    fill: 'fill-(--art-ink-fill)',
    stroke: 'stroke-(--art-ink-stroke)',
    text: 'fill-(--art-ink-text)',
    swatch: '#0ea5e9',
  },
  {
    name: 'Forest',
    paper: 'fill-emerald-50 dark:fill-emerald-950',
    fill: 'fill-emerald-100 dark:fill-emerald-900',
    stroke: 'stroke-emerald-600 dark:stroke-emerald-400',
    text: 'fill-emerald-900 dark:fill-emerald-100',
    swatch: '#16a34a',
  },
  {
    name: 'Sunset',
    paper: 'fill-orange-50 dark:fill-orange-950',
    fill: 'fill-orange-100 dark:fill-orange-900',
    stroke: 'stroke-orange-500 dark:stroke-orange-400',
    text: 'fill-orange-900 dark:fill-orange-100',
    swatch: '#f97316',
  },
];
// Each theme's turn in the 6s cycle (.fa-a-cycle): a third each.
const TURN = [0, -4, -2];
// The themed diagram: [x, y, width, label].
const THEMED: [number, number, number, string][] = [
  [30, 37, 40, 'Idea'],
  [86, 37, 40, 'Plan'],
  [142, 24, 40, 'Build'],
  [142, 50, 40, 'Test'],
];

/** One click recolours everything: the same diagram in Default, Forest and Sunset in turn. */
export function ThemesArt() {
  return (
    <Scene>
      <Panel x={14} y={10} w={186} h={76} />
      {THEMES.map((t, i) => (
        <g
          key={t.name}
          className={`fa-a-cycle ${i === 0 ? 'fa-a-first' : ''}`}
          style={at(TURN[i]!)}
        >
          <rect className={t.paper} x="17" y="13" width="180" height="70" rx="4" />
          <g
            className={`${t.stroke} fill-none`}
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M70 47 H 84 M126 47 C 134 47, 134 34, 140 34 M126 47 C 134 47, 134 60, 140 60" />
            <path d="M81 44 l3 3 l-3 3" />
          </g>
          {THEMED.map(([x, y, w, label]) => (
            <g key={label}>
              <rect
                className={`${t.fill} ${t.stroke}`}
                x={x}
                y={y}
                width={w}
                height="20"
                rx="5"
                strokeWidth="1.6"
              />
              <text
                className={t.text}
                x={x + w / 2}
                y={y + 12.6}
                fontSize="7.5"
                fontWeight="600"
                textAnchor="middle"
              >
                {label}
              </text>
            </g>
          ))}
        </g>
      ))}
      {/* The theme picker beside it, the theme in use highlighted. */}
      <Panel x={212} y={10} w={76} h={76} />
      {THEMES.map((t, i) => {
        const y = 28 + i * 21;
        return (
          <g key={t.name}>
            <rect
              className={`fa-a-cycle ${i === 0 ? 'fa-a-first' : ''} fill-slate-100 dark:fill-slate-700`}
              style={at(TURN[i]!)}
              x="216"
              y={y - 8}
              width="68"
              height="16"
              rx="4"
            />
            <circle className={ON_CANVAS} cx="226" cy={y} r="4.5" fill={t.swatch} strokeWidth="1" />
            <text className={TEXT} x="235" y={y + 2.4} fontSize="7" fontWeight="600">
              {t.name}
            </text>
          </g>
        );
      })}
    </Scene>
  );
}

// The custom theme's canvas: [x, y, width, height, label].
const BRAND_BOXES: [number, number, number, number, string][] = [
  [146, 28, 38, 20, 'Brand'],
  [198, 28, 38, 20, 'Voice'],
  [250, 28, 30, 20, 'Tone'],
  [146, 62, 38, 18, 'Logo'],
];

/** A theme of your own: pick a colour in the builder and the canvas takes it. */
export function CustomThemesArt() {
  const swatches = ['#8b5cf6', '#ec4899', '#f59e0b', '#14b8a6', '#0ea5e9', '#334155'];
  return (
    <Scene>
      <Panel x={12} y={10} w={112} h={76} />
      <Glyph x={20} y={17}>
        <path d="M1 3 h8 M1 7 h8" />
        <circle cx="3.5" cy="3" r="1.3" className="fill-white dark:fill-slate-800" />
        <circle cx="6.5" cy="7" r="1.3" className="fill-white dark:fill-slate-800" />
      </Glyph>
      <text className={TEXT} x="33" y="24.5" fontSize="7.5" fontWeight="700">
        My brand
      </text>
      {swatches.map((c, i) => {
        const x = 30 + (i % 3) * 28;
        const y = 44 + Math.floor(i / 3) * 20;
        return (
          <g key={c}>
            {i === 0 ? (
              <circle
                className="fa-a-pop fill-none stroke-slate-700 dark:stroke-slate-200"
                style={at(0.8)}
                cx={x}
                cy={y}
                r="8"
                strokeWidth="1.3"
              />
            ) : null}
            <circle cx={x} cy={y} r="6" fill={c} />
          </g>
        );
      })}
      <Pill x={84} y={15} w={34} label="Save" tone="slate" className="fa-a-out" style={at(0)} />
      <Pill x={80} y={15} w={38} label="Saved" tone="green" className="fa-a-late" style={at(0)} />
      <Pointer x={31} y={45} color={YOU} className="fa-a-move" style={from(40, 30, 0)} />

      <rect
        className="fill-(--art-paper) stroke-slate-200 dark:stroke-slate-700"
        x="134"
        y="10"
        width="154"
        height="76"
        rx="6"
      />
      <path
        className="stroke-(--art-arrow)"
        d="M184 38 H 198 M236 38 H 250 M165 48 V 62"
        strokeWidth="1.4"
        fill="none"
      />
      <g className="fa-a-out" style={at(0)}>
        {BRAND_BOXES.map(([x, y, w, h, label]) => (
          <Box key={label} x={x} y={y} w={w} h={h} label={label} />
        ))}
      </g>
      <g className="fa-a-late" style={at(0)} strokeWidth="1.75">
        {BRAND_BOXES.map(([x, y, w, h, label]) => (
          <g key={label}>
            <rect
              className="fill-violet-100 stroke-violet-500 dark:fill-violet-500/25 dark:stroke-violet-300"
              x={x}
              y={y}
              width={w}
              height={h}
              rx="5"
            />
            <text
              className="fill-violet-800 dark:fill-violet-100"
              x={x + w / 2}
              y={y + h / 2 + 2.6}
              fontSize="7.5"
              fontWeight="600"
              textAnchor="middle"
            >
              {label}
            </text>
          </g>
        ))}
      </g>
    </Scene>
  );
}

/* ───────────────────────── Tidy, fast editing ───────────────────────── */
