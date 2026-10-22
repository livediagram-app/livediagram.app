// Element illustrations for the Canvas article on Locking Elements (docs/specs/018-help/help-app.md),
// drawn as the canvas draws them: a locked element wears a solid padlock badge on its top-left corner and shows no resize handles
// (canvas/element-parts.tsx LockBadge).

import { Scene, Shape, Label, SelectionBox } from './primitives';

/** A small solid padlock badge, centred on (cx, cy). */
function LockBadge({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle r={10} className="fill-brand-500" />
      <g className="help-art-as-drawn">
        <rect x={-4} y={-1} width={8} height={6.5} rx={1.3} className="fill-white" />
        <path
          d="M-2.5 -1 v-2 a2.5 2.5 0 0 1 5 0 v2"
          fill="none"
          className="stroke-white"
          strokeWidth={1.5}
        />
      </g>
    </g>
  );
}

/** An editable element with its resize handles beside a locked one: the padlock badge on its
 *  top-left corner and no handles to grab, even while it is selected. */
export function LockedElementScene() {
  return (
    <Scene w={400} h={200}>
      <Shape x={52} y={72} w={120} h={64} kind="rect" label="Editable" labelTone="strong" />
      <SelectionBox x={52} y={72} w={120} h={64} />
      <Shape x={232} y={72} w={120} h={64} kind="rect" accent label="Locked" />
      <rect
        x={229}
        y={69}
        width={126}
        height={70}
        rx={8}
        fill="none"
        className="stroke-brand-500"
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      <LockBadge cx={232} cy={72} />
      <Label x={112} y={164} anchor="middle" size={10.5} tone="muted">
        Handles to resize
      </Label>
      <Label x={292} y={164} anchor="middle" size={10.5} tone="muted">
        No handles, can't be moved
      </Label>
    </Scene>
  );
}
