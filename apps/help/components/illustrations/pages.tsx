// Pages mode illustrations for the Canvas articles on Pages Mode, Infographic Layouts,
// Exporting and Presenting Pages and Writing Articles (docs/specs/018-help/help-app.md). Each draws
// the real surface with its real labels: the pages in a row with their labels, title-bar buttons,
// cogs and add buttons (CanvasPages.tsx, AddPageButton.tsx), the navigator (PageNavigatorClusterStrip.tsx), the
// page panel (PagePanel.tsx, page-panel-sections.tsx), the Layout button's
// popover's layout gallery (PageLayoutsButton.tsx, layout-gallery/LayoutGallery.tsx), the export page picker (ExportPagePicker.tsx) and the
// article formatting toolbar (article/PageToolbar.tsx). Composed from the shared primitives.

import type { ReactNode } from 'react';
import { Scene, Label, TextBar, Tabs } from './primitives';
import {
  BackgroundGlyph,
  LayoutGlyph,
  PadlockGlyph,
  TidyUpGlyph,
  TitleButton,
  TitleIcon,
  titleButtonWidth,
} from './page-title-bar';

// --- Shared bits -------------------------------------------------------------------------------

/** The page cog: a small round button with a gear. `on` marks the cog whose panel is open. */
function Cog({ cx, cy, on = false }: { cx: number; cy: number; on?: boolean }) {
  const spokes = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle
        r={9}
        className={on ? 'fill-brand-50 stroke-brand-400' : 'fill-white stroke-slate-300'}
        strokeWidth={1.3}
      />
      {spokes.map((a) => (
        <line
          key={a}
          x1={0}
          y1={-3.4}
          x2={0}
          y2={-5.4}
          transform={`rotate(${a})`}
          className={on ? 'stroke-brand-600' : 'stroke-slate-500'}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      ))}
      <circle
        r={2.9}
        fill="none"
        className={on ? 'stroke-brand-600' : 'stroke-slate-500'}
        strokeWidth={1.4}
      />
    </g>
  );
}

/** A sheet of paper on the canvas, with a soft edge. */
function Sheet({
  x,
  y,
  w,
  h,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  children?: ReactNode;
}) {
  return (
    <g>
      <rect x={x + 2} y={y + 3} width={w} height={h} rx={2} className="fill-slate-200" />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={2}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      {children}
    </g>
  );
}

/** A section title, as the page panel prints it. */
/** A page-panel section heading, set in capitals as the panel sets it. */
function SectionTitle({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <Label x={x} y={y} size={9.5} weight={700} tone="muted">
      {children.toUpperCase()}
    </Label>
  );
}

/** A segmented control whose chosen half is filled solid, as the export picker draws it. */
function SolidSegments({
  x,
  y,
  items,
  active,
  segW,
}: {
  x: number;
  y: number;
  items: string[];
  active: number;
  segW: number;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={segW * items.length}
        height={24}
        rx={7}
        className="fill-slate-100 stroke-slate-200"
        strokeWidth={1.2}
      />
      {items.map((it, i) => (
        <g key={it}>
          {i === active && (
            <rect
              x={x + i * segW + 2}
              y={y + 2}
              width={segW - 4}
              height={20}
              rx={5}
              className="fill-brand-500"
            />
          )}
          <Label
            x={x + i * segW + segW / 2}
            y={y + 12.5}
            anchor="middle"
            size={10.5}
            weight={600}
            tone={i === active ? 'onAccent' : 'muted'}
          >
            {it}
          </Label>
        </g>
      ))}
    </g>
  );
}

// --- Pages in a row ----------------------------------------------------------------------------

/** An infographic page's title-bar buttons as icons alone (the page too small on screen to name
 *  them): Layout, Background, Tidy and the padlock, left of the cog at `cogX`. */
function PageIcons({ cogX, cy }: { cogX: number; cy: number }) {
  return (
    <g>
      <TitleIcon cx={cogX - 70} cy={cy} Glyph={LayoutGlyph} />
      <TitleIcon cx={cogX - 54} cy={cy} Glyph={BackgroundGlyph} />
      <TitleIcon cx={cogX - 38} cy={cy} Glyph={TidyUpGlyph} />
      <TitleIcon cx={cogX - 22} cy={cy} Glyph={PadlockGlyph} />
    </g>
  );
}

/** Two pages in a row: each with its label above its top-left corner and its buttons and cog
 *  above its top-right, the + and the any-kind button after the last, and the page navigator in
 *  the bottom-right cluster beside Undo / Redo. */
export function PagesScene() {
  return (
    <Scene w={480} h={250}>
      {/* Page 1: A4 landscape, a title and a small chart */}
      <Label x={20} y={38} size={9} weight={600} tone="body">
        A4 · Landscape
      </Label>
      <PageIcons cogX={211} cy={38} />
      <Cog cx={211} cy={38} />
      <Sheet x={20} y={52} w={200} h={141}>
        <TextBar x={36} y={68} w={110} h={9} tone="accent" />
        <TextBar x={36} y={84} w={78} />
        {[38, 58, 46, 72].map((bh, i) => (
          <rect
            key={i}
            x={40 + i * 24}
            y={178 - bh}
            width={14}
            height={bh}
            rx={2}
            className="fill-brand-400"
          />
        ))}
        <circle cx={176} cy={142} r={22} fill="none" className="stroke-brand-200" strokeWidth={7} />
        <path
          d="M176 120 a22 22 0 0 1 21 28"
          fill="none"
          className="stroke-brand-500"
          strokeWidth={7}
        />
      </Sheet>
      {/* Page 2: a square social post */}
      <Label x={244} y={38} size={9} weight={600} tone="body">
        Square
      </Label>
      <PageIcons cogX={395} cy={38} />
      <Cog cx={395} cy={38} />
      <Sheet x={244} y={52} w={160} h={160}>
        <rect x={244} y={52} width={160} height={160} rx={2} className="fill-brand-50" />
        <Label x={324} y={104} anchor="middle" size={26} weight={800} tone="accent">
          7 in 10
        </Label>
        <TextBar x={281} y={128} w={86} />
        <TextBar x={293} y={142} w={62} tone="faint" />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <circle
            key={i}
            cx={275 + i * 11}
            cy={178}
            r={4}
            className={i < 7 ? 'fill-brand-500' : 'fill-slate-200'}
          />
        ))}
      </Sheet>
      {/* After the last page: the + adds another like it, the button under it any kind */}
      <g>
        <circle
          cx={438}
          cy={122}
          r={14}
          className="fill-white stroke-slate-300"
          strokeWidth={1.3}
        />
        <path
          d="M438 116 v12 M432 122 h12"
          className="stroke-slate-500"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        <circle
          cx={438}
          cy={148}
          r={10}
          className="fill-white stroke-slate-300"
          strokeWidth={1.2}
        />
        <path
          d="M434 144h3v3h-3zM439 144h3v3h-3zM434 149h3v3h-3zM439 149h3v3h-3z"
          className="fill-none stroke-slate-500"
          strokeWidth={1}
        />
      </g>
      {/* The bottom-right cluster: Undo / Redo, then the page navigator */}
      <g>
        <rect
          x={286}
          y={214}
          width={60}
          height={28}
          rx={6}
          className="fill-white stroke-slate-200"
          strokeWidth={1.2}
        />
        <line x1={316} y1={214} x2={316} y2={242} className="stroke-slate-100" strokeWidth={1.2} />
        <path
          d="M297 228 a6 6 0 1 1 3 5 M297 223 v5 h5"
          fill="none"
          className="stroke-slate-500"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <path
          d="M335 228 a6 6 0 1 0 -3 5 M335 223 v5 h-5"
          fill="none"
          className="stroke-slate-300"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <rect
          x={352}
          y={214}
          width={112}
          height={28}
          rx={6}
          className="fill-white stroke-slate-200"
          strokeWidth={1.2}
        />
        <path
          d="M368 223 l-5 5 l5 5"
          fill="none"
          className="stroke-slate-300"
          strokeWidth={1.6}
          strokeLinecap="round"
        />
        <Label x={408} y={228.5} anchor="middle" size={10.5} tone="body">
          1 of 2
        </Label>
        <path
          d="M448 223 l5 5 l-5 5"
          fill="none"
          className="stroke-slate-600"
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </g>
    </Scene>
  );
}

// --- The page panel ----------------------------------------------------------------------------

// An infographic page's six sizes (a slide size is a slide page's alone).
const SIZE_TILES: { label: string; w: number; h: number }[] = [
  { label: 'A4', w: 10, h: 14 },
  { label: 'Letter', w: 11, h: 14 },
  { label: 'A3', w: 10, h: 14 },
  { label: 'Square', w: 13, h: 13 },
  { label: 'Post', w: 11, h: 14 },
  { label: 'Story', w: 8, h: 14 },
];

/** An infographic page's panel open beside it: the name (Untitled page, the tab's only page), the
 *  Size tiles four to a row, Portrait and Landscape, and the page actions along the bottom. Its
 *  one section needs no tabs: the page's layouts and background are on the title bar's buttons,
 *  drawn as icons beside the lit cog. */
export function PagePanelScene() {
  const px = 196;
  const pw = 230;
  const ix = px + 10;
  const cols = 4;
  const gap = 4;
  const tw = (pw - 20 - (cols - 1) * gap) / cols;
  return (
    <Scene w={436} h={266}>
      {/* The page, its cog lit while its panel is open */}
      <Label x={20} y={32} size={10} weight={600} tone="body">
        A4 · Portrait
      </Label>
      <PageIcons cogX={161} cy={32} />
      <Cog cx={161} cy={32} on />
      <Sheet x={20} y={46} w={150} h={212}>
        <TextBar x={36} y={70} w={90} h={9} tone="accent" />
        <TextBar x={36} y={88} w={66} />
        <rect x={36} y={106} width={118} height={136} rx={4} className="fill-brand-50" />
      </Sheet>
      {/* The panel */}
      <rect
        x={px}
        y={10}
        width={pw}
        height={234}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <rect
        x={ix}
        y={20}
        width={pw - 20}
        height={22}
        rx={6}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      <Label x={ix + 8} y={31.5} size={11} tone="muted">
        Untitled page
      </Label>
      <SectionTitle x={ix} y={60}>
        Size
      </SectionTitle>
      {SIZE_TILES.map((t, i) => {
        const tx = ix + (i % cols) * (tw + gap);
        const ty = 68 + Math.floor(i / cols) * 40;
        const on = i === 0;
        return (
          <g key={t.label}>
            <rect
              x={tx}
              y={ty}
              width={tw}
              height={36}
              rx={5}
              className={on ? 'fill-brand-50 stroke-brand-400' : 'fill-white stroke-slate-200'}
              strokeWidth={1.2}
            />
            <rect
              x={tx + tw / 2 - t.w / 2}
              y={ty + 5 + (14 - t.h) / 2}
              width={t.w}
              height={t.h}
              rx={1}
              fill="none"
              className={on ? 'stroke-brand-500' : 'stroke-slate-400'}
              strokeWidth={1.2}
            />
            <Label
              x={tx + tw / 2}
              y={ty + 28}
              anchor="middle"
              size={10}
              weight={on ? 700 : 500}
              tone={on ? 'accent' : 'body'}
            >
              {t.label}
            </Label>
          </g>
        );
      })}
      <SectionTitle x={ix} y={164}>
        Orientation
      </SectionTitle>
      <Tabs
        x={ix}
        y={172}
        items={['Portrait', 'Landscape']}
        active={0}
        tabW={(pw - 20) / 2}
        h={22}
      />
      {/* Page actions: duplicate, move left, move right, delete */}
      <line x1={px} y1={210} x2={px + pw} y2={210} className="stroke-slate-100" strokeWidth={1.2} />
      <g className="stroke-slate-500" fill="none" strokeWidth={1.5} strokeLinecap="round">
        <rect x={ix + 6} y={218} width={9} height={9} rx={2} />
        <rect x={ix + 9} y={221} width={9} height={9} rx={2} />
        <path d={`M${ix + 40} 219 l-4 4.5 l4 4.5`} />
        <path d={`M${ix + 62} 219 l4 4.5 l-4 4.5`} />
      </g>
      <path
        d={`M${ix + 86} 220 h10 M${ix + 88} 220 v8 h6 v-8 M${ix + 89.5} 218 h3`}
        fill="none"
        className="stroke-rose-500"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </Scene>
  );
}

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
  // The title bar from the right: the cog, the padlock, Tidy (its icon alone), then Background
  // and Layout, named, the gaps the title bar's own.
  const tidyCx = right - 18 - 4 - 22 - 4 - 10;
  const bgX = tidyCx - 10 - 4 - titleButtonWidth('Background');
  const layoutX = bgX - 4 - titleButtonWidth('Layout');
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
      <Label x={pageX} y={barY} size={10} weight={600} tone="body">
        A4 · Landscape
      </Label>
      <TitleButton x={layoutX} cy={barY} name="Layout" on Glyph={LayoutGlyph} />
      <TitleButton x={bgX} cy={barY} name="Background" Glyph={BackgroundGlyph} />
      <TitleIcon cx={tidyCx} cy={barY} Glyph={TidyUpGlyph} />
      <PadlockGlyph cx={right - 18 - 4 - 11} cy={barY} />
      <Cog cx={right - 9} cy={barY} />
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

// --- Exporting pages ---------------------------------------------------------------------------

/** The Export dialog's page picker, inside the PDF panel (reached from the format cards, with
 *  the All formats bar to go back): All pages or One page, the page the preview shows, and the
 *  line saying what the download will be, over the preview of that page. */
export function ExportPagePickerScene() {
  return (
    <Scene w={420} h={248} bg="none">
      <rect
        x={16}
        y={12}
        width={388}
        height={224}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={32} y={32} size={13} weight={700} tone="strong">
        Export Tab
      </Label>
      {/* The two-level bar back to the format cards. */}
      <Label x={32} y={56} size={10.5} weight={600} tone="muted">
        ‹ All formats
      </Label>
      <Label x={102} y={56} size={10.5} tone="muted">
        ›
      </Label>
      <Label x={112} y={56} size={10.5} weight={700} tone="strong">
        PDF
      </Label>
      <rect x={32} y={70} width={356} height={90} rx={8} className="fill-slate-50" />
      <SolidSegments x={42} y={80} items={['All pages', 'One page']} active={0} segW={72} />
      <rect
        x={42}
        y={110}
        width={336}
        height={24}
        rx={6}
        className="fill-white stroke-slate-300"
        strokeWidth={1.2}
      />
      <Label x={52} y={122.5} size={10} tone="body">
        Preview: Page 1 · A4 · Portrait
      </Label>
      <path
        d="M362 120 l3.5 3.5 l3.5 -3.5"
        fill="none"
        className="stroke-slate-500"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <Label x={42} y={148} size={10.5} tone="body">
        3 pages, one PDF.
      </Label>
      {/* The preview: exactly the page, nothing around it */}
      <Sheet x={176} y={170} w={44} h={58}>
        <TextBar x={182} y={178} w={26} h={4} tone="accent" />
        <TextBar x={182} y={187} w={20} h={3} />
        <rect x={182} y={196} width={32} height={24} rx={2} className="fill-brand-100" />
      </Sheet>
    </Scene>
  );
}

// --- The article toolbar -----------------------------------------------------------------------

/** An article page with its formatting toolbar along the top, a heading and paragraphs, and a
 *  comment on some words: tinted, with its marker in the margin. */
export function ArticleToolbarScene() {
  return (
    <Scene w={420} h={250}>
      <Sheet x={60} y={16} w={300} h={226}>
        {/* The toolbar, inside the top of the page */}
        <rect
          x={70}
          y={26}
          width={280}
          height={26}
          rx={7}
          className="fill-white stroke-slate-200"
          strokeWidth={1.2}
        />
        <Label x={80} y={39.5} size={10.5} weight={600} tone="body">
          Text
        </Label>
        <path d="M104 37.5 l3 3 l3 -3" fill="none" className="stroke-slate-500" strokeWidth={1.3} />
        <line x1={116} y1={31} x2={116} y2={47} className="stroke-slate-200" strokeWidth={1} />
        <Label x={124} y={39.5} size={12} weight={800} tone="strong">
          B
        </Label>
        <Label
          x={142}
          y={39.5}
          size={12}
          weight={500}
          tone="strong"
          className="fill-slate-800 italic"
        >
          I
        </Label>
        <Label x={156} y={39.5} size={12} weight={500} tone="strong">
          U
        </Label>
        <line x1={156} y1={46} x2={164} y2={46} className="stroke-slate-800" strokeWidth={1.1} />
        <Label x={176} y={38.5} size={12} weight={700} tone="strong">
          A
        </Label>
        <rect x={175} y={45} width={10} height={2.5} rx={1} className="fill-brand-500" />
        {/* Link */}
        <path
          d="M199 41 a3 3 0 0 1 0 -4 l2 -2 a3 3 0 0 1 4 4 l-1 1 M205 37 a3 3 0 0 1 0 4 l-2 2 a3 3 0 0 1 -4 -4 l1 -1"
          fill="none"
          className="stroke-slate-600"
          strokeWidth={1.3}
        />
        {/* Lists */}
        <g className="stroke-slate-600" strokeWidth={1.3} strokeLinecap="round">
          <line x1={220} y1={34} x2={230} y2={34} />
          <line x1={220} y1={39} x2={230} y2={39} />
          <line x1={220} y1={44} x2={230} y2={44} />
          <circle cx={216} cy={34} r={0.8} />
          <circle cx={216} cy={39} r={0.8} />
          <circle cx={216} cy={44} r={0.8} />
          {/* Alignment */}
          <line x1={242} y1={34} x2={254} y2={34} />
          <line x1={242} y1={39} x2={250} y2={39} />
          <line x1={242} y1={44} x2={254} y2={44} />
        </g>
        {/* More formatting */}
        <g className="fill-slate-600">
          <circle cx={264} cy={39} r={1.3} />
          <circle cx={269} cy={39} r={1.3} />
          <circle cx={274} cy={39} r={1.3} />
        </g>
        <line x1={282} y1={31} x2={282} y2={47} className="stroke-slate-200" strokeWidth={1} />
        {/* Insert */}
        <path
          d="M292 34 v10 M287 39 h10"
          className="stroke-slate-600"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        {/* Comment */}
        <path
          d="M306 34 h12 a2 2 0 0 1 2 2 v5 a2 2 0 0 1 -2 2 h-7 l-3 3 v-3 h-2 a2 2 0 0 1 -2 -2 v-5 a2 2 0 0 1 2 -2 Z"
          fill="none"
          className="stroke-slate-600"
          strokeWidth={1.2}
        />
        {/* Assign Action */}
        <circle cx={334} cy={36} r={3} fill="none" className="stroke-slate-600" strokeWidth={1.2} />
        <path
          d="M328 45 a6 5 0 0 1 12 0"
          fill="none"
          className="stroke-slate-600"
          strokeWidth={1.2}
        />
        {/* The writing */}
        <Label x={84} y={74} size={16} weight={800} tone="strong">
          Project brief
        </Label>
        <TextBar x={84} y={92} w={250} />
        <TextBar x={84} y={104} w={232} />
        {/* Commented words: tinted amber */}
        <rect x={84} y={113} width={96} height={10} rx={2} className="fill-amber-100" />
        <TextBar x={86} y={115.5} w={92} tone="muted" />
        <TextBar x={184} y={115.5} w={140} />
        <TextBar x={84} y={128} w={196} />
        <Label x={84} y={152} size={12} weight={700} tone="strong">
          Goals
        </Label>
        <TextBar x={84} y={166} w={240} />
        <TextBar x={84} y={178} w={210} />
        <TextBar x={84} y={190} w={226} />
        <TextBar x={84} y={202} w={150} />
      </Sheet>
      {/* The comment's marker in the margin, beside its words (amber in both appearances) */}
      <g className="help-art-as-drawn" transform="translate(362 104) scale(1.1)">
        <path
          d="M5 4.5h14A2.5 2.5 0 0 1 21.5 7v8a2.5 2.5 0 0 1-2.5 2.5h-8l-4.5 3.5v-3.5H5A2.5 2.5 0 0 1 2.5 15V7A2.5 2.5 0 0 1 5 4.5Z"
          className="fill-amber-500"
        />
        <Label x={12} y={11.4} anchor="middle" size={9.5} weight={700} className="fill-white">
          1
        </Label>
      </g>
    </Scene>
  );
}
