// Canvas basics illustrations (docs/specs/018-help/help-app.md): the palette strip and dock on the
// canvas, the multi-selection toolbar, the New Project template step, the element menu's
// Font tiles, and the Colours, Text and Canvas panels of the Tab Style dialog plus the custom-theme builder.
// Each draws the real surface with its real labels: ToolbarPalette.tsx, CanvasChrome.tsx,
// MultiSelectionToolbar.tsx, TemplatePickerHeader.tsx / TemplatePickerBrowse.tsx,
// TypographySections.tsx, CanvasThemeDialog.tsx, BackBar.tsx, ThemeBrowser.tsx, TextTab.tsx,
// CanvasStyleControls.tsx and CustomThemeBuilder.tsx. Composed from the shared primitives so
// the house style holds.

import type { ReactNode } from 'react';
import { Scene, Dialog, Label, Button } from './primitives';

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

/** The Colours panel: every theme in one carousel, nine to a page, Default first (then the
 *  catalogue, then your custom themes and New Theme). */
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

/** The custom-theme builder, opened from the New Theme card at the end of the Colours panel's
 *  theme list: the back bar stays on top, then the live preview, the name, the four base colours, the Pattern section
 *  (open to start with) and the Per-shape colours section stacked beneath it, and Save theme. */
export function CustomThemeBuilderScene() {
  const bases: [string, string][] = [
    ['Background', 'fill-brand-50'],
    ['Fill', 'fill-brand-200'],
    ['Stroke', 'fill-brand-600'],
    ['Text', 'fill-slate-800'],
  ];
  const chevron = { className: 'stroke-slate-400', strokeWidth: 1.4, fill: 'none' } as const;
  return (
    <TabStylePanel panel="Colours" h={378} sceneH={402}>
      <Label x={60} y={98} size={10} weight={600} tone="muted">
        ‹ Back
      </Label>
      <Label x={102} y={98} size={10} weight={700} tone="strong">
        New Theme
      </Label>
      {/* Live preview of the in-progress theme. */}
      <g className="help-art-as-drawn">
        <rect x={60} y={110} width={300} height={40} rx={6} className="fill-brand-50" />
        <rect
          x={110}
          y={120}
          width={52}
          height={20}
          rx={4}
          className="fill-brand-200 stroke-brand-600"
          strokeWidth={1.5}
        />
        <rect
          x={258}
          y={120}
          width={52}
          height={20}
          rx={4}
          className="fill-brand-200 stroke-brand-600"
          strokeWidth={1.5}
        />
        <path d="M162 130 H256" className="stroke-brand-600" strokeWidth={1.5} />
      </g>
      <Caption x={60} y={164}>
        Name
      </Caption>
      <rect
        x={60}
        y={172}
        width={300}
        height={22}
        rx={5}
        className="fill-white stroke-slate-200"
        strokeWidth={1.3}
      />
      <Label x={70} y={183} size={10} tone="muted">
        My theme
      </Label>
      <Caption x={60} y={208}>
        Base colours
      </Caption>
      {bases.map(([name, cls], i) => (
        <g key={name}>
          <rect
            x={60 + i * 77}
            y={216}
            width={69}
            height={40}
            rx={6}
            className="fill-white stroke-slate-200"
            strokeWidth={1.3}
          />
          <g className="help-art-as-drawn">
            <rect
              x={67 + i * 77}
              y={221}
              width={55}
              height={16}
              rx={3}
              className={`${cls} stroke-slate-300`}
              strokeWidth={1}
            />
          </g>
          <Label x={94.5 + i * 77} y={247} anchor="middle" size={10} tone="body">
            {name}
          </Label>
        </g>
      ))}
      {/* Pattern: open to start with, a row of pattern tiles inside. */}
      <line x1={60} y1={266} x2={360} y2={266} className="stroke-slate-100" strokeWidth={1.5} />
      <Label x={60} y={278} size={10} weight={600} tone="body">
        Pattern
      </Label>
      <path d="M350 275 L354 280 L358 275" {...chevron} />
      {Array.from({ length: 6 }, (_, i) => (
        <g key={i}>
          <rect
            x={60 + i * 51}
            y={290}
            width={45}
            height={22}
            rx={4}
            className={i === 0 ? 'fill-brand-50 stroke-brand-400' : 'fill-white stroke-slate-200'}
            strokeWidth={1.3}
          />
          {i === 0 &&
            [0, 1, 2, 3].map((d) => (
              <circle key={d} cx={71 + d * 8} cy={301} r={1.4} className="fill-brand-400" />
            ))}
        </g>
      ))}
      {/* Per-shape colours: an advanced section, closed until opened. */}
      <line x1={60} y1={322} x2={360} y2={322} className="stroke-slate-100" strokeWidth={1.5} />
      <Label x={60} y={334} size={10} weight={600} tone="body">
        Per-shape colours
      </Label>
      <path d="M352 330 L357 334 L352 338" {...chevron} />
      <Button x={208} y={350} w={64} h={24} label="Cancel" />
      <Button x={280} y={350} w={80} h={24} label="Save theme" variant="primary" />
    </TabStylePanel>
  );
}
