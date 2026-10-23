// Feature illustrations: templates and themes and tidy editing (the canvas cards; tab links and folders are in ./tabs; the Collaborate cards live in ./together). Each is a small mock of the editor
// surface its card describes, plain SVG on the card's 300 by 96 stage (Scene in ./canvas-parts),
// composed across the full width. Motion runs on one shared 6s timeline
// (app/feature-art/canvas.css, the canvas and collaboration block): pieces are drawn where they end up and staggered
// with --d, and every one settles to its finished frame under reduced motion.

import { ON_CANVAS, Panel, Scene, TEXT, at } from './canvas-parts';

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
// The themed screen flow: [x, y, width, label].
const THEMED: [number, number, number, string][] = [
  [30, 37, 40, 'Sign in'],
  [86, 37, 40, 'Home'],
  [142, 24, 40, 'Cart'],
  [142, 50, 40, 'Profile'],
];

/** One click recolours everything: the same screen flow in Default, Forest and Sunset in turn. */
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

/* ───────────────────────── Tidy, fast editing ───────────────────────── */
