import { Arrow, Cursor, Label, SelectionBox, Shape } from '@liveworkspace/help-site/art/primitives';
import { Card, Stage } from '@liveworkspace/help-site/art/parts';

// Canvas: the infinite canvas itself, mid-flowchart. A decision branching to two outcomes, a sticky note pinned
// beside it, the palette strip floating above and the zoom and undo controls in their corners.
export function CanvasArt() {
  return (
    <Stage>
      {/* The palette strip. */}
      <Card x={112} y={14} w={176} h={28} r={9}>
        <path
          d="M124 21 v13 l3.5 -3.2 2.3 4.8 2.3 -1 -2.2 -4.6 4.6 -0.3 Z"
          className="fill-brand-500"
        />
        <rect
          x={146}
          y={22}
          width={13}
          height={12}
          rx={2.5}
          className="fill-none stroke-slate-500"
          strokeWidth={1.6}
        />
        <ellipse
          cx={177}
          cy={28}
          rx={7}
          ry={6}
          className="fill-none stroke-slate-500"
          strokeWidth={1.6}
        />
        <path
          d="M200 21 l7 7 -7 7 -7 -7 Z"
          className="fill-none stroke-slate-500"
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
        <path
          d="M216 34 l12 -12 m-6 0 h6 v6"
          className="fill-none stroke-slate-500"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Label x={244} y={28.5} anchor="middle" size={13} weight={700} tone="body">
          T
        </Label>
        <rect
          x={259}
          y={21}
          width={14}
          height={14}
          rx={2}
          className="fill-amber-200 stroke-amber-400"
          strokeWidth={1.2}
        />
      </Card>

      {/* The flow. */}
      <Arrow from={[102, 112]} to={[127, 112]} />
      <Arrow from={[194, 112]} to={[223, 80]} kind="elbow" />
      <Arrow from={[194, 112]} to={[223, 146]} kind="elbow" />
      <Shape x={30} y={95} w={72} h={34} kind="stadium" label="Start" />
      <Shape x={130} y={83} w={64} h={58} kind="diamond" label="Ready?" />
      <Shape x={226} y={62} w={84} h={36} accent label="Ship it" />
      <Shape x={226} y={128} w={84} h={36} label="Iterate" />
      <SelectionBox x={221} y={57} w={94} h={46} />

      {/* A sticky note, pinned at a slight angle. */}
      <g transform="rotate(5 352 132)" className="help-art-as-drawn">
        <rect
          x={325}
          y={106}
          width={56}
          height={54}
          rx={3}
          className="fill-slate-900/[0.06]"
          transform="translate(2 4)"
        />
        <rect x={325} y={106} width={56} height={54} rx={3} className="fill-amber-200" />
        <rect x={325} y={106} width={56} height={9} rx={3} className="fill-amber-300" />
        <Label x={332} y={127} size={9} weight={600} className="fill-amber-900 help-art-as-drawn">
          Launch
        </Label>
        <Label x={332} y={140} size={9} weight={600} className="fill-amber-900 help-art-as-drawn">
          on Friday!
        </Label>
      </g>

      <Cursor x={300} y={92} colour="brand" />

      {/* Undo and zoom. */}
      <Card x={14} y={184} w={56} h={24} r={8}>
        <path
          d="M30 192 l-4 4 4 4 M26 196 h8 a4 4 0 0 1 0 8 h-2"
          className="fill-none stroke-slate-500"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M54 192 l4 4 -4 4 M58 196 h-8 a4 4 0 0 0 0 8 h2"
          className="fill-none stroke-slate-400"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Card>
      <Card x={298} y={184} w={88} h={24} r={8}>
        <Label x={312} y={196.5} anchor="middle" size={13} weight={600} tone="body">
          −
        </Label>
        <Label x={342} y={196.5} anchor="middle" size={10} weight={700} tone="strong">
          100%
        </Label>
        <Label x={372} y={196.5} anchor="middle" size={13} weight={600} tone="body">
          +
        </Label>
      </Card>
    </Stage>
  );
}
