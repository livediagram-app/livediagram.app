// liveplanner's editor chrome as the help draws it, at about half the real editor's size (a 1280 x 800 window is
// 640 x 400 units here, with labels nudged up to 9 units so they stay legible). Every scene that shows the editor
// builds from these so the frame reads the same everywhere and matches the real one (liveplanner/apps/editor:
// EditorHeader, the board's header row, ChromeControls, the corner cluster, TabBar):
//
// - a Board tab fills the window with one white board card; its header row carries the logo, the menu, the
//   board's name, its card types, the filter box and widgets, then Share and Sign In (BoardHeader);
// - a Sheet, Dashboard or Form tab keeps the floating cards instead: the logo card, the menu card with the tab's
//   name, and the Share / Sign In card top right (TopCards);
// - the corner cluster and the bottom bar live in ./planner-bars.

import type { ReactNode } from 'react';
import { Avatar, Label, Lift } from '@liveworkspace/help-site/art/primitives';
import { Glyph, LogoCube, type GlyphName } from './planner-glyphs';

/** A person in the art: their initial and colour. */
export type Person = { initial: string; colour: 'brand' | 'emerald' | 'violet' | 'amber' | 'rose' };

/** The hairline every chrome card and divider uses. */
export const HAIR = 0.75;

/** Roughly how wide a label is at a size (system-ui averages a little over half an em per character). */
export function textW(s: string, size = 9): number {
  return s.length * size * 0.57;
}

/** A floating chrome card: white, a hairline border and the soft lift. */
export function ChromeCard({
  x,
  y,
  w,
  h,
  r = 7,
  lift = true,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
  lift?: boolean;
  children?: ReactNode;
}) {
  return (
    <g>
      {lift && <Lift x={x} y={y} w={w} h={h} r={r} />}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={r}
        className="fill-white stroke-slate-200"
        strokeWidth={HAIR}
      />
      {children}
    </g>
  );
}

/** A thin vertical divider inside a card. */
export function VDivider({ x, y, h }: { x: number; y: number; h: number }) {
  return <line x1={x} y1={y} x2={x} y2={y + h} className="stroke-slate-200" strokeWidth={HAIR} />;
}

/** The wordmark: the cube, then live in the accent and planner in ink. About 62 wide at size 10. */
export function Wordmark({ x, y, size = 10 }: { x: number; y: number; size?: number }) {
  const k = size / 10;
  return (
    <g>
      <LogoCube x={x + 6 * k} y={y} s={0.95 * k} />
      <text
        x={x + 15 * k}
        y={y}
        fontSize={size}
        fontWeight={700}
        dominantBaseline="middle"
        letterSpacing={-0.2}
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        <tspan className="fill-brand-600">live</tspan>
        <tspan className="fill-slate-800">planner</tspan>
      </text>
    </g>
  );
}

export const TOP_H = 25;
/** The logo card's width. */
export const LOGO_W = 88;

/** The floating cards a Sheet, Dashboard or Form tab keeps: the logo card, then the menu card with the tab's name
 *  (when `tab` is given) at (x, y); returns nothing on the right. Use AccountCard for the top-right card. */
export function TopCards({ x, y, tab }: { x: number; y: number; tab?: string }) {
  const menuW = tab ? 22 + textW(tab, 9.5) + 10 : TOP_H;
  return (
    <g>
      <ChromeCard x={x} y={y} w={LOGO_W} h={TOP_H} />
      <Wordmark x={x + 6} y={y + TOP_H / 2} />
      <ChromeCard x={x + LOGO_W + 5} y={y} w={menuW} h={TOP_H} />
      <Glyph name="menu" x={x + LOGO_W + 5 + (tab ? 12 : TOP_H / 2)} y={y + TOP_H / 2} s={0.85} />
      {tab && (
        <Label
          x={x + LOGO_W + 5 + 23}
          y={y + TOP_H / 2 + 0.5}
          size={9.5}
          weight={500}
          tone="strong"
        >
          {tab}
        </Label>
      )}
    </g>
  );
}

/** Share and Sign In, as a floating card (`card`) or bare in a board's header, their right edge at `right`.
 *  `signedIn` swaps Sign In for the account's avatar; `shared` turns Share solid, as it is once the plan has a live
 *  link. */
export function AccountCard({
  right,
  y,
  card = true,
  signedIn,
  shared = false,
}: {
  right: number;
  y: number;
  card?: boolean;
  signedIn?: Person;
  shared?: boolean;
}) {
  const w = signedIn ? 66 : 98;
  const x = right - w;
  const mid = y + TOP_H / 2;
  return (
    <g>
      {card && <ChromeCard x={x} y={y} w={w} h={TOP_H} />}
      {shared && (
        <rect x={x + 4} y={y + 4} width={42} height={TOP_H - 8} rx={5} className="fill-brand-500" />
      )}
      <g className={shared ? 'help-art-as-drawn' : undefined}>
        <Glyph
          name="share"
          x={x + 12}
          y={mid}
          s={0.85}
          className={shared ? 'stroke-white' : undefined}
        />
        <Label
          x={x + 20}
          y={mid + 0.5}
          size={9}
          weight={500}
          className={shared ? 'fill-white' : 'fill-slate-800'}
        >
          Share
        </Label>
      </g>
      {signedIn ? (
        <Avatar
          cx={right - 12}
          cy={mid}
          r={6.5}
          initial={signedIn.initial}
          colour={signedIn.colour}
        />
      ) : (
        <>
          <Glyph name="signIn" x={x + 58} y={mid} s={0.85} />
          <Label x={x + 66} y={mid + 0.5} size={9} weight={500} tone="strong">
            Sign In
          </Label>
        </>
      )}
    </g>
  );
}

// --- The board window -----------------------------------------------------------------------------------------

export const HEADER_H = 26;

/** A card type button in the board header: its icon in a tinted square, then its name. */
export type HeaderType = { name: string; icon: GlyphName; hue: TypeHue };
export type TypeHue = 'slate' | 'teal' | 'rose' | 'violet' | 'indigo' | 'amber' | 'emerald';

/** The tint, ink and solid fill of a card type's hue, dark-safe (help-art.css retargets only the pale steps). */
export const HUE: Record<TypeHue, { tint: string; ink: string; stroke: string; solid: string }> = {
  slate: {
    tint: 'fill-slate-500/15',
    ink: 'fill-slate-700',
    stroke: 'stroke-slate-600',
    solid: 'fill-slate-600 dark:fill-(--help-art-slate-600)',
  },
  teal: {
    tint: 'fill-teal-500/15',
    ink: 'fill-teal-700 dark:fill-teal-300',
    stroke: 'stroke-teal-600 dark:stroke-teal-300',
    solid: 'fill-teal-600 dark:fill-teal-700',
  },
  rose: {
    tint: 'fill-rose-500/15',
    ink: 'fill-rose-700 dark:fill-rose-300',
    stroke: 'stroke-rose-600 dark:stroke-rose-300',
    solid: 'fill-rose-500 dark:fill-rose-700',
  },
  violet: {
    tint: 'fill-violet-500/15',
    ink: 'fill-violet-700 dark:fill-violet-300',
    stroke: 'stroke-violet-600 dark:stroke-violet-300',
    solid: 'fill-violet-600 dark:fill-violet-700',
  },
  indigo: {
    tint: 'fill-indigo-500/15',
    ink: 'fill-indigo-700 dark:fill-indigo-300',
    stroke: 'stroke-indigo-600 dark:stroke-indigo-300',
    solid: 'fill-indigo-600 dark:fill-indigo-700',
  },
  amber: {
    tint: 'fill-amber-500/15',
    ink: 'fill-amber-700 dark:fill-amber-300',
    stroke: 'stroke-amber-600 dark:stroke-amber-300',
    solid: 'fill-amber-500 dark:fill-amber-700',
  },
  emerald: {
    tint: 'fill-emerald-500/15',
    ink: 'fill-emerald-700 dark:fill-emerald-300',
    stroke: 'stroke-emerald-600 dark:stroke-emerald-300',
    solid: 'fill-emerald-600 dark:fill-emerald-700',
  },
};

/** A small hairline box in the header (a widget, the filter box, the + and pencil buttons). */
export function HeaderBox({
  x,
  y,
  w,
  children,
  dashed = false,
}: {
  x: number;
  y: number;
  w: number;
  children?: ReactNode;
  dashed?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={15}
        rx={4}
        className="fill-white stroke-slate-200"
        strokeWidth={HAIR}
        strokeDasharray={dashed ? '2 1.5' : undefined}
      />
      {children}
    </g>
  );
}

/** The completion widget: a ring, the percent and "done · n/m". completionW(...) wide. */
export function completionW(pct: number, of: string): number {
  return 17 + textW(`${pct}%`, 12) + 3 + textW(`done · ${of}`) + 6;
}

export function CompletionWidget({
  x,
  y,
  pct,
  of,
}: {
  x: number;
  y: number;
  pct: number;
  of: string;
}) {
  const r = 4;
  const c = 2 * Math.PI * r;
  return (
    <HeaderBox x={x} y={y} w={completionW(pct, of)}>
      <circle
        cx={x + 9}
        cy={y + 7.5}
        r={r}
        fill="none"
        className="stroke-slate-200"
        strokeWidth={1.6}
      />
      <circle
        cx={x + 9}
        cy={y + 7.5}
        r={r}
        fill="none"
        className="stroke-emerald-500"
        strokeWidth={1.6}
        strokeDasharray={`${(c * pct) / 100} ${c}`}
        transform={`rotate(-90 ${x + 9} ${y + 7.5})`}
      />
      <Label x={x + 16} y={y + 8} size={9} weight={700} tone="strong">
        {`${pct}%`}
      </Label>
      <Label x={x + 17 + textW(`${pct}%`, 12) + 3} y={y + 8} size={9} tone="body">
        {`done · ${of}`}
      </Label>
    </HeaderBox>
  );
}

/** The filter box: a search glyph, "Filter cards" and, when it is wide enough, "+ Add Filter". */
export function FilterBox({ x, y, w = 96 }: { x: number; y: number; w?: number }) {
  return (
    <HeaderBox x={x} y={y} w={w}>
      <Glyph name="search" x={x + 7} y={y + 7.5} s={0.7} />
      <Label x={x + 13} y={y + 8} size={9} tone="muted">
        Filter cards
      </Label>
      {w >= 120 && (
        <Label x={x + w - 4} y={y + 8} size={9} tone="body" anchor="end">
          + Add Filter
        </Label>
      )}
    </HeaderBox>
  );
}

/** The board's header row inside its window, from x across w: the logo, the menu, the board's name, its card
 *  types, then `widgets` (drawn by the caller, from `widgetsX`), the + and pencil, and Share / Sign In at the
 *  right. Returns where the widgets may start. */
export function BoardHeader({
  x,
  y,
  w,
  title,
  types,
  children,
  account = true,
}: {
  x: number;
  y: number;
  w: number;
  title: string;
  types: HeaderType[];
  /** The widgets, drawn by the caller between the types and Share. */
  children?: ReactNode;
  account?: boolean;
}) {
  const mid = y + HEADER_H / 2;
  const first = x + 106 + textW(title, 10) + 12;
  const lefts = types.map(
    (_, i) => first + types.slice(0, i).reduce((a, t) => a + 14 + textW(t.name) + 10, 0),
  );
  const typeEls = types.map((t, i) => {
    const tx = lefts[i]!;
    const hue = HUE[t.hue];
    return (
      <g key={t.name}>
        <rect x={tx} y={mid - 5.5} width={11} height={11} rx={2.5} className={hue.tint} />
        <Glyph name={t.icon} x={tx + 5.5} y={mid} s={0.75} className={hue.stroke} />
        <Label x={tx + 14} y={mid + 0.5} size={9} weight={500} tone="strong">
          {t.name}
        </Label>
      </g>
    );
  });
  return (
    <g>
      <Wordmark x={x + 6} y={mid} />
      <Glyph name="menu" x={x + 94} y={mid} s={0.85} />
      <Label x={x + 106} y={mid + 0.5} size={10} weight={500} tone="strong">
        {title}
      </Label>
      {typeEls}
      {children}
      {account && <AccountCard right={x + w - 4} y={y} card={false} />}
      <line
        x1={x}
        y1={y + HEADER_H}
        x2={x + w}
        y2={y + HEADER_H}
        className="stroke-slate-200"
        strokeWidth={HAIR}
      />
    </g>
  );
}

/** The x where a board header's widgets may start, for a title and its types. */
export function headerWidgetsX(x: number, title: string, types: HeaderType[]): number {
  return (
    x + 106 + textW(title, 10) + 12 + types.reduce((a, t) => a + 14 + textW(t.name) + 10, 0) + 2
  );
}
