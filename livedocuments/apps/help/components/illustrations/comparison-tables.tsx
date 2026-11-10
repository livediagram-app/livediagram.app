// Comparison table illustration for the Tables article (docs/specs/018-help/help-app.md,
// docs/specs/009-elements/comparison-tables.md): a pricing table as the canvas draws it, features down the side, three
// plans across, each cell a tick or cross in its disc, and the middle plan's column highlighted (a soft accent wash,
// its header cell filled with the accent, a frame round it). Composed from the shared primitives.

import { Scene, Label } from '@liveworkspace/help-site/art/primitives';

const PLANS = ['Free', 'Pro', 'Enterprise'] as const;
const FEATURES: readonly [string, readonly boolean[]][] = [
  ['Unlimited decks', [true, true, true]],
  ['Brand themes', [false, true, true]],
  ['Presenter view', [true, true, true]],
  ['Audit log', [false, false, true]],
];

function Mark({ cx, cy, yes }: { cx: number; cy: number; yes: boolean }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} className={yes ? 'fill-emerald-400/20' : 'fill-rose-400/20'} />
      <path
        d={
          yes
            ? `M${cx - 3.6} ${cy + 0.3}l2.4 2.4 4.8-5.2`
            : `M${cx - 3} ${cy - 3}l6 6M${cx + 3} ${cy - 3}l-6 6`
        }
        fill="none"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={yes ? 'stroke-emerald-500' : 'stroke-rose-500'}
      />
    </g>
  );
}

export function ComparisonTableFigure() {
  const x = 30;
  const y = 28;
  const firstW = 130;
  const cw = 78;
  const ch = 30;
  const rows = FEATURES.length + 1;
  const w = firstW + cw * PLANS.length;
  const colX = (c: number) => x + firstW + c * cw;
  const hc = 1;
  return (
    <Scene w={400} h={210}>
      <rect
        x={x}
        y={y}
        width={w}
        height={ch * rows}
        rx={4}
        className="fill-white stroke-slate-300"
        strokeWidth={1.5}
      />
      {/* Zebra stripes on alternate body rows. */}
      {FEATURES.map((_, r) =>
        r % 2 === 1 ? (
          <rect
            key={r}
            x={x + 1}
            y={y + ch * (r + 1)}
            width={w - 2}
            height={ch}
            className="fill-slate-100"
          />
        ) : null,
      )}
      {/* The header band, then the highlighted column: its wash, its accent header. */}
      <rect x={x + 1} y={y + 1} width={w - 2} height={ch - 1} className="fill-brand-50" />
      <rect
        x={colX(hc)}
        y={y + ch}
        width={cw}
        height={ch * (rows - 1)}
        className="fill-brand-500/10"
      />
      <rect x={colX(hc)} y={y} width={cw} height={ch} className="fill-brand-500" />
      {Array.from({ length: rows - 1 }, (_, i) => (
        <line
          key={`h${i}`}
          x1={x}
          y1={y + ch * (i + 1)}
          x2={x + w}
          y2={y + ch * (i + 1)}
          className="stroke-slate-200"
        />
      ))}
      {PLANS.map((_, c) => (
        <line
          key={`v${c}`}
          x1={colX(c)}
          y1={y}
          x2={colX(c)}
          y2={y + ch * rows}
          className="stroke-slate-200"
        />
      ))}
      {PLANS.map((plan, c) => (
        <Label
          key={plan}
          x={colX(c) + cw / 2}
          y={y + ch / 2 + 4}
          size={11}
          weight={700}
          anchor="middle"
          tone={c === hc ? 'onAccent' : 'strong'}
        >
          {plan}
        </Label>
      ))}
      {FEATURES.map(([name, marks], r) => (
        <g key={name}>
          <Label x={x + 10} y={y + ch * (r + 1) + ch / 2 + 4} size={11}>
            {name}
          </Label>
          {marks.map((yes, c) => (
            <Mark key={c} cx={colX(c) + cw / 2} cy={y + ch * (r + 1) + ch / 2} yes={yes} />
          ))}
        </g>
      ))}
      {/* The highlight's frame, over the grid. */}
      <rect
        x={colX(hc)}
        y={y}
        width={cw}
        height={ch * rows}
        rx={2}
        fill="none"
        strokeWidth={2}
        className="stroke-brand-500"
      />
    </Scene>
  );
}
