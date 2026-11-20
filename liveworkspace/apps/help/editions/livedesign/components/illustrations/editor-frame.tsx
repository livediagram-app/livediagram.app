// The Pages rail, a page on the canvas and the whole editor window, built from the chrome kit's cards, strip and
// bars (./editor-chrome). See that file's header for the parts and the scale.

import type { ReactNode } from 'react';
import { Label } from '@liveworkspace/help-site/art/primitives';
import { Glyph } from './editor-glyphs';
import {
  HAIR,
  Card,
  textW,
  Strip,
  Wordmark,
  LogoCards,
  AccountCard,
  CornerControls,
  BottomBar,
  BAR_H,
} from './editor-chrome';

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
