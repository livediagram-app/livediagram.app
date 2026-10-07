// Element illustrations for the Canvas articles on Annotations and Locking Elements
// (docs/specs/018-help/help-app.md), drawn as the canvas draws them: an annotation is a themed
// circle holding the note marker, with its note floated above it on hover (AnnotationView), and
// a locked element wears a solid padlock badge on its top-left corner and shows no resize handles
// (canvas/element-parts.tsx LockBadge).

import { Scene, Shape, Label, TextBar, SelectionBox } from './primitives';

/** The note marker inside an annotation: a speech bubble with two lines. */
function NoteMarker({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g
      transform={`translate(${cx - 12} ${cy - 13})`}
      fill="none"
      className="stroke-brand-500"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 5.5h16A1.5 1.5 0 0 1 21.5 7v8a1.5 1.5 0 0 1-1.5 1.5H10l-4 3v-3H4A1.5 1.5 0 0 1 2.5 15V7A1.5 1.5 0 0 1 4 5.5Z" />
      <path d="M6.5 9.75h11" />
      <path d="M6.5 12.5h7" />
    </g>
  );
}

/** An annotation pinned beside a shape: the fixed-size themed circle with its note marker, and
 *  the read-only preview of its note floating above it while the pointer rests on it. */
export function AnnotationScene() {
  return (
    <Scene w={420} h={200}>
      <Shape x={54} y={104} w={110} h={58} kind="rect" label="Payments API" />
      {/* The annotation: a themed circle, never resized */}
      <circle cx={196} cy={104} r={22} className="fill-white stroke-brand-300" strokeWidth={2} />
      <NoteMarker cx={196} cy={105} />
      {/* The hover preview, above everything else on the canvas */}
      <g>
        <rect
          x={222}
          y={22}
          width={176}
          height={70}
          rx={9}
          className="fill-white stroke-slate-200"
          strokeWidth={1.5}
        />
        <Label x={236} y={40} size={11} weight={700} tone="strong">
          Rate limit
        </Label>
        <TextBar x={236} y={54} w={146} />
        <TextBar x={236} y={66} w={118} tone="faint" />
      </g>
    </Scene>
  );
}

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
