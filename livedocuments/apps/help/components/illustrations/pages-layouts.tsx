// The Pages illustration of the Layout button's layout gallery (PageLayoutsButton.tsx,
// layout-gallery/LayoutGallery.tsx; docs/specs/018-help/help-app.md), re-exported from ./pages. Composed
// from the shared primitives.

import type { ReactNode } from 'react';
import { Scene, Label, TextBar } from '@liveworkspace/help-site/art/primitives';
import {
  BackgroundGlyph,
  CogGlyph,
  LayoutGlyph,
  PadlockGlyph,
  PageLabel,
  TidyUpGlyph,
  TitleBarCard,
  titleBarLayout,
  type TitleBarItem,
} from './page-title-bar';
import { Sheet } from './pages-parts';

// --- The Layouts browser -----------------------------------------------------------------------

// The eight infographic categories in the order the browser shows them, with how many each holds
// and the name's width at 10 units semibold (measured), so a card centres its name and count.
const LAYOUT_CATEGORIES: [string, number, number][] = [
  ['Covers', 12, 35],
  ['Posters', 11, 38.5],
  ['Data', 12, 23.5],
  ['Steps and Time', 12, 78],
  ['Compare', 12, 45.5],
  ['People and Ideas', 12, 86],
  ['Social', 12, 30.5],
  ['Explainers', 9, 52.5],
];

// A category card's front tile is a landscape page (the scene's page is A4 landscape).
const THUMB_W = 52;
const THUMB_H = 37;

/** A small landscape layout tile in one of the categories' own looks (a title and lines past the
 *  last). */
function MiniLayout({ x, y, motif }: { x: number; y: number; motif: number }) {
  const W = THUMB_W;
  const H = THUMB_H;
  let body: ReactNode;
  switch (motif) {
    case 0: // Covers: a title over a line beside a picture
      body = (
        <g>
          <TextBar x={x + 5} y={y + 10} w={22} h={4} tone="accent" />
          <TextBar x={x + 5} y={y + 18} w={17} h={2.5} />
          <rect x={x + 5} y={y + 23} width={8} height={1.5} className="fill-brand-500" />
          <rect x={x + 31} y={y + 6} width={16} height={25} rx={1} className="fill-brand-100" />
        </g>
      );
      break;
    case 1: // Posters: a big image over a bold headline
      body = (
        <g>
          <rect x={x + 4} y={y + 4} width={W - 8} height={17} rx={1} className="fill-brand-200" />
          <TextBar x={x + 4} y={y + 24} w={30} h={4} tone="accent" />
          <TextBar x={x + 4} y={y + 31} w={20} h={2.5} />
        </g>
      );
      break;
    case 2: // Data: a title and a bar chart
      body = (
        <g>
          <TextBar x={x + 5} y={y + 5} w={20} h={3.5} tone="accent" />
          {[10, 17, 13, 21, 15].map((bh, i) => (
            <rect
              key={i}
              x={x + 7 + i * 8}
              y={y + 32 - bh}
              width={5}
              height={bh}
              rx={0.8}
              className="fill-brand-400"
            />
          ))}
        </g>
      );
      break;
    case 3: // Steps and Time: discs joined along a line, a note under each
      body = (
        <g>
          <TextBar x={x + 5} y={y + 5} w={20} h={3.5} tone="accent" />
          <line
            x1={x + 9}
            y1={y + 19}
            x2={x + W - 9}
            y2={y + 19}
            className="stroke-brand-300"
            strokeWidth={1}
          />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <circle cx={x + 9 + i * 11.3} cy={y + 19} r={3} className="fill-brand-500" />
              <TextBar x={x + 6 + i * 11.3} y={y + 26} w={7} h={2} />
            </g>
          ))}
        </g>
      );
      break;
    case 4: // Compare: two columns of points under their heads
      body = (
        <g>
          {[0, 1].map((c) => (
            <g key={c}>
              <TextBar x={x + 5 + c * 23} y={y + 6} w={14} h={3.5} tone="accent" />
              {[0, 1, 2].map((r) => (
                <g key={r}>
                  <circle
                    cx={x + 6.5 + c * 23}
                    cy={y + 15 + r * 6}
                    r={1.4}
                    className={c === 0 ? 'fill-emerald-500' : 'fill-rose-500'}
                  />
                  <TextBar x={x + 9.5 + c * 23} y={y + 14 + r * 6} w={11} h={2} />
                </g>
              ))}
            </g>
          ))}
          <line
            x1={x + W / 2}
            y1={y + 5}
            x2={x + W / 2}
            y2={y + 31}
            className="stroke-slate-200"
            strokeWidth={0.8}
          />
        </g>
      );
      break;
    case 5: // People and Ideas: three round photos, a name under each
      body = (
        <g>
          <TextBar x={x + 5} y={y + 5} w={20} h={3.5} tone="accent" />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <circle cx={x + 12 + i * 14} cy={y + 19} r={4.5} className="fill-brand-200" />
              <TextBar x={x + 8 + i * 14} y={y + 27} w={8} h={2} />
            </g>
          ))}
        </g>
      );
      break;
    case 6: // Social: a badge, a big figure and a button
      body = (
        <g>
          <rect x={x + 18} y={y + 5} width={16} height={4} rx={2} className="fill-brand-200" />
          <TextBar x={x + 12} y={y + 13} w={28} h={7} tone="accent" />
          <TextBar x={x + 16} y={y + 23} w={20} h={2} />
          <rect x={x + 19} y={y + 28} width={14} height={4} rx={2} className="fill-brand-500" />
        </g>
      );
      break;
    case 7: // Explainers: a big idea in a hub and the ideas round it
      body = (
        <g>
          {[
            [-15, -9],
            [15, -9],
            [-15, 9],
            [15, 9],
          ].map(([dx, dy], i) => (
            <g key={i}>
              <line
                x1={x + W / 2}
                y1={y + H / 2}
                x2={x + W / 2 + dx!}
                y2={y + H / 2 + dy!}
                className="stroke-brand-300"
                strokeWidth={0.9}
              />
              <circle cx={x + W / 2 + dx!} cy={y + H / 2 + dy!} r={3} className="fill-brand-200" />
            </g>
          ))}
          <circle cx={x + W / 2} cy={y + H / 2} r={6} className="fill-brand-500" />
        </g>
      );
      break;
    default: // A title and a few lines
      body = (
        <g>
          <TextBar x={x + 5} y={y + 6} w={22} h={3.5} tone="accent" />
          <TextBar x={x + 5} y={y + 14} w={36} h={2.5} tone="faint" />
          <TextBar x={x + 5} y={y + 20} w={30} h={2.5} tone="faint" />
          <TextBar x={x + 5} y={y + 26} w={33} h={2.5} tone="faint" />
        </g>
      );
  }
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={W}
        height={H}
        rx={1.5}
        className="fill-white stroke-slate-200"
        strokeWidth={1}
      />
      {body}
    </g>
  );
}

/** An infographic page's title bar with its Layout button pressed, and the Layout popover open
 *  under it on the layout gallery: Layouts, the search beside Surprise Me, the category chips with
 *  All on, and a row of tiles, one under the pointer (ringed, its Use pill). */
export function LayoutGalleryScene() {
  // The page: A4 landscape, its only page, so its label is its size alone.
  const pageX = 20;
  const pageW = 360;
  const right = pageX + pageW;
  const barY = 32;
  // The title bar card from the right: the page (its padlock and cog), then Tidy, then Layout
  // (pressed) and Background, named, at full size.
  const groups: TitleBarItem[][] = [
    [
      { Glyph: LayoutGlyph, name: 'Layout', on: true },
      { Glyph: BackgroundGlyph, name: 'Background' },
    ],
    [{ Glyph: TidyUpGlyph, name: 'Tidy' }],
    [{ Glyph: PadlockGlyph }, { Glyph: CogGlyph }],
  ];
  const layoutX = titleBarLayout(right, groups, 22).items[0]!.x;
  // The popover, left-aligned under the Layout button: the gallery, four tiles across.
  const cols = 4;
  const tw = THUMB_W * 2;
  const th = THUMB_H * 2;
  const gap = 10;
  const pad = 12;
  const popX = layoutX;
  const popY = barY + 16;
  const popW = pad * 2 + cols * tw + (cols - 1) * gap;
  const searchY = popY + 40;
  const chipY = searchY + 30;
  const tileY = chipY + 18;
  const popH = tileY - popY + th + 34 + pad;
  const surpriseW = 86;
  // The chips in one row: All (on), then the first categories; the rest scroll in from the right.
  let chipX = popX + pad;
  const chips = [['All', 92] as [string, number], ...LAYOUT_CATEGORIES.slice(0, 4)].map(
    ([name, count], i) => {
      const w = name.length * 5.6 + (count > 9 ? 30 : 26);
      const chip = { name, count, x: chipX, w, on: i === 0 };
      chipX += w + 6;
      return chip;
    },
  );
  // One from each of the first categories, drawn in its category's look.
  const TILES = ['Title Page', 'Poster', 'Chart Story', 'Timeline'];
  return (
    <Scene w={popX + popW + 12} h={popY + popH + 14}>
      {/* The title bar */}
      <PageLabel x={pageX} y={barY} rest="A4 · Landscape" />
      <TitleBarCard right={right} cy={barY} groups={groups} cell={22} />
      {/* The page, with what is on it now: a layout placed over it replaces it, one Undo back */}
      <Sheet x={pageX} y={barY + 14} w={pageW} h={255}>
        <TextBar x={pageX + 18} y={barY + 34} w={78} h={10} tone="accent" />
        <TextBar x={pageX + 18} y={barY + 54} w={60} />
        <TextBar x={pageX + 18} y={barY + 66} w={70} tone="faint" />
        <TextBar x={pageX + 18} y={barY + 76} w={52} tone="faint" />
      </Sheet>
      {/* The popover, its soft shadow under it */}
      <rect
        x={popX + 2}
        y={popY + 3}
        width={popW}
        height={popH}
        rx={9}
        className="fill-slate-200"
      />
      <rect
        x={popX}
        y={popY}
        width={popW}
        height={popH}
        rx={9}
        className="fill-white stroke-slate-200"
        strokeWidth={1.3}
      />
      <Label x={popX + pad} y={popY + 18} size={11} weight={700} tone="strong">
        Layouts
      </Label>
      {/* The search, and Surprise Me beside it */}
      <rect
        x={popX + pad}
        y={searchY - 10}
        width={popW - pad * 2 - surpriseW - 8}
        height={20}
        rx={6}
        className="fill-white stroke-slate-300"
        strokeWidth={1}
      />
      <Label x={popX + pad + 10} y={searchY} size={9.5} tone="muted">
        Search 92 layouts
      </Label>
      <rect
        x={popX + popW - pad - surpriseW}
        y={searchY - 10}
        width={surpriseW}
        height={20}
        rx={6}
        className="fill-brand-50 stroke-brand-200"
        strokeWidth={1}
      />
      <Label
        x={popX + popW - pad - surpriseW / 2}
        y={searchY}
        anchor="middle"
        size={9.5}
        weight={700}
        tone="accent"
      >
        Surprise Me
      </Label>
      {/* The category chips, All on */}
      {chips.map((c) => (
        <g key={c.name}>
          <rect
            x={c.x}
            y={chipY - 8}
            width={c.w}
            height={16}
            rx={8}
            className={c.on ? 'fill-brand-600' : 'fill-slate-100'}
          />
          <text
            x={c.x + 9}
            y={chipY + 3.2}
            fontSize={9}
            fontWeight={600}
            className={c.on ? 'fill-white' : 'fill-slate-700'}
          >
            {c.name}
            <tspan dx={4} fontWeight={500} className={c.on ? 'fill-white/80' : 'fill-slate-500'}>
              {c.count}
            </tspan>
          </text>
        </g>
      ))}
      {TILES.map((name, i) => {
        const x = popX + pad + i * (tw + gap);
        const hovered = i === 1;
        return (
          <g key={name}>
            <g transform={`translate(${x} ${tileY}) scale(2)`}>
              <MiniLayout x={0} y={0} motif={i} />
            </g>
            {hovered ? (
              <g>
                <rect
                  x={x - 1}
                  y={tileY - 1}
                  width={tw + 2}
                  height={th + 2}
                  rx={4}
                  fill="none"
                  className="stroke-brand-500"
                  strokeWidth={2}
                />
                <rect
                  x={x + tw - 30}
                  y={tileY + th - 18}
                  width={24}
                  height={12}
                  rx={6}
                  className="fill-brand-600"
                />
                <text
                  x={x + tw - 18}
                  y={tileY + th - 9.5}
                  textAnchor="middle"
                  fontSize={7.5}
                  fontWeight={700}
                  className="fill-white"
                >
                  Use
                </text>
              </g>
            ) : null}
            <Label x={x + 2} y={tileY + th + 13} size={9.5} weight={700} tone="strong">
              {name}
            </Label>
            <TextBar x={x + 2} y={tileY + th + 21} w={tw - 20} h={3} tone="faint" />
          </g>
        );
      })}
    </Scene>
  );
}
