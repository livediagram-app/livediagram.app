// Canvas basics illustrations (docs/specs/018-help/help-app.md): the palette strip and dock on the
// canvas, the multi-selection toolbar, the New Project template step, the element menu's
// Font tiles, and the Colours, Text and Canvas panels of the Tab Style dialog.
// Each draws the real surface with its real labels: ToolbarPalette.tsx, CanvasChrome.tsx,
// MultiSelectionToolbar.tsx, TemplatePickerHeader.tsx / TemplatePickerBrowse.tsx,
// TypographySections.tsx, CanvasThemeDialog.tsx, BackBar.tsx, ThemeBrowser.tsx, TextTab.tsx,
// and CanvasStyleControls.tsx. Composed from the shared primitives so
// the house style holds.

import type { ReactNode } from 'react';
import { Scene, Dialog, Label } from '@liveworkspace/help-site/art/primitives';

// --- Shared bits -------------------------------------------------------------------------------

/** A small section caption, as the dialogs print them. */
function Caption({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <Label x={x} y={y} size={10} weight={600} tone="muted">
      {children}
    </Label>
  );
}

/** A selectable option box; `on` fills it as the chosen option. */
function OptionBox({
  x,
  y,
  w,
  h,
  on = false,
  label,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  on?: boolean;
  label?: string;
  children?: ReactNode;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={6}
        className={on ? 'fill-brand-50 stroke-brand-400' : 'fill-white stroke-slate-200'}
        strokeWidth={on ? 1.8 : 1.3}
      />
      {children}
      {label && (
        <Label
          x={x + w / 2}
          y={y + h - 9}
          anchor="middle"
          size={10}
          weight={on ? 700 : 500}
          tone={on ? 'accent' : 'body'}
        >
          {label}
        </Label>
      )}
    </g>
  );
}

/** The shared back bar a Tab Style panel opens under (BackBar.tsx): the chevron well, Tab Style,
 *  and the open panel's name in a chip on the right. */
function TabStyleBackBar({ x, y, w, panel }: { x: number; y: number; w: number; panel: string }) {
  const chipW = panel.length * 6 + 16;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={26}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.3}
      />
      <rect x={x + 7} y={y + 5} width={16} height={16} rx={4} className="fill-slate-100" />
      <path
        d={`M${x + 17} ${y + 9} L${x + 13} ${y + 13} L${x + 17} ${y + 17}`}
        fill="none"
        className="stroke-slate-500"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Label x={x + 30} y={y + 13} size={10} weight={600} tone="body">
        Tab Style
      </Label>
      <rect
        x={x + w - 7 - chipW}
        y={y + 6}
        width={chipW}
        height={14}
        rx={4}
        className="fill-slate-100"
      />
      <Label x={x + w - 7 - chipW / 2} y={y + 13} anchor="middle" size={9} weight={600} tone="body">
        {panel}
      </Label>
    </g>
  );
}

/** A carousel's previous / next arrows, right-aligned to `right`, centred on `y`. */
function PagerArrows({ right, y }: { right: number; y: number }) {
  return (
    <g>
      {[0, 1].map((i) => {
        const bx = right - 36 + i * 20;
        const d =
          i === 0
            ? `M${bx + 9.5} ${y - 3} L${bx + 6.5} ${y} L${bx + 9.5} ${y + 3}`
            : `M${bx + 6.5} ${y - 3} L${bx + 9.5} ${y} L${bx + 6.5} ${y + 3}`;
        return (
          <g key={i}>
            <rect
              x={bx}
              y={y - 7}
              width={16}
              height={14}
              rx={4}
              className="fill-white stroke-slate-200"
              strokeWidth={1.2}
            />
            <path
              d={d}
              fill="none"
              className="stroke-slate-500"
              strokeWidth={1.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      })}
    </g>
  );
}

/** A carousel's page dots, centred on `cx`, the first page current. */
function PageDots({ cx, y, count }: { cx: number; y: number; count: number }) {
  return (
    <g>
      {Array.from({ length: count }, (_, i) => (
        <circle
          key={i}
          cx={cx + (i - (count - 1) / 2) * 10}
          cy={y}
          r={2.5}
          className={i === 0 ? 'fill-brand-500' : 'fill-slate-300'}
        />
      ))}
    </g>
  );
}

/** A carousel heading: the section caption on the left, the pager arrows on the right. */
function CarouselHeading({ y, label }: { y: number; label: string }) {
  return (
    <g>
      <Caption x={60} y={y}>
        {label}
      </Caption>
      <PagerArrows right={360} y={y - 2} />
    </g>
  );
}

/** A Tab Style panel as it opens from Fine-tune: the dialog, then the shared back bar naming
 *  the panel. */
function TabStylePanel({
  panel,
  h,
  sceneH,
  children,
}: {
  panel: 'Colours' | 'Text' | 'Canvas';
  h: number;
  sceneH: number;
  children: ReactNode;
}) {
  return (
    <Scene w={420} h={sceneH} bg="plain">
      <Dialog
        x={40}
        y={12}
        w={340}
        h={h}
        title="Tab Style"
        sceneW={420}
        sceneH={sceneH}
        scrim={false}
      >
        <TabStyleBackBar x={60} y={56} w={300} panel={panel} />
        {children}
      </Dialog>
    </Scene>
  );
}

// --- The canvas and its palette ----------------------------------------------------------------

// --- Selecting many ----------------------------------------------------------------------------

// --- Fonts -------------------------------------------------------------------------------------

// --- Themes ------------------------------------------------------------------------------------

/** One theme card in the Colours panel: a tiny diagram in the theme's colours and its name. */
function ThemeTile({
  x,
  y,
  name,
  bg,
  node,
  line,
  on = false,
}: {
  x: number;
  y: number;
  name: string;
  bg: string;
  node: string;
  line: string;
  on?: boolean;
}) {
  return (
    <OptionBox x={x} y={y} w={96} h={50} on={on} label={name}>
      <g className="help-art-as-drawn">
        <rect x={x + 6} y={y + 5} width={84} height={24} rx={4} className={bg} strokeWidth={1} />
        <rect
          x={x + 14}
          y={y + 11}
          width={22}
          height={12}
          rx={3}
          className={node}
          strokeWidth={1.2}
        />
        <rect
          x={x + 60}
          y={y + 11}
          width={22}
          height={12}
          rx={3}
          className={node}
          strokeWidth={1.2}
        />
        <path d={`M${x + 36} ${y + 17} H${x + 60}`} className={line} strokeWidth={1.2} />
      </g>
    </OptionBox>
  );
}

/** The Colours panel: every theme in one carousel, nine to a page, Default first, then the
 *  catalogue. */
export function LookAndFeelTheme() {
  const themes: [string, string, string, string][] = [
    [
      'Default',
      'fill-white stroke-slate-200',
      'fill-brand-100 stroke-brand-500',
      'stroke-brand-500',
    ],
    ['Pink', 'fill-rose-50 stroke-rose-100', 'fill-rose-200 stroke-rose-500', 'stroke-rose-500'],
    [
      'Forest',
      'fill-emerald-50 stroke-emerald-100',
      'fill-emerald-200 stroke-emerald-700',
      'stroke-emerald-700',
    ],
    [
      'Sunset',
      'fill-orange-50 stroke-orange-100',
      'fill-orange-200 stroke-orange-500',
      'stroke-orange-500',
    ],
    [
      'Lavender',
      'fill-violet-50 stroke-violet-100',
      'fill-violet-200 stroke-violet-500',
      'stroke-violet-500',
    ],
    ['Mono', 'fill-white stroke-slate-200', 'fill-slate-100 stroke-slate-700', 'stroke-slate-700'],
    ['Ocean', 'fill-cyan-50 stroke-cyan-100', 'fill-cyan-200 stroke-cyan-700', 'stroke-cyan-700'],
    ['Sky', 'fill-sky-50 stroke-sky-100', 'fill-sky-200 stroke-sky-600', 'stroke-sky-600'],
    [
      'Midnight',
      'fill-slate-800 stroke-slate-700',
      'fill-slate-700 stroke-indigo-300',
      'stroke-indigo-300',
    ],
  ];
  return (
    <TabStylePanel panel="Colours" h={284} sceneH={308}>
      <CarouselHeading y={98} label="THEMES" />
      {themes.map(([name, bg, node, line], i) => (
        <ThemeTile
          key={name}
          x={60 + (i % 3) * 102}
          y={106 + Math.floor(i / 3) * 56}
          name={name}
          bg={bg}
          node={node}
          line={line}
          on={i === 0}
        />
      ))}
      <PageDots cx={210} y={280} count={3} />
    </TabStylePanel>
  );
}
