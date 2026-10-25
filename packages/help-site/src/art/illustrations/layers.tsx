// Layer illustrations for the Canvas articles on Layers, Organising and Merging Layers, Hiding,
// Locking and Dimming Layers, and Layer Order and Opacity (docs/specs/018-help/help-app.md). Each
// draws the real surface with its real labels: the Layers panel's rows and footer
// (panels/LayersPanel.tsx, panels/LayerRow.tsx), a row's menu (panels/LayerRowMenu.tsx), and the
// element menu's Layer category (palette/EditorContextMenu.tsx, palette/MoveToLayerRow.tsx).

import type { ReactNode } from 'react';
import { Scene, Label, Shape, Panel, SelectionBox } from '../primitives';

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

type Row = {
  name: string;
  thumb: (tx: number, cy: number) => ReactNode;
  count?: number;
  active?: boolean;
  locked?: boolean;
  hidden?: boolean;
};

const ROW_H = 40;
// Where the first row starts below the panel's top: the title band, then the header bar.
const ROWS_TOP = 54;

/** The Layers panel: the header bar (layer count + New Layer), one row per layer, top of the
 *  stack first (preview, name over its meta line, padlock, eye, options), and the footer's
 *  labelled Merge Up and Merge Down on the left, Delete on the right. */
function LayersPanel({ x, y, rows }: { x: number; y: number; rows: Row[] }) {
  const w = 218;
  const h = ROWS_TOP + rows.length * ROW_H + 30;
  return (
    <Panel x={x} y={y} w={w} h={h} title="LAYERS">
      <Label x={x + 12} y={y + 38} size={9.5} tone="muted">
        {`${rows.length} layers`}
      </Label>
      <rect x={x + w - 86} y={y + 28} width={76} height={19} rx={5} className="fill-brand-600" />
      <path
        d={`M${x + w - 77} ${y + 37.5} h7 M${x + w - 73.5} ${y + 34} v7`}
        className="stroke-white"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <Label x={x + w - 65} y={y + 38} size={9.5} weight={600} tone="onAccent">
        New Layer
      </Label>
      {rows.map((r, i) => {
        const ry = y + ROWS_TOP + i * ROW_H;
        const cy = ry + ROW_H / 2;
        const tx = x + 12;
        const meta = [
          r.count === undefined ? 'Empty' : `${r.count} ${r.count === 1 ? 'element' : 'elements'}`,
        ]
          .concat(r.locked ? ['Locked'] : [])
          .concat(r.hidden ? ['Hidden'] : [])
          .join(' · ');
        return (
          <g key={r.name}>
            {r.active && (
              <rect
                x={x + 5}
                y={ry + 1.5}
                width={w - 10}
                height={ROW_H - 3}
                rx={7}
                className="fill-brand-50 stroke-brand-200"
                strokeWidth={1}
              />
            )}
            <g opacity={r.hidden ? 0.4 : 1}>
              <rect
                x={tx}
                y={cy - 13}
                width={40}
                height={26}
                rx={4}
                className={
                  r.count === undefined
                    ? 'fill-white stroke-slate-300'
                    : 'fill-white stroke-slate-200'
                }
                strokeWidth={1}
                strokeDasharray={r.count === undefined ? '3 2' : undefined}
              />
              {r.thumb(tx, cy)}
            </g>
            <g opacity={r.hidden ? 0.5 : 1}>
              <Label
                x={x + 60}
                y={cy - 5}
                size={11}
                weight={r.active ? 700 : 500}
                tone={r.active ? 'accent' : 'strong'}
              >
                {r.name}
              </Label>
            </g>
            <Label x={x + 60} y={cy + 8} size={9} tone="muted">
              {meta}
            </Label>
            {r.locked && <Lock cx={x + w - 52} cy={cy} />}
            {r.active && !r.locked && <Lock cx={x + w - 52} cy={cy} cls="stroke-slate-400" />}
            <Eye cx={x + w - 33} cy={cy} hidden={r.hidden} />
            {r.active && <Ellipsis cx={x + w - 14} cy={cy} />}
          </g>
        );
      })}
      {/* Footer */}
      <line
        x1={x}
        y1={y + h - 26}
        x2={x + w}
        y2={y + h - 26}
        className="stroke-slate-100"
        strokeWidth={1.2}
      />
      <g
        className="stroke-slate-500"
        fill="none"
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Merge Up / Merge Down: an arrow meeting a line */}
        <path d={`M${x + 10} ${y + h - 17} h7 M${x + 13.5} ${y + h - 7} v-8 m-3 3 l3 -3 l3 3`} />
        <path d={`M${x + 78} ${y + h - 7} h7 M${x + 81.5} ${y + h - 17} v8 m-3 -3 l3 3 l3 -3`} />
        {/* Delete */}
        <path
          d={`M${x + w - 50} ${y + h - 16} h9 M${x + w - 48.5} ${y + h - 16} v8 h6 v-8 M${x + w - 47} ${y + h - 18} h3`}
        />
      </g>
      <Label x={x + 21} y={y + h - 11.5} size={9.5} weight={500} tone="body">
        Merge Up
      </Label>
      <Label x={x + 89} y={y + h - 11.5} size={9.5} weight={500} tone="body">
        Merge Down
      </Label>
      <Label x={x + w - 37} y={y + h - 11.5} size={9.5} weight={500} tone="body">
        Delete
      </Label>
    </Panel>
  );
}

// Each row's preview: just that layer's elements, framed against the whole tab. `tx` is the
// preview's left edge, `cy` the row's centre.
const thumbNotes = (tx: number, cy: number) => (
  <g>
    <rect x={tx + 12} y={cy - 9} width={8} height={8} rx={1} className="fill-amber-400" />
    <rect x={tx + 23} y={cy - 1} width={8} height={8} rx={1} className="fill-amber-400" />
  </g>
);
const thumbFlow = (tx: number, cy: number) => (
  <g>
    <rect
      x={tx + 6}
      y={cy - 4}
      width={10}
      height={8}
      rx={1.5}
      className="fill-white stroke-brand-400"
      strokeWidth={1}
    />
    <rect x={tx + 24} y={cy - 4} width={10} height={8} rx={1.5} className="fill-brand-400" />
    <path d={`M${tx + 16} ${cy} h8`} className="stroke-brand-400" strokeWidth={1} />
  </g>
);
const thumbBackground = (tx: number, cy: number) => (
  <rect
    x={tx + 3}
    y={cy - 10}
    width={34}
    height={20}
    rx={2}
    className="fill-slate-100 stroke-slate-300"
    strokeWidth={1}
  />
);
const thumbEmpty = () => null;

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

/** The Layers panel beside the canvas it organises: four layers, the active one highlighted,
 *  a locked background, and an empty layer's dashed preview. */
export function LayersPanelScene() {
  return (
    <Scene w={436} h={264}>
      <LayeredCanvas />
      <LayersPanel
        x={206}
        y={14}
        rows={[
          { name: 'Review notes', count: 2, thumb: thumbNotes },
          { name: 'Checkout flow', count: 3, active: true, thumb: thumbFlow },
          { name: 'Layer 3', thumb: thumbEmpty },
          { name: 'Background', count: 1, locked: true, thumb: thumbBackground },
        ]}
      />
    </Scene>
  );
}

/** The same canvas with the Review notes layer hidden: its eye is struck through, its row fades,
 *  and its notes are gone from the canvas while everything else stays. */
export function LayerHiddenScene() {
  return (
    <Scene w={436} h={224}>
      <LayeredCanvas showNotes={false} />
      <LayersPanel
        x={206}
        y={14}
        rows={[
          { name: 'Review notes', count: 2, hidden: true, thumb: thumbNotes },
          { name: 'Checkout flow', count: 3, active: true, thumb: thumbFlow },
          { name: 'Background', count: 1, locked: true, thumb: thumbBackground },
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

/** A plain menu row: its glyph (drawn centred on the origin) and its label. */
function MenuRow({
  x,
  y,
  label,
  disabled = false,
  children,
}: {
  x: number;
  y: number;
  label: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <g opacity={disabled ? 0.4 : 1}>
      <g transform={`translate(${x + 18} ${y})`}>{children}</g>
      <Label x={x + 34} y={y + 0.5} size={10.5} tone="strong">
        {label}
      </Label>
    </g>
  );
}

/** A group separator inside a menu. */
function MenuRule({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <line x1={x + 8} y1={y} x2={x + w - 8} y2={y} className="stroke-slate-200" strokeWidth={1} />
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

/** A layer's menu, opened from its row and hung to the left of the panel: the layer's name and
 *  preview, its opacity, then every verb as a row (no categories to open): hide, lock and Hide
 *  Others; Bring to Top and Send to Bottom; the two merges; Rename, Clear Layer and Delete Layer. */
export function LayerRowMenuScene() {
  const mx = 18;
  const my = 14;
  const mw = 206;
  const px = 246;
  const ROW = 19;
  // Each group's first row, top to bottom, with an 9px separator between groups.
  const g1 = my + 88;
  const g2 = g1 + 3 * ROW + 9;
  const g3 = g2 + 2 * ROW + 9;
  const g4 = g3 + 2 * ROW + 9;
  const h = g4 + 3 * ROW - my;
  return (
    <Scene w={436} h={h + 28}>
      {/* The menu */}
      <rect
        x={mx}
        y={my}
        width={mw}
        height={h}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {/* Header: the layer's preview, name and count */}
      <rect
        x={mx + 12}
        y={my + 10}
        width={30}
        height={20}
        rx={3}
        className="fill-white stroke-slate-200"
        strokeWidth={1}
      />
      {thumbFlow(mx + 7, my + 20)}
      <Label x={mx + 50} y={my + 16} size={11} weight={700} tone="strong">
        Checkout flow
      </Label>
      <Label x={mx + 50} y={my + 28} size={9} tone="muted">
        3 elements
      </Label>
      <line
        x1={mx}
        y1={my + 40}
        x2={mx + mw}
        y2={my + 40}
        className="stroke-slate-100"
        strokeWidth={1.2}
      />
      <OpacitySlider x={mx + 12} y={my + 60} w={mw - 24} value={60} />
      <MenuRule x={mx} y={g1 - 14} w={mw} />
      <MenuRow x={mx} y={g1} label="Hide Layer">
        <path d="M-6 0 q6 -6 12 0 q-6 6 -12 0 Z M-6 5 L6 -5" {...GLYPH} />
      </MenuRow>
      <MenuRow x={mx} y={g1 + ROW} label="Lock Layer">
        <Lock cx={0} cy={-1} cls="stroke-slate-500" />
      </MenuRow>
      <MenuRow x={mx} y={g1 + 2 * ROW} label="Hide Others">
        <path d="M-6 -3 v-3 h3 M3 -6 h3 v3 M6 3 v3 h-3 M-3 6 h-3 v-3" {...GLYPH} />
        <circle r={1.6} {...GLYPH} />
      </MenuRow>
      <MenuRule x={mx} y={g2 - 14} w={mw} />
      <MenuRow x={mx} y={g2} label="Bring to Top">
        <path d="M-5 -6 h10 M0 6 v-9 m-4 4 l4 -4 l4 4" {...GLYPH} />
      </MenuRow>
      <MenuRow x={mx} y={g2 + ROW} label="Send to Bottom">
        <path d="M-5 6 h10 M0 -6 v9 m-4 -4 l4 4 l4 -4" {...GLYPH} />
      </MenuRow>
      <MenuRule x={mx} y={g3 - 14} w={mw} />
      <MenuRow x={mx} y={g3} label="Merge With Layer Above">
        <path d="M-5 -6 h10 M0 6 v-9 m-4 4 l4 -4 l4 4" {...GLYPH} />
      </MenuRow>
      <MenuRow x={mx} y={g3 + ROW} label="Merge With Layer Below">
        <path d="M-5 6 h10 M0 -6 v9 m-4 -4 l4 4 l4 -4" {...GLYPH} />
      </MenuRow>
      <MenuRule x={mx} y={g4 - 14} w={mw} />
      <MenuRow x={mx} y={g4} label="Rename">
        <path d="M-5 5 l8 -8 l3 3 l-8 8 h-3 Z" {...GLYPH} />
      </MenuRow>
      <MenuRow x={mx} y={g4 + ROW} label="Clear Layer">
        <path d="M-6 3 l6 -7 l5 5 l-5 5 h-4 Z M-2 -1 l5 5" {...GLYPH} />
      </MenuRow>
      <MenuRow x={mx} y={g4 + 2 * ROW} label="Delete Layer">
        <path d="M-5 -4 h10 M-3.5 -4 v9 h7 v-9 M-1.5 -6 h3" {...GLYPH} />
      </MenuRow>
      {/* The panel it hangs beside, its clicked row active */}
      <Panel x={px} y={my + 70} w={176} h={150} title="LAYERS">
        {[
          { name: 'Review notes', thumb: thumbNotes },
          { name: 'Checkout flow', thumb: thumbFlow },
          { name: 'Background', thumb: thumbBackground },
        ].map(({ name, thumb }, i) => {
          const ry = my + 70 + 28 + i * ROW_H;
          const cy = ry + ROW_H / 2;
          const on = i === 1;
          return (
            <g key={name}>
              {on && (
                <rect
                  x={px + 5}
                  y={ry + 1.5}
                  width={166}
                  height={ROW_H - 3}
                  rx={7}
                  className="fill-brand-50 stroke-brand-200"
                  strokeWidth={1}
                />
              )}
              <rect
                x={px + 12}
                y={cy - 13}
                width={40}
                height={26}
                rx={4}
                className="fill-white stroke-slate-200"
                strokeWidth={1}
              />
              {thumb(px + 12, cy)}
              <Label
                x={px + 60}
                y={cy + 0.5}
                size={11}
                weight={on ? 700 : 500}
                tone={on ? 'accent' : 'strong'}
              >
                {name}
              </Label>
              {on && <Ellipsis cx={px + 162} cy={cy} />}
            </g>
          );
        })}
      </Panel>
      <path
        d={`M${mx + mw} ${my + 70 + 28 + ROW_H * 1.5} H${px}`}
        className="stroke-slate-300"
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
    <Scene w={420} h={298}>
      <Shape x={32} y={112} w={96} h={56} kind="rect" accent label="Pay" />
      <SelectionBox x={32} y={112} w={96} h={56} />
      <rect
        x={mx}
        y={my}
        width={mw}
        height={268}
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
        // A two-column grid of 105-wide tiles, the third tile wrapping to a second row.
        const tx = mx + 10 + 18.5;
        const on = i === 1;
        return (
          <g key={name} transform={`translate(${(i % 2) * 111} ${Math.floor(i / 2) * 50})`}>
            <rect
              x={tx - 18.5}
              y={my + 108}
              width={105}
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
        y1={my + 216}
        x2={mx + mw - 10}
        y2={my + 216}
        className="stroke-slate-100"
        strokeWidth={1.2}
      />
      <OpacitySlider x={mx + 12} y={my + 240} w={mw - 24} value={100} />
    </Scene>
  );
}
