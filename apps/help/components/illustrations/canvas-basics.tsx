// Canvas basics illustrations (docs/specs/018-help/help-app.md): the palette and dock on the
// canvas, the multi-selection toolbar, the New Document template step, the element menu's
// Font tiles, and the three tabs of the Tab Look & Feel dialog plus the custom-theme builder.
// Each draws the real surface with its real labels: CommandPalette.tsx, CanvasChrome.tsx,
// MultiSelectionToolbar.tsx, TemplatePickerHeader.tsx / TemplatePickerBrowse.tsx,
// TypographySections.tsx, CanvasThemeDialog.tsx, ThemeCategoryBrowser.tsx,
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
  Tabs,
  Tile,
  Label,
  Button,
  Menu,
} from './primitives';

// --- Shared bits -------------------------------------------------------------------------------

/** A small section caption, as the dialogs print them. */
function Caption({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <Label x={x} y={y} size={10} weight={600} tone="muted">
      {children}
    </Label>
  );
}

/** A small chevron pointing down, for dropdown chips. */
function Chevron({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x - 3} ${y - 1.5} L${x} ${y + 1.5} L${x + 3} ${y - 1.5}`}
      fill="none"
      className="stroke-slate-400"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** A dropdown chip: a label and a chevron in a bordered pill. */
function DropdownChip({ x, y, w, label }: { x: number; y: number; w: number; label: string }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={22}
        rx={6}
        className="fill-white stroke-slate-200"
        strokeWidth={1.3}
      />
      <Label x={x + 8} y={y + 12} size={10} weight={600} tone="body">
        {label}
      </Label>
      <Chevron x={x + w - 10} y={y + 11} />
    </g>
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

/** The Tab Look & Feel dialog's shell: title plus the Theme / Canvas / Font tab strip. */
function LookAndFeelShell({
  active,
  h,
  sceneH,
  children,
}: {
  active: 0 | 1 | 2;
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
        title="Tab Look & Feel"
        sceneW={420}
        sceneH={sceneH}
        scrim={false}
      >
        <Tabs x={60} y={56} items={['Theme', 'Canvas', 'Font']} active={active} tabW={100} />
        {children}
      </Dialog>
    </Scene>
  );
}

// --- The canvas and its palette ----------------------------------------------------------------

/** The canvas with the floating Palette in its top-right home (title, mode switch, the
 *  canvas-tool and category dropdowns, a grid of tiles) and the bottom-right dock (the
 *  Theme & canvas paintbrush beside the zoom controls). */
export function CanvasPaletteOverview() {
  const tiles = [0, 1, 2, 3, 4, 5, 6, 7];
  return (
    <Scene w={420} h={240}>
      <Shape x={24} y={70} w={76} h={42} label="Start" />
      <Shape x={140} y={64} w={60} h={54} kind="diamond" />
      <Shape x={132} y={162} w={76} h={40} accent label="Done" />
      <Arrow from={[100, 91]} to={[140, 91]} />
      <Arrow from={[170, 118]} to={[170, 162]} />
      <Panel x={246} y={14} w={160} h={150} title="Palette">
        <rect
          x={334}
          y={17}
          width={64}
          height={16}
          rx={5}
          className="fill-white stroke-slate-200"
          strokeWidth={1}
        />
        <Label x={366} y={25.5} anchor="middle" size={10} weight={600} tone="accent">
          Diagram
        </Label>
        <DropdownChip x={254} y={42} w={66} label="Select" />
        <DropdownChip x={326} y={42} w={72} label="Popular" />
        {tiles.map((i) => {
          const col = i % 4;
          const row = Math.floor(i / 4);
          return (
            <Tile key={i} x={258 + col * 36} y={76 + row * 38} size={28} active={i === 0}>
              {i === 0 ? (
                <rect
                  x={-7}
                  y={-6}
                  width={14}
                  height={12}
                  rx={2}
                  className="stroke-white"
                  strokeWidth={2}
                  fill="none"
                />
              ) : i % 3 === 1 ? (
                <circle r={6} className="stroke-brand-500" strokeWidth={2} fill="none" />
              ) : i % 3 === 2 ? (
                <path
                  d="M0 -7 L7 0 L0 7 L-7 0 Z"
                  className="stroke-brand-500"
                  strokeWidth={2}
                  fill="none"
                />
              ) : (
                <path d="M-6 6 L6 -6" className="stroke-brand-500" strokeWidth={2} />
              )}
            </Tile>
          );
        })}
      </Panel>
      {/* Bottom-right dock: the paintbrush, then the zoom controls. */}
      <rect
        x={262}
        y={198}
        width={30}
        height={30}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <path
        d="M272 220 c3 0 4 -2 4 -4 l7 -9 a2 2 0 0 1 3 2 l-8 8 c0 2 -2 3 -6 3 Z"
        className="fill-brand-400 stroke-slate-500"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <rect
        x={298}
        y={198}
        width={108}
        height={30}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={316} y={214} anchor="middle" size={14} weight={700} tone="muted">
        −
      </Label>
      <Label x={352} y={214} anchor="middle" size={11} weight={600} tone="body">
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

/** The New Document wizard's template step: the mode filter beside the search box, the
 *  Popular shelf with a mode glyph before each title, and Next. */
export function NewDocumentTemplates() {
  const cards: { title: string; mode: 'diagram' | 'draw'; on?: boolean }[] = [
    { title: 'Blank Diagram', mode: 'diagram', on: true },
    { title: 'Mind map', mode: 'diagram' },
    { title: 'Sketchnote', mode: 'draw' },
  ];
  return (
    <Scene w={420} h={250} bg="plain">
      <Dialog
        x={20}
        y={10}
        w={380}
        h={232}
        title="New Document"
        sceneW={420}
        sceneH={250}
        scrim={false}
      >
        <DropdownChip x={36} y={56} w={100} label="Everything" />
        <rect
          x={144}
          y={56}
          width={240}
          height={22}
          rx={6}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.3}
        />
        <Label x={156} y={68} size={10} tone="muted">
          Search templates...
        </Label>
        <Label x={36} y={100} size={12} weight={700} tone="strong">
          Popular
        </Label>
        {cards.map((c, i) => {
          const x = 36 + i * 118;
          const y = 112;
          return (
            <g key={c.title}>
              <rect
                x={x}
                y={y}
                width={110}
                height={82}
                rx={8}
                className={c.on ? 'fill-brand-50 stroke-brand-400' : 'fill-white stroke-slate-200'}
                strokeWidth={c.on ? 2 : 1.5}
              />
              <rect x={x + 8} y={y + 8} width={94} height={46} rx={5} className="fill-slate-50" />
              {c.mode === 'diagram' ? (
                <g>
                  <rect
                    x={x + 26}
                    y={y + 22}
                    width={24}
                    height={16}
                    rx={3}
                    className="fill-brand-200"
                  />
                  <rect
                    x={x + 62}
                    y={y + 22}
                    width={24}
                    height={16}
                    rx={3}
                    className="fill-brand-400"
                  />
                  <path
                    d={`M${x + 50} ${y + 30} H${x + 62}`}
                    className="stroke-slate-300"
                    strokeWidth={2}
                  />
                </g>
              ) : (
                <path
                  d={`M${x + 22} ${y + 36} c8 -14 16 10 24 -2 s14 -12 22 2 s10 8 18 -4`}
                  fill="none"
                  className="stroke-slate-500"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              )}
              {/* The mode glyph before the title. */}
              {c.mode === 'diagram' ? (
                <rect
                  x={x + 9}
                  y={y + 63}
                  width={9}
                  height={9}
                  rx={2}
                  className="fill-none stroke-slate-400"
                  strokeWidth={1.5}
                />
              ) : (
                <path
                  d={`M${x + 9} ${y + 70} q3 -6 6 0 t5 -2`}
                  fill="none"
                  className="stroke-slate-400"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
              )}
              <Label x={x + 24} y={y + 68} size={10} weight={600} tone="strong">
                {c.title}
              </Label>
            </g>
          );
        })}
        <Button x={316} y={206} w={68} label="Next" variant="primary" />
      </Dialog>
    </Scene>
  );
}

// --- Fonts -------------------------------------------------------------------------------------

/** A selected shape with its menu's Text flyout open on the Font tiles, one face chosen. */
export function ElementFontMenu() {
  const fonts = ['Inter', 'Poppins', 'Nunito', 'Oswald', 'Lora', 'Caveat'];
  return (
    <Scene w={420} h={230}>
      <Shape x={22} y={92} w={104} h={52} label="Step one" />
      <SelectionBox x={22} y={92} w={104} h={52} />
      <Menu
        x={142}
        y={40}
        w={108}
        items={['Colours', 'Border', 'Style', 'Text']}
        active={3}
        rowH={24}
      />
      <Label x={238} y={129} anchor="end" size={11} weight={600} tone="accent">
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

/** The Font tab: the Tab font grid, the default size for new elements, and Apply to all
 *  elements. */
export function LookAndFeelFont() {
  const fonts = ['Default', 'Inter', 'Poppins', 'Nunito', 'Oswald', 'Space Grotesk'];
  const sizes = ['Scale', 'Small', 'Medium', 'Large'];
  return (
    <LookAndFeelShell active={2} h={240} sceneH={264}>
      <Caption x={60} y={96}>
        TAB FONT
      </Caption>
      {fonts.map((f, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        return (
          <OptionBox key={f} x={60 + col * 102} y={106 + row * 30} w={96} h={24} on={i === 1}>
            <Label
              x={108 + col * 102}
              y={119 + row * 30}
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
      <Caption x={60} y={180}>
        DEFAULT SIZE FOR NEW ELEMENTS
      </Caption>
      {sizes.map((s, i) => (
        <OptionBox key={s} x={60 + i * 76} y={190} w={70} h={22} on={i === 1}>
          <Label
            x={95 + i * 76}
            y={202}
            anchor="middle"
            size={10}
            weight={i === 1 ? 700 : 500}
            tone={i === 1 ? 'accent' : 'body'}
          >
            {s}
          </Label>
        </OptionBox>
      ))}
      <Button x={60} y={222} w={140} h={22} label="Apply to all elements" />
    </LookAndFeelShell>
  );
}

// --- Themes ------------------------------------------------------------------------------------

/** One category card on the Theme tab's overview: a mini preview and the category's name. */
function ThemeCategoryCard({
  x,
  y,
  label,
  on = false,
  children,
}: {
  x: number;
  y: number;
  label: string;
  on?: boolean;
  children: ReactNode;
}) {
  return (
    <OptionBox x={x} y={y} w={72} h={60} on={on} label={label}>
      <g className="help-art-as-drawn">{children}</g>
    </OptionBox>
  );
}

/** Three little nodes for a card preview, each in its own fill class. */
function MiniNodes({ x, y, fills }: { x: number; y: number; fills: [string, string, string] }) {
  return (
    <g>
      <rect x={x} y={y} width={56} height={30} rx={4} className={fills[0]} />
      <rect x={x + 6} y={y + 6} width={18} height={9} rx={2} className={fills[1]} />
      <rect x={x + 32} y={y + 15} width={18} height={9} rx={2} className={fills[2]} />
    </g>
  );
}

/** The Theme tab's overview: Default, a card per category and Custom, with Reset elements
 *  to theme beneath. */
export function LookAndFeelTheme() {
  const row1: [string, [string, string, string]][] = [
    ['Default', ['fill-white stroke-slate-200', 'fill-brand-100', 'fill-brand-300']],
    ['Formal', ['fill-white stroke-slate-200', 'fill-amber-400', 'fill-violet-400']],
    ['Cool', ['fill-brand-50', 'fill-brand-300', 'fill-teal-400']],
    ['Warm', ['fill-amber-50', 'fill-rose-400', 'fill-amber-400']],
  ];
  const row2: [string, [string, string, string]][] = [
    ['Dark', ['fill-slate-800', 'fill-slate-500', 'fill-teal-400']],
    ['Multi-colour', ['fill-white stroke-slate-200', 'fill-rose-400', 'fill-emerald-400']],
  ];
  return (
    <LookAndFeelShell active={0} h={234} sceneH={258}>
      {row1.map(([label, fills], i) => (
        <ThemeCategoryCard key={label} x={60 + i * 76} y={92} label={label} on={i === 0}>
          <MiniNodes x={68 + i * 76} y={98} fills={fills} />
        </ThemeCategoryCard>
      ))}
      {row2.map(([label, fills], i) => (
        <ThemeCategoryCard key={label} x={60 + i * 76} y={158} label={label}>
          <MiniNodes x={68 + i * 76} y={164} fills={fills} />
        </ThemeCategoryCard>
      ))}
      {/* Custom: your saved themes, plus build your own. */}
      <OptionBox x={212} y={158} w={72} h={60} label="Custom">
        <rect
          x={220}
          y={164}
          width={56}
          height={30}
          rx={4}
          className="fill-none stroke-slate-300"
          strokeWidth={1.3}
          strokeDasharray="4 3"
        />
        <Label x={248} y={180} anchor="middle" size={14} weight={600} tone="muted">
          +
        </Label>
      </OptionBox>
      <Button x={60} y={222} w={156} h={20} label="Reset elements to theme" />
    </LookAndFeelShell>
  );
}

/** The Canvas tab: the Pattern grid, the Canvas and Pattern colours, and the Opacity and
 *  Size sliders. */
export function LookAndFeelCanvas() {
  const patterns: { label: string; art: ReactNode }[] = [
    {
      label: 'Grid',
      art: (
        <g className="fill-slate-400">
          {[0, 1, 2].map((r) =>
            [0, 1, 2, 3].map((c) => <circle key={`${r}${c}`} cx={c * 8} cy={r * 7} r={1.3} />),
          )}
        </g>
      ),
    },
    { label: 'Blank', art: null },
    {
      label: 'Lines',
      art: (
        <path d="M-2 0 H26 M-2 7 H26 M-2 14 H26" className="stroke-slate-400" strokeWidth={1.2} />
      ),
    },
    {
      label: 'Graph',
      art: (
        <path
          d="M-2 0 H26 M-2 7 H26 M-2 14 H26 M0 -3 V17 M8 -3 V17 M16 -3 V17 M24 -3 V17"
          className="stroke-slate-300"
          strokeWidth={1}
        />
      ),
    },
    {
      label: 'Cross',
      art: (
        <path
          d="M-2 -2 L14 16 M8 -2 L24 16 M-2 8 L8 -2 M-2 18 L18 -2 M8 18 L26 0"
          className="stroke-slate-300"
          strokeWidth={1}
        />
      ),
    },
  ];
  return (
    <LookAndFeelShell active={1} h={220} sceneH={244}>
      <Caption x={60} y={96}>
        Pattern
      </Caption>
      {patterns.map((p, i) => (
        <OptionBox key={p.label} x={60 + i * 60} y={106} w={54} h={46} on={i === 0} label={p.label}>
          <g transform={`translate(${75 + i * 60} 114)`}>{p.art}</g>
        </OptionBox>
      ))}
      <Caption x={60} y={170}>
        Colours
      </Caption>
      <rect
        x={60}
        y={180}
        width={18}
        height={18}
        rx={4}
        className="fill-white stroke-slate-300"
        strokeWidth={1.3}
      />
      <Label x={84} y={190} size={10} tone="body">
        Canvas
      </Label>
      <rect x={130} y={180} width={18} height={18} rx={4} className="fill-slate-300" />
      <Label x={154} y={190} size={10} tone="body">
        Pattern
      </Label>
      <Slider x={220} y={170} w={140} t={1} label="Opacity" readout="100%" />
      <Slider x={220} y={204} w={140} t={1 / 3} label="Size" readout="100%" />
    </LookAndFeelShell>
  );
}

/** The custom-theme builder, opened from New theme in the Custom category: the live
 *  preview, the name, the four base colours, the Pattern and Per-shape colours sections,
 *  and Save theme. */
export function CustomThemeBuilderScene() {
  const bases: [string, string][] = [
    ['Background', 'fill-brand-50'],
    ['Fill', 'fill-brand-200'],
    ['Stroke', 'fill-brand-600'],
    ['Text', 'fill-slate-800'],
  ];
  return (
    <Scene w={420} h={300} bg="plain">
      <Dialog
        x={50}
        y={10}
        w={320}
        h={282}
        title="Tab Look & Feel"
        sceneW={420}
        sceneH={300}
        scrim={false}
      >
        <Label x={66} y={60} size={10} weight={600} tone="muted">
          ‹ Back
        </Label>
        <Label x={108} y={60} size={10} weight={700} tone="strong">
          New theme
        </Label>
        {/* Live preview of the in-progress theme. */}
        <g className="help-art-as-drawn">
          <rect x={66} y={72} width={288} height={40} rx={6} className="fill-brand-50" />
          <rect
            x={100}
            y={82}
            width={52}
            height={20}
            rx={4}
            className="fill-brand-200 stroke-brand-600"
            strokeWidth={1.5}
          />
          <rect
            x={196}
            y={82}
            width={52}
            height={20}
            rx={4}
            className="fill-brand-200 stroke-brand-600"
            strokeWidth={1.5}
          />
          <path d="M152 92 H194" className="stroke-brand-600" strokeWidth={1.5} />
        </g>
        <Caption x={66} y={126}>
          Name
        </Caption>
        <rect
          x={66}
          y={134}
          width={288}
          height={22}
          rx={5}
          className="fill-white stroke-slate-200"
          strokeWidth={1.3}
        />
        <Label x={76} y={145} size={10} tone="muted">
          My theme
        </Label>
        <Caption x={66} y={170}>
          Base colours
        </Caption>
        {bases.map(([name, cls], i) => (
          <g key={name}>
            <rect
              x={66 + i * 74}
              y={178}
              width={66}
              height={40}
              rx={6}
              className="fill-white stroke-slate-200"
              strokeWidth={1.3}
            />
            <g className="help-art-as-drawn">
              <rect
                x={72 + i * 74}
                y={183}
                width={54}
                height={16}
                rx={3}
                className={`${cls} stroke-slate-300`}
                strokeWidth={1}
              />
            </g>
            <Label x={99 + i * 74} y={209} anchor="middle" size={10} tone="body">
              {name}
            </Label>
          </g>
        ))}
        <line x1={66} y1={228} x2={354} y2={228} className="stroke-slate-100" strokeWidth={1.5} />
        <Label x={66} y={238} size={10} weight={600} tone="body">
          Pattern
        </Label>
        <Label x={190} y={238} size={10} weight={600} tone="body">
          Per-shape colours
        </Label>
        <Button x={212} y={256} w={64} h={24} label="Cancel" />
        <Button x={282} y={256} w={72} h={24} label="Save theme" variant="primary" />
      </Dialog>
    </Scene>
  );
}
