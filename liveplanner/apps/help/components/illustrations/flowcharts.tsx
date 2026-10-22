// Scenes for the Flowcharts article (docs/specs/009-elements/flowchart.md): growing a chart from the
// keyboard, with a Decision's Yes and No leaving by its corners, and a chart in swimlanes. Labels are
// the editor's: FLOWCHART_STEP_LABEL (packages/project/src/flowchart.ts) and the toolbar's Add Step /
// Add Branch.

import { Arrow, Label, Scene, Shape } from './primitives';

/** A key on the keyboard and what it does, as the Mind Maps figures draw them. */
function KeyHint({ x, y, k, text }: { x: number; y: number; k: string; text: string }) {
  const w = k.length * 7 + 14;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={20}
        rx={5}
        className="fill-white stroke-slate-300"
        strokeWidth={1.5}
      />
      <Label x={x + w / 2} y={y + 11} size={10} weight={700} anchor="middle" tone="strong">
        {k}
      </Label>
      <Label x={x + w + 8} y={y + 11} size={10} tone="body">
        {text}
      </Label>
    </g>
  );
}

/** A connector through square corners, one arrowhead at its end. */
function Route({ points }: { points: [number, number][] }) {
  const legs = points.slice(0, -1).map((p, i) => [p, points[i + 1]!] as const);
  return (
    <g>
      {legs.map(([a, b], i) => (
        <Arrow key={i} from={a} to={b} head={i === legs.length - 1} width={2} />
      ))}
    </g>
  );
}

/** An exit's label, on a plate so the line runs behind it. */
function ExitLabel({ x, y, text }: { x: number; y: number; text: string }) {
  const w = text.length * 7 + 8;
  return (
    <g>
      <rect x={x - w / 2} y={y - 8} width={w} height={16} rx={4} className="fill-white" />
      <Label x={x} y={y + 1} size={10} weight={600} anchor="middle" tone="body">
        {text}
      </Label>
    </g>
  );
}

/** Growing a chart: Start, then a step, then a Decision whose Yes and No leave by its corners. Tab
 *  added Ship order; Enter added Show error beside it. */
export function FlowchartGrowth() {
  return (
    <Scene w={420} h={300}>
      <Shape x={150} y={14} w={120} h={36} kind="stadium" accent label="Start" />
      <Shape x={150} y={78} w={120} h={40} label="Add to cart" />
      <Shape x={140} y={146} w={140} h={64} kind="diamond" label="Card valid?" />
      <Shape x={30} y={232} w={120} h={40} label="Ship order" />
      <Shape x={270} y={232} w={120} h={40} label="Show error" dashed />
      <Arrow from={[210, 50]} to={[210, 76]} width={2} />
      <Arrow from={[210, 118]} to={[210, 144]} width={2} />
      <Route
        points={[
          [140, 178],
          [90, 178],
          [90, 230],
        ]}
      />
      <Route
        points={[
          [280, 178],
          [330, 178],
          [330, 230],
        ]}
      />
      <ExitLabel x={90} y={204} text="Yes" />
      <ExitLabel x={330} y={204} text="No" />
      <KeyHint x={20} y={20} k="Tab" text="next step" />
      <KeyHint x={20} y={48} k="Enter" text="parallel step" />
    </Scene>
  );
}

/** A chart in two lanes, flowing right: each step in its lane's band, the columns shared by both
 *  lanes, the hand-off crossing between them. */
export function FlowchartLanes() {
  const lane = (y: number, title: string) => (
    <g>
      <rect
        x={10}
        y={y}
        width={500}
        height={82}
        className="fill-slate-50 stroke-brand-200"
        strokeWidth={1.5}
      />
      <rect x={10} y={y} width={76} height={82} className="fill-brand-50" />
      <Label x={20} y={y + 42} size={11} weight={700} tone="strong">
        {title}
      </Label>
    </g>
  );
  return (
    <Scene w={520} h={184}>
      {lane(10, 'Customer')}
      {lane(92, 'Warehouse')}
      <Shape x={98} y={33} w={84} h={36} kind="stadium" accent label="Order" />
      <Shape x={204} y={33} w={84} h={36} label="Pay" />
      <Shape x={310} y={115} w={92} h={36} label="Pick & pack" />
      <Shape x={424} y={115} w={78} h={36} kind="stadium" label="Shipped" />
      <Arrow from={[182, 51]} to={[202, 51]} width={2} />
      <Route
        points={[
          [288, 51],
          [299, 51],
          [299, 133],
          [308, 133],
        ]}
      />
      <Arrow from={[402, 133]} to={[422, 133]} width={2} />
    </Scene>
  );
}
