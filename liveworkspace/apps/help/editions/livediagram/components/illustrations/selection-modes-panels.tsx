// The panels each canvas tool opens while it is active (selection-modes.tsx): Eraser, Format,
// Laser and Spotlight, each docked top-right under the picker, plus the Spotlight tool on the
// canvas. Rows and values are lifted from apps/editor's *-config.ts catalogues, and the Format
// banner from TopCenterChrome.tsx.

import type { ReactNode } from 'react';
import { Scene, Shape, Arrow, Panel, Label } from '@liveworkspace/help-site/art/primitives';
import { PainterGlyph } from './palette-modes-parts';
import { Chevron, PickerTrigger } from './selection-modes-picker';

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
