// The photo page illustration for the Pages article on Photo Pages (docs/specs/018-help/help-app.md). Draws the
// real surface with its real labels: the palette strip holding the photo tools in place of its categories, the
// selection mode first and Search last, the colours after the groups (ToolbarPalette.tsx, PhotoToolsRail.tsx,
// PhotoColours.tsx); the options bar of the Brush in hand under it (PhotoOptionsBar.tsx); the page's label
// ("1920 x 1080 · Photo") and its title-bar menus, Image, Select and Filter, before the padlock and cog
// (PhotoTitleBar.tsx); a selection's marching ants on the photo; and the Photo panel open over its Photo button,
// joined to Contents at the bottom right (PhotoClusterSegment.tsx), with its histogram, its three tabs and the Layers
// tab's blend mode, opacity and rows (PhotoPanel.tsx, PhotoLayersTab.tsx). Composed from the shared primitives.

import { Label, Panel, Scene, Tabs, TextBar } from './primitives';
import { PadlockGlyph, TitleButton } from './page-title-bar';

type GlyphProps = { cx: number; cy: number; on?: boolean };
const stroke = (on?: boolean) => (on ? 'stroke-brand-600' : 'stroke-slate-500');

function ImageGlyph({ cx, cy, on }: GlyphProps) {
  return (
    <g fill="none" className={stroke(on)} strokeWidth={1.3} strokeLinejoin="round">
      <rect x={cx - 5} y={cy - 4} width={10} height={8} rx={1.5} />
      <path d={`M${cx - 5} ${cy + 3} l3.5 -3.5 l2.5 2.5 l1.5 -1.5 l2.5 2.5`} />
    </g>
  );
}

function SelectGlyph({ cx, cy, on }: GlyphProps) {
  return (
    <rect
      x={cx - 4.5}
      y={cy - 4}
      width={9}
      height={8}
      rx={0.5}
      fill="none"
      className={stroke(on)}
      strokeWidth={1.3}
      strokeDasharray="2 1.6"
    />
  );
}

function FilterGlyph({ cx, cy, on }: GlyphProps) {
  return (
    <path
      d={`M${cx - 5} ${cy - 4} h10 l-4 4.5 v3.5 l-2 -1 v-2.5 Z`}
      fill="none"
      className={stroke(on)}
      strokeWidth={1.3}
      strokeLinejoin="round"
    />
  );
}

/** The page cog: a small round button with a gear. */
function Cog({ cx, cy }: { cx: number; cy: number }) {
  const spokes = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle r={8} className="fill-white stroke-slate-300" strokeWidth={1.2} />
      {spokes.map((a) => (
        <line
          key={a}
          x1={0}
          y1={-3}
          x2={0}
          y2={-4.8}
          transform={`rotate(${a})`}
          className="stroke-slate-500"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      ))}
      <circle r={2.5} fill="none" className="stroke-slate-500" strokeWidth={1.3} />
    </g>
  );
}

/** A tool in the strip: a 20-unit tile with a simple glyph; `on` is the tool in hand. */
function Tool({ cx, on = false, d }: { cx: number; on?: boolean; d: string }) {
  return (
    <g>
      {on && <rect x={cx - 10} y={13} width={20} height={20} rx={5} className="fill-brand-100" />}
      <path
        d={d}
        transform={`translate(${cx} 23)`}
        fill="none"
        className={on ? 'stroke-brand-600' : 'stroke-slate-500'}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/** A strip divider at `x`. */
function StripDivider({ x }: { x: number }) {
  return <line x1={x} y1={16} x2={x} y2={30} className="stroke-slate-200" strokeWidth={1.2} />;
}

// The strip's glyphs, about the tile's centre: Move, Marquee, Lasso, Quick Select (Select); Crop, Eyedropper
// (Crop and Sample); Brush, Eraser (Paint).
const TOOLS = [
  'M0 -6 V6 M-6 0 H6 M-2 -4 L0 -6 L2 -4 M-2 4 L0 6 L2 4 M-4 -2 L-6 0 L-4 2 M4 -2 L6 0 L4 2',
  'M-5 -4 h10 v8 h-10 Z',
  'M-5 -1 a5 3.5 0 1 1 3 3.2 M-2 2.2 q-1 2.5 1 3.8',
  'M-5 5 L2 -2 M3 -6 v2 M1 -5 h2 M5 -5 h1 M4 -3 v1',
  'M-3 -6 V3 H6 M-6 -3 H3 V6',
  'M4 -5 l2 2 l-7 7 l-3 1 l1 -3 Z',
  'M5 -6 l1 1 l-6 6 l-2 -1 Z M-2 1 q-4 1 -3 5 q3 0 4 -3',
  'M-1 -5 l6 6 l-4 4 h-4 l-3 -3 Z M-6 6 h12',
];
// The selection mode's pointer and Search's lens, at the strip's two ends.
const POINTER = 'M-4 -6 L5 1 L1 2 L3 6 L1 7 L-1 3 L-4 6 Z';
const LENS = 'M-1.5 -1.5 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M1.5 1.5 L5.5 5.5';

export function PhotoPagesScene() {
  // The strip, centred over the canvas left of the panel.
  const stripX = 40;
  const stripW = 312;
  // The sheet: a 16:9 photo.
  const sx = 40;
  const sy = 104;
  const sw = 320;
  const sh = 180;
  // The groups in their categories (Select, Crop and Sample, Paint), a divider between each.
  const toolX = (i: number) => stripX + 46 + i * 22 + (i >= 4 ? 8 : 0) + (i >= 6 ? 8 : 0);
  const coloursX = toolX(TOOLS.length - 1) + 28;
  return (
    <Scene w={560} h={330}>
      {/* The palette strip: the selection mode, the photo tools (the Brush in hand), the colours, Search. */}
      <rect
        x={stripX}
        y={8}
        width={stripW}
        height={30}
        rx={9}
        className="fill-white stroke-slate-200"
        strokeWidth={1.4}
      />
      <path d={POINTER} transform={`translate(${stripX + 18} 23)`} className="fill-slate-500" />
      <StripDivider x={stripX + 32} />
      {TOOLS.map((d, i) => (
        <Tool key={i} cx={toolX(i)} d={d} on={i === 6} />
      ))}
      <StripDivider x={toolX(4) - 15} />
      <StripDivider x={toolX(6) - 15} />
      <StripDivider x={coloursX} />
      <rect
        x={coloursX + 12}
        y={19}
        width={10}
        height={10}
        rx={2}
        className="fill-white stroke-slate-400"
        strokeWidth={1.2}
      />
      <rect x={coloursX + 8} y={15} width={10} height={10} rx={2} className="fill-slate-800" />
      <StripDivider x={coloursX + 32} />
      <path
        d={LENS}
        transform={`translate(${coloursX + 48} 23)`}
        fill="none"
        className="stroke-slate-500"
        strokeWidth={1.4}
        strokeLinecap="round"
      />

      {/* The Brush's options, hanging from its button in the strip (held on screen at the left), a pointer up
          to the button. */}
      <rect
        x={sx}
        y={46}
        width={sw}
        height={24}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.4}
      />
      <path
        d={`M${toolX(6) - 5} 46.7 L${toolX(6)} 41.5 L${toolX(6) + 5} 46.7`}
        className="fill-white stroke-slate-200"
        strokeWidth={1.4}
      />
      <Label x={sx + 10} y={58.5} size={10} weight={700} tone="strong">
        Brush
      </Label>
      <Label x={sx + 48} y={58.5} size={9} tone="muted">
        Size
      </Label>
      <TextBar x={sx + 72} y={56} w={44} h={4} tone="faint" />
      <circle cx={sx + 86} cy={58} r={4} className="fill-brand-500" />
      <Label x={sx + 126} y={58.5} size={9} tone="muted">
        Hardness
      </Label>
      <TextBar x={sx + 170} y={56} w={44} h={4} tone="faint" />
      <circle cx={sx + 204} cy={58} r={4} className="fill-brand-500" />
      <rect
        x={sx + 226}
        y={51}
        width={86}
        height={15}
        rx={4}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      <Label x={sx + 269} y={59} size={9} weight={500} anchor="middle">
        Brush Presets
      </Label>

      {/* The page's label and its title bar: Image, Select, Filter, the padlock and the cog. */}
      <Label x={sx} y={sy - 10} size={10} tone="muted">
        1920 x 1080 · Photo
      </Label>
      <TitleButton x={sx + 108} cy={sy - 10} name="Image" Glyph={ImageGlyph} />
      <TitleButton x={sx + 162} cy={sy - 10} name="Select" Glyph={SelectGlyph} on />
      <TitleButton x={sx + 222} cy={sy - 10} name="Filter" Glyph={FilterGlyph} />
      <PadlockGlyph cx={sx + 296} cy={sy - 10} />
      <Cog cx={sx + 318} cy={sy - 10} />

      {/* The photo: a sky, a sun, two hills and a lake, the same in a dark theme. */}
      <rect x={sx + 2} y={sy + 3} width={sw} height={sh} rx={2} className="fill-slate-200" />
      <g className="help-art-as-drawn">
        <rect x={sx} y={sy} width={sw} height={sh} className="fill-sky-200" />
        <rect x={sx} y={sy} width={sw} height={sh * 0.3} className="fill-sky-300" />
        <circle cx={sx + 238} cy={sy + 56} r={22} className="fill-amber-200" />
        <path
          d={`M${sx} ${sy + 126} Q${sx + 70} ${sy + 80} ${sx + 150} ${sy + 114} T${sx + sw} ${sy + 100} V${sy + sh} H${sx} Z`}
          className="fill-emerald-400"
        />
        <path
          d={`M${sx} ${sy + 147} Q${sx + 110} ${sy + 118} ${sx + 210} ${sy + 141} T${sx + sw} ${sy + 135} V${sy + sh} H${sx} Z`}
          className="fill-emerald-600"
        />
        <path
          d={`M${sx + 40} ${sy + sh} Q${sx + 120} ${sy + 155} ${sx + 220} ${sy + 165} T${sx + sw - 20} ${sy + sh} Z`}
          className="fill-sky-400"
        />
        {/* A selection round the sun: its marching ants, a black dash over a white line. */}
        <rect
          x={sx + 204}
          y={sy + 24}
          width={68}
          height={64}
          fill="none"
          stroke="white"
          strokeWidth={1.2}
        />
        <rect
          x={sx + 204}
          y={sy + 24}
          width={68}
          height={64}
          fill="none"
          stroke="black"
          strokeWidth={1.2}
          strokeDasharray="4 4"
        />
      </g>

      {/* The pages strip at the bottom right: Contents, and Photo joined to it, pressed. */}
      <rect
        x={400}
        y={300}
        width={150}
        height={24}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.4}
      />
      <line x1={470} y1={300} x2={470} y2={324} className="stroke-slate-200" strokeWidth={1.2} />
      <Label x={435} y={312.5} size={9} weight={500} anchor="middle">
        Contents
      </Label>
      <rect x={471} y={301.5} width={77.5} height={21} rx={5} className="fill-brand-50" />
      <Label x={510} y={312.5} size={9} weight={600} tone="accent" anchor="middle">
        Photo
      </Label>

      {/* The Photo panel open above its button: the histogram, the tabs, the blend mode and opacity, the layers. */}
      <g transform="translate(0 46)">
        <Panel x={400} y={12} w={150} h={236} title="PHOTO">
          <rect x={410} y={42} width={130} height={34} rx={4} className="fill-slate-50" />
          <path
            d="M410 76 L420 70 L432 62 L444 66 L456 54 L468 58 L480 50 L492 56 L504 48 L516 60 L528 66 L540 72 L540 76 Z"
            className="fill-slate-400"
          />
          <Label x={410} y={86} size={8} tone="muted" className="fill-slate-400">
            640, 210 #8ecae6
          </Label>
          <Tabs x={410} y={94} items={['Layers', 'Adjust', 'History']} tabW={43.3} h={18} />
          <Label x={410} y={124} size={8} tone="muted">
            Blend Mode
          </Label>
          <rect
            x={460}
            y={117}
            width={60}
            height={14}
            rx={3}
            className="fill-white stroke-slate-200"
            strokeWidth={1}
          />
          <Label x={465} y={124.5} size={8}>
            Normal
          </Label>
          <Label x={410} y={142} size={8} tone="muted">
            Opacity
          </Label>
          <TextBar x={448} y={140} w={70} h={4} tone="faint" />
          <circle cx={514} cy={142} r={3.5} className="fill-brand-500" />
          {(
            [
              ['Sun Glow', 'fill-amber-200', false],
              ['Layer 1', 'fill-emerald-500', true],
              ['Background', 'fill-sky-300', false],
            ] as const
          ).map(([name, thumb, on], i) => {
            const y = 154 + i * 26;
            return (
              <g key={name}>
                {on && <rect x={402} y={y} width={146} height={24} className="fill-brand-50" />}
                <path
                  d={`M${410} ${y + 12} q5 -5 10 0 q-5 5 -10 0 Z`}
                  fill="none"
                  className="stroke-slate-500"
                  strokeWidth={1}
                />
                <circle cx={415} cy={y + 12} r={1.4} className="fill-slate-500" />
                <rect
                  x={426}
                  y={y + 4}
                  width={16}
                  height={16}
                  rx={2}
                  className={`help-art-as-drawn ${thumb}`}
                />
                <Label
                  x={448}
                  y={y + 12.5}
                  size={9}
                  weight={on ? 600 : 400}
                  tone={on ? 'accent' : 'body'}
                >
                  {name}
                </Label>
              </g>
            );
          })}
        </Panel>
      </g>
    </Scene>
  );
}
