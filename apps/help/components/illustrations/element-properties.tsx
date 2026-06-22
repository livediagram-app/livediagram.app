// Illustrations for the element context-menu property articles: layer order
// (front / back / opacity), rotation (snap angles), and animation (boxed loops
// + arrow flow). All built from the shared primitives so they match the rest
// of the help centre's visual language.
import { Scene, Shape, Label, Arrow, SelectionBox } from './primitives';

/** A small padlock glyph, centred on (cx, cy). */
function Padlock({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle r={12} className="fill-white stroke-brand-300" strokeWidth={1.5} />
      <rect x={-5} y={-1} width={10} height={8} rx={1.5} className="fill-brand-500" />
      <path
        d="M-3 -1 V-3.5 a3 3 0 0 1 6 0 V-1"
        fill="none"
        className="stroke-brand-500"
        strokeWidth={1.6}
      />
    </g>
  );
}

/** Two overlapping cards with the front one selected, plus a faded (low-opacity)
 *  twin, illustrating Bring to Front / Send to Back and the opacity slider. */
export function LayerOrder() {
  return (
    <Scene w={400} h={240}>
      {/* Back card */}
      <Shape x={96} y={78} w={120} h={74} kind="rect" label="Back" labelTone="strong" />
      {/* Front card, brought forward and selected */}
      <Shape x={150} y={108} w={120} h={74} kind="rect" accent label="Front" />
      <rect
        x={147}
        y={105}
        width={126}
        height={80}
        rx={5}
        className="fill-none stroke-brand-500"
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      {/* Faded twin showing reduced opacity */}
      <g opacity={0.35}>
        <Shape x={292} y={86} w={84} h={58} kind="rect" accent label="40%" />
      </g>
      <Label x={334} y={162} anchor="middle" size={11} tone="muted">
        Opacity
      </Label>
    </Scene>
  );
}

/** An upright dashed outline with a solid square rotated 45° over it, a curved
 *  handle arc, and the snapped angle, illustrating the Rotation category. */
export function Rotation() {
  const cx = 200;
  const cy = 128;
  return (
    <Scene w={400} h={240}>
      {/* Upright reference outline */}
      <rect
        x={cx - 46}
        y={cy - 46}
        width={92}
        height={92}
        rx={8}
        className="fill-none stroke-slate-300"
        strokeWidth={2}
        strokeDasharray="5 4"
      />
      {/* Rotated element */}
      <g transform={`rotate(45 ${cx} ${cy})`}>
        <rect
          x={cx - 46}
          y={cy - 46}
          width={92}
          height={92}
          rx={8}
          className="fill-brand-500 stroke-brand-600"
          strokeWidth={2}
        />
        {/* Rotation handle stem + knob */}
        <line
          x1={cx}
          y1={cy - 46}
          x2={cx}
          y2={cy - 70}
          className="stroke-brand-500"
          strokeWidth={2}
        />
        <circle
          cx={cx}
          cy={cy - 70}
          r={5}
          className="fill-white stroke-brand-500"
          strokeWidth={2}
        />
      </g>
      {/* Snap-angle arc + readout */}
      <path
        d={`M${cx + 40} ${cy - 40} A 56 56 0 0 1 ${cx + 56} ${cy}`}
        fill="none"
        className="stroke-brand-400"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Label x={cx + 78} y={cy - 18} anchor="middle" size={13} weight={600} tone="accent">
        45°
      </Label>
    </Scene>
  );
}

/** A shape radiating pulse rings beside a flowing dashed arrow, illustrating
 *  boxed-element animation and arrow flow. */
export function ElementAnimation() {
  const cx = 130;
  const cy = 120;
  return (
    <Scene w={400} h={240}>
      {/* Pulse rings */}
      <circle cx={cx} cy={cy} r={52} className="fill-none stroke-brand-200" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={68} className="fill-none stroke-brand-100" strokeWidth={2} />
      <Shape x={cx - 40} y={cy - 28} w={80} h={56} kind="circle" accent label="Pulse" />
      {/* Flowing arrow */}
      <Arrow from={[222, 120]} to={[330, 120]} kind="straight" tone="accent" dashed width={3} />
      <Label x={276} y={150} anchor="middle" size={11} tone="muted">
        Flow
      </Label>
    </Scene>
  );
}

/** A locked element (padlock badge, no resize handles) beside an unlocked one
 *  that still shows its selection handles. */
export function LockedElement() {
  return (
    <Scene w={400} h={240}>
      {/* Unlocked: full selection handles */}
      <Shape x={56} y={92} w={120} h={64} kind="rect" label="Editable" labelTone="strong" />
      <SelectionBox x={56} y={92} w={120} h={64} />
      {/* Locked: padlock badge, no handles */}
      <Shape x={232} y={92} w={120} h={64} kind="rect" accent label="Locked" />
      <Padlock cx={352} cy={92} />
    </Scene>
  );
}
