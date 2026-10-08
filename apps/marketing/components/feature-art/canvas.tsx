// Feature illustrations: templates and themes, tidy editing, and tabs (the Diagrams category's
// canvas cards; the Collaborate cards live in ./together). Each is a small mock of the editor
// surface its card describes, plain SVG on the card's 300 by 96 stage (Scene in ./canvas-parts),
// composed across the full width. Motion runs on one shared 6s timeline
// (app/feature-art-animations.css, the canvas and collaboration block): pieces are drawn where they end up and staggered
// with --d, and every one settles to its finished frame under reduced motion.

import type { CSSProperties, ReactNode } from 'react';
import {
  ALEX,
  AWAY,
  Box,
  Connector,
  FOLDER_PATHS,
  Glyph,
  JORDAN,
  LINK_PATHS,
  ON_CANVAS,
  Panel,
  Pill,
  Pointer,
  RULE,
  SAM,
  Scene,
  TEXT,
  Tab,
  TextBar,
  YOU,
  at,
  from,
} from './canvas-parts';

/* ───────────────────────── Templates and themes ───────────────────────── */

// The template cards' previews, each drawn in its card's own space (a 60-wide card, its preview
// well from (4, 18) to (56, 65)).
const PREVIEWS: { name: string; art: ReactNode }[] = [
  {
    name: 'Flowchart',
    art: (
      <g className="fill-(--art-ink-fill) stroke-(--art-ink-stroke)" strokeWidth="1.2">
        <path className="fill-none stroke-(--art-arrow)" d="M30 33 v5 M30 48 v4" />
        <rect x="17" y="24" width="26" height="9" rx="2.5" />
        <path d="M30 38 l7 5 l-7 5 l-7 -5 z" />
        <rect x="17" y="52" width="26" height="9" rx="2.5" />
      </g>
    ),
  },
  {
    name: 'Mind map',
    art: (
      <g className="stroke-(--art-ink-stroke)" strokeWidth="1.2">
        <path
          className="fill-none"
          d="M30 43 C 20 43, 18 30, 14 30 M30 43 C 20 43, 18 56, 14 56 M30 43 C 40 43, 42 30, 46 30 M30 43 C 40 43, 42 56, 46 56"
        />
        <rect className="fill-(--art-ink-stroke)" x="21" y="38" width="18" height="10" rx="5" />
        {[
          [6, 27],
          [6, 53],
          [44, 27],
          [44, 53],
        ].map(([x, y]) => (
          <rect
            key={`${x}-${y}`}
            className="fill-(--art-ink-fill)"
            x={x}
            y={y}
            width="10"
            height="6"
            rx="3"
          />
        ))}
      </g>
    ),
  },
  {
    name: 'Kanban',
    art: (
      <g>
        {[9, 24, 39].map((x, c) => (
          <g key={x}>
            <rect
              className="fill-slate-100 dark:fill-slate-700/60"
              x={x}
              y="24"
              width="12"
              height="38"
              rx="2"
            />
            {Array.from({ length: 3 - c }, (_, i) => (
              <rect
                key={i}
                className="fill-(--art-ink-fill) stroke-(--art-ink-stroke)"
                x={x + 1.5}
                y={27 + i * 8}
                width="9"
                height="6"
                rx="1.2"
                strokeWidth="0.8"
              />
            ))}
          </g>
        ))}
      </g>
    ),
  },
  {
    name: 'Org chart',
    art: (
      <g strokeWidth="1.2">
        <path
          className="fill-none stroke-(--art-arrow)"
          d="M30 33 V 40 M15 47 V 40 H 45 V 47 M30 40 V 47"
        />
        <g className="fill-(--art-ink-fill) stroke-(--art-ink-stroke)">
          <rect x="21" y="25" width="18" height="8" rx="2" />
          {[8, 23, 38].map((x) => (
            <rect key={x} x={x} y="47" width="14" height="8" rx="2" />
          ))}
        </g>
      </g>
    ),
  },
];

/** The template picker: four starters, the one under the pointer lifting to be used. */
export function TemplatesArt() {
  return (
    <Scene>
      {PREVIEWS.map(({ name, art }, i) => {
        const x = 12 + i * 72;
        return (
          <g key={name} transform={`translate(${x} 0)`}>
            {i === 1 ? (
              <rect
                className="fa-a-pop fill-none stroke-sky-500"
                style={at(1.2)}
                x="-2.5"
                y="11.5"
                width="65"
                height="75"
                rx="7.5"
                strokeWidth="1.5"
              />
            ) : null}
            <Panel x={0} y={14} w={60} h={70} />
            <rect
              className="fill-(--art-paper) stroke-slate-100 dark:stroke-slate-700"
              x="4"
              y="18"
              width="52"
              height="47"
              rx="3.5"
              strokeWidth="0.8"
            />
            {art}
            <text
              className={TEXT}
              x="30"
              y="75.5"
              fontSize="7"
              fontWeight="600"
              textAnchor="middle"
            >
              {name}
            </text>
          </g>
        );
      })}
      <Pointer x={110} y={50} color={YOU} className="fa-a-move" style={from(70, 30, 0.2)} />
    </Scene>
  );
}

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

/** Drag a box, take everything in it: the marquee grows, three shapes light up, the fourth stays out. */
export function MarqueeArt() {
  const inside: [number, number, string][] = [
    [40, 24, 'Ideas'],
    [108, 54, 'Draft'],
    [176, 22, 'Review'],
  ];
  return (
    <Scene>
      {inside.map(([x, y, label]) => (
        <Box key={label} x={x} y={y} w={44} h={20} label={label} />
      ))}
      <Box x={244} y={50} w={44} h={20} label="Ship" />
      <rect
        className="fa-a-marquee fill-sky-500/10 stroke-sky-500"
        x="30"
        y="12"
        width="200"
        height="72"
        rx="2"
        strokeWidth="1"
        strokeDasharray="3 2.5"
      />
      {inside.map(([x, y], i) => (
        <g key={`${x}`} className="fa-a-pop" style={at(1.9 + i * 0.12)}>
          <rect
            className="fill-none stroke-sky-500"
            x={x - 2.5}
            y={y - 2.5}
            width="49"
            height="25"
            rx="6.5"
            strokeWidth="1.3"
          />
          {[
            [x - 2.5, y - 2.5],
            [x + 46.5, y - 2.5],
            [x - 2.5, y + 22.5],
            [x + 46.5, y + 22.5],
          ].map(([hx, hy]) => (
            <rect
              key={`${hx}-${hy}`}
              className="fill-white stroke-sky-500 dark:fill-slate-900"
              x={hx! - 2}
              y={hy! - 2}
              width="4"
              height="4"
              rx="1"
              strokeWidth="1"
            />
          ))}
        </g>
      ))}
      <Pill
        x={168}
        y={62}
        w={46}
        label="3 selected"
        tone="solid"
        className="fa-a-pop"
        style={at(2.3)}
      />
      <Pointer x={230} y={84} color={YOU} className="fa-a-move" style={from(-200, -72, 0)} />
    </Scene>
  );
}

// The format painter's brush, as the toolbar draws it.
const BRUSH = (
  <>
    <rect x="1" y="1" width="7" height="3.5" rx="1" />
    <path d="M8 2.8 h1.2 v2.4 h-4.2 v2 M5 7.2 v2" />
  </>
);

/** The format painter: pick up one shape's look and brush it onto the next. */
export function FormatPainterArt() {
  const styled = 'fill-pink-100 stroke-pink-500 dark:fill-pink-500/25 dark:stroke-pink-300';
  const styledText = 'fill-pink-800 dark:fill-pink-100';
  return (
    <Scene>
      {/* The painter, armed, in the floating toolbar. */}
      <Panel x={126} y={8} w={48} h={16} />
      <Glyph x={132} y={11} className="stroke-sky-600 dark:stroke-sky-300">
        {BRUSH}
      </Glyph>
      <text
        className="fill-sky-700 dark:fill-sky-200"
        x="145"
        y="18.5"
        fontSize="6.5"
        fontWeight="600"
      >
        Paint
      </text>

      <rect className={styled} x="30" y="42" width="64" height="28" rx="14" strokeWidth="2.2" />
      <text
        className={styledText}
        x="62"
        y="58.6"
        fontSize="8"
        fontWeight="700"
        textAnchor="middle"
      >
        Launch
      </text>
      <path
        className="fa-a-draw stroke-slate-400 dark:stroke-slate-500"
        style={{ '--len': 150, '--d': '0.3s' } as CSSProperties}
        d="M94 48 C 120 28, 176 28, 206 44"
        fill="none"
        strokeWidth="1.1"
        strokeDasharray="2 3"
      />
      <g className="fa-a-out" style={at(0.4)}>
        <Box x={206} y={42} w={64} h={28} label="Review" />
      </g>
      <g className="fa-a-late" style={at(0.4)}>
        <rect className={styled} x="206" y="42" width="64" height="28" rx="14" strokeWidth="2.2" />
        <text
          className={styledText}
          x="238"
          y="58.6"
          fontSize="8"
          fontWeight="700"
          textAnchor="middle"
        >
          Review
        </text>
      </g>
      {/* The brush, carried from one to the other. */}
      <g className="fa-a-move" style={from(-160, 0, 0)}>
        <circle
          className="fill-white stroke-sky-500 dark:fill-slate-800"
          cx="258"
          cy="76"
          r="7"
          strokeWidth="1.2"
        />
        <Glyph x={253.5} y={71.5} className="stroke-sky-600 dark:stroke-sky-300" scale={0.9}>
          {BRUSH}
        </Glyph>
      </g>
    </Scene>
  );
}

/* ───────────────────────── Tabs ───────────────────────── */

/** Link an element to another tab: a press on its link lands you there. */
export function TabsArt() {
  return (
    <Scene>
      <Panel x={12} y={8} w={276} h={80} />
      <rect className="fill-(--art-paper)" x="13" y="9" width="274" height="60" rx="5" />
      {/* Backend tab's canvas. */}
      <g className="fa-a-out" style={at(0.6)}>
        <Box x={36} y={30} w={56} h={22} label="Auth" />
        <Connector d="M92 41 H 116" head="M112 38 l4 3 l-4 3" />
        <Box x={118} y={30} w={60} h={22} label="Gateway" />
        <Connector d="M178 41 H 202" head="M198 38 l4 3 l-4 3" />
        <Box x={204} y={30} w={56} h={22} label="Queue" />
        <rect
          className="fill-white stroke-sky-300 dark:fill-slate-800 dark:stroke-sky-500/60"
          x="160"
          y="18"
          width="40"
          height="12"
          rx="6"
          strokeWidth="1"
        />
        <Glyph x={164} y={19.2} className="stroke-sky-600 dark:stroke-sky-300" scale={0.9}>
          {LINK_PATHS}
        </Glyph>
        <text
          className="fill-sky-700 dark:fill-sky-200"
          x="175"
          y="26.6"
          fontSize="6.5"
          fontWeight="600"
        >
          Data
        </text>
      </g>
      {/* Data tab's canvas: two tables and the key between them. */}
      <g className="fa-a-late" style={at(0.6)}>
        {(
          [
            [76, 'users'],
            [168, 'orders'],
          ] as const
        ).map(([x, name]) => (
          <g key={name}>
            <rect
              className="fill-violet-50 stroke-violet-500 dark:fill-violet-500/15 dark:stroke-violet-300"
              x={x}
              y="20"
              width="60"
              height="40"
              rx="4"
              strokeWidth="1.5"
            />
            <path
              className="fill-violet-500 dark:fill-violet-400"
              d={`M${x + 4} 20 h52 a4 4 0 0 1 4 4 v7 h-60 v-7 a4 4 0 0 1 4 -4 z`}
            />
            <text
              x={x + 30}
              y="28.2"
              fontSize="6.5"
              fontWeight="700"
              textAnchor="middle"
              fill="#fff"
            >
              {name}
            </text>
            {[38, 46, 54].map((y) => (
              <g key={y}>
                <TextBar
                  x={x + 6}
                  y={y - 2}
                  w={22}
                  className="fill-violet-200 dark:fill-violet-400/40"
                />
                <TextBar
                  x={x + 36}
                  y={y - 2}
                  w={16}
                  className="fill-violet-200 dark:fill-violet-400/40"
                />
              </g>
            ))}
          </g>
        ))}
        <path className="stroke-violet-400" d="M136 44 H 168" strokeWidth="1.3" fill="none" />
        <circle className="fill-violet-500" cx="136" cy="44" r="1.8" />
      </g>
      <path className={RULE} d="M13 69.5 H 287" strokeWidth="1" />
      <Tab x={18} w={52} name="Backend" color={YOU} />
      <Tab x={74} w={40} name="Data" color={ALEX} />
      <Tab x={118} w={50} name="Roadmap" color={SAM} />
      <Tab x={172} w={40} name="Notes" color={AWAY} />
      <rect
        className="fa-a-out fill-sky-500"
        style={at(0.6)}
        x="22"
        y="85"
        width="42"
        height="1.6"
        rx="0.8"
      />
      <rect
        className="fa-a-late fill-violet-500"
        style={at(0.6)}
        x="78"
        y="85"
        width="30"
        height="1.6"
        rx="0.8"
      />
      <g className="fa-a-out" style={at(0.6)}>
        <Pointer x={182} y={26} color={YOU} className="fa-a-move" style={from(-50, 36, 0)} />
      </g>
    </Scene>
  );
}

/** Tab folders: a named folder on the tab bar folds its tabs away and opens them again. */
export function TabFoldersArt() {
  const bar = (open: boolean) => (
    <g>
      <rect
        className="fill-sky-50 stroke-sky-200 dark:fill-sky-500/10 dark:stroke-sky-500/40"
        x="22"
        y="38"
        width={open ? 140 : 60}
        height="20"
        rx="5"
        strokeWidth="1"
      />
      <Glyph
        x={27}
        y={43}
        className="fill-sky-200 stroke-sky-600 dark:fill-sky-500/30 dark:stroke-sky-300"
      >
        {FOLDER_PATHS}
      </Glyph>
      <text
        className="fill-sky-800 dark:fill-sky-100"
        x="39"
        y="50.6"
        fontSize="7"
        fontWeight="700"
      >
        Backend
      </text>
      <path
        className="stroke-sky-600 dark:stroke-sky-300"
        d={open ? 'M73 46 l2.5 2.5 l2.5 -2.5' : 'M74 45 l2.5 2.5 l-2.5 2.5'}
        fill="none"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {open ? (
        <>
          <Tab x={84} w={24} name="Auth" color={ALEX} y={40} />
          <Tab x={108} w={24} name="API" color={AWAY} y={40} />
          <Tab x={130} w={30} name="Jobs" color={YOU} y={40} />
        </>
      ) : null}
      <Tab x={open ? 168 : 88} w={34} name="Notes" color={SAM} y={40} />
      <Tab x={open ? 202 : 122} w={30} name="Docs" color={JORDAN} y={40} />
      <Tab x={open ? 234 : 154} w={40} name="Roadmap" color={ALEX} y={40} />
    </g>
  );
  return (
    <Scene>
      <Panel x={12} y={32} w={276} h={32} />
      <g className="fa-a-out" style={at(0.2)}>
        {bar(true)}
      </g>
      <g className="fa-a-late" style={at(0.2)}>
        {bar(false)}
      </g>
      <Pointer x={75} y={50} color={YOU} className="fa-a-move" style={from(60, 26, 0)} />
    </Scene>
  );
}
