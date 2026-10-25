// The diagram-building elements' figures (docs/specs/009-elements/): Card, accent edge, Badge and Step number,
// and the concept graphics. Each is drawn the way the element draws on the canvas: the same slots, the same
// ramp from the accent, the same places for a chip to sit.

import { Arrow, Label, Scene, Shape, TextBar } from '../primitives';

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

// --- Concept graphics ----------------------------------------------------------------

// The accent ramp a concept graphic paints its rows in: the accent first, lighter row by row.
const RAMP = ['fill-brand-700', 'fill-brand-500', 'fill-brand-300', 'fill-brand-100'];
const RAMP_TEXT = ['onAccent', 'onAccent', 'strong', 'strong'] as const;

/** The four concept graphics side by side: a layer stack, a pyramid, a funnel and a cycle. */
export function ConceptGraphics() {
  const stack = ['Presentation', 'API', 'Domain', 'Storage'];
  const tiers = ['Why', 'How', 'What', 'Now'];
  const funnel = ['Visited', 'Signed up', 'Activated', 'Retained'];
  // The pyramid: one triangle cut into four tiers with a gap between.
  const px = 113;
  const pw = 102;
  const ptop = 34;
  const ph = 128;
  const tierH = (ph - 9) / 4;
  const halfAt = (y: number) => ((y - ptop) / ph) * (pw / 2);
  const pcx = px + pw / 2;
  // The funnel: tiers tapering from the full width to 35% of it.
  const fx = 224;
  const fw = 92;
  const fcx = fx + fw / 2;
  const fHalf = (t: number) => fw / 2 - t * (fw / 2 - fw * 0.175);
  // The cycle: four discs round a ring.
  const ccx = 368;
  const ccy = 98;
  const R = 34;
  const discs = [0, 1, 2, 3].map((i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 2;
    return [ccx + R * Math.cos(a), ccy + R * Math.sin(a)] as const;
  });
  return (
    <Scene w={420} h={200}>
      {/* A concept graphic keeps its own colours in both appearances, as on the canvas. */}
      <g className="help-art-as-drawn">
        {stack.map((label, i) => (
          <g key={label}>
            <rect x={12} y={34 + i * 32.5} width={94} height={28} rx={6} className={RAMP[i]} />
            <Label x={20} y={48.5 + i * 32.5} size={10} weight={600} tone={RAMP_TEXT[i]}>
              {label}
            </Label>
          </g>
        ))}
        <Label x={59} y={186} anchor="middle" size={10} tone="muted">
          Layer Stack
        </Label>

        {tiers.map((label, i) => {
          const y0 = ptop + i * (tierH + 3);
          const y1 = y0 + tierH;
          const top = halfAt(y0);
          const bot = halfAt(y1);
          const pts =
            i === 0
              ? `${pcx},${y0} ${pcx + bot},${y1} ${pcx - bot},${y1}`
              : `${pcx - top},${y0} ${pcx + top},${y0} ${pcx + bot},${y1} ${pcx - bot},${y1}`;
          return (
            <g key={label}>
              <polygon points={pts} className={RAMP[i]} />
              <Label
                x={pcx}
                y={i === 0 ? y1 - 7 : (y0 + y1) / 2 + 0.5}
                anchor="middle"
                size={i === 0 ? 7 : 10}
                weight={600}
                tone={RAMP_TEXT[i]}
              >
                {label}
              </Label>
            </g>
          );
        })}
        <Label x={pcx} y={186} anchor="middle" size={10} tone="muted">
          Pyramid
        </Label>

        {funnel.map((label, i) => {
          const y0 = ptop + i * (tierH + 3);
          const y1 = y0 + tierH;
          const top = fHalf(i / 4);
          const bot = fHalf((i + 1) / 4);
          return (
            <g key={label}>
              <polygon
                points={`${fcx - top},${y0} ${fcx + top},${y0} ${fcx + bot},${y1} ${fcx - bot},${y1}`}
                className={RAMP[i]}
              />
              <Label
                x={fcx}
                y={(y0 + y1) / 2 + 0.5}
                anchor="middle"
                size={i === 3 ? 8 : 9}
                weight={600}
                tone={RAMP_TEXT[i]}
              >
                {label}
              </Label>
            </g>
          );
        })}
        <Label x={fcx} y={186} anchor="middle" size={10} tone="muted">
          Funnel
        </Label>

        <circle
          cx={ccx}
          cy={ccy}
          r={R}
          className="fill-none stroke-brand-400"
          strokeWidth={2}
          strokeDasharray="5 4"
        />
        {['Plan', 'Do', 'Check', 'Act'].map((label, i) => (
          <g key={label}>
            <circle
              cx={discs[i]![0]}
              cy={discs[i]![1]}
              r={15}
              className={i === 0 ? 'fill-brand-500' : 'fill-white stroke-brand-500'}
              strokeWidth={2}
            />
            <Label
              x={discs[i]![0]}
              y={discs[i]![1] + 0.5}
              anchor="middle"
              size={8}
              weight={600}
              tone={i === 0 ? 'onAccent' : 'strong'}
            >
              {label}
            </Label>
          </g>
        ))}
      </g>
      <Label x={ccx} y={186} anchor="middle" size={10} tone="muted">
        Cycle
      </Label>
    </Scene>
  );
}
