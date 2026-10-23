// Canvas basics illustrations (docs/specs/018-help/help-app.md): the palette strip and dock on the
// canvas, the multi-selection toolbar, the New Design template step, the element menu's
// Font tiles, and the Colours, Text and Canvas panels of the Tab Style dialog plus the custom-theme builder.
// Each draws the real surface with its real labels: ToolbarPalette.tsx, CanvasChrome.tsx,
// MultiSelectionToolbar.tsx, TemplatePickerHeader.tsx / TemplatePickerBrowse.tsx,
// TypographySections.tsx, CanvasThemeDialog.tsx, BackBar.tsx, ThemeBrowser.tsx, TextTab.tsx,
// CanvasStyleControls.tsx and CustomThemeBuilder.tsx. Composed from the shared primitives so
// the house style holds.

import type { ReactNode } from 'react';
import {
  Scene,
  Shape,
  Arrow,
  SelectionBox,
  Panel,
  Dialog,
  Label,
  Button,
  Menu,
} from './primitives';
import { MenuCard, Strip } from './toolbar-layout';

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

/** A slider: caption and percentage readout over a track with a knob at `t` (0 to 1). */
function Slider({
  x,
  y,
  w,
  t,
  label,
  readout,
}: {
  x: number;
  y: number;
  w: number;
  t: number;
  label: string;
  readout: string;
}) {
  return (
    <g>
      <Caption x={x} y={y}>
        {label}
      </Caption>
      <Label x={x + w} y={y} anchor="end" size={10} weight={600} tone="body">
        {readout}
      </Label>
      <rect x={x} y={y + 12} width={w} height={4} rx={2} className="fill-slate-200" />
      <rect x={x} y={y + 12} width={w * t} height={4} rx={2} className="fill-brand-400" />
      <circle
        cx={x + w * t}
        cy={y + 14}
        r={6}
        className="fill-white stroke-brand-500"
        strokeWidth={1.8}
      />
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

/** The canvas with the menu button and tab name top-left, the palette strip across the top
 *  (the canvas-tool and category dropdowns, the tiles, More and Search) and the bottom-right
 *  cluster (Undo and Redo, Layers beside the Theme & canvas paintbrush, then the zoom controls). */
export function CanvasPaletteOverview() {
  const ink = { className: 'stroke-slate-500', strokeWidth: 1.4, fill: 'none' } as const;
  return (
    <Scene w={420} h={240}>
      <MenuCard x={8} y={14} />
      <Strip x={78} y={14} />
      <Shape x={60} y={72} w={76} h={42} label="Start" />
      <Shape x={176} y={66} w={60} h={54} kind="diamond" />
      <Shape x={168} y={146} w={76} h={36} accent label="Done" />
      <Arrow from={[136, 93]} to={[176, 93]} />
      <Arrow from={[206, 120]} to={[206, 146]} />
      {/* Bottom-right cluster: Undo and Redo, Layers and the paintbrush, then the zoom controls. */}
      <rect
        x={150}
        y={198}
        width={60}
        height={30}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <line x1={180} y1={204} x2={180} y2={222} className="stroke-slate-200" strokeWidth={1.2} />
      <path d="M170 209 h-8 l3 -3 M162 209 l3 3 M162 209 h5 a4.5 4.5 0 0 1 0 9 h-2" {...ink} />
      <path d="M190 209 h8 l-3 -3 M198 209 l-3 3 M198 209 h-5 a4.5 4.5 0 0 0 0 9 h2" {...ink} />
      <rect
        x={218}
        y={198}
        width={66}
        height={30}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <line x1={251} y1={204} x2={251} y2={222} className="stroke-slate-200" strokeWidth={1.2} />
      <path
        d="M228 211 L235 208 L242 211 L235 214 Z M228 215 L235 218 L242 215"
        {...ink}
        strokeLinejoin="round"
      />
      <path
        d="M260 220 c3 0 4 -2 4 -4 l7 -9 a2 2 0 0 1 3 2 l-8 8 c0 2 -2 3 -6 3 Z"
        className="fill-brand-400 stroke-slate-500"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <rect
        x={292}
        y={198}
        width={114}
        height={30}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={310} y={214} anchor="middle" size={14} weight={700} tone="muted">
        −
      </Label>
      <Label x={349} y={214} anchor="middle" size={11} weight={600} tone="body">
        100%
      </Label>
      <Label x={388} y={214} anchor="middle" size={14} weight={700} tone="muted">
        +
      </Label>
    </Scene>
  );
}

// --- Selecting many ----------------------------------------------------------------------------

/** A multi-selection with its floating toolbar: More, Filter Selection, Duplicate, Export,
 *  Lock and Delete, over the union of the selected elements. */
export function MultiSelectionBar() {
  const bx = 104;
  const by = 46;
  const ink = 'fill-none stroke-slate-500';
  // The toolbar's buttons are icon-only: More, Filter Selection (the funnel), Duplicate,
  // Export, Lock and Delete, in that order.
  const icons: ReactNode[] = [
    <g key="more" className="fill-slate-500">
      <circle cx={-5} cy={0} r={1.6} />
      <circle cx={0} cy={0} r={1.6} />
      <circle cx={5} cy={0} r={1.6} />
    </g>,
    <path
      key="filter"
      d="M-6 -5 H6 L1.5 1 V6 L-1.5 4 V1 Z"
      className={ink}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />,
    <g key="dup" className={ink} strokeWidth={1.5}>
      <rect x={-6} y={-6} width={8} height={8} rx={1.5} />
      <rect x={-2} y={-2} width={8} height={8} rx={1.5} />
    </g>,
    <path
      key="export"
      d="M0 3 V-6 M-3.5 -2.5 L0 -6 L3.5 -2.5 M-6 2 V6 H6 V2"
      className={ink}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />,
    <g key="lock" className={ink} strokeWidth={1.5}>
      <rect x={-5} y={-1} width={10} height={7} rx={1.5} />
      <path d="M-3 -1 V-3.5 a3 3 0 0 1 6 0 V-1" />
    </g>,
    <path
      key="delete"
      d="M-6 -4 H6 M-2 -4 V-6 H2 V-4 M-4.5 -4 L-3.5 6 H3.5 L4.5 -4"
      className={ink}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />,
  ];
  return (
    <Scene w={420} h={220}>
      <Shape x={72} y={120} w={70} h={42} />
      <Shape x={176} y={116} w={70} h={50} kind="circle" />
      <Shape x={282} y={120} w={70} h={42} kind="diamond" />
      <Arrow from={[142, 141]} to={[176, 141]} />
      {[
        [72, 120, 70, 42],
        [176, 116, 70, 50],
        [282, 120, 70, 42],
      ].map(([x, y, w, h], i) => (
        <rect
          key={i}
          x={x! - 3}
          y={y! - 3}
          width={w! + 6}
          height={h! + 6}
          rx={8}
          className="fill-none stroke-brand-500"
          strokeWidth={1.8}
        />
      ))}
      <Panel x={bx} y={by} w={216} h={36}>
        {icons.map((icon, i) => (
          <g key={i} transform={`translate(${bx + 20 + i * 35} ${by + 18})`}>
            {icon}
          </g>
        ))}
        <line
          x1={bx + 72}
          y1={by + 8}
          x2={bx + 72}
          y2={by + 28}
          className="stroke-slate-200"
          strokeWidth={1.5}
        />
      </Panel>
    </Scene>
  );
}

// --- Templates ---------------------------------------------------------------------------------

// --- Fonts -------------------------------------------------------------------------------------

/** A selected shape with its menu's Text flyout open on the Font tiles, one face chosen. */
export function ElementFontMenu() {
  const fonts = ['Inter', 'Poppins', 'Nunito', 'Oswald', 'Lora', 'Caveat'];
  return (
    <Scene w={420} h={230}>
      <Shape x={22} y={92} w={104} h={52} label="Step one" />
      <SelectionBox x={22} y={92} w={104} h={52} />
      <Menu x={142} y={40} w={108} items={['Style', 'Text']} active={1} rowH={24} />
      <Label x={238} y={81} anchor="end" size={11} weight={600} tone="accent">
        ›
      </Label>
      <rect
        x={260}
        y={40}
        width={146}
        height={150}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={272} y={58} size={11} weight={600} tone="strong">
        Font
      </Label>
      {fonts.map((f, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        return (
          <OptionBox key={f} x={270 + col * 66} y={70 + row * 32} w={60} h={26} on={i === 1}>
            <Label
              x={300 + col * 66}
              y={84 + row * 32}
              anchor="middle"
              size={10}
              weight={i === 1 ? 700 : 500}
              tone={i === 1 ? 'accent' : 'body'}
            >
              {f}
            </Label>
          </OptionBox>
        );
      })}
      <line x1={260} y1={172} x2={406} y2={172} className="stroke-slate-100" strokeWidth={1.5} />
      <Label x={272} y={182} size={10} tone="body">
        Size
      </Label>
    </Scene>
  );
}

/** The Text panel: a preview, the typeface cards (a page of nine) and the four sizes of new
 *  text. Picking either applies to the whole tab, so there is no Apply button. */
export function LookAndFeelFont() {
  const faces: [string, string][] = [
    ['Editor default', 'System'],
    ['Inter', 'Sans-serif'],
    ['Poppins', 'Geometric'],
    ['Nunito', 'Rounded'],
    ['Oswald', 'Condensed'],
    ['Space Grotesk', 'Techy sans'],
    ['Lora', 'Serif'],
    ['Abril Fatface', 'Display serif'],
    ['Roboto Slab', 'Slab serif'],
  ];
  const sizes: [string, number | null][] = [
    ['Small', 9],
    ['Medium', 12],
    ['Large', 15],
    ['Scale', null],
  ];
  return (
    <TabStylePanel panel="Text" h={336} sceneH={360}>
      {/* Preview: a small sample diagram lettered in the tab's font. */}
      <g className="help-art-as-drawn">
        <rect
          x={60}
          y={92}
          width={300}
          height={36}
          rx={6}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.2}
        />
        <rect
          x={130}
          y={100}
          width={56}
          height={20}
          rx={4}
          className="fill-brand-100 stroke-brand-500"
          strokeWidth={1.3}
        />
        <rect
          x={234}
          y={100}
          width={56}
          height={20}
          rx={4}
          className="fill-brand-100 stroke-brand-500"
          strokeWidth={1.3}
        />
        <path d="M186 110 H232" className="stroke-brand-500" strokeWidth={1.3} />
        <path
          d="M227 106.5 L232 110 L227 113.5"
          fill="none"
          className="stroke-brand-500"
          strokeWidth={1.3}
        />
      </g>
      <Label x={158} y={110} anchor="middle" size={9} weight={600} tone="strong">
        Idea
      </Label>
      <Label x={262} y={110} anchor="middle" size={9} weight={600} tone="strong">
        Plan
      </Label>
      <CarouselHeading y={144} label="TYPEFACE" />
      {faces.map(([name, kind], i) => {
        const x = 60 + (i % 3) * 102;
        const y = 152 + Math.floor(i / 3) * 38;
        const on = i === 1;
        return (
          <g key={name}>
            <OptionBox x={x} y={y} w={96} h={34} on={on} />
            <Label x={x + 7} y={y + 17} size={13} weight={600} tone={on ? 'accent' : 'strong'}>
              Aa
            </Label>
            <Label x={x + 29} y={y + 12} size={8.5} weight={600} tone={on ? 'accent' : 'strong'}>
              {name}
            </Label>
            <Label x={x + 29} y={y + 24} size={8} tone="muted">
              {kind}
            </Label>
          </g>
        );
      })}
      <PageDots cx={210} y={272} count={2} />
      <Caption x={60} y={288}>
        SIZE OF NEW TEXT
      </Caption>
      {sizes.map(([name, px], i) => {
        const x = 60 + i * 77;
        const on = i === 0;
        return (
          <g key={name}>
            <OptionBox x={x} y={296} w={69} h={38} on={on} label={name} />
            {px ? (
              <Label
                x={x + 34.5}
                y={311}
                anchor="middle"
                size={px}
                weight={700}
                tone={on ? 'accent' : 'body'}
              >
                A
              </Label>
            ) : (
              <path
                d={`M${x + 29} 316 L${x + 40} 305 M${x + 35} 305 H${x + 40} V310 M${x + 29} 311 V316 H${x + 34}`}
                fill="none"
                className="stroke-slate-500"
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </g>
        );
      })}
    </TabStylePanel>
  );
}

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

/** A pattern's look, drawn inside a tile's preview strip (`x`, `y`, 84 by 13). */
function PatternArt({ kind, x, y }: { kind: string; x: number; y: number }) {
  const line = { className: 'stroke-slate-300', strokeWidth: 1, fill: 'none' } as const;
  const cols = Array.from({ length: 9 }, (_, i) => x + 4 + i * 9.5);
  switch (kind) {
    case 'Grid':
      return (
        <g className="fill-slate-400">
          {cols.map((cx) =>
            [y + 3.5, y + 9.5].map((cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.1} />),
          )}
        </g>
      );
    case 'Lines':
      return <path d={`M${x} ${y + 4} H${x + 84} M${x} ${y + 9} H${x + 84}`} {...line} />;
    case 'Graph':
      return (
        <path
          d={`M${x} ${y + 4} H${x + 84} M${x} ${y + 9} H${x + 84} ${cols.map((cx) => `M${cx} ${y} V${y + 13}`).join(' ')}`}
          {...line}
        />
      );
    case 'Crosshatch':
    case 'Diagonal': {
      const starts = Array.from({ length: 7 }, (_, i) => x + i * 12);
      const fwd = starts.map((sx) => `M${sx} ${y + 13} L${sx + 13} ${y}`).join(' ');
      const back = starts.map((sx) => `M${sx} ${y} L${sx + 13} ${y + 13}`).join(' ');
      return <path d={kind === 'Diagonal' ? fwd : `${fwd} ${back}`} {...line} />;
    }
    case 'Confetti': {
      const bits: [number, number, string][] = [
        [6, 3, 'fill-rose-400'],
        [20, 8, 'fill-amber-400'],
        [33, 2, 'fill-emerald-400'],
        [47, 7, 'fill-brand-400'],
        [60, 3, 'fill-violet-400'],
        [73, 8, 'fill-rose-400'],
      ];
      return (
        <g className="help-art-as-drawn">
          {bits.map(([dx, dy, cls]) => (
            <rect key={dx} x={x + dx} y={y + dy} width={4} height={2.5} rx={1} className={cls} />
          ))}
        </g>
      );
    }
    case 'Stripes':
      return (
        <g className="fill-slate-200">
          {Array.from({ length: 7 }, (_, i) => (
            <rect key={i} x={x + 2 + i * 12} y={y} width={5} height={13} />
          ))}
        </g>
      );
    case 'Waves':
    case 'Flow': {
      const wave = (wy: number) => `M${x} ${wy} ${'q7 -3 14 0 '.repeat(6).trim()}`;
      const d = `${wave(y + 4)} ${wave(y + 10)}`;
      return kind === 'Flow' ? (
        <path
          d={d}
          className="stroke-brand-300"
          strokeWidth={1.2}
          fill="none"
          strokeDasharray="5 3"
        />
      ) : (
        <path d={d} {...line} />
      );
    }
    case 'Drift':
      return (
        <g className="fill-brand-300">
          {(
            [
              [8, 4],
              [22, 9],
              [37, 3],
              [50, 8],
              [64, 5],
              [77, 10],
            ] as const
          ).map(([dx, dy]) => (
            <circle key={dx} cx={x + dx} cy={y + dy} r={1.8} />
          ))}
        </g>
      );
    case 'Aurora':
      return (
        <g className="help-art-as-drawn">
          <ellipse
            cx={x + 28}
            cy={y + 6.5}
            rx={26}
            ry={5}
            className="fill-emerald-200"
            opacity={0.8}
          />
          <ellipse
            cx={x + 58}
            cy={y + 6.5}
            rx={24}
            ry={5}
            className="fill-violet-200"
            opacity={0.8}
          />
        </g>
      );
    case 'Ripple':
      return (
        <g className="stroke-brand-300" fill="none" strokeWidth={1}>
          {[10, 22, 36].map((rx) => (
            <ellipse key={rx} cx={x + 42} cy={y + 6.5} rx={rx} ry={rx / 8 + 1} />
          ))}
        </g>
      );
    case 'Ribbons':
      return (
        <g fill="none" strokeWidth={2.4} strokeLinecap="round" className="help-art-as-drawn">
          <path
            d={`M${x + 2} ${y + 9} C${x + 24} ${y - 2} ${x + 50} ${y + 14} ${x + 82} ${y + 3}`}
            className="stroke-brand-200"
          />
          <path
            d={`M${x + 2} ${y + 4} C${x + 30} ${y + 14} ${x + 56} ${y - 1} ${x + 82} ${y + 10}`}
            className="stroke-violet-200"
          />
        </g>
      );
    default:
      return null;
  }
}

/** A pattern tile in a Canvas panel carousel: the pattern drawn for real, then its name. */
function PatternTile({
  x,
  y,
  kind,
  on = false,
}: {
  x: number;
  y: number;
  kind: string;
  on?: boolean;
}) {
  return (
    <OptionBox x={x} y={y} w={96} h={34} on={on} label={kind}>
      <rect
        x={x + 6}
        y={y + 4}
        width={84}
        height={13}
        rx={3}
        className="fill-white stroke-slate-100"
        strokeWidth={1}
      />
      <PatternArt kind={kind} x={x + 6} y={y + 4} />
    </OptionBox>
  );
}

/** The Canvas panel: the Static and Animated pattern carousels (a page of nine each on a wide
 *  screen), the Canvas and Pattern colours, and the Opacity and Size sliders. */
export function LookAndFeelCanvas() {
  const still = [
    'Grid',
    'Blank',
    'Lines',
    'Graph',
    'Crosshatch',
    'Confetti',
    'Stripes',
    'Diagonal',
    'Waves',
  ];
  const animated = ['Flow', 'Drift', 'Aurora', 'Ripple', 'Ribbons'];
  return (
    <TabStylePanel panel="Canvas" h={384} sceneH={408}>
      <CarouselHeading y={98} label="STATIC" />
      {still.map((p, i) => (
        <PatternTile
          key={p}
          x={60 + (i % 3) * 102}
          y={106 + Math.floor(i / 3) * 38}
          kind={p}
          on={i === 0}
        />
      ))}
      <Caption x={60} y={232}>
        ANIMATED
      </Caption>
      {animated.map((p, i) => (
        <PatternTile key={p} x={60 + (i % 3) * 102} y={240 + Math.floor(i / 3) * 38} kind={p} />
      ))}
      <Caption x={60} y={334}>
        COLOURS
      </Caption>
      <rect
        x={60}
        y={346}
        width={18}
        height={18}
        rx={4}
        className="fill-white stroke-slate-300"
        strokeWidth={1.3}
      />
      <Label x={84} y={355} size={10} tone="body">
        Canvas
      </Label>
      <rect x={130} y={346} width={18} height={18} rx={4} className="fill-slate-300" />
      <Label x={154} y={355} size={10} tone="body">
        Pattern
      </Label>
      <Slider x={220} y={334} w={140} t={1} label="Opacity" readout="100%" />
      <Slider x={220} y={364} w={140} t={1 / 3} label="Size" readout="100%" />
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
