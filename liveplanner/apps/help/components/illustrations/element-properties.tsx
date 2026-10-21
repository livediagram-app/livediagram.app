// Illustrations for the element context-menu property articles: layer order
// (front / back / opacity), rotation (snap angles), and animation (boxed loops
// + arrow flow). All built from the shared primitives so they match the rest
// of the help centre's visual language.
import { Scene, Shape, Label, Arrow } from './primitives';

/** Two overlapping cards with the front one selected, plus a faded (low-opacity)
 *  twin, illustrating Bring to Front / Send to Back and the opacity slider. */
export function LayerOrder() {
  return (
    <Scene w={400} h={240}>
      {/* Back card */}
      <Shape x={66} y={58} w={120} h={74} kind="rect" label="Back" labelTone="strong" />
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

/** An upright dashed outline with a solid square rotated 45° over it, an angle
 *  arc clear of both, and the chosen angle, illustrating the Rotation category. */
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
      </g>
      {/* Snap-angle arc + readout */}
      <path
        d={`M${cx + 56.6} ${cy - 56.6} A 80 80 0 0 1 ${cx + 80} ${cy}`}
        fill="none"
        className="stroke-brand-400"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Label x={cx + 104} y={cy - 30} anchor="middle" size={13} weight={600} tone="accent">
        45°
      </Label>
    </Scene>
  );
}

/** Two shapes joined by a flowing dashed arrow, illustrating arrow flow. */
export function ElementAnimation() {
  return (
    <Scene w={400} h={240}>
      <Shape x={40} y={92} w={96} h={56} label="Order" />
      <Arrow from={[136, 120]} to={[264, 120]} kind="straight" tone="accent" dashed width={3} />
      <Shape x={264} y={92} w={96} h={56} accent label="Ship" />
      <Label x={200} y={150} anchor="middle" size={11} tone="muted">
        Arrow flow
      </Label>
    </Scene>
  );
}
