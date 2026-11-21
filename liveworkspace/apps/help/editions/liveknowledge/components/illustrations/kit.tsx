import type { ReactNode } from 'react';
import { Label, Lift } from '@liveworkspace/help-site/art/primitives';

// The building blocks of liveknowledge's figures (liveworkspace/docs/specs/017-help/help-centre.md "Figures and card
// icons"): the editor as a Knowledgebase draws it, scaled down. There is no canvas here: a page of writing on plain
// ground, the page tree in a sidebar at the left, one top row, and the footer whose three tabs are the views (Pages,
// Ask, AI Knowledge). Every figure in this edition is composed from these, so a change to the editor's chrome is
// drawn once. Colours are the light ramp only; the art scope turns them over for the dark appearance.

/** Chrome hairline, in scene units (scenes render near 2x). */
export const HAIR = 0.75;
/** The sidebar's width, the top row's and the footer's height inside an AppFrame. */
export const SIDEBAR_W = 112;
export const TOP_H = 20;
export const FOOT_H = 20;
/** A tree row's height. */
export const ROW_H = 15;

const MONO = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' } as const;

/** Muted bars standing in for lines of writing: each `widths` entry is one line. */
export function Lines({
  x,
  y,
  widths,
  gap = 8,
  h = 3.5,
  className = 'fill-slate-200',
}: {
  x: number;
  y: number;
  widths: readonly number[];
  gap?: number;
  h?: number;
  className?: string;
}) {
  return (
    <>
      {widths.map((w, i) => (
        <rect key={i} x={x} y={y + i * gap} width={w} height={h} rx={h / 2} className={className} />
      ))}
    </>
  );
}

/** A white surface with a hairline border: a card, a dialog, a menu. `lift` adds the soft shadow of a floating one. */
export function Surface({
  x,
  y,
  w,
  h,
  r = 8,
  lift = false,
  className = 'fill-white stroke-slate-200',
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
  lift?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <g>
      {lift ? <Lift x={x} y={y} w={w} h={h} r={r} /> : null}
      <rect x={x} y={y} width={w} height={h} rx={r} className={className} strokeWidth={HAIR} />
      {children}
    </g>
  );
}

/** A tick, drawn as a stroke at (cx, cy): the Verified mark, a chosen row, a ticked checkbox. */
export function Tick({
  cx,
  cy,
  r = 4,
  className = 'stroke-brand-600',
}: {
  cx: number;
  cy: number;
  r?: number;
  className?: string;
}) {
  return (
    <path
      d={`M${cx - r * 0.7} ${cy + r * 0.05} l${r * 0.5} ${r * 0.5} l${r * 0.9} -${r}`}
      className={`fill-none ${className}`}
      strokeWidth={r * 0.36}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** The Verified mark as the editor draws it: a tick in a pale brand disc. */
export function VerifiedMark({ cx, cy, r = 5 }: { cx: number; cy: number; r?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} className="fill-brand-100" />
      <Tick cx={cx} cy={cy} r={r * 0.62} className="stroke-brand-700" />
    </g>
  );
}

/** The width a pill of `label` takes at `size`. */
export function pillWidth(label: string, size = 7.5): number {
  return Math.ceil(label.length * size * 0.56 + 10);
}

const PILL_TONES = {
  amber: { box: 'fill-amber-50 stroke-amber-200', text: 'fill-amber-700 dark:fill-amber-300' },
  brand: { box: 'fill-brand-50 stroke-brand-200', text: 'fill-brand-700' },
  slate: { box: 'fill-slate-100 stroke-slate-200', text: 'fill-slate-600' },
  rose: { box: 'fill-rose-50 stroke-rose-200', text: 'fill-rose-700 dark:fill-rose-300' },
  violet: { box: 'fill-violet-50 stroke-violet-200', text: 'fill-violet-700 dark:fill-violet-300' },
  solid: { box: 'fill-brand-600 stroke-brand-600', text: 'fill-white help-art-as-drawn' },
  dark: { box: 'fill-slate-800 stroke-slate-800', text: 'fill-white help-art-as-drawn' },
} as const;
export type PillTone = keyof typeof PILL_TONES;

/** A pill with a word in it: Review Due (amber), a scope chip, a count. Its left edge is `x`, its middle `y`. */
export function Pill({
  x,
  y,
  label,
  tone = 'amber',
  size = 7.5,
  w,
  h = 12,
}: {
  x: number;
  y: number;
  label: string;
  tone?: PillTone;
  size?: number;
  w?: number;
  h?: number;
}) {
  const width = w ?? pillWidth(label, size);
  const t = PILL_TONES[tone];
  return (
    <g>
      <rect
        x={x}
        y={y - h / 2}
        width={width}
        height={h}
        rx={h / 2}
        className={t.box}
        strokeWidth={HAIR}
      />
      <Label
        x={x + width / 2}
        y={y + 0.4}
        anchor="middle"
        size={size}
        weight={600}
        className={t.text}
      >
        {label}
      </Label>
    </g>
  );
}

/** A button: `primary` is the filled one. Its left edge is `x`, its top `y`. */
export function Btn({
  x,
  y,
  w,
  h = 16,
  label,
  variant = 'default',
  size = 8,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  label: string;
  variant?: 'default' | 'primary' | 'quiet';
  size?: number;
}) {
  const box = {
    default: 'fill-white stroke-slate-300',
    primary: 'fill-brand-600 stroke-brand-600',
    quiet: 'fill-slate-100 stroke-slate-100',
  }[variant];
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={5} className={box} strokeWidth={HAIR} />
      <Label
        x={x + w / 2}
        y={y + h / 2 + 0.4}
        anchor="middle"
        size={size}
        weight={600}
        tone={variant === 'primary' ? 'onAccent' : 'strong'}
      >
        {label}
      </Label>
    </g>
  );
}

/** Text in the code face, for a command, a tool's name or a path. */
export function Code({
  x,
  y,
  children,
  size = 8,
  className = 'fill-slate-700',
  anchor = 'start',
}: {
  x: number;
  y: number;
  children: ReactNode;
  size?: number;
  className?: string;
  anchor?: 'start' | 'middle' | 'end';
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      textAnchor={anchor}
      dominantBaseline="middle"
      className={className}
      style={{ ...MONO, whiteSpace: 'pre' }}
    >
      {children}
    </text>
  );
}

/** A chevron: right (a closed page) or down (an open one). */
export function Chevron({ cx, cy, open = false }: { cx: number; cy: number; open?: boolean }) {
  const d = open
    ? `M${cx - 2.4} ${cy - 1.2} L${cx} ${cy + 1.4} L${cx + 2.4} ${cy - 1.2}`
    : `M${cx - 1.2} ${cy - 2.4} L${cx + 1.4} ${cy} L${cx - 1.2} ${cy + 2.4}`;
  return (
    <path
      d={d}
      className="fill-none stroke-slate-400"
      strokeWidth={1.1}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

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
export function PageHead({
  x,
  y,
  title,
  crumb,
  children,
}: {
  x: number;
  y: number;
  title: string;
  crumb?: string;
  /** The meta row, drawn at y + 31 by the caller. */
  children?: ReactNode;
}) {
  return (
    <g>
      {crumb ? (
        <Label x={x} y={y} size={6.5} tone="muted">
          {crumb}
        </Label>
      ) : null}
      <Label x={x} y={y + 14} size={14} weight={800} tone="strong">
        {title}
      </Label>
      {children}
    </g>
  );
}

/** The meta row's Verified badge: a pale brand pill holding the tick and "Verified by <name>", then what follows
 *  after a dot. Its left edge is `x`, its middle `y`. */
export function VerifiedBadge({
  x,
  y,
  by = 'Maya',
  after,
}: {
  x: number;
  y: number;
  by?: string;
  after?: string;
}) {
  const text = `Verified by ${by}`;
  const w = Math.ceil(text.length * 4.1 + 20);
  return (
    <g>
      <rect x={x} y={y - 6.5} width={w} height={13} rx={6.5} className="fill-brand-100" />
      <Tick cx={x + 8} cy={y} r={3} className="stroke-brand-700" />
      <Label x={x + 15} y={y + 0.4} size={7.5} weight={600} className="fill-brand-800">
        {text}
      </Label>
      {after ? (
        <Label x={x + w + 5} y={y + 0.4} size={7.5} tone="muted">
          {`· ${after}`}
        </Label>
      ) : null}
    </g>
  );
}

/** The width VerifiedBadge takes for `by`, so a caller can place what follows it. */
export const verifiedBadgeWidth = (by = 'Maya'): number =>
  Math.ceil(`Verified by ${by}`.length * 4.1 + 20);

/** A dialog's card: a title, an optional line under it, and its body. Centred by the caller. */
export function DialogCard({
  x,
  y,
  w,
  h,
  title,
  line,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  line?: string;
  children?: ReactNode;
}) {
  return (
    <Surface x={x} y={y} w={w} h={h} r={10} lift>
      <Label x={x + 14} y={y + 16} size={10.5} weight={700} tone="strong">
        {title}
      </Label>
      {line ? (
        <Label x={x + 14} y={y + 29} size={7.5} tone="muted">
          {line}
        </Label>
      ) : null}
      {/* Close. */}
      <path
        d={`M${x + w - 17} ${y + 12.5} l6 6 M${x + w - 11} ${y + 12.5} l-6 6`}
        className="stroke-slate-400"
        strokeWidth={1.1}
        strokeLinecap="round"
      />
      {children}
    </Surface>
  );
}

/** A bordered single-choice row: a radio at the left, a label, and a tick when it is the chosen one. */
export function ChoiceRow({
  x,
  y,
  w,
  h = 16,
  label,
  note,
  chosen = false,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  label: string;
  note?: string;
  chosen?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={5}
        className={chosen ? 'fill-brand-50 stroke-brand-500' : 'fill-white stroke-slate-200'}
        strokeWidth={chosen ? 1.1 : HAIR}
      />
      <Label x={x + 9} y={y + h / 2 + 0.4} size={8} weight={chosen ? 700 : 500} tone="strong">
        {label}
      </Label>
      {note ? (
        <Label x={x + w - (chosen ? 20 : 9)} y={y + h / 2 + 0.4} anchor="end" size={7} tone="muted">
          {note}
        </Label>
      ) : null}
      {chosen ? <Tick cx={x + w - 10} cy={y + h / 2} r={3.4} className="stroke-brand-600" /> : null}
    </g>
  );
}

/** A menu's row: a small glyph square at its left and a verb. `muted` greys a verb that cannot run. */
export function MenuRows({
  x,
  y,
  w,
  rows,
}: {
  x: number;
  y: number;
  w: number;
  rows: readonly (
    { label: string; hover?: boolean; muted?: boolean; ticked?: boolean } | 'separator'
  )[];
}) {
  const tops = runningStarts(
    y,
    rows.map((row) => (row === 'separator' ? 5 : 13)),
  );
  return (
    <>
      {rows.map((row, i) => {
        const at = tops[i]!;
        if (row === 'separator') {
          const line = (
            <line
              key={i}
              x1={x + 4}
              y1={at + 2.5}
              x2={x + w - 4}
              y2={at + 2.5}
              className="stroke-slate-200"
              strokeWidth={HAIR}
            />
          );
          return line;
        }
        const top = at;
        return (
          <g key={i} opacity={row.muted ? 0.45 : 1}>
            {row.hover ? (
              <rect
                x={x + 3}
                y={top}
                width={w - 6}
                height={13}
                rx={3.5}
                className="fill-slate-100"
              />
            ) : null}
            <rect
              x={x + 8}
              y={top + 3.5}
              width={6}
              height={6}
              rx={1.5}
              className="fill-none stroke-slate-400"
              strokeWidth={1}
            />
            <Label x={x + 19} y={top + 6.9} size={7.5} weight={500} tone="strong">
              {row.label}
            </Label>
            {row.ticked ? (
              <Tick cx={x + w - 10} cy={top + 6.5} r={3} className="stroke-brand-600" />
            ) : null}
          </g>
        );
      })}
    </>
  );
}

/** A stacked bar of parts that sum to its width: Knowledge Health, a budget. */
export function StackedBar({
  x,
  y,
  w,
  h = 6,
  parts,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  /** Each part's share (0 to 1) and its fill; a remainder is left as the track. */
  parts: readonly { share: number; className: string }[];
}) {
  const lefts = runningStarts(
    x,
    parts.map((part) => w * part.share),
  );
  const id = `kb-bar-${x}-${y}-${w}`;
  return (
    <g>
      <defs>
        <clipPath id={id}>
          <rect x={x} y={y} width={w} height={h} rx={h / 2} />
        </clipPath>
      </defs>
      <rect x={x} y={y} width={w} height={h} rx={h / 2} className="fill-slate-100" />
      <g clipPath={`url(#${id})`}>
        {parts.map((part, i) => (
          <rect
            key={i}
            x={lefts[i]}
            y={y}
            width={w * part.share}
            height={h}
            className={part.className}
          />
        ))}
      </g>
    </g>
  );
}

/** A labelled row of a card: the label at the left in muted ink, the value at the right. */
export function FieldRow({
  x,
  y,
  w,
  label,
  value,
  valueClass = 'fill-slate-800',
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <g>
      <Label x={x} y={y} size={7} tone="muted">
        {label}
      </Label>
      <Label x={x + w} y={y} anchor="end" size={7} weight={600} className={valueClass}>
        {value}
      </Label>
    </g>
  );
}

/** A small avatar disc with an initial. */
export function Face({
  cx,
  cy,
  r = 5.5,
  initial,
  className = 'fill-violet-500 dark:fill-violet-700',
}: {
  cx: number;
  cy: number;
  r?: number;
  initial: string;
  className?: string;
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} className={className} />
      <Label
        x={cx}
        y={cy + 0.5}
        anchor="middle"
        size={r * 1.15}
        weight={700}
        className="fill-white help-art-as-drawn"
      >
        {initial}
      </Label>
    </g>
  );
}

/** Where each of a run of items starts, from `start`, each `sizes[i]` long: positions worked out before drawing. */
export function runningStarts(start: number, sizes: readonly number[]): number[] {
  const starts: number[] = [];
  let at = start;
  for (const size of sizes) {
    starts.push(at);
    at += size;
  }
  return starts;
}
