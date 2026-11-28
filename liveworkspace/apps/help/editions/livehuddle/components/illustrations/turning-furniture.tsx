// Scenes for the Turning Furniture article (docs/specs/009-elements/furniture-facing.md), drawn with the labels the
// editor prints. Furniture is drawn from the room's camera at every facing, so these never rotate a drawing: a sofa
// facing left is its side view, tall, its cushions one above the other.

import { Scene, Label, SelectionBox } from '@liveworkspace/help-site/art/primitives';

/** A two-seat sofa seen from the front: its back across the top, two cushions, arms at the ends, legs below. */
function SofaFront({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx={60} cy={66} rx={58} ry={5} className="fill-slate-200" />
      <rect
        x={4}
        y={0}
        width={112}
        height={26}
        rx={9}
        className="fill-brand-300 stroke-brand-500"
        strokeWidth={1.5}
      />
      <rect
        x={14}
        y={22}
        width={44}
        height={30}
        rx={7}
        className="fill-brand-100 stroke-brand-500"
        strokeWidth={1.5}
      />
      <rect
        x={62}
        y={22}
        width={44}
        height={30}
        rx={7}
        className="fill-brand-100 stroke-brand-500"
        strokeWidth={1.5}
      />
      <rect
        x={0}
        y={16}
        width={16}
        height={42}
        rx={6}
        className="fill-brand-200 stroke-brand-500"
        strokeWidth={1.5}
      />
      <rect
        x={104}
        y={16}
        width={16}
        height={42}
        rx={6}
        className="fill-brand-200 stroke-brand-500"
        strokeWidth={1.5}
      />
      <path
        d="M10 58v6M110 58v6"
        className="stroke-slate-500"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </g>
  );
}

/** The same sofa facing left: its side view, the back a bar down the right, the cushions one above the other. */
function SofaSide({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx={34} cy={124} rx={32} ry={5} className="fill-slate-200" />
      <rect
        x={44}
        y={0}
        width={22}
        height={118}
        rx={8}
        className="fill-brand-300 stroke-brand-500"
        strokeWidth={1.5}
      />
      <rect
        x={6}
        y={14}
        width={42}
        height={44}
        rx={7}
        className="fill-brand-100 stroke-brand-500"
        strokeWidth={1.5}
      />
      <rect
        x={6}
        y={60}
        width={42}
        height={44}
        rx={7}
        className="fill-brand-100 stroke-brand-500"
        strokeWidth={1.5}
      />
      <rect
        x={2}
        y={0}
        width={46}
        height={14}
        rx={6}
        className="fill-brand-200 stroke-brand-500"
        strokeWidth={1.5}
      />
      <rect
        x={2}
        y={104}
        width={46}
        height={14}
        rx={6}
        className="fill-brand-200 stroke-brand-500"
        strokeWidth={1.5}
      />
      <path
        d="M8 118v4M60 118v4"
        className="stroke-slate-500"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </g>
  );
}

/** A toolbar button: a rounded square, pressed or not, with its glyph. */
function ToolButton({
  x,
  y,
  on,
  children,
}: {
  x: number;
  y: number;
  on?: boolean;
  children: React.ReactNode;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        width={26}
        height={26}
        rx={6}
        className={on ? 'fill-brand-100 stroke-brand-400' : 'fill-white stroke-transparent'}
        strokeWidth={1.5}
      />
      <g
        transform="translate(13 13)"
        className="fill-none stroke-slate-600"
        strokeWidth={1.6}
        strokeLinecap="round"
      >
        {children}
      </g>
    </g>
  );
}

/** A selected sofa, its menu section's four facings with Left picked, and the sofa a quarter turn later. */
export function TurnASofa() {
  return (
    <Scene w={440} h={250}>
      {/* The element menu's Sofa section: Down, Left, Up and Right, the way it now faces pressed. */}
      <rect
        x={58}
        y={26}
        width={140}
        height={36}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      <ToolButton x={64} y={31}>
        <path d="M0 -5v10M-4 1l4 4 4-4" />
      </ToolButton>
      <ToolButton x={96} y={31} on>
        <path d="M5 0h-10M-1 -4l-4 4 4 4" />
      </ToolButton>
      <ToolButton x={128} y={31}>
        <path d="M0 5v-10M-4 -1l4-4 4 4" />
      </ToolButton>
      <ToolButton x={160} y={31}>
        <path d="M-5 0h10M1 -4l4 4-4 4" />
      </ToolButton>
      <Label x={128} y={18} size={10} weight={600} tone="accent" anchor="middle">
        Sofa · Left
      </Label>

      <SelectionBox x={64} y={88} w={128} h={72} />
      <SofaFront x={68} y={92} />
      <Label x={128} y={190} size={10} tone="muted" anchor="middle">
        Facing down
      </Label>

      {/* A quarter turn clockwise. */}
      <path d="M216 126h52" className="stroke-slate-400" strokeWidth={1.75} strokeLinecap="round" />
      <path
        d="M262 120l7 6-7 6"
        className="fill-none stroke-slate-400"
        strokeWidth={1.75}
        strokeLinecap="round"
      />

      <SofaSide x={310} y={70} />
      <Label x={344} y={220} size={10} tone="muted" anchor="middle">
        Facing left
      </Label>
    </Scene>
  );
}
