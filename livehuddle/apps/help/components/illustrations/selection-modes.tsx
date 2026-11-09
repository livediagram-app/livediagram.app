// Edit | Walk illustrations (docs/specs/018-help/help-app.md): the toggle at the very start of the palette strip
// (docs/specs/007-editor/toolbar-layout.md) in both its states, the Format panel the Format Painter opens while its
// brush is loaded, and the pixel characters Avatar mode walks. The toggle replaced the Selection Mode picker: Select,
// Hand, Eraser and Format are no longer modes to pick.
//
// Labels are lifted from apps/editor: the toggle's sides (Edit, Walk), the avatar palette's
// categories, and the format-config catalogue (the Format panel's rows and values).

import type { ReactNode } from 'react';
import { Scene, Shape, Arrow, Panel, Label } from '@liveworkspace/help-site/art/primitives';
import { PixelCharacter } from './pixel-character';
import { EditWalkToggle, PainterGlyph } from './palette-modes-parts';

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

// --- The Edit | Walk toggle ---------------------------------------------------

/** One strip in the toggle scene: its caption above, the toggle at its start, then the names that follow it on
 *  that strip, faded off to the right. */
function ToggleRow({
  y,
  caption,
  on,
  after,
}: {
  y: number;
  caption: string;
  on: 'edit' | 'walk';
  after: string[];
}) {
  const x = 24;
  // Each name's left edge: they start past the toggle's divider, about 6 a character apart at this size.
  const lefts = after.map((_, i) =>
    after.slice(0, i).reduce((at, name) => at + name.length * 6 + 16, x + 122),
  );
  return (
    <g>
      <Label x={x + 2} y={y - 12} size={10} weight={700} tone="muted">
        {caption}
      </Label>
      <rect
        x={x}
        y={y}
        width={372}
        height={40}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <EditWalkToggle x={x + 8} y={y + 8} on={on} labelSize={11} />
      <path d={`M${x + 112} ${y + 11}v18`} className="stroke-slate-200" strokeWidth={1} />
      {after.map((name, i) => (
        <g key={name} opacity={Math.max(0.25, 1 - i * 0.22)}>
          <Label x={lefts[i]!} y={y + 20.5} size={10.5} weight={500} tone="body">
            {name}
          </Label>
        </g>
      ))}
    </g>
  );
}

/** The Edit | Walk toggle in both its states: building, with Edit on and the palette's categories after it, and
 *  walking, with Walk on at the start of the avatar palette, ahead of the look. */
export function EditWalkToggleScene() {
  return (
    <Scene w={420} h={176}>
      <ToggleRow
        y={30}
        caption="BUILDING"
        on="edit"
        after={['Write', 'Rooms', 'Seats', 'Travel']}
      />
      <ToggleRow y={112} caption="WALKING" on="walk" after={['Gender', 'Clothes', 'Actions']} />
    </Scene>
  );
}

// --- Tool panels --------------------------------------------------------------

type PanelRow = { label: string; value: string; amber?: boolean };

/** A tool's own panel (Format): a titled panel that
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

/** The Format Painter mid-job: the message under the strip, a source loaded in the
 *  Format panel (its swatch drawn from the enabled parts only), and a target
 *  being painted. */
export function FormatPanelScene() {
  return (
    <Scene w={420} h={240}>
      {/* The message under the strip, with Done to stop painting */}
      <rect x={14} y={12} width={300} height={28} rx={14} className="fill-brand-500" />
      <g transform="translate(30 26)" className="help-art-as-drawn">
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

// --- Avatar -----------------------------------------------------------------

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
