// The Pen illustrations for The Pen and Edit Points article (liveworkspace/docs/specs/017-help/help-centre.md; drawing
// docs/specs/023-draw-mode/path-tool.md). Real labels from apps/live/components/canvas/path/PathEditToolbar.tsx: the
// node type choice (Corner, Mirrored, Aligned), Close Path and Done. Corner nodes draw as squares, smooth ones as
// circles, and a selected node shows its two handles.

import { Label, Scene } from '@liveworkspace/help-site/art/primitives';

function Chip({ x, w, label, on = false }: { x: number; w: number; label: string; on?: boolean }) {
  return (
    <g>
      <rect
        x={x}
        y={20}
        width={w}
        height={22}
        rx={5}
        className={on ? 'fill-brand-500' : 'fill-white stroke-slate-200'}
        strokeWidth={on ? 0 : 1.2}
      />
      <Label
        x={x + w / 2}
        y={31}
        size={10}
        weight={600}
        anchor="middle"
        tone={on ? 'onAccent' : 'body'}
      >
        {label}
      </Label>
    </g>
  );
}

/** Edit Points on a path: the edit toolbar over it, square corners, round smooth points and one selected point's handles. */
export function PenEditPointsScene() {
  return (
    <Scene w={420} h={250} bg="canvas">
      <rect
        x={50}
        y={12}
        width={320}
        height={38}
        rx={9}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Chip x={58} w={54} label="Corner" />
      <Chip x={116} w={62} label="Mirrored" on />
      <Chip x={182} w={56} label="Aligned" />
      <Chip x={244} w={68} label="Close Path" />
      <Chip x={318} w={44} label="Done" />
      <path
        d="M90 200 C 120 110, 200 90, 230 150 S 320 210, 340 110"
        className="fill-none stroke-slate-700"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <line x1={190} y1={110} x2={270} y2={190} className="stroke-brand-400" strokeWidth={1.4} />
      <circle cx={190} cy={110} r={4.5} className="fill-white stroke-brand-500" strokeWidth={1.6} />
      <circle cx={270} cy={190} r={4.5} className="fill-white stroke-brand-500" strokeWidth={1.6} />
      <rect
        x={84}
        y={194}
        width={12}
        height={12}
        className="fill-white stroke-brand-500"
        strokeWidth={2}
      />
      <circle cx={230} cy={150} r={7} className="fill-brand-500 stroke-white" strokeWidth={2} />
      <rect
        x={334}
        y={104}
        width={12}
        height={12}
        className="fill-white stroke-brand-500"
        strokeWidth={2}
      />
      <Label x={96} y={224} size={10} tone="muted" anchor="middle">
        Corner point
      </Label>
      <Label x={230} y={226} size={10} tone="muted" anchor="middle">
        Smooth point, selected
      </Label>
      <Label x={340} y={96} size={10} tone="muted" anchor="middle">
        Corner point
      </Label>
    </Scene>
  );
}
