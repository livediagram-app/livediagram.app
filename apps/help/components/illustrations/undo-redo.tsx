// Undo / Redo illustrations for the Canvas category (docs/specs/018-help/help-app.md): a change on
// the canvas being stepped back or re-applied, the Undo / Redo pair in the
// bottom-right controls, and the keyboard shortcut. Composed only from the
// shared primitives so the house style holds.

import { Scene, Shape, Label } from './primitives';

/** A small square icon button (undo / redo hook arrow) in the bottom-right controls. */
function ArrowButton({
  x,
  y,
  dir,
  muted = false,
  pressed = false,
}: {
  x: number;
  y: number;
  dir: 'undo' | 'redo';
  muted?: boolean;
  pressed?: boolean;
}) {
  const stroke = muted ? 'stroke-slate-300' : 'stroke-brand-500';
  // Hook arrows matching the editor's Undo / Redo controls: a shaft that curves
  // back on itself with a chevron head, authored in a 16-unit space and centred
  // in the 24-unit button.
  const body =
    dir === 'undo'
      ? 'M3.5 6.5h6.75A3.25 3.25 0 0 1 13.5 9.75v0a3.25 3.25 0 0 1 -3.25 3.25H6'
      : 'M12.5 6.5H5.75A3.25 3.25 0 0 0 2.5 9.75v0A3.25 3.25 0 0 0 5.75 13H10';
  const head = dir === 'undo' ? 'M6 3.5L3 6.5L6 9.5' : 'M10 3.5L13 6.5L10 9.5';
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        width={24}
        height={24}
        rx={5}
        className={pressed ? 'fill-brand-50 stroke-brand-300' : 'fill-white stroke-slate-200'}
        strokeWidth={1.5}
      />
      <g transform="translate(4 4)">
        <path
          d={body}
          fill="none"
          className={stroke}
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={head}
          fill="none"
          className={stroke}
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </g>
  );
}

/** The Undo / Redo pair in the bottom-right controls. */
function UndoRedoControls({ active }: { active: 'undo' | 'redo' }) {
  return (
    <g>
      <rect
        x={332}
        y={196}
        width={60}
        height={32}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <ArrowButton x={336} y={200} dir="undo" pressed={active === 'undo'} />
      <ArrowButton
        x={364}
        y={200}
        dir="redo"
        muted={active === 'undo'}
        pressed={active === 'redo'}
      />
    </g>
  );
}

/** A keyboard shortcut chip with its caption underneath. */
function KeyChip({ x, y, keys, caption }: { x: number; y: number; keys: string; caption: string }) {
  const w = keys.length > 3 ? 56 : 40;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        width={w}
        height={26}
        rx={6}
        className="fill-white stroke-slate-300"
        strokeWidth={1.5}
      />
      <Label x={w / 2} y={14} anchor="middle" size={10} weight={700} tone="body">
        {keys}
      </Label>
      <Label x={w / 2} y={42} anchor="middle" size={10} tone="muted">
        {caption}
      </Label>
    </g>
  );
}

/** Undo: the square just added fades out as it is stepped back. */
export function UndoStep() {
  return (
    <Scene w={420} h={240} bg="canvas">
      <Shape x={40} y={60} label="API" />
      <Shape x={160} y={60} label="Queue" />
      <g opacity={0.35}>
        <Shape x={100} y={140} dashed label="Worker" />
      </g>
      <KeyChip x={300} y={70} keys="⌘ Z" caption="Undo" />
      <UndoRedoControls active="undo" />
    </Scene>
  );
}

/** Redo: the square that was undone comes back. */
export function RedoStep() {
  return (
    <Scene w={420} h={240} bg="canvas">
      <Shape x={40} y={60} label="API" />
      <Shape x={160} y={60} label="Queue" />
      <Shape x={100} y={140} accent label="Worker" />
      <KeyChip x={292} y={70} keys="⌘ ⇧ Z" caption="Redo" />
      <UndoRedoControls active="redo" />
    </Scene>
  );
}
