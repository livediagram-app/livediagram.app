// Illustrations for the Pages articles on Working with Pages and Exporting and Presenting Pages
// (docs/specs/018-help/help-app.md). Each draws the real surface with its real labels: the pages in
// a row with their labels, title-bar buttons, cogs and add buttons (CanvasPages.tsx,
// AddPageButton.tsx), the navigator (PageNavigatorClusterStrip.tsx), the page panel (PagePanel.tsx,
// page-panel-sections.tsx) and the export page picker (ExportPagePicker.tsx). Composed from the
// shared primitives.

import type { ReactNode } from 'react';
import { Scene, Label, TextBar, Tabs } from '@liveworkspace/help-site/art/primitives';
import { BackgroundGlyph, LayoutGlyph, PadlockGlyph, TitleIcon } from './page-title-bar';

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

/** A wireframe page's title-bar buttons as icons alone (the page too small on screen to name
 *  them): Layout, Background and the padlock, left of the cog at `cogX`. */
function PageIcons({ cogX, cy }: { cogX: number; cy: number }) {
  return (
    <g>
      <TitleIcon cx={cogX - 54} cy={cy} Glyph={LayoutGlyph} />
      <TitleIcon cx={cogX - 38} cy={cy} Glyph={BackgroundGlyph} />
      <TitleIcon cx={cogX - 22} cy={cy} Glyph={PadlockGlyph} />
    </g>
  );
}

/** The padlock alone, left of the cog at `cogX`: the one title-bar button every page has. */
function PadlockOnly({ cogX, cy }: { cogX: number; cy: number }) {
  return <TitleIcon cx={cogX - 22} cy={cy} Glyph={PadlockGlyph} />;
}

/** Two pages in a row, a logo and a phone wireframe: each with its label above its top-left corner
 *  and its buttons and cog above its top-right, the + and the any-kind button after the last, and the page navigator in
 *  the bottom-right cluster beside Undo / Redo. */
export function PagesScene() {
  return (
    <Scene w={480} h={250}>
      {/* Page 1: a logo artboard, a mark over its wordmark */}
      <Label x={20} y={38} size={9} weight={600} tone="body">
        1024 x 1024 · Logo
      </Label>
      <PadlockOnly cogX={211} cy={38} />
      <Cog cx={211} cy={38} />
      <Sheet x={20} y={52} w={192} h={192}>
        <circle cx={116} cy={124} r={34} className="fill-brand-500" />
        <path d="M98 136 l18 -30 l18 30 z" className="fill-white" />
        <TextBar x={78} y={176} w={76} h={10} tone="accent" />
        <TextBar x={92} y={194} w={48} tone="faint" />
      </Sheet>
      {/* Page 2: a phone screen, framed as its device */}
      <Label x={244} y={38} size={9} weight={600} tone="body">
        iPhone · Wireframe
      </Label>
      <PageIcons cogX={395} cy={38} />
      <Cog cx={395} cy={38} />
      <rect x={292} y={52} width={96} height={192} rx={16} className="fill-slate-800" />
      <Sheet x={297} y={57} w={86} h={182}>
        <rect x={331} y={61} width={18} height={5} rx={2.5} className="fill-slate-800" />
        <TextBar x={305} y={78} w={52} h={8} tone="accent" />
        <rect x={305} y={94} width={70} height={46} rx={4} className="fill-brand-50" />
        <TextBar x={305} y={150} w={64} />
        <TextBar x={305} y={162} w={48} tone="faint" />
        <rect x={305} y={206} width={70} height={16} rx={8} className="fill-brand-500" />
      </Sheet>
      {/* After the last page: the + adds another screen like it, the button under it a screen of another device */}
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

/** A blank page's panel open beside it (a page whose kind is not chosen yet): the name (Untitled
 *  page, the tab's only page), Portrait and Landscape, and the page actions along the bottom. Its
 *  title bar holds the padlock alone beside the lit cog. */
export function PagePanelScene() {
  const px = 196;
  const pw = 230;
  const ix = px + 10;
  return (
    <Scene w={436} h={266}>
      {/* The page, its cog lit while its panel is open */}
      <Label x={20} y={32} size={10} weight={600} tone="body">
        A4 · Portrait
      </Label>
      <PadlockOnly cogX={161} cy={32} />
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
        height={142}
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
      <SectionTitle x={ix} y={64}>
        Orientation
      </SectionTitle>
      <Tabs
        x={ix}
        y={72}
        items={['Portrait', 'Landscape']}
        active={0}
        tabW={(pw - 20) / 2}
        h={22}
      />
      {/* Page actions: duplicate, move left, move right, delete */}
      <line x1={px} y1={110} x2={px + pw} y2={110} className="stroke-slate-100" strokeWidth={1.2} />
      <g className="stroke-slate-500" fill="none" strokeWidth={1.5} strokeLinecap="round">
        <rect x={ix + 6} y={118} width={9} height={9} rx={2} />
        <rect x={ix + 9} y={121} width={9} height={9} rx={2} />
        <path d={`M${ix + 40} 119 l-4 4.5 l4 4.5`} />
        <path d={`M${ix + 62} 119 l4 4.5 l-4 4.5`} />
      </g>
      <path
        d={`M${ix + 86} 120 h10 M${ix + 88} 120 v8 h6 v-8 M${ix + 89.5} 118 h3`}
        fill="none"
        className="stroke-rose-500"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
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
