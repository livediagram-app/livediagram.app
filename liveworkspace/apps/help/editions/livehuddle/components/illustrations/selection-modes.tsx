// Edit | Walk illustrations (liveworkspace/docs/specs/017-help/help-centre.md): the toggle at the very start of the palette strip
// (docs/specs/007-editor/toolbar-layout.md) in both its states, the Format panel the Format Painter opens while its
// brush is loaded, and the pixel characters Avatar mode walks. The toggle replaced the Selection Mode picker: Select,
// Hand, Eraser and Format are no longer modes to pick.
//
// Labels are lifted from apps/editor: the toggle's sides (Edit, Walk), the avatar palette's
// categories, and the format-config catalogue (the Format panel's rows and values).

import type { ReactNode } from 'react';
import { Scene, Panel, Label } from '@liveworkspace/help-site/art/primitives';
import { Bookshelf, Plant, Room, Rug, Sofa, Sticky } from './space-furniture';
import { PixelCharacter } from './pixel-character';
import { PainterGlyph } from './palette-modes-parts';
import { Strip, WalkStrip } from './editor-chrome';

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

/** One strip in the toggle scene: its caption above, then the strip as it stands on that side of the toggle. */
function ToggleRow({ y, caption, on }: { y: number; caption: string; on: 'edit' | 'walk' }) {
  const x = 24;
  return (
    <g>
      <Label x={x + 2} y={y - 12} size={10} weight={700} tone="muted">
        {caption}
      </Label>
      {on === 'walk' ? <WalkStrip x={x} y={y} /> : <Strip x={x} y={y} />}
    </g>
  );
}

/** The Edit | Walk toggle in both its states: building, with Edit on and the palette's categories after it, and
 *  walking, with Walk on and the walker's own controls after it (Avatar, Clothes, Hair, Emotes, Hand, React, Chat). */
export function EditWalkToggleScene() {
  return (
    <Scene w={370} h={150}>
      <ToggleRow y={34} caption="BUILDING" on="edit" />
      <ToggleRow y={110} caption="WALKING" on="walk" />
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
      {/* Source and target: two notes, the second taking the first's green paper and border. */}
      <Sticky x={26} y={80} w={84} h={64} tone="emerald" label="Agenda" lines={2} />
      <rect
        x={26}
        y={80}
        width={84}
        height={64}
        className="fill-none stroke-brand-600"
        strokeWidth={1.5}
      />
      <path
        d="M112 120 C 132 150, 140 160, 150 170"
        className="fill-none stroke-slate-400"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <Sticky x={110} y={160} w={84} h={64} label="Notes" lines={2} />
      <rect
        x={110}
        y={160}
        width={84}
        height={64}
        className="fill-none stroke-brand-600"
        strokeWidth={1.5}
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
              Agenda
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
      <Room x={20} y={16} w={380} h={196} name="Lounge" />
      <Rug cx={250} cy={92} rx={60} ry={26} />
      <Sofa x={230} y={70} />
      <Bookshelf x={40} y={28} w={44} />
      <Plant cx={380} cy={190} />
      <PixelCharacter fx={92} fy={196} />
      <PixelCharacter fx={204} fy={186} shirt="emerald" name="Sam" hair="fill-slate-800" />
      <PixelCharacter fx={272} fy={112} shirt="violet" name="Priya" hair="fill-slate-900" />
    </Scene>
  );
}
