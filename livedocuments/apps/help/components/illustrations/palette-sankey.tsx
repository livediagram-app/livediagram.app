// The Sankey Diagram article's figures (docs/specs/009-elements/sankey.md). The budget's geometry is the
// layout engine's own (`sankeyLayout(SANKEY_DEFAULT_FLOWS, { x: 40, y: 22, w: 340, h: 160 })` in
// @livedocuments/document), pinned here so the figure shows exactly what dropping a Sankey draws; rerun that
// call and paste its numbers if the layout ever changes.

import { Label, Scene } from './primitives';

type Node = { name: string; x: number; y0: number; y1: number; amount: string; color: string };

// The built-in ramp by first appearance, as a new diagram on the Default theme colours its nodes.
const NODES: Node[] = [
  { name: 'Salary', x: 40, y0: 38.42, y1: 128.02, amount: '3,200', color: '#0ea5e9' },
  { name: 'Budget', x: 149.33, y0: 38.42, y1: 150.42, amount: '4,000', color: '#f59e0b' },
  { name: 'Side Work', x: 40, y0: 144.02, y1: 166.42, amount: '800', color: '#22c55e' },
  { name: 'Needs', x: 258.67, y0: 113.99, y1: 169.99, amount: '2,000', color: '#ef4444' },
  { name: 'Wants', x: 368, y0: 22, y1: 55.6, amount: '1,200', color: '#a855f7' },
  { name: 'Savings', x: 368, y0: 71.6, y1: 94, amount: '800', color: '#14b8a6' },
  { name: 'Rent', x: 368, y0: 110, y1: 149.2, amount: '1,400', color: '#ec4899' },
  { name: 'Groceries', x: 368, y0: 165.2, y1: 182, amount: '600', color: '#84cc16' },
];

const BANDS: [number, number, string][] = [
  [
    0,
    1,
    'M52,38.42C100.67,38.42 100.67,38.42 149.33,38.42L149.33,128.02C100.67,128.02 100.67,128.02 52,128.02Z',
  ],
  [
    2,
    1,
    'M52,144.02C100.67,144.02 100.67,128.02 149.33,128.02L149.33,150.42C100.67,150.42 100.67,166.42 52,166.42Z',
  ],
  [
    1,
    3,
    'M161.33,94.42C210,94.42 210,113.99 258.67,113.99L258.67,169.99C210,169.99 210,150.42 161.33,150.42Z',
  ],
  [
    1,
    4,
    'M161.33,38.42C264.67,38.42 264.67,22 368,22L368,55.6C264.67,55.6 264.67,72.02 161.33,72.02Z',
  ],
  [
    1,
    5,
    'M161.33,72.02C264.67,72.02 264.67,71.6 368,71.6L368,94C264.67,94 264.67,94.42 161.33,94.42Z',
  ],
  [
    3,
    6,
    'M270.67,113.99C319.34,113.99 319.34,110 368,110L368,149.2C319.34,149.2 319.34,153.19 270.67,153.19Z',
  ],
  [
    3,
    7,
    'M270.67,153.19C319.34,153.19 319.34,165.2 368,165.2L368,182C319.34,182 319.34,169.99 270.67,169.99Z',
  ],
];

const NODE_W = 12;

/**
 * The starter household budget as the canvas draws it: two incomes pooling into a budget that splits into
 * needs, wants and savings, needs splitting again. With `hover`, the Salary → Budget band is lifted and its
 * readout shown, the rest faded back.
 */
export function SankeyBudget({ hover = false }: { hover?: boolean }) {
  return (
    <Scene w={420} h={204}>
      <g className="help-art-as-drawn">
        <defs>
          {BANDS.map(([s, t], i) => (
            <linearGradient
              key={i}
              id={`help-sk-${i}`}
              gradientUnits="userSpaceOnUse"
              x1={NODES[s]!.x + NODE_W}
              x2={NODES[t]!.x}
              y1={0}
              y2={0}
            >
              <stop offset={0} stopColor={NODES[s]!.color} />
              <stop offset={1} stopColor={NODES[t]!.color} />
            </linearGradient>
          ))}
        </defs>
        {BANDS.map(([, , d], i) => (
          <path
            key={i}
            d={d}
            fill={`url(#help-sk-${i})`}
            fillOpacity={hover ? (i === 0 ? 0.78 : 0.1) : 0.42}
          />
        ))}
        {NODES.map((n, i) => (
          <rect
            key={n.name}
            x={n.x}
            y={n.y0}
            width={NODE_W}
            height={n.y1 - n.y0}
            rx={2}
            fill={n.color}
            opacity={hover && i !== 0 && i !== 1 ? 0.35 : 1}
          />
        ))}
      </g>
      {NODES.map((n) => {
        // Inward-facing labels: left of the middle label to the right, the rest to the left.
        const right = n.x < 210;
        const x = right ? n.x + NODE_W + 6 : n.x - 6;
        const mid = (n.y0 + n.y1) / 2;
        const tall = n.y1 - n.y0 >= 24;
        return (
          <g key={n.name}>
            <Label
              x={x}
              y={tall ? mid - 6 : mid}
              size={10}
              weight={600}
              tone="strong"
              anchor={right ? 'start' : 'end'}
            >
              {tall ? n.name : `${n.name} ${n.amount}`}
            </Label>
            {tall ? (
              <Label x={x} y={mid + 6} size={9} tone="body" anchor={right ? 'start' : 'end'}>
                {n.amount}
              </Label>
            ) : null}
          </g>
        );
      })}
      {hover ? (
        <g>
          <rect x={58} y={4} width={136} height={30} rx={6} className="fill-slate-900" />
          <Label x={126} y={14} size={9} weight={600} tone="onAccent" anchor="middle">
            Salary → Budget
          </Label>
          <Label x={126} y={26} size={9} tone="onAccent" anchor="middle">
            3,200 · 100% of Salary
          </Label>
        </g>
      ) : null}
    </Scene>
  );
}

/**
 * The Flows dialog's table: the flows grouped step by step, a group per node listing where it sends, a node's
 * leftover line with its switch, and the Add a Flow area with its blank line.
 */
export function SankeyFlowsTable() {
  const x = 28;
  const w = 364;
  // A node's group: its name and totals, a row per flow out of it, then its Add a Flow From row.
  const group = (
    top: number,
    name: string,
    color: string,
    totals: string,
    rows: [string, string][],
    leftover?: string,
  ) => {
    const rowsH = rows.length * 26 + (leftover ? 22 : 0);
    const h = 30 + rowsH + 28;
    return (
      <g key={name}>
        <rect
          x={x}
          y={top}
          width={w}
          height={h}
          rx={7}
          className="fill-slate-50 stroke-slate-200"
        />
        <rect x={x + 10} y={top + 11} width={8} height={8} rx={2} fill={color} />
        <Label x={x + 24} y={top + 15} size={10} weight={600} tone="strong">
          {name}
        </Label>
        <Label x={x + w - 10} y={top + 15} size={8} tone="muted" anchor="end">
          {totals}
        </Label>
        {rows.map(([to, amount], i) => {
          const ry = top + 26 + i * 26;
          return (
            <g key={to}>
              <Label x={x + 18} y={ry + 10} size={10} tone="muted" anchor="middle">
                →
              </Label>
              <rect
                x={x + 30}
                y={ry}
                width={200}
                height={20}
                rx={4}
                className="fill-white stroke-slate-200"
              />
              <Label x={x + 38} y={ry + 10} size={10} tone="strong">
                {to}
              </Label>
              <rect
                x={x + 236}
                y={ry}
                width={70}
                height={20}
                rx={4}
                className="fill-white stroke-slate-200"
              />
              <Label x={x + 300} y={ry + 10} size={10} tone="strong" anchor="end">
                {amount}
              </Label>
            </g>
          );
        })}
        {leftover ? (
          <g>
            <line
              x1={x + 12}
              x2={x + 24}
              y1={top + 26 + rows.length * 26 + 8}
              y2={top + 26 + rows.length * 26 + 8}
              className="stroke-slate-400"
              strokeDasharray="2 2"
            />
            <Label x={x + 38} y={top + 26 + rows.length * 26 + 8} size={10} tone="muted">
              Leftover
            </Label>
            <Label
              x={x + 300}
              y={top + 26 + rows.length * 26 + 8}
              size={10}
              tone="muted"
              anchor="end"
            >
              {leftover}
            </Label>
            <rect
              x={x + 318}
              y={top + 26 + rows.length * 26 + 1}
              width={26}
              height={14}
              rx={7}
              className="fill-brand-500"
            />
            <circle
              cx={x + 336}
              cy={top + 26 + rows.length * 26 + 8}
              r={5}
              className="fill-white"
            />
          </g>
        ) : null}
        <rect
          x={x + 30}
          y={top + 26 + rowsH + 2}
          width={276}
          height={20}
          rx={4}
          className="fill-white stroke-slate-300"
          strokeDasharray="3 2"
        />
        <Label x={x + 40} y={top + 26 + rowsH + 12} size={9} tone="body">
          + Add a Flow From {name}
        </Label>
      </g>
    );
  };
  return (
    <Scene w={420} h={354} bg="plain">
      <Label x={x} y={16} size={9} weight={600} tone="muted">
        Step 1
      </Label>
      {group(26, 'Salary', '#2563eb', 'Out 3,200', [['Budget', '3,200']])}
      <Label x={x} y={128} size={9} weight={600} tone="muted">
        Step 2
      </Label>
      {group(
        138,
        'Budget',
        '#0ea5e9',
        'In 3,200 · Out 3,000',
        [
          ['Needs', '2,000'],
          ['Wants', '1,000'],
        ],
        '200',
      )}
      <rect
        x={x}
        y={284}
        width={w}
        height={58}
        rx={7}
        className="fill-brand-50 stroke-brand-300"
        strokeDasharray="5 3"
        strokeWidth={1.5}
      />
      <Label x={x + 12} y={298} size={10} weight={600} tone="accent">
        Add a Flow
      </Label>
      {[
        [x + 12, 130, 'From'],
        [x + 150, 130, 'To'],
        [x + 288, 64, 'Amount'],
      ].map(([rx, rw, ph]) => (
        <g key={ph as string}>
          <rect
            x={rx as number}
            y={310}
            width={rw as number}
            height={20}
            rx={4}
            className="fill-white stroke-slate-200"
          />
          <Label x={(rx as number) + 8} y={320} size={9} tone="muted">
            {ph as string}
          </Label>
        </g>
      ))}
    </Scene>
  );
}
