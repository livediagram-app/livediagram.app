// livedesign's editor chrome as the help draws it, at about half the real editor's size (a 1280 x 800 window is
// 640 x 400 units here, with labels nudged up to 9 units so they stay legible). Every scene that shows the editor
// builds from these so the frame reads the same everywhere and matches the real one (apps/live: the Pages rail,
// ToolbarPalette's strip, ChromeControls, the corner controls, TabBar):
//
// - the Pages rail down the left, the logo and menu at its top and the numbered page thumbnails under it;
// - the palette strip across the top: the select mode, Shapes and Write, Concepts and Components, Icons, Media,
//   Data, then the Library and Search buttons;
// - the share and sign-in card top right, the Undo / Redo, Theme and zoom cards bottom right;
// - the bottom bar: the tabs, +, then Tools, Settings, notifications and the appearance switch;
// - the pages on the canvas: a white page with its size chip above its corner.

import type { ReactNode } from 'react';
import { Avatar, Label, Lift } from '@liveworkspace/help-site/art/primitives';
import { Glyph, LogoCube, type GlyphName } from './editor-glyphs';

/** The hairline every chrome card and divider uses. */
export const HAIR = 0.75;

/** A floating chrome card: white, a hairline border and the soft lift. */
export function Card({
  x,
  y,
  w,
  h,
  r = 7,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
  children?: ReactNode;
}) {
  return (
    <g>
      <Lift x={x} y={y} w={w} h={h} r={r} />
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

// --- The palette strip ----------------------------------------------------------------------------------------

/** The strip's categories in order; '|' is a divider between bands. */
export const CATEGORIES: readonly string[] = [
  'Shapes',
  'Write',
  '|',
  'Concepts',
  'Components',
  '|',
  'Icons',
  'Media',
  '|',
  'Data',
];

const ICON: Record<string, GlyphName> = {
  Shapes: 'shapes',
  Write: 'write',
  Concepts: 'concepts',
  Components: 'components',
  Icons: 'icons',
  Media: 'media',
  Data: 'data',
};

/** Roughly how wide a label is at a size (system-ui averages a little over half an em per character). */
export function textW(s: string, size = 9): number {
  return s.length * size * 0.52;
}

const STRIP_H = 25;
const LEAD = 31; // the select-mode pill and its divider
const itemW = (name: string) => Math.round(4 + 10 + 3 + textW(name) + 5);

function stripSlots(x: number) {
  let at = x + LEAD;
  return CATEGORIES.map((name) => {
    const w = name === '|' ? 7 : itemW(name);
    const slot = { name, left: at, w };
    at += w;
    return slot;
  });
}

/** The strip's full width. */
export const STRIP_W = (() => {
  const s = stripSlots(0).at(-1)!;
  return s.left + s.w + 5 + 2 * 20 + 3;
})();

/** Where a category's button sits on a strip drawn at x: its left edge and width. */
export function stripCategory(x: number, name: string): { left: number; w: number } {
  const slot = stripSlots(x).find((s) => s.name === name);
  return slot ? { left: slot.left, w: slot.w } : { left: x, w: 0 };
}

/** The palette strip, top-left at (x, y), STRIP_W wide and 25 tall. `open` presses a category (its flyout showing),
 *  `openTool` names the select mode's flyout as open, `searchOn` presses Search. */
export function Strip({
  x,
  y,
  open,
  searchOn = false,
  libraryOn = false,
  tool,
}: {
  x: number;
  y: number;
  open?: string;
  searchOn?: boolean;
  libraryOn?: boolean;
  /** The current canvas tool's glyph in the select-mode pill (Select's by default). */
  tool?: ReactNode;
}) {
  const slots = stripSlots(x);
  const end = slots.at(-1)!.left + slots.at(-1)!.w;
  const mid = y + STRIP_H / 2;
  return (
    <g>
      <Card x={x} y={y} w={STRIP_W} h={STRIP_H} />
      {/* The select mode: the current tool's glyph and a chevron in a pale accent pill. */}
      <rect
        x={x + 3.5}
        y={y + 3.5}
        width={23}
        height={STRIP_H - 7}
        rx={4}
        className="fill-brand-50"
      />
      {tool ? (
        <g transform={`translate(${x + 11.5} ${mid})`}>{tool}</g>
      ) : (
        <Glyph name="select" x={x + 11.5} y={mid} brand s={0.85} />
      )}
      <path
        d={`M${x + 19} ${mid - 1} l2 2 l2 -2`}
        className="stroke-brand-600"
        strokeWidth={0.9}
        fill="none"
      />
      <VDivider x={x + 29.5} y={y + 6} h={STRIP_H - 12} />
      {slots.map((slot, i) => {
        if (slot.name === '|')
          return <VDivider key={i} x={slot.left + 3.5} y={y + 6} h={STRIP_H - 12} />;
        const on = slot.name === open;
        return (
          <g key={slot.name}>
            {on && (
              <rect
                x={slot.left + 2}
                y={y + 3.5}
                width={slot.w - 4}
                height={STRIP_H - 7}
                rx={4}
                className="fill-brand-50"
              />
            )}
            <Glyph name={ICON[slot.name] ?? 'shapes'} x={slot.left + 9} y={mid} brand={on} />
            <Label
              x={slot.left + 17}
              y={mid + 0.5}
              size={9}
              weight={500}
              className={on ? 'fill-brand-700' : 'fill-slate-700'}
            >
              {slot.name}
            </Label>
          </g>
        );
      })}
      <VDivider x={end + 2.5} y={y + 6} h={STRIP_H - 12} />
      {/* The Library and Search, each an icon in its own pale accent square. */}
      {(
        [
          ['library', end + 7, libraryOn],
          ['search', end + 27, searchOn],
        ] as const
      ).map(([g, bx, on]) => (
        <g key={g}>
          <rect
            x={bx}
            y={y + 3.5}
            width={18}
            height={STRIP_H - 7}
            rx={4}
            className={on ? 'fill-brand-100' : 'fill-brand-50'}
          />
          <Glyph name={g} x={bx + 9} y={mid} brand />
        </g>
      ))}
    </g>
  );
}

// --- Cards around the strip -----------------------------------------------------------------------------------

/** The wordmark: the cube, then live in the accent and design in ink. */
export function Wordmark({ x, y, size = 11 }: { x: number; y: number; size?: number }) {
  return (
    <g>
      <LogoCube x={x + 6} y={y} s={size / 11} />
      <text
        x={x + 15 * (size / 11)}
        y={y}
        fontSize={size}
        fontWeight={700}
        dominantBaseline="middle"
        letterSpacing={-0.2}
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        <tspan className="fill-brand-600">live</tspan>
        <tspan className="fill-slate-800">design</tspan>
      </text>
    </g>
  );
}

/** The logo card and the menu button card, top left, when the Pages rail is closed. 105 wide in all. */
export function LogoCards({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <Card x={x} y={y} w={70} h={STRIP_H} />
      <Wordmark x={x + 6} y={y + STRIP_H / 2} />
      <Card x={x + 75} y={y} w={STRIP_H} h={STRIP_H} />
      <Glyph name="menu" x={x + 75 + STRIP_H / 2} y={y + STRIP_H / 2} />
    </g>
  );
}

/** The share and sign-in card, top right, its right edge at `right`. */
export function AccountCard({ right, y }: { right: number; y: number }) {
  return (
    <g>
      <Card x={right - 48} y={y} w={48} h={STRIP_H} />
      <Glyph name="share" x={right - 36} y={y + STRIP_H / 2} />
      <Glyph name="signIn" x={right - 13} y={y + STRIP_H / 2} />
    </g>
  );
}

/** The corner controls, bottom right, their right edge at `right` and top at y: Undo and Redo, the Theme palette,
 *  then the zoom card (minus, the level, plus). 166 wide. */
export function CornerControls({
  right,
  y,
  level = '100%',
}: {
  right: number;
  y: number;
  level?: string;
}) {
  const x = right - 166;
  const mid = y + 11;
  return (
    <g>
      <Card x={x} y={y} w={45} h={22} r={6} />
      <VDivider x={x + 22.5} y={y + 4} h={14} />
      <Glyph name="undo" x={x + 11} y={mid} />
      <Glyph name="redo" x={x + 34} y={mid} />
      <Card x={x + 50} y={y} w={22} h={22} r={6} />
      <Glyph name="palette" x={x + 61} y={mid} />
      <Card x={x + 77} y={y} w={89} h={22} r={6} />
      <path
        d={`M${x + 87} ${mid} h6`}
        className="stroke-slate-600"
        strokeWidth={1}
        strokeLinecap="round"
      />
      <Label x={x + 121.5} y={mid + 0.5} size={9} weight={500} anchor="middle" tone="strong">
        {level}
      </Label>
      <path
        d={`M${x + 150} ${mid} h6 M${x + 153} ${mid - 3} v6`}
        className="stroke-slate-600"
        strokeWidth={1}
        strokeLinecap="round"
      />
    </g>
  );
}

// --- The bottom bar -------------------------------------------------------------------------------------------

export const BAR_H = 24;

/** The bottom bar across the window: the tabs (the open one a white card standing on the bar), +, then Tools,
 *  Settings, notifications and the appearance switch at the right-hand end. */
export function BottomBar({
  y,
  w,
  tabs = ['Tab 1'],
  active = 0,
  x = 0,
  controls = true,
  presence = [],
}: {
  y: number;
  w: number;
  tabs?: string[];
  active?: number;
  x?: number;
  controls?: boolean;
  /** Who is on the open tab: initials and colour, drawn as a small stack inside its card. */
  presence?: { initial: string; colour: 'brand' | 'emerald' | 'violet' | 'amber' | 'rose' }[];
}) {
  // Each tab's left edge and width, laid end to end from the bar's start.
  const widths = tabs.map((t, i) =>
    Math.round(
      textW(t) + (i === active ? 32 + presence.length * 8 + (presence.length ? 4 : 0) : 16),
    ),
  );
  const lefts = widths.map((_, i) => x + 8 + widths.slice(0, i).reduce((a, w) => a + w + 2, 0));
  const at = x + 8 + widths.reduce((a, w) => a + w + 2, 0);
  const tabEls = tabs.map((t, i) => {
    const tw = widths[i] ?? 0;
    const tx = lefts[i] ?? 0;
    const on = i === active;
    return (
      <g key={t + i}>
        {on && (
          <path
            d={`M${tx} ${y + BAR_H} V${y + 9} a5 5 0 0 1 5 -5 H${tx + tw - 5} a5 5 0 0 1 5 5 V${y + BAR_H}`}
            className="fill-white stroke-slate-200"
            strokeWidth={HAIR}
          />
        )}
        <Label
          x={tx + 8}
          y={y + 14.5}
          size={9}
          weight={on ? 600 : 500}
          className={on ? 'fill-brand-600' : 'fill-slate-600'}
        >
          {t}
        </Label>
        {on &&
          presence.map((p, k) => (
            <Avatar
              key={k}
              cx={tx + textW(t) + 18 + k * 8}
              cy={y + 14.5}
              r={5}
              initial={p.initial}
              colour={p.colour}
            />
          ))}
        {on && <Glyph name="dots" x={tx + tw - 11} y={y + 14.5} brand />}
      </g>
    );
  });
  const r = x + w;
  return (
    <g>
      <rect x={x} y={y} width={w} height={BAR_H} className="fill-slate-100" />
      <line x1={x} y1={y} x2={x + w} y2={y} className="stroke-slate-200" strokeWidth={HAIR} />
      {tabEls}
      <path
        d={`M${at + 9} ${y + 14.5} h7 M${at + 12.5} ${y + 11} v7`}
        className="stroke-slate-500"
        strokeWidth={1}
        strokeLinecap="round"
      />
      {controls && (
        <g>
          <Glyph name="tools" x={r - 150} y={y + 14} s={0.9} />
          <Label x={r - 142} y={y + 14.5} size={9} tone="body">
            Tools
          </Label>
          <Glyph name="settings" x={r - 100} y={y + 14} s={0.9} />
          <Label x={r - 92} y={y + 14.5} size={9} tone="body">
            Settings
          </Label>
          <Glyph name="bell" x={r - 34} y={y + 14} s={0.9} />
          <Glyph name="monitor" x={r - 14} y={y + 14} s={0.9} />
        </g>
      )}
    </g>
  );
}

// --- The Pages rail -------------------------------------------------------------------------------------------

export const RAIL_W = 118;

/** One page in the rail: its number, then the grip, delete and more buttons under it, the thumbnail and its name.
 *  `thumb` draws inside the thumbnail's box (x, y, w, h). */
export type RailPage = {
  name: string;
  thumb?: (box: { x: number; y: number; w: number; h: number }) => ReactNode;
  /** Thumbnail aspect (height / width); A4 portrait by default. */
  aspect?: number;
};

/** The Pages rail down the left of the window, full height down to the bottom bar: the wordmark and the menu button
 *  at its top, then each page, the `active` one tinted with an accent outline, and the settings button at its foot. */
export function PagesRail({
  h,
  pages = [{ name: 'Page 1' }],
  active = 0,
  x = 0,
  y = 0,
  foot = true,
}: {
  h: number;
  pages?: RailPage[];
  active?: number;
  x?: number;
  y?: number;
  /** The settings button at the rail's foot. */
  foot?: boolean;
}) {
  // Each page entry's top, stacked down the rail under the wordmark.
  const heights = pages.map((p) => Math.round(46 * (p.aspect ?? 1.37)) + 22);
  const tops = heights.map((_, i) => y + 42 + heights.slice(0, i).reduce((a, h2) => a + h2 + 4, 0));
  return (
    <g>
      <rect x={x} y={y} width={RAIL_W} height={h} className="fill-white" />
      <line
        x1={x + RAIL_W}
        y1={y}
        x2={x + RAIL_W}
        y2={y + h}
        className="stroke-slate-200"
        strokeWidth={HAIR}
      />
      <Wordmark x={x + 8} y={y + 19} />
      <Glyph name="menu" x={x + 100} y={y + 19} />
      <line
        x1={x + 6}
        y1={y + 37}
        x2={x + RAIL_W - 6}
        y2={y + 37}
        className="stroke-slate-200"
        strokeWidth={HAIR}
      />
      {pages.map((p, i) => {
        const tw = 46;
        const th = Math.round(tw * (p.aspect ?? 1.37));
        const eh = th + 22;
        const top = tops[i] ?? 0;
        if (top + eh > y + h - 30) return null;
        const on = i === active;
        const tx = x + 40;
        const ty = top + 4;
        return (
          <g key={i}>
            {on && (
              <rect
                x={x + 3}
                y={top}
                width={RAIL_W - 6}
                height={eh}
                rx={6}
                className="fill-brand-50"
              />
            )}
            <Label
              x={x + 11}
              y={top + 9}
              size={9}
              weight={600}
              anchor="middle"
              className={on ? 'fill-brand-600' : 'fill-slate-500'}
            >
              {String(i + 1)}
            </Label>
            {on && (
              <>
                <Glyph name="grip" x={x + 11} y={top + 22} s={0.8} />
                <Glyph name="trash" x={x + 11} y={top + 34} s={0.85} />
                <Glyph name="dots" x={x + 11} y={top + 45} s={0.8} />
              </>
            )}
            <rect
              x={tx}
              y={ty}
              width={tw}
              height={th}
              rx={3}
              className={on ? 'fill-white stroke-brand-500' : 'fill-white stroke-slate-200'}
              strokeWidth={on ? 1.1 : HAIR}
            />
            {p.thumb?.({ x: tx, y: ty, w: tw, h: th })}
            <Label x={tx - 18} y={ty + th + 9} size={9} tone="strong">
              {p.name}
            </Label>
          </g>
        );
      })}
      {foot && (
        <>
          <Card x={x + RAIL_W - 28} y={y + h - 27} w={20} h={20} r={5} />
          <Glyph name="cog" x={x + RAIL_W - 18} y={y + h - 17} s={0.9} />
        </>
      )}
    </g>
  );
}

// --- Pages on the canvas --------------------------------------------------------------------------------------

/** A page on the canvas: a white sheet with a soft lift, its size chip above its top-left corner (A4 · Portrait)
 *  and, unless `bare`, the lock and settings chip above its top-right corner. Children draw on the page. */
export function DesignPage({
  x,
  y,
  w,
  h,
  size = 'A4 · Portrait',
  bare = false,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  size?: string;
  bare?: boolean;
  children?: ReactNode;
}) {
  const cw = textW(size, 9) + 12;
  return (
    <g>
      {size && (
        <>
          <Card x={x} y={y - 21} w={cw} h={16} r={5} />
          <Label x={x + 6} y={y - 12.5} size={9} tone="body">
            {size}
          </Label>
        </>
      )}
      {!bare && (
        <>
          <Card x={x + w - 32} y={y - 21} w={32} h={16} r={5} />
          <Glyph name="lock" x={x + w - 24} y={y - 13} s={0.8} />
          <Glyph name="cog" x={x + w - 9} y={y - 13} s={0.8} />
        </>
      )}
      <rect x={x} y={y + 1.5} width={w} height={h} className="fill-slate-900/[0.05]" />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        className="fill-white stroke-slate-200"
        strokeWidth={0.5}
      />
      {children}
    </g>
  );
}

// --- The whole window -----------------------------------------------------------------------------------------

/** The editor window, w x h: the Pages rail (unless `rail` is false, when the logo cards stand top left), the strip,
 *  the account card, the corner controls and the bottom bar. The canvas content is `children`, drawn under the
 *  chrome; `over` draws above it (a flyout, a popover). */
export function EditorFrame({
  w,
  h,
  rail = true,
  pages,
  activePage = 0,
  open,
  searchOn,
  libraryOn,
  level = '100%',
  tabs,
  activeTab,
  account = true,
  corner = true,
  children,
  over,
}: {
  w: number;
  h: number;
  rail?: boolean;
  pages?: RailPage[];
  activePage?: number;
  open?: string;
  searchOn?: boolean;
  libraryOn?: boolean;
  level?: string;
  tabs?: string[];
  activeTab?: number;
  account?: boolean;
  corner?: boolean;
  children?: ReactNode;
  over?: ReactNode;
}) {
  const barY = h - BAR_H;
  const left = rail ? RAIL_W : 0;
  return (
    <g>
      {children}
      {rail ? <PagesRail h={barY} pages={pages} active={activePage} /> : <LogoCards x={6} y={6} />}
      <Strip x={left + 11} y={6} open={open} searchOn={searchOn} libraryOn={libraryOn} />
      {account && <AccountCard right={w - 6} y={6} />}
      {corner && <CornerControls right={w - 6} y={barY - 30} level={level} />}
      <BottomBar y={barY} w={w} tabs={tabs} active={activeTab} />
      {over}
    </g>
  );
}

/** Where the strip starts in an EditorFrame. */
export const stripX = (rail = true) => (rail ? RAIL_W : 0) + 11;
