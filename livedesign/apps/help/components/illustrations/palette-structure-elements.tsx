// Element scenes for the Entities and Lanes articles (docs/specs/018-help/help-app.md, drawing
// docs/specs/009-elements/entity.md and docs/specs/009-elements/lane.md).

import { Scene, Label, Shape, Arrow } from './primitives';

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
  const h = 88;
  const gutter = 84;
  const lanes = [
    { y: 16, title: 'Customer' },
    { y: 16 + h, title: 'Support' },
  ];
  return (
    <Scene w={420} h={226}>
      {lanes.map((l) => (
        <g key={l.title}>
          <rect x={x} y={l.y} width={w} height={h} className="fill-white stroke-slate-300" />
          <rect x={x + 0.5} y={l.y + 0.5} width={gutter} height={h - 1} className="fill-brand-50" />
          <line
            x1={x + gutter}
            y1={l.y}
            x2={x + gutter}
            y2={l.y + h}
            className="stroke-slate-300"
            strokeWidth={1}
          />
          <Label x={x + 12} y={l.y + h / 2} size={12} weight={700} tone="strong">
            {l.title}
          </Label>
        </g>
      ))}
      {/* The lane being dragged, outlined on top so its edge reads clearly. */}
      <rect
        x={x}
        y={lanes[0]!.y}
        width={w}
        height={h}
        className="fill-none stroke-brand-500"
        strokeWidth={2}
      />
      {/* Inside the top lane: these travel with it. */}
      <Shape x={124} y={40} w={80} h={40} label="Order" accent />
      <Shape x={228} y={40} w={80} h={40} label="Pay" accent />
      <Arrow from={[204, 60]} to={[226, 60]} />
      {/* Straddling the edge with its centre in the lane below: stays. */}
      <Shape x={318} y={88} w={70} h={44} label="Refund" dashed />
      <Label x={353} y={150} anchor="middle" size={10} tone="muted">
        centre in Support
      </Label>
      <Label x={210} y={210} anchor="middle" size={11} weight={600} tone="accent">
        Drag Customer: Order and Pay travel, Refund stays
      </Label>
    </Scene>
  );
}
