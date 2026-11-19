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
    accent: 'fill-(--art-ink-stroke)',
    swatch: '#0ea5e9',
  },
  {
    name: 'Forest',
    paper: 'fill-emerald-50 dark:fill-emerald-950',
    fill: 'fill-emerald-100 dark:fill-emerald-900',
    stroke: 'stroke-emerald-600 dark:stroke-emerald-400',
    text: 'fill-emerald-900 dark:fill-emerald-100',
    accent: 'fill-emerald-600 dark:fill-emerald-400',
    swatch: '#16a34a',
  },
  {
    name: 'Sunset',
    paper: 'fill-orange-50 dark:fill-orange-950',
    fill: 'fill-orange-100 dark:fill-orange-900',
    stroke: 'stroke-orange-500 dark:stroke-orange-400',
    text: 'fill-orange-900 dark:fill-orange-100',
    accent: 'fill-orange-500 dark:fill-orange-400',
    swatch: '#f97316',
  },
];
// Each theme's turn in the 6s cycle (.fa-a-cycle): a third each.
const TURN = [0, -4, -2];
// The themed phone screens: [x, title].
const SCREENS: [number, string][] = [
  [92, 'Sign in'],
  [142, 'Home'],
];

/** One click recolours every page: a logo and two screens in Default, Forest and Sunset in turn. */
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
          {/* The logo page: the theme's tint, its ink on the mark and the wordmark. */}
          <rect
            className={`${t.fill} ${t.stroke}`}
            x="30"
            y="24"
            width="48"
            height="48"
            rx="2"
            strokeWidth="1"
          />
          <circle className={`${t.stroke} fill-none`} cx="54" cy="43" r="9" strokeWidth="3" />
          <circle className={t.accent} cx="54" cy="43" r="3.4" />
          <text className={t.text} x="54" y="65" fontSize="7" fontWeight="800" textAnchor="middle">
            Bloom
          </text>
          {/* Two phone screens: a tinted header, wireframe blocks and the button in the theme's ink. */}
          {SCREENS.map(([x, title]) => (
            <g key={title}>
              <rect
                className={`fill-white dark:fill-slate-900 ${t.stroke}`}
                x={x}
                y="18"
                width="38"
                height="60"
                rx="6"
                strokeWidth="1"
              />
              <rect className={t.fill} x={x + 1} y="27" width="36" height="12" />
              <text className={t.text} x={x + 5} y="35.6" fontSize="5.6" fontWeight="800">
                {title}
              </text>
              <rect
                className="fill-slate-200 dark:fill-slate-700"
                x={x + 5}
                y="44"
                width="28"
                height="3"
                rx="1.5"
              />
              <rect
                className="fill-slate-200 dark:fill-slate-700"
                x={x + 5}
                y="50"
                width="20"
                height="3"
                rx="1.5"
              />
              <rect className={t.accent} x={x + 5} y="64" width="28" height="7" rx="3.5" />
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
