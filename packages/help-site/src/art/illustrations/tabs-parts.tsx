// Tab-bar building blocks for the Tabs-category illustrations (docs/specs/018-help/help-app.md), shared by
// every product's help app: a tab on the bar (TabFrame), the + button, folder glyphs and folder groups on the
// bar, the bar strip, dialog tiles, format cards and the tab menu's rows. Composed only from the shared
// primitives so the house style holds.

import type { ReactNode } from 'react';
import { Label } from '../primitives';

/** A small padlock glyph drawn from its centre (the locked-tab marker). */
export function Padlock({ tone = 'accent' }: { tone?: 'accent' | 'muted' }) {
  const fill = tone === 'accent' ? 'fill-brand-600' : 'fill-slate-500';
  const stroke = tone === 'accent' ? 'stroke-brand-600' : 'stroke-slate-500';
  return (
    <g>
      <rect x={-4.5} y={-1} width={9} height={7} rx={1.5} className={fill} />
      <path
        d="M-2.8 -1 V-3.2 a2.8 2.8 0 0 1 5.6 0 V-1"
        fill="none"
        className={stroke}
        strokeWidth={1.5}
      />
    </g>
  );
}

/** One tab on the bar, standing on its bottom edge (TabFrame). The open tab is a white card that
 *  joins the bar's bottom edge, rounded only at the top, its name in the accent with its trailing
 *  ⋯; the others are bare names on the bar. Nothing runs along a tab's top, and no type icon. */
export function TabPill({
  x,
  y,
  w,
  label,
  active = false,
  locked = false,
  h = 26,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  active?: boolean;
  locked?: boolean;
  h?: number;
}) {
  const top = y - 4;
  const bottom = y + h + 8;
  const r = 7;
  const mid = (top + bottom) / 2;
  const textX = x + 12 + (locked ? 13 : 0);
  return (
    <g>
      {active && (
        <path
          d={`M${x} ${bottom} V${top + r} a${r} ${r} 0 0 1 ${r} ${-r} H${x + w - r} a${r} ${r} 0 0 1 ${r} ${r} V${bottom} Z`}
          className="fill-white stroke-slate-300"
          strokeWidth={1}
        />
      )}
      {locked && (
        <g transform={`translate(${x + 16} ${mid})`}>
          <Padlock tone={active ? 'accent' : 'muted'} />
        </g>
      )}
      <Label
        x={textX}
        y={mid + 1}
        size={11}
        weight={active ? 650 : 500}
        tone={active ? 'accent' : 'body'}
      >
        {label}
      </Label>
      {active && (
        <g>
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={x + w - 18 + i * 5} cy={mid} r={1.4} className="fill-slate-400" />
          ))}
        </g>
      )}
    </g>
  );
}

/** The `+` (Add tab) button after the last tab. */
export function AddTabButton({ x, y, h = 26 }: { x: number; y: number; h?: number }) {
  const cx = x + h / 2;
  const cy = y + h / 2 + 2;
  return (
    <path
      d={`M${cx - 5} ${cy} h10 M${cx} ${cy - 5} v10`}
      className="stroke-slate-500"
      strokeWidth={1.75}
      strokeLinecap="round"
    />
  );
}

/** A folder glyph drawn from its centre, closed or open (the folder tiles in the dialogs). */
export function FolderIcon({ open = false }: { open?: boolean }) {
  if (open) {
    return (
      <g>
        <path
          d="M-8 -5 h5 l2 2 h7 v2 h-14 Z"
          className="fill-slate-200 stroke-slate-500"
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        <path
          d="M-8 -1 h17 l-2 6.5 h-15 Z"
          className="fill-white stroke-slate-500"
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </g>
    );
  }
  return (
    <path
      d="M-8 -5 h5 l2 2 h8 a1 1 0 0 1 1 1 v7 a1 1 0 0 1 -1 1 h-14 a1 1 0 0 1 -1 -1 v-9 a1 1 0 0 1 1 -1 Z"
      className="fill-slate-200 stroke-slate-500"
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
  );
}

/** A folder's colour, as the editor derives it from the name (folder-colour.ts): a pale shelf
 *  behind its tabs, the chip a deeper tint with the name and count badge in the hue. */
export const FOLDER_TONES = {
  rose: {
    shelf: 'fill-rose-50',
    chip: 'fill-rose-100',
    ink: 'fill-rose-700 dark:fill-rose-300',
    badge: 'fill-rose-600 dark:fill-rose-300',
    stroke: 'stroke-rose-700 dark:stroke-rose-300',
  },
  violet: {
    shelf: 'fill-violet-50',
    chip: 'fill-violet-100',
    ink: 'fill-violet-700 dark:fill-violet-300',
    badge: 'fill-violet-600 dark:fill-violet-300',
    stroke: 'stroke-violet-700 dark:stroke-violet-300',
  },
} as const;

/** A folder on the bar (TabFolderGroup): a shelf tinted in the folder's colour and shaped like a tab, always there,
 *  holding its header (a folder glyph, the name and the count badge, open or shut) and then whichever of its tabs
 *  show. Shut, only the tab you are on stays beside the header; open, every tab sits after it, in order. */
export function FolderGroup({
  x,
  y,
  name,
  count,
  chipW = 80,
  tabs = [],
  tone = 'rose',
}: {
  x: number;
  y: number;
  name: string;
  count: number;
  chipW?: number;
  tabs?: { label: string; w: number; active?: boolean }[];
  tone?: keyof typeof FOLDER_TONES;
}) {
  const t = FOLDER_TONES[tone];
  const w = chipW + tabs.reduce((s, tab) => s + tab.w + 2, 0) + 2;
  const top = y - 4;
  const bottom = y + 34;
  const r = 7;
  const mid = y + 15;
  const tabsX = x + chipW + 2;
  const badgeX = x + chipW - 20;
  return (
    <g>
      <path
        d={`M${x} ${bottom} V${top + r} a${r} ${r} 0 0 1 ${r} ${-r} H${x + w - r} a${r} ${r} 0 0 1 ${r} ${r} V${bottom} Z`}
        className={t.shelf}
      />
      <path
        d="M-8 -5 h5 l2 2 h8 a1 1 0 0 1 1 1 v7 a1 1 0 0 1 -1 1 h-14 a1 1 0 0 1 -1 -1 v-9 a1 1 0 0 1 1 -1 Z"
        transform={`translate(${x + 14} ${mid + 0.5}) scale(0.65)`}
        fill="none"
        className={t.stroke}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      <Label x={x + 25} y={mid + 1} size={10.5} weight={650} className={t.ink}>
        {name}
      </Label>
      <rect x={badgeX} y={mid - 7} width={14} height={14} rx={4} className={t.badge} />
      <Label
        x={badgeX + 7}
        y={mid + 0.5}
        anchor="middle"
        size={9}
        weight={700}
        className="fill-white dark:fill-slate-950"
      >
        {String(count)}
      </Label>
      {tabs.map((tab, i) => (
        <TabPill
          key={tab.label}
          x={tabsX + tabs.slice(0, i).reduce((s, t) => s + t.w + 2, 0)}
          y={y}
          w={tab.w}
          label={tab.label}
          active={tab.active}
        />
      ))}
    </g>
  );
}

/** The bottom tab-bar strip: a quiet slate band the tabs stand on. */
export function TabBar({ y, w }: { y: number; w: number }) {
  return (
    <g>
      <rect x={0} y={y} width={w} height={42} className="fill-slate-100" />
      <path d={`M0 ${y} H${w}`} className="stroke-slate-200" strokeWidth={1.5} />
    </g>
  );
}

/** A tile in a dialog grid: an icon well, a label and an optional sub-line. */
export function PickTile({
  x,
  y,
  w = 80,
  h = 64,
  label,
  sub,
  selected = false,
  dashed = false,
  children,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  label: string;
  sub?: string;
  selected?: boolean;
  dashed?: boolean;
  children?: ReactNode;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        className={selected ? 'fill-brand-50 stroke-brand-400' : 'fill-white stroke-slate-200'}
        strokeWidth={1.5}
        strokeDasharray={dashed ? '4 3' : undefined}
      />
      {children && <g transform={`translate(${x + w / 2} ${y + 18})`}>{children}</g>}
      <Label
        x={x + w / 2}
        y={y + 38}
        anchor="middle"
        size={10}
        weight={600}
        tone={selected ? 'accent' : 'strong'}
      >
        {label}
      </Label>
      {sub && (
        <Label x={x + w / 2} y={y + 52} anchor="middle" size={10} tone="muted">
          {sub}
        </Label>
      )}
    </g>
  );
}

/** A format card in the Import / Export dialogs: a small file badge and the format name. */
export function FormatCard({
  x,
  y,
  w = 98,
  title,
  badge,
}: {
  x: number;
  y: number;
  w?: number;
  title: string;
  badge: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={34}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <rect
        x={x + 6}
        y={y + 9}
        width={36}
        height={16}
        rx={2}
        className="fill-none stroke-slate-300"
        strokeWidth={1.2}
      />
      <Label x={x + 24} y={y + 18} anchor="middle" size={10} weight={600} tone="body">
        {badge}
      </Label>
      <Label x={x + 48} y={y + 18} size={11} weight={700} tone="strong">
        {title}
      </Label>
    </g>
  );
}

/** The tab menu's full-width rows, in groups parted by a hairline: one entry per row, `null` for
 *  a separator. `highlight` tints one row as if under the pointer. */
export function MenuRowList({
  x,
  y,
  w,
  rows,
  highlight,
}: {
  x: number;
  y: number;
  w: number;
  rows: (string | null)[];
  highlight?: string;
}) {
  let cy = y;
  const out: ReactNode[] = [];
  rows.forEach((r, i) => {
    if (r === null) {
      out.push(
        <line
          key={`sep-${i}`}
          x1={x}
          y1={cy + 4}
          x2={x + w}
          y2={cy + 4}
          className="stroke-slate-200"
          strokeWidth={1}
        />,
      );
      cy += 8;
      return;
    }
    const on = r === highlight;
    out.push(
      <g key={r}>
        {on ? (
          <rect x={x + 4} y={cy} width={w - 8} height={18} rx={4} className="fill-brand-50" />
        ) : null}
        <rect
          x={x + 12}
          y={cy + 5}
          width={8}
          height={8}
          rx={2}
          className={on ? 'fill-none stroke-brand-500' : 'fill-none stroke-slate-300'}
          strokeWidth={1.2}
        />
        <Label
          x={x + 28}
          y={cy + 9.5}
          size={10}
          weight={on ? 600 : 400}
          tone={on ? 'accent' : 'body'}
        >
          {r}
        </Label>
      </g>,
    );
    cy += 18;
  });
  return <g>{out}</g>;
}
