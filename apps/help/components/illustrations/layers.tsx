// Layer illustrations for the Canvas articles on Layers, Organising and Merging Layers, Hiding,
// Locking and Dimming Layers, and Layer Order and Opacity (docs/specs/018-help/help-app.md). Each
// draws the real surface with its real labels: the Layers panel's rows and footer
// (panels/LayersPanel.tsx, panels/LayerRow.tsx), a row's menu (panels/LayerRowMenu.tsx), and the
// element menu's Layer category (palette/EditorContextMenu.tsx, palette/MoveToLayerRow.tsx).

import type { ReactNode } from 'react';
import { Scene, Label, Shape, Panel, SelectionBox } from './primitives';

// --- Shared bits -------------------------------------------------------------------------------

/** The eye toggle: open, or struck through when the layer is hidden. */
function Eye({ cx, cy, hidden = false }: { cx: number; cy: number; hidden?: boolean }) {
  const cls = hidden ? 'stroke-slate-300' : 'stroke-slate-500';
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <path d="M-6 0 q6 -6 12 0 q-6 6 -12 0 Z" fill="none" className={cls} strokeWidth={1.3} />
      <circle r={1.8} fill="none" className={cls} strokeWidth={1.3} />
      {hidden && <path d="M-6 5 L6 -5" className={cls} strokeWidth={1.3} strokeLinecap="round" />}
    </g>
  );
}

/** A small padlock, centred on (cx, cy). */
function Lock({ cx, cy, cls = 'stroke-brand-600' }: { cx: number; cy: number; cls?: string }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <rect
        x={-4}
        y={-1}
        width={8}
        height={6}
        rx={1.2}
        fill="none"
        className={cls}
        strokeWidth={1.3}
      />
      <path
        d="M-2.4 -1 v-2 a2.4 2.4 0 0 1 4.8 0 v2"
        fill="none"
        className={cls}
        strokeWidth={1.3}
      />
    </g>
  );
}

/** The ellipsis that opens a row's menu. */
function Ellipsis({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g className="fill-slate-400">
      <circle cx={cx - 4} cy={cy} r={1.2} />
      <circle cx={cx} cy={cy} r={1.2} />
      <circle cx={cx + 4} cy={cy} r={1.2} />
    </g>
  );
}

/** A quiet chip beside a layer's name: its element count, or the Empty tag. */
function Chip({ x, cy, text }: { x: number; cy: number; text: string }) {
  const w = text.length * 6 + 8;
  return (
    <g>
      <rect x={x - w} y={cy - 7} width={w} height={14} rx={3} className="fill-slate-100" />
      <Label x={x - w / 2} y={cy + 0.5} anchor="middle" size={10} weight={600} tone="muted">
        {text}
      </Label>
    </g>
  );
}

type Row = {
  name: string;
  thumb: ReactNode;
  count?: number;
  active?: boolean;
  locked?: boolean;
  hidden?: boolean;
};

/** The Layers panel: one row per layer, top of the stack first, and the footer's Merge Up and
 *  Merge Down on the left, Add and Delete on the right. */
function LayersPanel({ x, y, rows }: { x: number; y: number; rows: Row[] }) {
  const w = 214;
  const rowH = 38;
  const h = 30 + rows.length * rowH + 34;
  return (
    <Panel x={x} y={y} w={w} h={h} title="LAYERS">
      {rows.map((r, i) => {
        const ry = y + 28 + i * rowH;
        const cy = ry + rowH / 2;
        return (
          <g key={r.name}>
            {r.active && (
              <rect
                x={x + 5}
                y={ry + 2}
                width={w - 10}
                height={rowH - 4}
                rx={6}
                className="fill-brand-50"
              />
            )}
            <Eye cx={x + 18} cy={cy} hidden={r.hidden} />
            <rect
              x={x + 30}
              y={cy - 13}
              width={38}
              height={26}
              rx={3}
              className="fill-white stroke-slate-200"
              strokeWidth={1}
            />
            <g opacity={r.hidden ? 0.45 : 1}>{r.thumb}</g>
            <Label
              x={x + 76}
              y={cy + 0.5}
              size={11}
              weight={r.active ? 700 : 500}
              tone={r.active ? 'accent' : 'strong'}
            >
              {r.name}
            </Label>
            {r.count === undefined ? (
              <Chip x={x + w - 42} cy={cy} text="Empty" />
            ) : (
              <Chip x={x + w - (r.locked ? 42 : 28)} cy={cy} text={String(r.count)} />
            )}
            {r.locked && <Lock cx={x + w - 32} cy={cy} />}
            <Ellipsis cx={x + w - 15} cy={cy} />
          </g>
        );
      })}
      {/* Footer */}
      <line
        x1={x}
        y1={y + h - 30}
        x2={x + w}
        y2={y + h - 30}
        className="stroke-slate-100"
        strokeWidth={1.2}
      />
      <g
        className="stroke-slate-500"
        fill="none"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Merge Up / Merge Down */}
        <path d={`M${x + 14} ${y + h - 10} v-10 m-4 4 l4 -4 l4 4`} />
        <path d={`M${x + 36} ${y + h - 20} v10 m-4 -4 l4 4 l4 -4`} />
        {/* Add */}
        <path d={`M${x + w - 46} ${y + h - 21} v11 M${x + w - 51.5} ${y + h - 15.5} h11`} />
      </g>
      {/* Delete Layer, in red */}
      <path
        d={`M${x + w - 26} ${y + h - 20} h11 M${x + w - 24} ${y + h - 20} v9 h7 v-9 M${x + w - 22} ${y + h - 22} h3`}
        fill="none"
        className="stroke-rose-500"
        strokeWidth={1.3}
        strokeLinecap="round"
      />
    </Panel>
  );
}

// Each row's mini preview: just that layer's elements, framed against the whole tab.
const thumbNotes = (x: number, cy: number) => (
  <g>
    <rect x={x + 44} y={cy - 9} width={8} height={8} rx={1} className="fill-amber-400" />
    <rect x={x + 54} y={cy - 2} width={8} height={8} rx={1} className="fill-amber-400" />
  </g>
);
const thumbFlow = (x: number, cy: number) => (
  <g>
    <rect
      x={x + 35}
      y={cy - 4}
      width={9}
      height={7}
      rx={1.5}
      className="fill-white stroke-brand-400"
      strokeWidth={1}
    />
    <rect x={x + 52} y={cy - 4} width={9} height={7} rx={1.5} className="fill-brand-400" />
    <path d={`M${x + 44} ${cy - 0.5} h8`} className="stroke-brand-400" strokeWidth={1} />
  </g>
);
const thumbBackground = (x: number, cy: number) => (
  <rect
    x={x + 33}
    y={cy - 10}
    width={32}
    height={20}
    rx={2}
    className="fill-slate-100 stroke-slate-300"
    strokeWidth={1}
  />
);

/** The canvas the panel's layers paint: a background frame, a small flow and two notes. */
function LayeredCanvas({ showNotes = true }: { showNotes?: boolean }) {
  return (
    <g>
      <rect
        x={18}
        y={34}
        width={178}
        height={150}
        rx={8}
        className="fill-slate-50 stroke-slate-300"
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      <Shape x={34} y={84} w={62} h={40} kind="rect" label="Cart" />
      <Shape x={120} y={84} w={62} h={40} kind="rect" accent label="Pay" />
      <path d="M96 104 h22" className="stroke-brand-400" strokeWidth={2.2} />
      <path d="M112 99 l6 5 l-6 5" fill="none" className="stroke-brand-400" strokeWidth={2.2} />
      {showNotes && (
        <g className="help-art-as-drawn">
          <rect x={58} y={136} width={42} height={36} rx={2} className="fill-amber-200" />
          <rect x={112} y={44} width={42} height={36} rx={2} className="fill-amber-200" />
        </g>
      )}
    </g>
  );
}

/** The Layers panel beside the canvas it organises: three layers, the active one highlighted,
 *  a locked background, and an empty layer wearing its tag. */
export function LayersPanelScene() {
  const px = 206;
  const py = 14;
  const cy = (i: number) => py + 28 + i * 38 + 19;
  return (
    <Scene w={430} h={244}>
      <LayeredCanvas />
      <LayersPanel
        x={px}
        y={py}
        rows={[
          { name: 'Review notes', count: 2, thumb: thumbNotes(px, cy(0)) },
          { name: 'Checkout flow', count: 3, active: true, thumb: thumbFlow(px, cy(1)) },
          { name: 'Layer 3', thumb: null },
          { name: 'Background', count: 1, locked: true, thumb: thumbBackground(px, cy(3)) },
        ]}
      />
    </Scene>
  );
}

/** The same canvas with the Review notes layer hidden: its eye is struck through, and its notes
 *  are gone from the canvas while everything else stays. */
export function LayerHiddenScene() {
  const px = 206;
  const py = 14;
  const cy = (i: number) => py + 28 + i * 38 + 19;
  return (
    <Scene w={430} h={206}>
      <LayeredCanvas showNotes={false} />
      <LayersPanel
        x={px}
        y={py}
        rows={[
          { name: 'Review notes', count: 2, hidden: true, thumb: thumbNotes(px, cy(0)) },
          { name: 'Checkout flow', count: 3, active: true, thumb: thumbFlow(px, cy(1)) },
          { name: 'Background', count: 1, locked: true, thumb: thumbBackground(px, cy(2)) },
        ]}
      />
    </Scene>
  );
}

// --- A row's menu ------------------------------------------------------------------------------

/** A labelled tile in a menu grid: glyph over label. */
function MenuTile({
  x,
  y,
  w,
  label,
  children,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  children?: ReactNode;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={40}
        rx={6}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1}
      />
      <g transform={`translate(${x + w / 2} ${y + 13})`}>{children}</g>
      <Label
        x={x + w / 2}
        y={y + 30}
        anchor="middle"
        size={10}
        weight={500}
        // A delete is styled as every other tile (never red).
        className="fill-slate-600"
      >
        {label}
      </Label>
    </g>
  );
}

/** A collapsible menu category's header row. */
function SectionHeader({
  x,
  y,
  w,
  title,
  open,
}: {
  x: number;
  y: number;
  w: number;
  title: string;
  open: boolean;
}) {
  return (
    <g>
      <line x1={x} y1={y} x2={x + w} y2={y} className="stroke-slate-100" strokeWidth={1.2} />
      <Label x={x + 12} y={y + 14} size={11} weight={600} tone="strong">
        {title}
      </Label>
      <path
        d={open ? `M${x + w - 18} ${y + 16} l4 -4 l4 4` : `M${x + w - 18} ${y + 12} l4 4 l4 -4`}
        fill="none"
        className="stroke-slate-400"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </g>
  );
}

/** An opacity slider row: its label, the track with a thumb, and the value. */
function OpacitySlider({ x, y, w, value }: { x: number; y: number; w: number; value: number }) {
  const tx = x + 58;
  const tw = w - 58 - 40;
  return (
    <g>
      <Label x={x} y={y} size={10.5} tone="body">
        Opacity
      </Label>
      <rect x={tx} y={y - 2} width={tw} height={4} rx={2} className="fill-slate-200" />
      <rect
        x={tx}
        y={y - 2}
        width={tw * (value / 100)}
        height={4}
        rx={2}
        className="fill-brand-500"
      />
      <circle
        cx={tx + tw * (value / 100)}
        cy={y}
        r={5.5}
        className="fill-white stroke-brand-500"
        strokeWidth={1.5}
      />
      <Label x={x + w} y={y} anchor="end" size={10.5} weight={600} tone="body">
        {`${value}%`}
      </Label>
    </g>
  );
}

const GLYPH = {
  fill: 'none',
  className: 'stroke-slate-500',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** A layer's menu, opened from its row and hung to the left of the panel: Rename and Delete over
 *  the Layer category (opacity, Bring to Top, Send to Back, Hide Others), Content and Merge. */
export function LayerRowMenuScene() {
  const mx = 18;
  const my = 14;
  const mw = 236;
  const px = 270;
  return (
    <Scene w={430} h={222}>
      {/* The menu */}
      <rect
        x={mx}
        y={my}
        width={mw}
        height={194}
        rx={9}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {/* Quick verbs: Rename, and Delete in red */}
      <path d={`M${mx + 14} ${my + 24} l8 -8 l3 3 l-8 8 h-3 Z`} {...GLYPH} />
      <Label x={mx + 32} y={my + 20} size={11} tone="body">
        Rename
      </Label>
      <path
        d={`M${mx + mw - 64} ${my + 15} h11 M${mx + mw - 62} ${my + 15} v9 h7 v-9 M${mx + mw - 60} ${my + 13} h3`}
        fill="none"
        className="stroke-rose-500"
        strokeWidth={1.3}
        strokeLinecap="round"
      />
      <Label x={mx + mw - 47} y={my + 20} size={11} className="fill-rose-600">
        Delete
      </Label>
      <SectionHeader x={mx} y={my + 36} w={mw} title="Layer" open />
      <OpacitySlider x={mx + 12} y={my + 70} w={mw - 24} value={60} />
      <MenuTile x={mx + 10} y={my + 86} w={70} label="Bring to Top">
        <path d="M0 6 v-12 m-5 5 l5 -5 l5 5" {...GLYPH} />
      </MenuTile>
      <MenuTile x={mx + 83} y={my + 86} w={70} label="Send to Back">
        <path d="M0 -6 v12 m-5 -5 l5 5 l5 -5" {...GLYPH} />
      </MenuTile>
      <MenuTile x={mx + 156} y={my + 86} w={70} label="Hide Others">
        <path d="M-6 0 q6 -6 12 0 q-6 6 -12 0 Z" {...GLYPH} />
      </MenuTile>
      <SectionHeader x={mx} y={my + 136} w={mw} title="Content" open={false} />
      <SectionHeader x={mx} y={my + 164} w={mw} title="Merge" open={false} />
      {/* The panel it hangs beside, its clicked row active */}
      <Panel x={px} y={14} w={146} h={150} title="LAYERS">
        {['Review notes', 'Sketch', 'Layer 1'].map((name, i) => {
          const ry = 42 + i * 36;
          const on = i === 1;
          return (
            <g key={name}>
              {on && (
                <rect
                  x={px + 5}
                  y={ry + 2}
                  width={136}
                  height={32}
                  rx={6}
                  className="fill-brand-50"
                />
              )}
              <Eye cx={px + 18} cy={ry + 18} />
              <Label
                x={px + 32}
                y={ry + 18.5}
                size={11}
                weight={on ? 700 : 500}
                tone={on ? 'accent' : 'strong'}
              >
                {name}
              </Label>
              <Ellipsis cx={px + 128} cy={ry + 18} />
            </g>
          );
        })}
      </Panel>
      <path
        d={`M${mx + mw} ${my + 92} L${px} 96`}
        className="stroke-slate-200"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
    </Scene>
  );
}

// --- The element menu's Layer category ---------------------------------------------------------

/** A selected shape and its menu's Layer category: Bring to Front and Send to Back, the Move to
 *  layer tiles (each a preview of its layer, the selection's own highlighted), and Opacity. */
export function ElementLayerMenuScene() {
  const mx = 168;
  const my = 16;
  const mw = 236;
  return (
    <Scene w={420} h={248}>
      <Shape x={32} y={84} w={96} h={56} kind="rect" accent label="Pay" />
      <SelectionBox x={32} y={84} w={96} h={56} />
      <rect
        x={mx}
        y={my}
        width={mw}
        height={218}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={mx + 14} y={my + 17} size={11} weight={700} tone="strong">
        Layer
      </Label>
      <path
        d={`M${mx + mw - 22} ${my + 19} l4 -4 l4 4`}
        fill="none"
        className="stroke-slate-400"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <line
        x1={mx}
        y1={my + 30}
        x2={mx + mw}
        y2={my + 30}
        className="stroke-slate-200"
        strokeWidth={1}
      />
      <MenuTile x={mx + 10} y={my + 40} w={105} label="Bring to Front">
        <path d="M0 6 v-12 m-5 5 l5 -5 l5 5" {...GLYPH} />
      </MenuTile>
      <MenuTile x={mx + 121} y={my + 40} w={105} label="Send to Back">
        <path d="M0 -6 v12 m-5 -5 l5 5 l5 -5" {...GLYPH} />
      </MenuTile>
      <Label x={mx + 12} y={my + 98} size={10} weight={600} tone="muted">
        Move to layer
      </Label>
      {['Notes', 'Flow', 'Layer 1'].map((name, i) => {
        const tx = mx + 10 + i * 74;
        const on = i === 1;
        return (
          <g key={name}>
            <rect
              x={tx}
              y={my + 108}
              width={68}
              height={44}
              rx={6}
              className={on ? 'fill-brand-50 stroke-brand-400' : 'fill-slate-50 stroke-slate-200'}
              strokeWidth={1.2}
            />
            <rect
              x={tx + 18}
              y={my + 113}
              width={32}
              height={18}
              rx={2}
              className="fill-white stroke-slate-200"
              strokeWidth={1}
            />
            {i === 0 && (
              <rect
                x={tx + 28}
                y={my + 117}
                width={8}
                height={8}
                rx={1}
                className="fill-amber-400"
              />
            )}
            {i === 1 && (
              <g>
                <rect
                  x={tx + 21}
                  y={my + 119}
                  width={9}
                  height={6}
                  rx={1}
                  className="fill-white stroke-brand-400"
                  strokeWidth={1}
                />
                <rect
                  x={tx + 38}
                  y={my + 119}
                  width={9}
                  height={6}
                  rx={1}
                  className="fill-brand-400"
                />
              </g>
            )}
            {i === 2 && (
              <rect
                x={tx + 21}
                y={my + 115}
                width={26}
                height={14}
                rx={1}
                className="fill-slate-100 stroke-slate-300"
                strokeWidth={1}
              />
            )}
            <Label
              x={tx + 34}
              y={my + 142}
              anchor="middle"
              size={10}
              weight={on ? 700 : 500}
              tone={on ? 'accent' : 'body'}
            >
              {name}
            </Label>
          </g>
        );
      })}
      <line
        x1={mx + 10}
        y1={my + 166}
        x2={mx + mw - 10}
        y2={my + 166}
        className="stroke-slate-100"
        strokeWidth={1.2}
      />
      <OpacitySlider x={mx + 12} y={my + 190} w={mw - 24} value={100} />
    </Scene>
  );
}
