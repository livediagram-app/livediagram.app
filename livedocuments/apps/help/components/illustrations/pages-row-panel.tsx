// The Pages illustrations of the pages in a row and the page panel (docs/specs/018-help/help-app.md),
// re-exported from ./pages: the pages with their title bars (CanvasPages.tsx, PageTitleBar.tsx) and the
// page panel (PagePanel.tsx, page-panel-sections.tsx). Composed from the shared primitives.

import { Scene, Label, TextBar, Tabs } from '@liveworkspace/help-site/art/primitives';
import {
  BackgroundGlyph,
  CogGlyph,
  LayoutGlyph,
  PadlockGlyph,
  PageLabel,
  TidyUpGlyph,
  TitleBarCard,
} from './page-title-bar';
import { Sheet, SectionTitle } from './pages-parts';

// --- Pages in a row ----------------------------------------------------------------------------

/** An infographic page's title bar, its controls as icons alone (the page too small on screen to name
 *  them), on its one card: Layout and Background, then Tidy (when the page has something to tidy),
 *  then the padlock and the cog, its right edge at the page's. */
function PageBar({
  right,
  cy,
  tidy = true,
  cogOn = false,
}: {
  right: number;
  cy: number;
  tidy?: boolean;
  cogOn?: boolean;
}) {
  return (
    <TitleBarCard
      right={right}
      cy={cy}
      groups={[
        [{ Glyph: LayoutGlyph }, { Glyph: BackgroundGlyph }],
        tidy ? [{ Glyph: TidyUpGlyph }] : [],
        [{ Glyph: PadlockGlyph }, { Glyph: CogGlyph, on: cogOn }],
      ]}
    />
  );
}

/** Two pages in a row: each with its label above its top-left corner and its buttons and cog
 *  above its top-right, the + and the any-kind button after the last, and the page navigator in
 *  the bottom-right cluster beside Undo / Redo. */
export function PagesScene() {
  return (
    <Scene w={480} h={250}>
      {/* Page 1: A4 landscape, a title and a small chart */}
      <PageLabel x={20} y={38} size={9} rest="A4 · Landscape" />
      <PageBar right={220} cy={38} />
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
      <PageLabel x={244} y={38} size={9} rest="Square" />
      <PageBar right={404} cy={38} />
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
      {/* After the last page: the + adds another like it */}
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
      <PageLabel x={20} y={32} rest="A4 · Portrait" />
      <PageBar right={170} cy={32} tidy={false} cogOn />
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
