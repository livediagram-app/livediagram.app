// Feature illustrations: the richer-content scenes (tables, icons, rich text and link cards; the
// technology icons and ready-made components are in ./content-tech), each a small, finished slice of the editor. Shared
// marks (the scene surface, chrome, cursors, carets) live in ./canvas-marks; ./shared holds Frame.
import {
  ARROW,
  Caret,
  Cursor,
  INK,
  INK_TEXT,
  PANEL,
  SHADOW,
  Scene,
  TEXT_BODY,
  TEXT_MUTED,
  TEXT_STRONG,
} from '@liveworkspace/marketing-site/components/feature-art/canvas-marks';
import { Glyph, ICON_PATHS } from './content-parts';
import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';

// A status pill in a table cell, its hue tinted behind its word.
const STATUS: Record<string, { tint: string; text: string }> = {
  Done: { tint: '#16a34a', text: 'fill-emerald-700 dark:fill-emerald-300' },
  'In review': { tint: '#d97706', text: 'fill-amber-700 dark:fill-amber-300' },
  Planned: { tint: '#64748b', text: 'fill-slate-600 dark:fill-slate-300' },
};

// Editable table: a themed header over three rows, the Owner cell of the last row open for
// typing (a ring, the name typing in, a caret), and the add-column handle on its edge.
export function TablesArt() {
  const cols = [
    { title: 'Feature', w: 70 },
    { title: 'Owner', w: 54 },
    { title: 'Status', w: 64 },
  ];
  const rows = [
    ['Onboarding', 'Maya', 'Done'],
    ['Billing v2', 'Sam', 'In review'],
    ['Search', 'Lee', 'Planned'],
  ];
  const x0 = 56;
  const y0 = 12;
  const head = 16;
  const rowH = 18;
  const width = cols.reduce((sum, c) => sum + c.w, 0);
  const height = head + rows.length * rowH;
  const colX = cols.map((_, i) => x0 + cols.slice(0, i).reduce((sum, c) => sum + c.w, 0));
  const editX = colX[1]!;
  const editY = y0 + head + 2 * rowH;
  return (
    <Frame canvas>
      <Scene>
        <defs>
          <clipPath id="fa-d-table-typing">
            <rect className="fa-d-type" x={editX + 6} y={editY + 3} width="24" height="12" />
          </clipPath>
        </defs>
        <g className={SHADOW}>
          <rect
            className="fill-(--art-paper) stroke-(--art-table-line)"
            x={x0}
            y={y0}
            width={width}
            height={height}
            rx="3"
            strokeWidth="0.9"
          />
        </g>
        {/* The header row, in the theme's accent. */}
        <path
          className="fill-(--art-ink-stroke)"
          d={`M${x0} ${y0 + head} V${y0 + 3} a3 3 0 0 1 3 -3 H${x0 + width - 3} a3 3 0 0 1 3 3 V${y0 + head} Z`}
        />
        {cols.map((c, i) => (
          <text
            key={c.title}
            x={colX[i]! + 7}
            y={y0 + 10.8}
            fontSize="6.6"
            fontWeight="700"
            fill="#fff"
          >
            {c.title}
          </text>
        ))}
        {/* The grid. */}
        <g className="stroke-(--art-table-line)" strokeWidth="0.7">
          {rows.slice(1).map((_, i) => (
            <path key={i} d={`M${x0} ${y0 + head + (i + 1) * rowH} h${width}`} />
          ))}
          {colX.slice(1).map((x) => (
            <path key={x} d={`M${x} ${y0} v${height}`} />
          ))}
        </g>
        {rows.map((row, ri) => {
          const y = y0 + head + ri * rowH + 11.8;
          const status = STATUS[row[2]!]!;
          const pillW = row[2]!.length * 3.3 + 9;
          return (
            <g key={row[0]}>
              <text className={TEXT_STRONG} x={colX[0]! + 7} y={y} fontSize="6.6" fontWeight="500">
                {row[0]}
              </text>
              {ri === 2 ? null : (
                <text className={TEXT_BODY} x={colX[1]! + 7} y={y} fontSize="6.6">
                  {row[1]}
                </text>
              )}
              <rect
                x={colX[2]! + 6}
                y={y - 7.2}
                width={pillW}
                height="10"
                rx="5"
                fill={status.tint}
                fillOpacity="0.16"
              />
              <text
                className={status.text}
                x={colX[2]! + 10.5}
                y={y - 0.2}
                fontSize="5.8"
                fontWeight="600"
              >
                {row[2]}
              </text>
            </g>
          );
        })}
        {/* The cell being typed into. */}
        <rect
          className="fill-brand-500/5 stroke-brand-500 dark:stroke-brand-400"
          x={editX + 0.8}
          y={editY + 0.8}
          width={cols[1]!.w - 1.6}
          height={rowH - 1.6}
          rx="1.5"
          strokeWidth="1.4"
        />
        <text
          className={TEXT_BODY}
          clipPath="url(#fa-d-table-typing)"
          x={editX + 7}
          y={editY + 11.8}
          fontSize="6.6"
        >
          Lee
        </text>
        <Caret x={editX + 20.5} y={editY + 4.6} h={8.6} />
        {/* Add a column, on the table's edge. */}
        <g className="fa-pulse" transform={`translate(${x0 + width + 9} ${y0 + height / 2})`}>
          <circle className="fill-brand-500 dark:fill-brand-400" r="5" />
          <path
            d="M-2.4 0 h4.8 M0 -2.4 v4.8"
            stroke="#fff"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </g>
      </Scene>
    </Frame>
  );
}

// The icon library: the Icons picker (a search, a grid of single-colour glyphs, the database
// picked) beside the canvas, where the picked icon lands as a themed element wired to the API.
export function IconsArt() {
  const grid = ['server', 'database', 'cloud', 'user', 'lock', 'bolt', 'globe', 'queue'];
  return (
    <Frame canvas>
      <Scene>
        {/* The picker. */}
        <g className={SHADOW}>
          <rect className={PANEL} x="12" y="8" width="118" height="80" rx="6" strokeWidth="0.8" />
        </g>
        <text
          className={TEXT_MUTED}
          x="20"
          y="19"
          fontSize="5.6"
          fontWeight="700"
          letterSpacing="0.6"
        >
          ICONS
        </text>
        <rect
          className="fill-slate-50 stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700"
          x="20"
          y="23"
          width="102"
          height="12"
          rx="3"
          strokeWidth="0.7"
        />
        <Glyph x={23.5} y={25.5} size={7} className="text-slate-400">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5 14 14" />
        </Glyph>
        <text className={TEXT_BODY} x="33" y="31.2" fontSize="6">
          data
        </text>
        {grid.map((name, i) => {
          const x = 20 + (i % 4) * 26;
          const y = 40 + Math.floor(i / 4) * 22;
          const picked = name === 'database';
          return (
            <g key={name}>
              <rect
                className={
                  picked
                    ? 'fill-brand-50 stroke-brand-500 dark:fill-brand-500/15 dark:stroke-brand-400'
                    : 'fill-transparent stroke-slate-200 dark:stroke-slate-700'
                }
                x={x}
                y={y}
                width="22"
                height="18"
                rx="3"
                strokeWidth={picked ? 1.2 : 0.7}
              />
              <Glyph
                x={x + 5}
                y={y + 3}
                className={
                  picked
                    ? 'text-brand-700 dark:text-brand-300'
                    : 'text-slate-600 dark:text-slate-300'
                }
              >
                {ICON_PATHS[name]}
              </Glyph>
            </g>
          );
        })}
        {/* On the canvas: the API, and the database icon landing beside it, wired up. */}
        <g>
          <rect className={INK} x="152" y="34" width="44" height="28" rx="5" strokeWidth="1.4" />
          <Glyph x={158} y={42} className="text-(--art-ink-stroke)">
            {ICON_PATHS.server}
          </Glyph>
          <text className={INK_TEXT} x="173" y="50.5" fontSize="6.6" fontWeight="600">
            API
          </text>
        </g>
        <path className={ARROW} d="M196 48 H231" strokeWidth="1.2" fill="none" />
        <path className="fill-(--art-arrow)" d="M236 48 l-5.5 -3.2 v6.4z" />
        <g className="fa-d-land">
          <Glyph x={240} y={30} size={30} className="text-(--art-ink-stroke)">
            {ICON_PATHS.database}
          </Glyph>
          <text
            className={INK_TEXT}
            x="255"
            y="72"
            fontSize="6.4"
            fontWeight="600"
            textAnchor="middle"
          >
            Orders
          </text>
        </g>
        <Cursor x={262} y={52} color="#ec4899" name="You" />
      </Scene>
    </Frame>
  );
}

// Rich text in a label: a shape whose words are styled run by run, one run selected with the
// floating format toolbar over it (italic on, a colour picked).
export function RichTextArt() {
  return (
    <Frame canvas>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-[7px]">
        {/* The floating toolbar over the selection. */}
        <div className="flex items-center gap-[2px] rounded-md border border-slate-200 bg-white p-[2px] text-[8.5px] text-slate-600 shadow-[0_2px_6px_-1px_rgb(15_23_42/0.18)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <span className="flex h-[15px] w-[15px] items-center justify-center rounded font-bold">
            B
          </span>
          <span className="flex h-[15px] w-[15px] items-center justify-center rounded bg-brand-50 font-semibold text-brand-700 italic dark:bg-brand-500/20 dark:text-brand-300">
            I
          </span>
          <span className="flex h-[15px] w-[15px] items-center justify-center rounded underline">
            U
          </span>
          <span className="flex h-[15px] w-[15px] items-center justify-center rounded line-through">
            S
          </span>
          <span className="mx-[2px] h-[11px] w-px bg-slate-200 dark:bg-slate-700" />
          {['#0f172a', '#ec4899', '#0ea5e9', '#16a34a'].map((c, i) => (
            <span
              key={c}
              className={`mx-[1.5px] h-[9px] w-[9px] rounded-full ${i === 0 ? 'dark:bg-slate-200!' : ''} ${i === 1 ? 'ring-[1.5px] ring-pink-500/40 ring-offset-1 ring-offset-white dark:ring-offset-slate-900' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <span className="mx-[2px] h-[11px] w-px bg-slate-200 dark:bg-slate-700" />
          <span className="px-[3px] font-medium">14</span>
        </div>
        {/* The label, on its shape. */}
        <div className="rounded-[6px] border-[1.5px] border-(--art-ink-stroke) bg-(color:--art-ink-fill) px-3 py-[7px] text-center text-[9.5px] leading-[1.45] text-(--art-ink-text)">
          Ship the <b className="font-bold">beta</b> on{' '}
          <span className="relative rounded-[2px] bg-brand-500/20 px-[1px] italic dark:bg-brand-400/25">
            <span className="font-semibold text-pink-500 dark:text-pink-400">Friday</span>
          </span>
          ,
          <br />
          then{' '}
          <span className="underline decoration-(--art-ink-stroke) decoration-[1.5px] underline-offset-2">
            celebrate
          </span>{' '}
          the launch
        </div>
      </div>
    </Frame>
  );
}

// Link card: a URL pasted onto the canvas unfurls into a bookmark with the page's preview,
// favicon, title and host. A link card keeps its own colours on any canvas, as in the editor.
export function LinkCardArt() {
  return (
    <Frame canvas>
      <Scene>
        {/* The pasted URL and the keys that pasted it. */}
        <g>
          <rect
            className={`${PANEL} ${SHADOW}`}
            x="14"
            y="40"
            width="94"
            height="16"
            rx="8"
            strokeWidth="0.8"
          />
          <Glyph x={20} y={44} size={8} className="text-slate-400">
            <path d="M6.5 9.5a3 3 0 0 0 4.2 0l2.3-2.3a3 3 0 0 0-4.2-4.2l-.8.8M9.5 6.5a3 3 0 0 0-4.2 0L3 8.8A3 3 0 0 0 7.2 13l.8-.8" />
          </Glyph>
          <text className={TEXT_BODY} x="31" y="50.3" fontSize="6">
            figma.com/file/checkout
          </text>
          <g className="fa-pulse">
            {[
              ['⌘', 40],
              ['V', 55],
            ].map(([k, x]) => (
              <g key={k}>
                <rect
                  className="fill-white stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-600"
                  x={x as number}
                  y="20"
                  width="13"
                  height="13"
                  rx="2.5"
                  strokeWidth="0.8"
                />
                <text
                  className={TEXT_STRONG}
                  x={(x as number) + 6.5}
                  y="29.2"
                  fontSize="6.5"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {k}
                </text>
              </g>
            ))}
          </g>
        </g>
        <path
          className={ARROW}
          d="M114 48 C 126 48, 128 48, 140 48"
          strokeWidth="1.1"
          strokeDasharray="2.5 2.5"
          fill="none"
        />
        <path className="fill-(--art-arrow)" d="M145 48 l-5 -3 v6z" />
        {/* The card, in its own light colours. */}
        <g className="fa-d-land">
          <g className="[filter:drop-shadow(0_2px_3px_rgb(15_23_42/0.16))]">
            <rect
              x="150"
              y="9"
              width="136"
              height="78"
              rx="5"
              fill="#fff"
              stroke="#cbd5e1"
              strokeWidth="0.8"
            />
          </g>
          <defs>
            <linearGradient id="fa-d-link-preview" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#e0f2fe" />
              <stop offset="1" stopColor="#ede9fe" />
            </linearGradient>
            <clipPath id="fa-d-link-clip">
              <rect x="150" y="9" width="136" height="78" rx="5" />
            </clipPath>
          </defs>
          <g clipPath="url(#fa-d-link-clip)">
            <rect x="150" y="9" width="136" height="44" fill="url(#fa-d-link-preview)" />
            {/* The page's preview: a checkout screen in a phone and a card beside it. */}
            <rect x="196" y="15" width="26" height="44" rx="4" fill="#0f172a" />
            <rect x="198.5" y="19" width="21" height="7" rx="1.5" fill="#38bdf8" />
            <rect x="198.5" y="29" width="21" height="3" rx="1" fill="#334155" />
            <rect x="198.5" y="34" width="14" height="3" rx="1" fill="#334155" />
            <rect x="198.5" y="41" width="21" height="6" rx="2" fill="#ec4899" />
            <rect x="228" y="22" width="34" height="22" rx="3" fill="#fff" />
            <rect x="232" y="27" width="18" height="3" rx="1" fill="#a78bfa" />
            <rect x="232" y="33" width="24" height="2.5" rx="1" fill="#e2e8f0" />
            <rect x="232" y="38" width="16" height="2.5" rx="1" fill="#e2e8f0" />
            <path d="M150 53 H286" stroke="#e2e8f0" strokeWidth="0.8" />
          </g>
          <rect x="157" y="60" width="11" height="11" rx="2.5" fill="#0f172a" />
          <circle cx="160.6" cy="63.6" r="1.6" fill="#f24e1e" />
          <circle cx="164.4" cy="63.6" r="1.6" fill="#a259ff" />
          <circle cx="160.6" cy="67.4" r="1.6" fill="#1abcfe" />
          <circle cx="164.4" cy="67.4" r="1.6" fill="#0acf83" />
          <text x="173" y="65.2" fontSize="6.8" fontWeight="700" fill="#0f172a">
            Checkout redesign
          </text>
          <text x="173" y="73.4" fontSize="5.8" fill="#64748b">
            Flows, states and the new pay step
          </text>
          <text x="157" y="82.4" fontSize="5.4" fill="#94a3b8">
            figma.com
          </text>
        </g>
      </Scene>
    </Frame>
  );
}
