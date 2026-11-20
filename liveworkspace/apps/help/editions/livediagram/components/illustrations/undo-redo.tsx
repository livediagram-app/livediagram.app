// Undo and Redo in livediagram (docs/specs/007-editor/undo-redo.md): a step taken back and brought back on the
// canvas, with the shortcut and the Undo | Redo card at the head of the corner cluster, lit as the editor lights it.

import { Label, Scene, Shape } from '@liveworkspace/help-site/art/primitives';
import { CLUSTER_W, CornerCluster } from './editor-chrome';

const W = 420;
const H = 230;

/** A keyboard shortcut on a key-shaped chip with what it does under it, top-left at (x, y). */
function KeyChip({ x, y, keys, caption }: { x: number; y: number; keys: string; caption: string }) {
  const w = Math.round(keys.length * 8 + 18);
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={22}
        rx={5}
        className="fill-white stroke-slate-300"
        strokeWidth={0.75}
      />
      <rect x={x + 2} y={y + 18} width={w - 4} height={2} rx={1} className="fill-slate-200" />
      <Label x={x + w / 2} y={y + 11} anchor="middle" size={10} weight={600} tone="strong">
        {keys}
      </Label>
      <Label x={x + w / 2} y={y + 34} anchor="middle" size={9.5} tone="muted">
        {caption}
      </Label>
    </g>
  );
}

/** Undo: the Worker just added fades out as the step is taken back; Undo is ringed, and Redo lights up. */
export function UndoStep() {
  return (
    <Scene w={W} h={H}>
      <Shape x={40} y={50} w={80} h={42} label="API" />
      <Shape x={170} y={50} w={80} h={42} label="Queue" />
      <g opacity={0.35}>
        <Shape x={105} y={124} w={80} h={42} dashed label="Worker" />
      </g>
      <KeyChip x={316} y={56} keys="⌘ Z" caption="Undo" />
      <CornerCluster x={W - 8 - CLUSTER_W} y={H - 8 - 24} canRedo highlight="undo" />
    </Scene>
  );
}

/** Redo: the Worker that was undone comes back; Redo is ringed. */
export function RedoStep() {
  return (
    <Scene w={W} h={H}>
      <Shape x={40} y={50} w={80} h={42} label="API" />
      <Shape x={170} y={50} w={80} h={42} label="Queue" />
      <Shape x={105} y={124} w={80} h={42} accent label="Worker" />
      <KeyChip x={306} y={56} keys="⌘ ⇧ Z" caption="Redo" />
      <CornerCluster x={W - 8 - CLUSTER_W} y={H - 8 - 24} highlight="redo" />
    </Scene>
  );
}
