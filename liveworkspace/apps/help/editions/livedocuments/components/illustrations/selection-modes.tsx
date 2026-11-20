// Selection-mode illustrations (liveworkspace/docs/specs/017-help/help-centre.md): the palette's canvas-tool picker
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
import { Scene, Shape, Arrow, Panel, Label, Lift } from '@liveworkspace/help-site/art/primitives';
import {
  EraserGlyph,
  HandGlyph,
  LaserGlyph,
  PainterGlyph,
  SelectGlyph,
  SpotlightGlyph,
  ZenGlyph,
} from '@liveworkspace/help-site/art/illustrations/palette-modes-parts';
import { STRIP_W, Strip } from './editor-chrome';
import { BarChart, Heading, Page, Sheet } from './doc-page';

// --- The picker -------------------------------------------------------------

/** The palette's canvas tools, in the picker's own order and bands. */
const TOOLS = [
  { key: 'select', label: 'Select', shortcut: 'V', band: 0, Glyph: SelectGlyph },
  { key: 'hand', label: 'Hand', shortcut: 'H', band: 0, Glyph: HandGlyph },
  { key: 'eraser', label: 'Eraser', shortcut: 'E', band: 0, Glyph: EraserGlyph },
  { key: 'format', label: 'Format', shortcut: undefined, band: 0, Glyph: PainterGlyph },
  { key: 'laser', label: 'Laser', shortcut: 'K', band: 1, Glyph: LaserGlyph },
  { key: 'spotlight', label: 'Spotlight', shortcut: undefined, band: 1, Glyph: SpotlightGlyph },
  { key: 'zen', label: 'Zen', shortcut: 'Z', band: 2, Glyph: ZenGlyph },
] as const;

type ToolKey = (typeof TOOLS)[number]['key'];

const BANDS = ['Edit', 'Present', 'Preview'] as const;

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

/** The palette strip across the top of the canvas, its selection mode showing the chosen tool: sits at the top of
 *  every mode scene. */
export function PickerTrigger({
  x = (420 - STRIP_W) / 2,
  y = 10,
  tool,
  open = false,
}: {
  x?: number;
  y?: number;
  tool: ToolKey;
  open?: boolean;
}) {
  const t = TOOLS.find((o) => o.key === tool) ?? TOOLS[0];
  return <Strip x={x} y={y} modeGlyph={<t.Glyph />} modeOpen={open} />;
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
  let cy = 50;
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
        <Label key={`band-${r}`} x={mx + 12} y={cy + 8} size={9} weight={600} tone="muted">
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
  const menuH = cy - 46 + 6;
  return (
    <Scene w={420} h={menuH + 58}>
      <PickerTrigger x={mx} y={10} tool={active} open />
      <Lift x={mx} y={42} w={menuW} h={menuH} r={8} />
      <rect
        x={mx}
        y={42}
        width={menuW}
        height={menuH}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
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
      {/* Source and target, two plan cards on a slide */}
      <Page x={14} y={66} w={182} h={160} name="Pricing" bar={{ look: false }}>
        <Heading x={28} y={84} size={10}>
          Choose a Plan
        </Heading>
      </Page>
      <Shape
        x={28}
        y={98}
        w={92}
        h={48}
        label="Team"
        fill="fill-brand-50"
        stroke="stroke-brand-500"
      />
      <Arrow from={[110, 148]} to={[130, 172]} kind="curved" tone="muted" dashed />
      <Shape
        x={92}
        y={168}
        w={92}
        h={48}
        label="Personal"
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
              Team
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
      <Page x={14} y={44} w={204} h={172} name="Results" bar={{ look: false }}>
        <Heading x={28} y={64} size={11}>
          Q3 Results
        </Heading>
        <BarChart x={70} y={150} w={134} h={56} values={[0.4, 0.62, 0.5, 0.95]} />
      </Page>
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
      <Sheet x={10} y={40} w={196} h={168}>
        {[62, 108, 154].map((ry, i) => (
          <g key={ry}>
            <Label x={22} y={ry + 17} size={10} weight={600} tone="strong">
              {['2024', '2025', '2026'][i]}
            </Label>
            <rect
              x={60}
              y={ry + 6}
              width={[70, 126, 98][i]}
              height={22}
              rx={3}
              className={i === 1 ? 'fill-brand-500' : 'fill-brand-200'}
            />
          </g>
        ))}
      </Sheet>
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
          <circle cx={252} cy={150} r={62} fill="url(#mtt-spot-soft)" />
        </mask>
      </defs>
      <PickerTrigger tool="spotlight" />
      <Sheet x={60} y={58} w={300} h={164}>
        <Heading x={80} y={80} size={12}>
          Three Wins
        </Heading>
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect
              x={80 + i * 92}
              y={100}
              width={80}
              height={96}
              rx={4}
              className={i === 1 ? 'fill-brand-500' : 'fill-brand-50 stroke-brand-500'}
              strokeWidth={1.25}
            />
            <Label
              x={120 + i * 92}
              y={150}
              size={16}
              weight={700}
              anchor="middle"
              tone={i === 1 ? 'onAccent' : 'accent'}
            >
              {['3x', '41%', '12'][i]}
            </Label>
          </g>
        ))}
      </Sheet>
      <rect
        x={0}
        y={42}
        width={420}
        height={188}
        className="fill-slate-900/55"
        mask="url(#mtt-spot-hole)"
      />
      {/* The cursor's stand-in, as the app draws it: a sky dot with a white rim and a glow,
          below B's label so the lit shape still reads. No ring: the light's edge is the shroud. */}
      <circle cx={262} cy={172} r={8} className="fill-sky-400/30" />
      <circle cx={262} cy={172} r={4.5} className="fill-sky-400 stroke-white" strokeWidth={1.5} />
    </Scene>
  );
}
