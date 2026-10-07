// Element scenes for the Entities, Lanes and Event Storming Elements articles (docs/specs/018-help/help-app.md,
// drawing docs/specs/009-elements/entity.md, docs/specs/009-elements/lane.md and
// docs/specs/021-event-storming/event-storming.md).

import { Scene, Label, Shape, Arrow, Panel } from './primitives';

// --- Entities ----------------------------------------------------------------

/** One entity: a title bar over name / type rows. */
function Entity({
  x,
  y,
  w,
  title,
  rows,
}: {
  x: number;
  y: number;
  w: number;
  title: string;
  rows: [string, string][];
}) {
  const h = 30 + rows.length * 20 + 8;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={7}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <Label x={x + 12} y={y + 15} size={12} weight={700} tone="strong">
        {title}
      </Label>
      <line
        x1={x}
        y1={y + 30}
        x2={x + w}
        y2={y + 30}
        className="stroke-brand-300"
        strokeWidth={1.5}
      />
      {rows.map(([name, type], i) => (
        <g key={name}>
          <Label x={x + 12} y={y + 44 + i * 20} size={11} tone="body">
            {name}
          </Label>
          {type && (
            <Label x={x + w - 12} y={y + 44 + i * 20} anchor="end" size={11} tone="muted">
              {type}
            </Label>
          )}
        </g>
      ))}
    </g>
  );
}

/** Two entities joined by a pinned arrow with a hollow triangle head:
 *  Customer inherits from User. */
export function EntityPair() {
  return (
    <Scene w={420} h={190}>
      <Entity
        x={28}
        y={40}
        w={150}
        title="Customer"
        rows={[
          ['loyaltyTier', 'string'],
          ['orders', 'Order[]'],
          ['checkout(): void', ''],
        ]}
      />
      <Entity
        x={250}
        y={50}
        w={142}
        title="User"
        rows={[
          ['id', 'string'],
          ['email', 'string'],
        ]}
      />
      <Arrow from={[178, 89]} to={[238, 89]} head={false} />
      {/* The hollow triangle: UML's inheritance head, pointing at the parent. */}
      <path
        d="M238 81 L250 89 L238 97 Z"
        className="fill-white stroke-brand-400"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
    </Scene>
  );
}

// --- Lanes -------------------------------------------------------------------

/** Two stacked lanes. Dragging the top one carries every element whose
 *  centre it holds; the step straddling its lower edge, centre below the
 *  line, stays behind with the lane underneath. */
export function LaneCarry() {
  const x = 20;
  const w = 380;
  const gutter = 70;
  const lanes = [
    { y: 20, title: 'Customer' },
    { y: 108, title: 'Support' },
  ];
  return (
    <Scene w={420} h={210}>
      {lanes.map((l, i) => (
        <g key={l.title}>
          <rect
            x={x}
            y={l.y}
            width={w}
            height={88}
            className={i === 0 ? 'fill-white stroke-brand-500' : 'fill-white stroke-slate-300'}
            strokeWidth={i === 0 ? 2 : 1}
          />
          <rect x={x + 1} y={l.y + 1} width={gutter} height={86} className="fill-brand-50" />
          <line
            x1={x + gutter}
            y1={l.y}
            x2={x + gutter}
            y2={l.y + 88}
            className="stroke-slate-300"
            strokeWidth={1}
          />
          <Label x={x + 12} y={l.y + 44} size={12} weight={700} tone="strong">
            {l.title}
          </Label>
        </g>
      ))}
      {/* Inside the top lane: these travel with it. */}
      <Shape x={110} y={42} w={80} h={40} label="Order" accent />
      <Shape x={216} y={42} w={80} h={40} label="Pay" accent />
      <Arrow from={[190, 62]} to={[214, 62]} />
      {/* Straddling the edge with its centre in the lane below: stays. */}
      <Shape x={312} y={92} w={76} h={40} label="Refund" dashed />
      <circle cx={350} cy={112} r={2.5} className="fill-slate-500" />
      <Label x={350} y={150} anchor="middle" size={10} tone="muted">
        centre below the line
      </Label>
      <Label x={110 + 93} y={186} anchor="middle" size={11} weight={600} tone="accent">
        Drag Customer: Order and Pay travel, Refund stays
      </Label>
    </Scene>
  );
}

// --- Event storming ------------------------------------------------------------

// The eight note kinds in workshop order, with the palette's caption and blurb
// (EVENT_STORMING_NOTES in packages/document/src/event-storming.ts). Their
// fills are the notation's own colours, so they are drawn as drawn in both
// appearances, the way stickies keep their colour on the canvas.
const NOTES: { label: string; blurb: string; fill: string; size: 'square' | 'wide' | 'small' }[] = [
  {
    label: 'Domain event',
    blurb: 'Something that happened, past tense',
    fill: 'fill-orange-300',
    size: 'square',
  },
  {
    label: 'Command',
    blurb: 'An intent that triggers an event',
    fill: 'fill-blue-300',
    size: 'square',
  },
  { label: 'Actor', blurb: 'Who issues the command', fill: 'fill-yellow-200', size: 'small' },
  { label: 'Policy', blurb: 'Whenever X happens, then Y', fill: 'fill-purple-300', size: 'wide' },
  {
    label: 'Read model',
    blurb: 'Information the actor decides on',
    fill: 'fill-green-300',
    size: 'square',
  },
  {
    label: 'External system',
    blurb: 'A third party the flow touches',
    fill: 'fill-pink-300',
    size: 'wide',
  },
  { label: 'Aggregate', blurb: 'The thing commands act on', fill: 'fill-yellow-100', size: 'wide' },
  {
    label: 'Hotspot',
    blurb: 'A conflict, question, or risk',
    fill: 'fill-red-300',
    size: 'square',
  },
];

/** The palette on an event-storming board: no header band, Add from photo
 *  above a rule, then one row per note kind with its stationery silhouette. */
export function EventStormingPalette() {
  const px = 60;
  const py = 10;
  const pw = 300;
  const row0 = py + 50;
  return (
    <Scene w={420} h={304} bg="plain">
      <Panel x={px} y={py} w={pw} h={284} />
      {/* Add from photo: a camera, the row's name and its line. */}
      <rect x={px + 12} y={py + 10} width={24} height={24} rx={6} className="fill-slate-100" />
      <path
        d={`M${px + 17} ${py + 18}h3l1.5-2h5l1.5 2h3v9h-14z`}
        className="fill-none stroke-slate-500"
        strokeWidth={1.3}
      />
      <circle
        cx={px + 24}
        cy={py + 23}
        r={2.6}
        className="fill-none stroke-slate-500"
        strokeWidth={1.3}
      />
      <Label x={px + 44} y={py + 16} size={11} weight={600} tone="strong">
        Add from photo
      </Label>
      <Label x={px + 44} y={py + 29} size={10} tone="muted">
        Read the stickies off a photo of the wall
      </Label>
      <line
        x1={px + 12}
        y1={py + 42}
        x2={px + pw - 12}
        y2={py + 42}
        className="stroke-slate-200"
        strokeWidth={1.5}
      />
      {NOTES.map((n, i) => {
        const ry = row0 + i * 29;
        const dims = n.size === 'wide' ? [22, 14] : n.size === 'small' ? [13, 13] : [18, 18];
        return (
          <g key={n.label}>
            <g className="help-art-as-drawn">
              <rect
                x={px + 24 - dims[0]! / 2}
                y={ry + 12 - dims[1]! / 2}
                width={dims[0]}
                height={dims[1]}
                rx={1.5}
                className={`${n.fill} stroke-slate-900/10`}
                strokeWidth={1}
              />
            </g>
            <Label x={px + 44} y={ry + 6} size={11} weight={600} tone="strong">
              {n.label}
            </Label>
            <Label x={px + 44} y={ry + 19} size={10} tone="muted">
              {n.blurb}
            </Label>
          </g>
        );
      })}
    </Scene>
  );
}
