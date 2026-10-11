// Illustrate mode illustrations for the Canvas articles on Illustrate Mode, Infographic Layouts,
// Exporting and Presenting Pages and Writing Articles (docs/specs/018-help/help-app.md). Each draws
// the real surface with its real labels: the pages in a row with their labels, cogs, navigator and
// add button (IllustratePages.tsx, PageNavigator.tsx, AddPageButton.tsx), the page panel
// (IllustratePagePanel.tsx, illustrate-page-panel-sections.tsx), the Layouts browser
// (infographic-page-layouts-section.tsx), the export page picker (ExportPagePicker.tsx) and the
// article formatting toolbar (article/PageToolbar.tsx). Composed from the shared primitives.

import type { ReactNode } from 'react';
import { Scene, Label, TextBar, Tabs } from './primitives';

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

/** Two pages in a row: each with its label above its top-left corner and its cog above its
 *  top-right, the page navigator under the first, and the + after the last. */
export function IllustratePagesScene() {
  return (
    <Scene w={480} h={250}>
      {/* Page 1: A4 landscape, a title and a small chart */}
      <Label x={20} y={38} size={9} weight={600} tone="body">
        Page 1 · A4 · Landscape · Infographic
      </Label>
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
      {/* The navigator under each page once there are two or more */}
      <g>
        <rect
          x={78}
          y={208}
          width={84}
          height={24}
          rx={7}
          className="fill-white stroke-slate-200"
          strokeWidth={1.2}
        />
        <path
          d="M92 215 l-5 5 l5 5"
          fill="none"
          className="stroke-slate-300"
          strokeWidth={1.6}
          strokeLinecap="round"
        />
        <Label x={120} y={220.5} anchor="middle" size={10.5} tone="body">
          1 of 2
        </Label>
        <path
          d="M148 215 l5 5 l-5 5"
          fill="none"
          className="stroke-slate-600"
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </g>
      {/* Page 2: a square social post */}
      <Label x={244} y={38} size={9} weight={600} tone="body">
        Page 2 · Square · Infographic
      </Label>
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
      {/* Add page, after the last page */}
      <g>
        <rect
          x={428}
          y={114}
          width={30}
          height={30}
          rx={8}
          className="fill-white stroke-slate-300"
          strokeWidth={1.3}
          strokeDasharray="3 3"
        />
        <path
          d="M443 122 v14 M436 129 h14"
          className="stroke-slate-500"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </g>
    </Scene>
  );
}

// --- The page panel ----------------------------------------------------------------------------

const SIZE_TILES: { label: string; w: number; h: number }[] = [
  { label: 'A4', w: 10, h: 14 },
  { label: 'Letter', w: 11, h: 14 },
  { label: 'A3', w: 10, h: 14 },
  { label: 'Square', w: 13, h: 13 },
  { label: 'Post', w: 11, h: 14 },
  { label: 'Story', w: 8, h: 14 },
  { label: 'Slide', w: 16, h: 9 },
];

/** The page panel open beside its page, on its Page tab: the name, the Page, Background and
 *  Layouts tabs, the Size tiles four to a row (an infographic's seven, Slide last), Portrait and
 *  Landscape, and the page actions along the bottom. The backgrounds have a tab of their own. */
export function PagePanelScene() {
  const px = 196;
  const pw = 230;
  const ix = px + 10;
  const cols = 4;
  const gap = 4;
  const tw = (pw - 20 - (cols - 1) * gap) / cols;
  return (
    <Scene w={436} h={262}>
      {/* The page, its cog lit while its panel is open */}
      <Label x={20} y={50} size={10} weight={600} tone="body">
        Page 2 · A4 · Portrait
      </Label>
      <Cog cx={161} cy={50} on />
      <Sheet x={30} y={64} w={130} h={180}>
        <TextBar x={46} y={84} w={84} h={9} tone="accent" />
        <TextBar x={46} y={102} w={60} />
        <rect x={46} y={120} width={98} height={104} rx={4} className="fill-brand-50" />
      </Sheet>
      {/* The panel */}
      <rect
        x={px}
        y={10}
        width={pw}
        height={244}
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
        Page 2
      </Label>
      <Tabs
        x={ix}
        y={50}
        items={['Page', 'Background', 'Layouts']}
        active={0}
        tabW={(pw - 20) / 3}
        h={22}
      />
      <SectionTitle x={ix} y={88}>
        Size
      </SectionTitle>
      {SIZE_TILES.map((t, i) => {
        const tx = ix + (i % cols) * (tw + gap);
        const ty = 96 + Math.floor(i / cols) * 40;
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
      <SectionTitle x={ix} y={188}>
        Orientation
      </SectionTitle>
      <Tabs
        x={ix}
        y={196}
        items={['Portrait', 'Landscape']}
        active={0}
        tabW={(pw - 20) / 2}
        h={22}
      />
      {/* Page actions: duplicate, move left, move right, delete */}
      <line x1={px} y1={230} x2={px + pw} y2={230} className="stroke-slate-100" strokeWidth={1.2} />
      <g className="stroke-slate-500" fill="none" strokeWidth={1.5} strokeLinecap="round">
        <rect x={ix + 6} y={236} width={9} height={9} rx={2} />
        <rect x={ix + 9} y={239} width={9} height={9} rx={2} />
        <path d={`M${ix + 40} 237 l-4 4.5 l4 4.5`} />
        <path d={`M${ix + 62} 237 l4 4.5 l-4 4.5`} />
      </g>
      <path
        d={`M${ix + 86} 238 h10 M${ix + 88} 238 v8 h6 v-8 M${ix + 89.5} 236 h3`}
        fill="none"
        className="stroke-rose-500"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </Scene>
  );
}

// --- The Layouts browser -----------------------------------------------------------------------

const LAYOUT_CATEGORIES: [string, number][] = [
  ['Covers', 5],
  ['Data', 8],
  ['Steps and Time', 7],
  ['Compare', 4],
  ['People and Ideas', 4],
  ['Social', 3],
];

/** Two small fanned pages fronting a category card. */
function FannedPages({ cx, cy, i }: { cx: number; cy: number; i: number }) {
  return (
    <g>
      <g transform={`rotate(-8 ${cx} ${cy})`}>
        <rect
          x={cx - 22}
          y={cy - 15}
          width={22}
          height={30}
          rx={2}
          className="fill-white stroke-slate-200"
          strokeWidth={1}
        />
        <TextBar x={cx - 18} y={cy - 9} w={12} h={3} tone="faint" />
      </g>
      <g transform={`rotate(6 ${cx} ${cy})`}>
        <rect
          x={cx - 4}
          y={cy - 16}
          width={22}
          height={30}
          rx={2}
          className="fill-white stroke-slate-300"
          strokeWidth={1}
        />
        <TextBar x={cx} y={cy - 10} w={14} h={3} tone="accent" />
        {i % 2 === 0 ? (
          <rect x={cx} y={cy - 3} width={14} height={9} rx={1} className="fill-brand-100" />
        ) : (
          <g>
            <TextBar x={cx} y={cy - 2} w={13} h={2.5} tone="faint" />
            <TextBar x={cx} y={cy + 3} w={10} h={2.5} tone="faint" />
          </g>
        )}
      </g>
    </g>
  );
}

/** An empty infographic page with Start from a layout in its title bar, and the panel's
 *  Layouts tab open on the six categories, each with how many layouts it holds. */
export function LayoutCategoriesScene() {
  const px = 182;
  const pw = 244;
  const ix = px + 10;
  const cw = (pw - 20 - 8) / 2;
  return (
    <Scene w={436} h={272}>
      {/* The empty page and its title bar */}
      <g>
        <rect
          x={20}
          y={34}
          width={124}
          height={22}
          rx={7}
          className="fill-white stroke-slate-300"
          strokeWidth={1.2}
        />
        <rect
          x={28}
          y={41}
          width={8}
          height={8}
          rx={1.5}
          fill="none"
          className="stroke-brand-500"
          strokeWidth={1.3}
        />
        <Label x={41} y={45.5} size={10} weight={600} tone="body">
          Start from a layout
        </Label>
      </g>
      <Cog cx={160} cy={45} on />
      <Sheet x={20} y={62} w={148} h={180} />
      {/* The panel, on its Layouts tab */}
      <rect
        x={px}
        y={10}
        width={pw}
        height={252}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Tabs
        x={ix}
        y={20}
        items={['Page', 'Background', 'Layouts']}
        active={2}
        tabW={(pw - 20) / 3}
        h={22}
      />
      <SectionTitle x={ix} y={58}>
        Start From a Layout
      </SectionTitle>
      {LAYOUT_CATEGORIES.map(([name, count], i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const cx = ix + col * (cw + 8);
        const cy = 68 + row * 64;
        const badgeX = cx + cw - 20;
        return (
          <g key={name}>
            <rect
              x={cx}
              y={cy}
              width={cw}
              height={58}
              rx={7}
              className="fill-slate-50 stroke-slate-200"
              strokeWidth={1}
            />
            <FannedPages cx={cx + cw / 2} cy={cy + 22} i={i} />
            <Label x={cx + 8} y={cy + 49} size={10} weight={600} tone="strong">
              {name}
            </Label>
            <rect x={badgeX} y={cy + 6} width={14} height={13} rx={4} className="fill-slate-200" />
            <Label x={badgeX + 7} y={cy + 13} anchor="middle" size={10} weight={600} tone="body">
              {String(count)}
            </Label>
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
        Export tab
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
        Preview: Page 1 · A4 · Portrait · Infographic
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
