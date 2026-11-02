// The diagram-building elements' figures (docs/specs/009-elements/): Card, accent edge, Badge and Step number,
// and Boundary. Each is drawn the way the element draws on the canvas: the same slots, the same places for a chip to
// sit.

import { Arrow, Label, Scene, Shape, TextBar } from '@liveworkspace/help-site/art/primitives';

// --- Card ----------------------------------------------------------------------

// A card's tile: a rounded square washed in the accent, with a simple glyph in it.
function MediaTile({ x, y, s = 30 }: { x: number; y: number; s?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={s} height={s} rx={s * 0.24} className="fill-brand-100" />
      <rect
        x={x + s * 0.28}
        y={y + s * 0.3}
        width={s * 0.44}
        height={s * 0.4}
        rx={2}
        className="fill-none stroke-brand-600"
        strokeWidth={1.6}
      />
    </g>
  );
}

function Tag({ x, y, text, w }: { x: number; y: number; text: string; w: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={16} rx={8} className="fill-brand-50 stroke-brand-200" />
      <Label x={x + w / 2} y={y + 8.5} anchor="middle" size={9} tone="accent">
        {text}
      </Label>
    </g>
  );
}

/** Three cards: a service with its tile, meta line, body and tags; one with a header band and a badge; a callout. */
export function CardAnatomy() {
  return (
    <Scene w={420} h={200}>
      {/* A service card: tile, title, meta, body, tags. */}
      <rect
        x={14}
        y={30}
        width={136}
        height={128}
        rx={10}
        className="fill-white stroke-brand-300"
      />
      <MediaTile x={24} y={40} />
      <Label x={62} y={50} size={11} weight={700} tone="strong">
        Orders service
      </Label>
      <Label x={62} y={64} size={9} tone="muted">
        ECS Fargate
      </Label>
      <TextBar x={24} y={84} w={112} />
      <TextBar x={24} y={96} w={88} />
      <Tag x={24} y={130} w={40} text="gRPC" />
      <Tag x={68} y={130} w={56} text="2 tasks" />
      <Label x={82} y={180} anchor="middle" size={10} tone="muted">
        Tile, meta line, tags
      </Label>

      {/* A card with a header band and a badge. */}
      <rect
        x={160}
        y={30}
        width={120}
        height={128}
        rx={10}
        className="fill-white stroke-brand-500"
      />
      <path
        d="M160 70 V40 a10 10 0 0 1 10 -10 H270 a10 10 0 0 1 10 10 V70 Z"
        className="fill-brand-500"
      />
      <circle cx={180} cy={50} r={11} className="fill-white" />
      <circle cx={180} cy={50} r={4} className="fill-brand-500" />
      <Label x={198} y={50} size={11} weight={700} tone="onAccent">
        API gateway
      </Label>
      <TextBar x={172} y={86} w={96} />
      <TextBar x={172} y={98} w={72} />
      <TextBar x={172} y={110} w={84} />
      <Label x={220} y={180} anchor="middle" size={10} tone="muted">
        Header band, badge
      </Label>

      {/* The Callout preset: a soft card with a badge. */}
      <rect
        x={290}
        y={30}
        width={116}
        height={92}
        rx={10}
        className="fill-amber-50 stroke-amber-400"
      />
      <circle cx={308} cy={50} r={10} className="fill-amber-400" />
      <Label x={308} y={51} anchor="middle" size={11} weight={700} className="fill-white">
        !
      </Label>
      <Label x={324} y={50} size={11} weight={700} tone="strong">
        Heads up
      </Label>
      <TextBar x={300} y={72} w={94} />
      <TextBar x={300} y={84} w={80} />
      <TextBar x={300} y={96} w={60} />
      <Label x={348} y={180} anchor="middle" size={10} tone="muted">
        Callout
      </Label>
    </Scene>
  );
}

/** An accent edge on the left, the top and the bottom of three boxes. */
export function AccentEdges() {
  const boxes = [
    { x: 24, label: 'Left', edge: 'left' },
    { x: 152, label: 'Top', edge: 'top' },
    { x: 280, label: 'Bottom', edge: 'bottom' },
  ] as const;
  return (
    <Scene w={420} h={130}>
      {boxes.map((b) => (
        <g key={b.edge}>
          <defs>
            <clipPath id={`accent-edge-${b.edge}`}>
              <rect x={b.x} y={30} width={116} height={60} rx={8} />
            </clipPath>
          </defs>
          <rect x={b.x} y={30} width={116} height={60} rx={8} className="fill-white" />
          <g clipPath={`url(#accent-edge-${b.edge})`}>
            {b.edge === 'left' && (
              <rect x={b.x} y={30} width={6} height={60} className="fill-violet-500" />
            )}
            {b.edge === 'top' && (
              <rect x={b.x} y={30} width={116} height={6} className="fill-teal-500" />
            )}
            {b.edge === 'bottom' && (
              <rect x={b.x} y={84} width={116} height={6} className="fill-amber-500" />
            )}
          </g>
          <rect
            x={b.x}
            y={30}
            width={116}
            height={60}
            rx={8}
            className="fill-none stroke-slate-300"
          />
          <Label x={b.x + 58} y={61} anchor="middle" size={12} weight={600} tone="strong">
            {b.label}
          </Label>
        </g>
      ))}
    </Scene>
  );
}

// --- Badge and Step number -------------------------------------------------------

function StepDisc({ cx, cy, n, r = 11 }: { cx: number; cy: number; n: number; r?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} className="fill-brand-500 stroke-white" strokeWidth={2} />
      <Label x={cx} y={cy + 0.5} anchor="middle" size={11} weight={700} tone="onAccent">
        {n}
      </Label>
    </g>
  );
}

/** A flow numbered with Step numbers on its boxes' corners, and a New badge on a box's top-right point. */
export function BadgesAndSteps() {
  const boxes = [
    { x: 24, label: 'Sign up' },
    { x: 152, label: 'Verify' },
    { x: 280, label: 'Order' },
  ];
  return (
    <Scene w={420} h={160}>
      {boxes.map((b, i) => (
        <g key={b.label}>
          <Shape x={b.x} y={56} w={108} h={52} label={b.label} />
          {i < boxes.length - 1 && <Arrow from={[b.x + 110, 82]} to={[b.x + 126, 82]} />}
          <StepDisc cx={b.x} cy={56} n={i + 1} />
        </g>
      ))}
      {/* A badge sits on the last box's top-right point, half over its edge. */}
      <rect x={356} y={47} width={40} height={18} rx={9} className="fill-emerald-500" />
      <Label x={376} y={56.5} anchor="middle" size={10} weight={700} className="fill-white">
        New
      </Label>
      <Label x={210} y={140} anchor="middle" size={11} weight={600} tone="accent">
        Drag a box: its step number and badge travel with it
      </Label>
    </Scene>
  );
}

/** The eight points a badge or step can sit on, round one box. */
export function AttachPoints() {
  const x = 150;
  const y = 40;
  const w = 120;
  const h = 64;
  const pts: [number, number][] = [
    [x, y],
    [x + w / 2, y],
    [x + w, y],
    [x + w, y + h / 2],
    [x + w, y + h],
    [x + w / 2, y + h],
    [x, y + h],
    [x, y + h / 2],
  ];
  return (
    <Scene w={420} h={150}>
      <Shape x={x} y={y} w={w} h={h} label="Payments" />
      {pts.map(([px, py]) => (
        <circle
          key={`${px}-${py}`}
          cx={px}
          cy={py}
          r={6}
          className="fill-brand-100 stroke-brand-500"
          strokeWidth={1.5}
          strokeDasharray="2 2"
        />
      ))}
      <Label x={210} y={134} anchor="middle" size={11} tone="muted">
        Drop a badge or step on any of the eight points to attach it
      </Label>
    </Scene>
  );
}

// --- Boundary --------------------------------------------------------------------

/** A region boundary with its title in a tab, holding an inset VPC that holds an inset subnet. */
export function BoundaryNesting() {
  return (
    <Scene w={420} h={236}>
      {/* The region: a tab on its top edge. */}
      <rect
        x={16}
        y={34}
        width={388}
        height={186}
        rx={10}
        className="fill-teal-500/5 stroke-teal-500"
        strokeWidth={2}
        strokeDasharray="7 5"
      />
      <rect
        x={30}
        y={22}
        width={176}
        height={24}
        rx={6}
        className="fill-teal-500 dark:fill-teal-700"
      />
      <Label x={42} y={34.5} size={11} weight={700} className="fill-white">
        AWS Cloud · eu-west-2
      </Label>
      <Shape x={34} y={70} w={86} h={44} label="API" />
      <Shape x={34} y={140} w={86} h={44} label="Queue" />

      {/* The VPC, inset: its title inside its corner, its CIDR the meta line. */}
      <rect
        x={140}
        y={58}
        width={250}
        height={148}
        rx={8}
        className="fill-violet-500/5 stroke-violet-500"
        strokeWidth={1.5}
      />
      <Label x={152} y={74} size={11} weight={700} className="fill-violet-700 dark:fill-violet-300">
        VPC
      </Label>
      <Label x={180} y={74} size={10} tone="muted">
        10.0.0.0/16
      </Label>

      {/* A subnet inside the VPC: the washes stack, so it reads deeper. */}
      <rect
        x={156}
        y={88}
        width={218}
        height={104}
        rx={8}
        className="fill-brand-500/10 stroke-brand-500"
        strokeWidth={1.5}
      />
      <Label x={168} y={104} size={11} weight={700} className="fill-brand-700 dark:fill-sky-300">
        Private subnet
      </Label>
      <Label x={256} y={104} size={10} tone="muted">
        10.0.1.0/24
      </Label>
      <Shape x={172} y={124} w={86} h={48} label="Orders" accent />
      <Shape x={272} y={124} w={86} h={48} kind="cylinder" label="Postgres" />
      <Arrow from={[120, 92]} to={[170, 140]} />
    </Scene>
  );
}
