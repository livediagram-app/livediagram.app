// The shared bits of the Layers illustrations (./layers and ./layers-menus): the row glyphs,
// the Layers panel with its rows and thumbnails, and the layered canvas behind it.
import type { ReactNode } from 'react';
import { Label, Shape, Panel } from '../primitives';

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
export function Lock({
  cx,
  cy,
  cls = 'stroke-brand-600',
}: {
  cx: number;
  cy: number;
  cls?: string;
}) {
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
export function Ellipsis({ cx, cy }: { cx: number; cy: number }) {
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

export const ROW_H = 40;
// Where the first row starts below the panel's top: the title band, then the header bar.
const ROWS_TOP = 54;

/** The Layers panel: the header bar (layer count + New Layer), one row per layer, top of the
 *  stack first (preview, name over its meta line, padlock, eye, options), and the footer's
 *  labelled Merge Up and Merge Down on the left, Delete on the right. */
export function LayersPanel({ x, y, rows }: { x: number; y: number; rows: Row[] }) {
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
export const thumbNotes = (tx: number, cy: number) => (
  <g>
    <rect x={tx + 12} y={cy - 9} width={8} height={8} rx={1} className="fill-amber-400" />
    <rect x={tx + 23} y={cy - 1} width={8} height={8} rx={1} className="fill-amber-400" />
  </g>
);
export const thumbFlow = (tx: number, cy: number) => (
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
export const thumbBackground = (tx: number, cy: number) => (
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
export const thumbEmpty = () => null;

/** The canvas the panel's layers paint: a background frame, a small flow and two notes. */
export function LayeredCanvas({ showNotes = true }: { showNotes?: boolean }) {
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
