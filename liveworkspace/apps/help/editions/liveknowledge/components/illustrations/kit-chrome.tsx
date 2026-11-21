import type { ReactNode } from 'react';
import { Label, Lift } from '@liveworkspace/help-site/art/primitives';
import {
  Chevron,
  FOOT_H,
  HAIR,
  Pill,
  ROW_H,
  SIDEBAR_W,
  TOP_H,
  Tick,
  runningStarts,
} from './kit-base';

// The editor's chrome in liveknowledge's figures (kit.tsx): the page tree, the sidebar, search, the footer's
// view tabs, the top and formatting rows, and the AppFrame that holds them.

export type TreeRowSpec = {
  label: string;
  /** 0 is the top level. */
  depth?: number;
  /** Has subpages: `true` open, `false` closed. Absent: a page with none. */
  open?: boolean;
  /** The page being read: the brand tint. */
  current?: boolean;
  state?: 'verified' | 'due';
  /** Hovered: the row's + and ⋯ show at its right. */
  hover?: boolean;
  /** A faint row, for a page being dragged away or one not ticked. */
  faint?: boolean;
};

/** The page tree's rows, top to bottom from (x, y), `w` wide. A row indents 9 units a level. */
export function TreeRows({
  x,
  y,
  w,
  rows,
}: {
  x: number;
  y: number;
  w: number;
  rows: readonly TreeRowSpec[];
}) {
  return (
    <>
      {rows.map((row, i) => {
        const top = y + i * ROW_H;
        const mid = top + ROW_H / 2;
        const indent = (row.depth ?? 0) * 9;
        return (
          <g key={`${row.label}-${i}`} opacity={row.faint ? 0.45 : 1}>
            {row.current || row.hover ? (
              <rect
                x={x}
                y={top + 0.75}
                width={w}
                height={ROW_H - 1.5}
                rx={4}
                className={row.current ? 'fill-brand-100' : 'fill-slate-200/70'}
              />
            ) : null}
            {row.open !== undefined ? (
              <Chevron cx={x + 7 + indent} cy={mid} open={row.open} />
            ) : null}
            <Label
              x={x + 13 + indent}
              y={mid + 0.4}
              size={7.5}
              weight={row.current ? 700 : 500}
              className={row.current ? 'fill-brand-800' : 'fill-slate-700'}
            >
              {row.label}
            </Label>
            {row.hover ? (
              <>
                <path
                  d={`M${x + w - 22} ${mid} h5 M${x + w - 19.5} ${mid - 2.5} v5`}
                  className="stroke-slate-500"
                  strokeWidth={1}
                  strokeLinecap="round"
                />
                {[0, 1, 2].map((d) => (
                  <circle
                    key={d}
                    cx={x + w - 11 + d * 2.6}
                    cy={mid}
                    r={0.8}
                    className="fill-slate-500"
                  />
                ))}
              </>
            ) : row.state === 'verified' ? (
              <Tick cx={x + w - 8} cy={mid} r={3} className="stroke-brand-600" />
            ) : row.state === 'due' ? (
              <Pill x={x + w - 22} y={mid} label="Due" tone="amber" size={6} w={18} h={9.5} />
            ) : null}
          </g>
        );
      })}
    </>
  );
}

/** The sidebar: the knowledgebase's name, the search field, the Pages label, the rows, and New Page at its foot. */
export function Sidebar({
  x = 0,
  y = 0,
  h,
  name = 'Team Handbook',
  rows,
  newPage = true,
  children,
}: {
  x?: number;
  y?: number;
  h: number;
  name?: string;
  rows: readonly TreeRowSpec[];
  /** The dashed New Page button (an Editor's). */
  newPage?: boolean;
  /** Drawn above New Page: Describe to Set Up. */
  children?: ReactNode;
}) {
  const w = SIDEBAR_W;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} className="fill-slate-50" />
      <line
        x1={x + w}
        y1={y}
        x2={x + w}
        y2={y + h}
        className="stroke-slate-200"
        strokeWidth={HAIR}
      />
      <Label x={x + 9} y={y + 12} size={8} weight={700} tone="strong">
        {name}
      </Label>
      {/* Hide Pages. */}
      <path
        d={`M${x + w - 14} ${y + 9.5} l-2.5 2.5 l2.5 2.5 M${x + w - 9.5} ${y + 9.5} l-2.5 2.5 l2.5 2.5`}
        className="fill-none stroke-slate-400"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <SearchBox x={x + 8} y={y + 22} w={w - 16} />
      <Label x={x + 10} y={y + 47} size={6} weight={700} tone="muted">
        PAGES
      </Label>
      <TreeRows x={x + 4} y={y + 53} w={w - 8} rows={rows} />
      {children}
      {newPage ? (
        <g>
          <line
            x1={x}
            y1={y + h - 25}
            x2={x + w}
            y2={y + h - 25}
            className="stroke-slate-200"
            strokeWidth={HAIR}
          />
          <rect
            x={x + 8}
            y={y + h - 20}
            width={w - 16}
            height={14}
            rx={4}
            className="fill-none stroke-slate-300"
            strokeWidth={HAIR}
            strokeDasharray="2.5 2"
          />
          <Label x={x + w / 2} y={y + h - 12.6} anchor="middle" size={7.5} weight={600} tone="body">
            + New Page
          </Label>
        </g>
      ) : null}
    </g>
  );
}

/** The search field at the sidebar's head: a lens, "Search" and its shortcut. */
export function SearchBox({
  x,
  y,
  w,
  h = 14,
  text = 'Search',
  typed = false,
  keys = '⌘K',
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  text?: string;
  /** What is in the field is typed, not the placeholder. */
  typed?: boolean;
  keys?: string | null;
}) {
  const mid = y + h / 2;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={4}
        className="fill-white stroke-slate-200"
        strokeWidth={HAIR}
      />
      <circle
        cx={x + 8}
        cy={mid - 0.5}
        r={2.6}
        className="fill-none stroke-slate-400"
        strokeWidth={1}
      />
      <path
        d={`M${x + 10} ${mid + 1.6} l1.8 1.8`}
        className="stroke-slate-400"
        strokeWidth={1}
        strokeLinecap="round"
      />
      <Label x={x + 16} y={mid + 0.4} size={7.5} tone={typed ? 'strong' : 'muted'}>
        {text}
      </Label>
      {keys ? (
        <Label x={x + w - 5} y={mid + 0.4} anchor="end" size={6.5} weight={600} tone="muted">
          {keys}
        </Label>
      ) : null}
    </g>
  );
}

export type KnowledgeView = 'pages' | 'ask' | 'ai';
const VIEW_TABS: readonly { view: KnowledgeView; label: string; w: number }[] = [
  { view: 'pages', label: 'Pages', w: 36 },
  { view: 'ask', label: 'Ask', w: 28 },
  { view: 'ai', label: 'AI Knowledge', w: 62 },
];

/** The footer: the three views as tabs at its left (the open one a white card standing on the bar's foot), then
 *  Tools and Settings at its right. */
export function Footer({
  x,
  y,
  w,
  view = 'pages',
}: {
  x: number;
  y: number;
  w: number;
  view?: KnowledgeView;
}) {
  const lefts = runningStarts(
    x + 6,
    VIEW_TABS.map((tab) => tab.w + 3),
  );
  return (
    <g>
      <rect x={x} y={y} width={w} height={FOOT_H} className="fill-slate-100" />
      <line x1={x} y1={y} x2={x + w} y2={y} className="stroke-slate-200" strokeWidth={HAIR} />
      {VIEW_TABS.map((tab, i) => {
        const left = lefts[i]!;
        const open = tab.view === view;
        return (
          <g key={tab.view}>
            {open ? (
              <path
                d={`M${left} ${y + FOOT_H} V${y + 7} a4 4 0 0 1 4 -4 H${left + tab.w - 4} a4 4 0 0 1 4 4 V${y + FOOT_H} Z`}
                className="fill-white stroke-slate-200"
                strokeWidth={HAIR}
              />
            ) : null}
            <Label
              x={left + tab.w / 2}
              y={y + FOOT_H / 2 + 1.6}
              anchor="middle"
              size={7.5}
              weight={open ? 700 : 500}
              className={open ? 'fill-slate-900' : 'fill-slate-500'}
            >
              {tab.label}
            </Label>
          </g>
        );
      })}
      <Label x={x + w - 46} y={y + FOOT_H / 2 + 1} anchor="end" size={7} tone="muted">
        Tools
      </Label>
      <Label x={x + w - 10} y={y + FOOT_H / 2 + 1} anchor="end" size={7} tone="muted">
        Settings
      </Label>
    </g>
  );
}

/** The top row: its own controls at the left (`children`), then Share and the account button at its right end. */
export function TopRow({
  x,
  y,
  w,
  title,
  children,
}: {
  x: number;
  y: number;
  w: number;
  /** A view's name (Ask, AI Knowledge), in place of the formatting controls. */
  title?: string;
  children?: ReactNode;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={TOP_H} className="fill-white" />
      <line
        x1={x}
        y1={y + TOP_H}
        x2={x + w}
        y2={y + TOP_H}
        className="stroke-slate-200"
        strokeWidth={HAIR}
      />
      {title ? (
        <Label x={x + 10} y={y + TOP_H / 2 + 0.5} size={8.5} weight={700} tone="strong">
          {title}
        </Label>
      ) : null}
      {children}
      <rect x={x + w - 54} y={y + 4} width={30} height={12} rx={4} className="fill-brand-600" />
      <Label x={x + w - 39} y={y + 10.4} anchor="middle" size={7} weight={700} tone="onAccent">
        Share
      </Label>
      <circle cx={x + w - 12} cy={y + 10} r={6} className="fill-violet-500 dark:fill-violet-700" />
      <Label
        x={x + w - 12}
        y={y + 10.5}
        anchor="middle"
        size={6.5}
        weight={700}
        className="fill-white help-art-as-drawn"
      >
        M
      </Label>
    </g>
  );
}

/** The formatting controls at the left of the top row while a page is being written: the block style, then marks. */
export function FormatRow({ x, y }: { x: number; y: number }) {
  const mid = y + TOP_H / 2;
  const marks: readonly { label: string; weight: number; style?: 'italic'; underline?: boolean }[] =
    [
      { label: 'B', weight: 800 },
      { label: 'I', weight: 500, style: 'italic' },
      { label: 'U', weight: 500, underline: true },
    ];
  return (
    <g>
      <rect
        x={x + 8}
        y={y + 4}
        width={44}
        height={12}
        rx={3.5}
        className="fill-white stroke-slate-200"
        strokeWidth={HAIR}
      />
      <Label x={x + 13} y={mid + 0.4} size={7} tone="body">
        Paragraph
      </Label>
      <Chevron cx={x + 47} cy={mid} open />
      {marks.map((m, i) => (
        <text
          key={m.label}
          x={x + 62 + i * 12}
          y={mid + 0.5}
          fontSize={8}
          fontWeight={m.weight}
          fontStyle={m.style}
          textDecoration={m.underline ? 'underline' : undefined}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-slate-600"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          {m.label}
        </text>
      ))}
      <line
        x1={x + 94}
        y1={y + 5}
        x2={x + 94}
        y2={y + 15}
        className="stroke-slate-200"
        strokeWidth={HAIR}
      />
      {/* Lists and alignment, as bars. */}
      {[0, 1].map((g) => (
        <g key={g}>
          {[0, 1, 2].map((l) => (
            <rect
              key={l}
              x={x + 100 + g * 14}
              y={y + 6.5 + l * 3}
              width={g === 0 ? 8 : l === 1 ? 5 : 8}
              height={1.2}
              rx={0.6}
              className="fill-slate-500"
            />
          ))}
        </g>
      ))}
      <rect x={x + 130} y={y + 4} width={30} height={12} rx={3.5} className="fill-slate-100" />
      <Label x={x + 145} y={mid + 0.4} anchor="middle" size={7} weight={600} tone="body">
        Insert
      </Label>
    </g>
  );
}

/** The editor's frame: a rounded window holding the sidebar, the top row and the footer. `children` draw the view
 *  between them; `content` says where that is. */
export function AppFrame({
  w,
  h,
  view = 'pages',
  rows,
  name,
  topRow,
  sidebarExtra,
  newPage,
  children,
}: {
  w: number;
  h: number;
  view?: KnowledgeView;
  /** The page tree's rows. Absent: no sidebar (Ask and AI Knowledge cover it). */
  rows?: readonly TreeRowSpec[];
  name?: string;
  topRow?: ReactNode;
  sidebarExtra?: ReactNode;
  newPage?: boolean;
  children?: ReactNode;
}) {
  const left = rows ? SIDEBAR_W : 0;
  const clip = `kb-frame-${w}-${h}-${view}`;
  return (
    <g>
      <Lift x={0.5} y={0.5} w={w - 1} h={h - 7} r={10} />
      <defs>
        <clipPath id={clip}>
          <rect x={0.5} y={0.5} width={w - 1} height={h - 7} rx={10} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect x={0} y={0} width={w} height={h} className="fill-white" />
        {rows ? (
          <Sidebar h={h - 6 - FOOT_H} rows={rows} name={name} newPage={newPage}>
            {sidebarExtra}
          </Sidebar>
        ) : null}
        <TopRow
          x={left}
          y={0}
          w={w - left}
          title={view === 'ask' ? 'Ask' : view === 'ai' ? 'AI Knowledge' : undefined}
        >
          {topRow}
        </TopRow>
        {children}
        <Footer x={0} y={h - 6 - FOOT_H} w={w} view={view} />
      </g>
      <rect
        x={0.5}
        y={0.5}
        width={w - 1}
        height={h - 7}
        rx={10}
        className="fill-none stroke-slate-300"
        strokeWidth={HAIR}
      />
    </g>
  );
}

/** A page's head in the reading column: the breadcrumb, the Title, and the meta row under it. */
