// Selection-mode illustrations (docs/specs/018-help/help-app.md): the palette's canvas-tool picker
// as the editor actually draws it (a trigger at the start of the palette strip that
// opens a tile grid in three bands), the panels each tool opens while it is
// active, the pixel character Avatar mode walks, and the isometric orbit
// button. The per-mode canvas scenes in palette-modes.tsx put PickerTrigger on
// top, so every selection-mode article shows the same picker with its own tool
// chosen.
//
// Labels are lifted from apps/live: canvas-tool-options.tsx (tool names,
// shortcuts, bands), the *-config.ts catalogues (panel rows and values), and
// TopCenterChrome.tsx (the Format banner).

import type { ReactNode } from 'react';
import { Scene, Shape, Arrow, Panel, Label, Cursor } from './primitives';
import {
  AvatarGlyph,
  EraserGlyph,
  HandGlyph,
  IsoCard,
  IsometricGlyph,
  LaserGlyph,
  PainterGlyph,
  SelectGlyph,
  SlideDeckGlyph,
  SpotlightGlyph,
  ZenGlyph,
  iso,
} from './palette-modes-parts';

// --- The picker -------------------------------------------------------------

/** The palette's canvas tools, in the picker's own order and bands. */
const TOOLS = [
  { key: 'select', label: 'Select', shortcut: 'V', band: 0, Glyph: SelectGlyph },
  { key: 'hand', label: 'Hand', shortcut: 'H', band: 0, Glyph: HandGlyph },
  { key: 'eraser', label: 'Eraser', shortcut: 'E', band: 0, Glyph: EraserGlyph },
  { key: 'format', label: 'Format', shortcut: undefined, band: 0, Glyph: PainterGlyph },
  { key: 'laser', label: 'Laser', shortcut: 'K', band: 1, Glyph: LaserGlyph },
  { key: 'spotlight', label: 'Spotlight', shortcut: undefined, band: 1, Glyph: SpotlightGlyph },
  { key: 'avatar', label: 'Avatar', shortcut: 'W', band: 1, Glyph: AvatarGlyph },
  { key: 'slide-deck', label: 'Slide Deck', shortcut: undefined, band: 1, Glyph: SlideDeckGlyph },
  { key: 'isometric', label: 'Isometric', shortcut: 'I', band: 2, Glyph: IsometricGlyph },
  { key: 'zen', label: 'Zen', shortcut: 'Z', band: 2, Glyph: ZenGlyph },
] as const;

export type ToolKey = (typeof TOOLS)[number]['key'];

const BANDS = ['EDIT', 'PRESENT', 'PREVIEW'] as const;

function Chevron({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x - 3.5} ${y - 1.5} l3.5 3.5 l3.5 -3.5`}
      className="stroke-slate-400"
      strokeWidth={1.5}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** The start of the palette strip across the top of the canvas: the canvas-tool picker on the
 *  left (showing the chosen tool) and the category picker beside it. Sits at the top of every
 *  mode scene. */
export function PickerTrigger({ x = 24, y = 14, tool }: { x?: number; y?: number; tool: ToolKey }) {
  const t = TOOLS.find((o) => o.key === tool) ?? TOOLS[0];
  const w = 236;
  return (
    <g>
      <rect
        x={x}
        y={y + 22}
        width={w}
        height={36}
        rx={9}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <rect
        x={x + 8}
        y={y + 28}
        width={122}
        height={24}
        rx={6}
        className="fill-brand-50 stroke-brand-200"
        strokeWidth={1.2}
      />
      <g transform={`translate(${x + 21} ${y + 40})`}>
        <t.Glyph />
      </g>
      <Label x={x + 34} y={y + 41} size={11} weight={600} tone="strong">
        {t.label}
      </Label>
      <Chevron x={x + 120} y={y + 40} />
      <line
        x1={x + 140}
        y1={y + 30}
        x2={x + 140}
        y2={y + 50}
        className="stroke-slate-200"
        strokeWidth={1.2}
      />
      <Label x={x + 150} y={y + 41} size={11} weight={500} tone="body">
        Popular
      </Label>
      <Chevron x={x + w - 16} y={y + 40} />
    </g>
  );
}

/** The canvas-tool picker opened: the trigger, and the tile grid hanging below
 *  it in its three named bands, with the current tool in its selected tone and
 *  the shortcut letters in the tiles' corners. */
export function ToolPicker({ active = 'select' }: { active?: ToolKey }) {
  const mx = 84;
  const tileW = 80;
  const tileH = 42;
  const gap = 4;
  const menuW = 3 * tileW + 2 * gap + 16;
  const rows: { band: number; tools: (typeof TOOLS)[number][] }[] = [];
  for (const b of [0, 1, 2]) {
    const inBand = TOOLS.filter((t) => t.band === b);
    for (let i = 0; i < inBand.length; i += 3)
      rows.push({ band: b, tools: inBand.slice(i, i + 3) });
  }
  let cy = 84;
  const body: ReactNode[] = [];
  let lastBand = -1;
  rows.forEach((row, r) => {
    if (row.band !== lastBand) {
      if (lastBand !== -1) {
        body.push(
          <line
            key={`rule-${r}`}
            x1={mx + 8}
            y1={cy + 2}
            x2={mx + menuW - 8}
            y2={cy + 2}
            className="stroke-slate-200"
            strokeWidth={1}
          />,
        );
        cy += 6;
      }
      body.push(
        <Label key={`band-${r}`} x={mx + 12} y={cy + 8} size={10} weight={700} tone="muted">
          {BANDS[row.band]}
        </Label>,
      );
      cy += 18;
      lastBand = row.band;
    }
    row.tools.forEach((t, i) => {
      const tx = mx + 8 + i * (tileW + gap);
      const on = t.key === active;
      body.push(
        <g key={t.key}>
          <rect
            x={tx}
            y={cy}
            width={tileW}
            height={tileH}
            rx={6}
            className={on ? 'fill-brand-100' : row.band === 0 ? 'fill-slate-50' : 'fill-slate-100'}
          />
          <g transform={`translate(${tx + tileW / 2} ${cy + 14})`}>
            <t.Glyph />
          </g>
          <Label
            x={tx + tileW / 2}
            y={cy + 32}
            size={10.5}
            weight={on ? 700 : 500}
            anchor="middle"
            tone={on ? 'accent' : 'body'}
          >
            {t.label}
          </Label>
          {t.shortcut && (
            <Label x={tx + tileW - 5} y={cy + 8} size={10} weight={600} anchor="end" tone="muted">
              {t.shortcut}
            </Label>
          )}
        </g>,
      );
    });
    cy += tileH + gap;
  });
  const menuH = cy - 80 + 6;
  return (
    <Scene w={420} h={menuH + 92}>
      <PickerTrigger x={mx} y={10} tool={active} />
      <rect
        x={mx}
        y={76}
        width={menuW}
        height={menuH}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {body}
    </Scene>
  );
}

// --- Tool panels --------------------------------------------------------------

type PanelRow = { label: string; value: string; amber?: boolean };

/** A tool's own panel (Eraser, Format, Laser, Spotlight): a titled panel that
 *  docks top-right while the tool is active, a preview strip at the
 *  top, then one collapsed row per setting naming its current value. */
function ToolPanel({
  x,
  y,
  w = 176,
  title,
  preview,
  rows,
}: {
  x: number;
  y: number;
  w?: number;
  title: string;
  preview: ReactNode;
  rows: PanelRow[];
}) {
  const h = 22 + 8 + 48 + rows.length * 24 + 8;
  return (
    <Panel x={x} y={y} w={w} h={h} title={title}>
      {/* The help link every tool panel carries in its header. */}
      <Label x={x + w - 14} y={y + 12} size={10} weight={700} anchor="middle" tone="muted">
        ?
      </Label>
      <rect x={x + 8} y={y + 30} width={w - 16} height={44} rx={7} className="fill-slate-100" />
      {preview}
      {rows.map((r, i) => {
        const ry = y + 78 + i * 24;
        return (
          <g key={r.label}>
            {i > 0 && (
              <line
                x1={x + 10}
                y1={ry}
                x2={x + w - 10}
                y2={ry}
                className="stroke-slate-100"
                strokeWidth={1}
              />
            )}
            <Label x={x + 12} y={ry + 12} size={10} weight={700} tone="muted">
              {r.label.toUpperCase()}
            </Label>
            <Label
              x={x + w - 26}
              y={ry + 12}
              size={10.5}
              weight={500}
              anchor="end"
              className={r.amber ? 'fill-amber-600 dark:fill-amber-400' : 'fill-slate-600'}
            >
              {r.value}
            </Label>
            <Chevron x={x + w - 15} y={ry + 12} />
          </g>
        );
      })}
    </Panel>
  );
}

/** The Eraser panel with a filter on: a Large brush set to Drawings, so the
 *  ring on the canvas (and in the preview) is amber, and a sweep through the
 *  pencil scribble leaves the shape under it alone. */
export function EraserPanelScene() {
  return (
    <Scene w={420} h={230}>
      <Shape x={34} y={70} w={110} h={56} label="Checkout" />
      {/* A pencil scribble over the shape */}
      <path
        d="M30 150 q24 -40 52 -8 t52 -10 t44 6"
        className="stroke-slate-500"
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
      />
      {/* The brush ring, amber because a filter is on */}
      <circle
        cx={150}
        cy={140}
        r={26}
        className="fill-amber-400/20 stroke-amber-500"
        strokeWidth={2}
      />
      <ToolPanel
        x={226}
        y={20}
        title="ERASER"
        preview={
          <g>
            {[0, 1, 2, 3].map((i) => (
              <rect
                key={i}
                x={242 + i * 38}
                y={44}
                width={28}
                height={16}
                rx={3}
                className="fill-slate-300"
              />
            ))}
            <circle
              cx={314}
              cy={52}
              r={14}
              className="fill-amber-400/25 stroke-amber-500"
              strokeWidth={2}
            />
          </g>
        }
        rows={[
          { label: 'Mode', value: 'Sweep' },
          { label: 'Size', value: 'Large' },
          { label: 'Erases', value: 'Drawings', amber: true },
        ]}
      />
    </Scene>
  );
}

/** The Format tool mid-job: the banner across the top, a source loaded in the
 *  Format panel (its swatch drawn from the enabled parts only), and a target
 *  being painted. */
export function FormatPanelScene() {
  return (
    <Scene w={420} h={240}>
      {/* The mode banner */}
      <rect x={14} y={12} width={300} height={28} rx={14} className="fill-brand-500" />
      <g transform="translate(30 26)">
        <PainterGlyph on />
      </g>
      <Label x={44} y={27} size={10.5} weight={600} tone="onAccent">
        Tap elements to paint this style onto them
      </Label>
      <rect x={268} y={17} width={38} height={18} rx={9} className="fill-white/25" />
      <Label x={287} y={27} size={10} weight={700} anchor="middle" tone="onAccent">
        Done
      </Label>
      {/* Source and target */}
      <Shape
        x={26}
        y={88}
        w={92}
        h={48}
        label="Step one"
        fill="fill-brand-50"
        stroke="stroke-brand-500"
      />
      <Arrow from={[122, 112]} to={[150, 160]} kind="curved" tone="muted" dashed />
      <Shape
        x={110}
        y={160}
        w={92}
        h={48}
        label="Step two"
        fill="fill-amber-100"
        stroke="stroke-brand-500"
      />
      <ToolPanel
        x={204}
        y={56}
        w={210}
        title="FORMAT"
        preview={
          <g>
            <rect
              x={218}
              y={93}
              width={34}
              height={28}
              rx={5}
              className="fill-white stroke-brand-500"
              strokeWidth={2}
            />
            <Label x={235} y={108} size={11} weight={700} anchor="middle" tone="strong">
              Aa
            </Label>
            <Label x={260} y={101} size={10.5} weight={700} tone="strong">
              Step one
            </Label>
            <Label x={260} y={115} size={10} tone="muted">
              Copies: Border, Text
            </Label>
          </g>
        }
        rows={[
          { label: 'Copies', value: 'Border, Text' },
          { label: 'After painting', value: 'Keep the brush' },
        ]}
      />
    </Scene>
  );
}

/** The Laser panel beside a Glow trail on the canvas. */
export function LaserPanelScene() {
  return (
    <Scene w={420} h={240}>
      <Shape x={30} y={60} w={96} h={46} label="Gateway" />
      <Shape x={60} y={160} w={96} h={46} accent label="Service" />
      <path
        d="M40 130 q50 -30 110 -6 q30 14 50 0"
        className="stroke-rose-300/50"
        strokeWidth={10}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M40 130 q50 -30 110 -6 q30 14 50 0"
        className="stroke-rose-400"
        strokeWidth={3.5}
        fill="none"
        strokeLinecap="round"
      />
      <circle cx={200} cy={124} r={5} className="fill-rose-500" />
      <ToolPanel
        x={230}
        y={20}
        title="LASER"
        preview={
          <g>
            <path
              d="M246 60 q40 -22 80 -4 q20 8 50 -6"
              className="stroke-rose-300/50"
              strokeWidth={8}
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M246 60 q40 -22 80 -4 q20 8 50 -6"
              className="stroke-rose-400"
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
            />
          </g>
        }
        rows={[
          { label: 'Width', value: 'Medium' },
          { label: 'Colour', value: 'Your colour' },
          { label: 'Trail', value: 'Normal' },
          { label: 'Effect', value: 'Glow' },
        ]}
      />
    </Scene>
  );
}

/** The Spotlight panel set to a Wide light, with the canvas dimmed around a
 *  broad ellipse that lights one row. */
export function SpotlightPanelScene() {
  return (
    <Scene w={420} h={240}>
      <defs>
        <mask id="mtt-spot-wide">
          <rect x={0} y={0} width={214} height={240} fill="white" />
          <ellipse cx={108} cy={124} rx={92} ry={30} fill="black" />
        </mask>
      </defs>
      {[60, 106, 152].map((ry, i) => (
        <g key={ry}>
          <Shape x={20} y={ry} w={56} h={34} label={['To do', 'Doing', 'Done'][i]} />
          <Shape x={84} y={ry} w={56} h={34} accent={i === 1} />
          <Shape x={148} y={ry} w={56} h={34} />
        </g>
      ))}
      <rect
        x={0}
        y={0}
        width={214}
        height={240}
        className="fill-slate-900/70"
        mask="url(#mtt-spot-wide)"
      />
      <ToolPanel
        x={230}
        y={20}
        title="SPOTLIGHT"
        preview={
          <g>
            <rect x={238} y={50} width={160} height={44} rx={7} className="fill-slate-800/70" />
            <ellipse cx={318} cy={72} rx={52} ry={14} className="fill-slate-100" />
          </g>
        }
        rows={[
          { label: 'Size', value: 'Custom' },
          { label: 'Dim', value: 'Blackout' },
          { label: 'Edge', value: 'Soft' },
          { label: 'Shape', value: 'Wide' },
        ]}
      />
    </Scene>
  );
}

/** Spotlight's mode scene: the picker on Spotlight, the canvas dimmed except a
 *  bright circle around the cursor over one shape. */
export function SpotlightTool() {
  return (
    <Scene w={420} h={230}>
      <defs>
        <mask id="mtt-spot-hole">
          <rect x={0} y={0} width={420} height={230} fill="white" />
          <circle cx={234} cy={158} r={54} fill="black" />
        </mask>
      </defs>
      <PickerTrigger tool="spotlight" />
      <Shape x={80} y={120} w={72} h={42} label="A" />
      <Shape x={196} y={128} w={72} h={42} accent label="B" />
      <Shape x={312} y={160} w={72} h={42} kind="circle" label="C" />
      <rect
        x={0}
        y={86}
        width={420}
        height={144}
        className="fill-slate-900/55"
        mask="url(#mtt-spot-hole)"
      />
      {/* The cursor's stand-in, as the app draws it: a sky dot with a white rim and a glow,
          below B's label so the lit shape still reads. No ring: the light's edge is the shroud. */}
      <circle cx={234} cy={162} r={8} className="fill-sky-400/30" />
      <circle cx={234} cy={162} r={4.5} className="fill-sky-400 stroke-white" strokeWidth={1.5} />
    </Scene>
  );
}

// --- Avatar -----------------------------------------------------------------

/** The pixel character Avatar mode walks, standing with its feet at (fx, fy).
 *  `shirt` is the owner's participant colour; `name` draws the chip other
 *  people's characters wear above their heads (your own has none). */
export function PixelCharacter({
  fx,
  fy,
  px = 3,
  shirt = 'brand',
  name,
  hair = 'fill-amber-900',
}: {
  fx: number;
  fy: number;
  px?: number;
  shirt?: 'brand' | 'emerald' | 'violet' | 'rose';
  name?: string;
  hair?: string;
}) {
  const p = (n: number) => n * px;
  const shirtCls = {
    brand: ['fill-brand-500', 'fill-brand-600'],
    emerald: ['fill-emerald-500', 'fill-emerald-600'],
    violet: ['fill-violet-500', 'fill-violet-600'],
    rose: ['fill-rose-500', 'fill-rose-600'],
  }[shirt];
  const chipFill = {
    brand: 'fill-brand-500',
    emerald: 'fill-emerald-500 dark:fill-emerald-700',
    violet: 'fill-violet-500 dark:fill-violet-700',
    rose: 'fill-rose-500 dark:fill-rose-700',
  }[shirt];
  return (
    <g>
      <g transform={`translate(${fx - p(8)} ${fy - p(23)})`} shapeRendering="crispEdges">
        <ellipse cx={p(8)} cy={p(23)} rx={p(5)} ry={p(1.2)} className="fill-slate-900/25" />
        <rect x={p(5)} y={p(15)} width={p(3)} height={p(6)} className="fill-slate-600" />
        <rect x={p(9)} y={p(15)} width={p(3)} height={p(6)} className="fill-slate-600" />
        <rect x={p(5)} y={p(21)} width={p(3)} height={p(2)} className="fill-slate-800" />
        <rect x={p(9)} y={p(21)} width={p(3)} height={p(2)} className="fill-slate-800" />
        <rect x={p(4)} y={p(9)} width={p(8)} height={p(6)} className={shirtCls[0]} />
        <rect x={p(2)} y={p(9)} width={p(2)} height={p(4)} className={shirtCls[0]} />
        <rect x={p(12)} y={p(9)} width={p(2)} height={p(4)} className={shirtCls[1]} />
        <rect x={p(4)} y={p(1)} width={p(8)} height={p(8)} className="fill-amber-200" />
        <rect x={p(3)} y={0} width={p(10)} height={p(3)} className={hair} />
        <rect x={p(6)} y={p(5)} width={px} height={px} className="fill-slate-800" />
        <rect x={p(9)} y={p(5)} width={px} height={px} className="fill-slate-800" />
      </g>
      {name && (
        <g transform={`translate(${fx - (name.length * 6.5 + 12) / 2} ${fy - p(23) - 22})`}>
          <rect width={name.length * 6.5 + 12} height={17} rx={5} className={chipFill} />
          <Label x={6} y={9} tone="onAccent" size={10} weight={600}>
            {name}
          </Label>
        </g>
      )}
    </g>
  );
}

/** Walking together: your character (no chip) beside two colleagues', each in
 *  their participant colour with a name chip, one of them on the box being
 *  discussed. */
export function WalkingTogether() {
  return (
    <Scene w={420} h={220}>
      <Shape x={40} y={60} w={96} h={48} label="Sign up" />
      <Shape x={250} y={60} w={150} h={48} accent label="Payment" />
      {/* No ring under Priya: only your own character rings what it stands on (Canvas.tsx). */}
      <Arrow from={[136, 84]} to={[250, 84]} tone="muted" />
      <PixelCharacter fx={92} fy={196} />
      <PixelCharacter fx={204} fy={186} shirt="emerald" name="Sam" hair="fill-slate-800" />
      <PixelCharacter fx={272} fy={112} shirt="violet" name="Priya" hair="fill-slate-900" />
    </Scene>
  );
}

// --- Isometric ----------------------------------------------------------------

/** The isometric view with the zoom dock's orbit button: drag it to orbit,
 *  click it to snap back to the default angle. */
export function IsometricOrbit() {
  const a = iso(-70, -30);
  const b = iso(70, 30);
  return (
    <Scene w={420} h={250}>
      <g transform="translate(-110 -40)">
        <line
          x1={a[0]}
          y1={a[1] + 6}
          x2={b[0]}
          y2={b[1] + 6}
          className="stroke-brand-400"
          strokeWidth={2.5}
        />
        <IsoCard cx={-70} cy={-30} label="Web" />
        <IsoCard cx={70} cy={30} accent label="API" />
      </g>
      {/* The zoom dock: zoom out, the percentage, zoom in, then Orbit */}
      <rect
        x={196}
        y={196}
        width={206}
        height={40}
        rx={9}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={218} y={217} size={14} weight={600} anchor="middle" tone="body">
        −
      </Label>
      <Label x={256} y={217} size={11} weight={600} anchor="middle" tone="body">
        100%
      </Label>
      <Label x={294} y={217} size={14} weight={600} anchor="middle" tone="body">
        +
      </Label>
      <line x1={314} y1={204} x2={314} y2={228} className="stroke-slate-200" strokeWidth={1.2} />
      <rect x={322} y={201} width={30} height={30} rx={7} className="fill-brand-100" />
      <g
        transform="translate(337 216)"
        className="stroke-brand-600"
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
      >
        <ellipse rx={9} ry={4} />
        <circle r={2} className="fill-brand-600" />
        <path d="M6 -6 l3 2.5 l-3.5 1.5" />
      </g>
      <Cursor x={344} y={222} />
      {/* Its hover card */}
      <rect
        x={236}
        y={124}
        width={166}
        height={60}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={248} y={140} size={11} weight={700} tone="strong">
        Orbit
      </Label>
      <Label x={248} y={156} size={10} tone="muted">
        Drag to orbit, click to
      </Label>
      <Label x={248} y={170} size={10} tone="muted">
        reset the angle.
      </Label>
    </Scene>
  );
}
