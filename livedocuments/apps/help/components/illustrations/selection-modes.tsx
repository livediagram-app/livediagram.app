// Selection-mode illustrations (docs/specs/018-help/help-app.md): the palette's canvas-tool picker
// as the editor actually draws it (a trigger at the start of the palette strip that
// opens a tile grid in three bands), the panels each tool opens while it is
// active. The per-mode canvas scenes in
// palette-modes.tsx put PickerTrigger on top, so every selection-mode article
// shows the same picker with its own tool chosen.
//
// Labels are lifted from apps/editor: canvas-tool-options.tsx (tool names,
// shortcuts, bands), the *-config.ts catalogues (panel rows and values), and
// TopCenterChrome.tsx (the Format banner).

import type { ReactNode } from 'react';
import { Scene, Shape, Arrow, Panel, Label } from '@liveworkspace/help-site/art/primitives';
import {
  EraserGlyph,
  HandGlyph,
  LaserGlyph,
  PainterGlyph,
  SelectGlyph,
  SlideDeckGlyph,
  SpotlightGlyph,
  ZenGlyph,
} from '@liveworkspace/help-site/art/illustrations/palette-modes-parts';
import { BAR, BarGlyph } from './toolbar-layout';

// --- The picker -------------------------------------------------------------

/** The palette's canvas tools, in the picker's own order and bands. */
const TOOLS = [
  { key: 'select', label: 'Select', shortcut: 'V', band: 0, Glyph: SelectGlyph },
  { key: 'hand', label: 'Hand', shortcut: 'H', band: 0, Glyph: HandGlyph },
  { key: 'eraser', label: 'Eraser', shortcut: 'E', band: 0, Glyph: EraserGlyph },
  { key: 'format', label: 'Format', shortcut: undefined, band: 0, Glyph: PainterGlyph },
  { key: 'laser', label: 'Laser', shortcut: 'K', band: 1, Glyph: LaserGlyph },
  { key: 'spotlight', label: 'Spotlight', shortcut: undefined, band: 1, Glyph: SpotlightGlyph },
  { key: 'slide-deck', label: 'Slide Deck', shortcut: undefined, band: 1, Glyph: SlideDeckGlyph },
  { key: 'zen', label: 'Zen', shortcut: 'Z', band: 2, Glyph: ZenGlyph },
] as const;

type ToolKey = (typeof TOOLS)[number]['key'];

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

/** The palette strip across the top of the canvas: the canvas-tool picker on the left (showing the chosen tool),
 *  then the category bar (its categories as glyphs, toolbar-layout's BAR) and Search. Sits at the top of every mode
 *  scene. */
export function PickerTrigger({ x = 24, y = 14, tool }: { x?: number; y?: number; tool: ToolKey }) {
  const t = TOOLS.find((o) => o.key === tool) ?? TOOLS[0];
  // Each category a 20-wide button, a 9-wide divider between the bands.
  const slots = BAR.reduce<{ name: string; left: number; w: number }[]>((out, name) => {
    const prev = out.at(-1);
    return [...out, { name, left: prev ? prev.left + prev.w : x + 146, w: name === '|' ? 9 : 20 }];
  }, []);
  const end = slots.at(-1)!.left + slots.at(-1)!.w;
  const w = end - x + 34;
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
      {slots.map((slot, i) =>
        slot.name === '|' ? (
          <line
            key={i}
            x1={slot.left + 4}
            y1={y + 32}
            x2={slot.left + 4}
            y2={y + 48}
            className="stroke-slate-200"
            strokeWidth={1}
          />
        ) : (
          <g key={slot.name} transform={`translate(${slot.left + slot.w / 2} ${y + 40})`}>
            <BarGlyph name={slot.name} />
          </g>
        ),
      )}
      {/* Search, last on the strip behind its own divider. */}
      <line
        x1={end + 5}
        y1={y + 30}
        x2={end + 5}
        y2={y + 50}
        className="stroke-slate-200"
        strokeWidth={1.2}
      />
      <circle
        cx={end + 18}
        cy={y + 39}
        r={5}
        className="fill-none stroke-slate-500"
        strokeWidth={1.6}
      />
      <path
        d={`M${end + 22} ${y + 43} l4 4`}
        className="stroke-slate-500"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </g>
  );
}

/** The canvas-tool picker opened: the trigger, and the tile grid hanging below
 *  it in its three named bands, with the current tool in its selected tone and
 *  the shortcut letters in the tiles' corners. */
export function ToolPicker({ active = 'select' }: { active?: ToolKey }) {
  const mx = 24;
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
        {/* The default Soft edge: the light feathers out into the dim. */}
        <radialGradient id="mtt-spot-soft">
          <stop offset="0.7" stopColor="black" />
          <stop offset="1" stopColor="white" />
        </radialGradient>
        <mask id="mtt-spot-hole">
          <rect x={0} y={0} width={420} height={230} fill="white" />
          <circle cx={234} cy={158} r={62} fill="url(#mtt-spot-soft)" />
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
      <circle cx={234} cy={166} r={8} className="fill-sky-400/30" />
      <circle cx={234} cy={166} r={4.5} className="fill-sky-400 stroke-white" strokeWidth={1.5} />
    </Scene>
  );
}
