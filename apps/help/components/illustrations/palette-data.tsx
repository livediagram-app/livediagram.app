// Palette "Data and Chart Elements" illustrations (spec/55): progress bars and
// rings, star ratings, pie charts, bar / line charts, and timeline rails. These
// are chart motifs the shared kit deliberately doesn't ship, so they draw raw
// <rect>/<circle>/<path>/<text> directly, but only with the house palette
// (brand / slate / accent Tailwind classes) so they read as the same window
// into the editor as every other scene. Chrome (panels, labels) still comes
// from the shared primitives.

import { Scene, Panel, Label, TextBar } from './primitives';

// --- Reusable motif builders -------------------------------------------------

/** A horizontal progress bar: a rounded slate track filled brand to `pct`%,
 *  with a centred percentage label, exactly as the canvas element draws. */
function ProgressBar({
  x,
  y,
  w,
  h = 26,
  pct,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  pct: number;
}) {
  const fillW = Math.max(h, (w * pct) / 100);
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={h / 2}
        className="fill-slate-100 stroke-slate-200"
        strokeWidth={1.5}
      />
      <rect x={x} y={y} width={fillW} height={h} rx={h / 2} className="fill-brand-500" />
      <Label x={x + w / 2} y={y + h / 2 + 1} anchor="middle" size={12} weight={700} tone="strong">
        {pct}%
      </Label>
    </g>
  );
}

/** A donut progress ring drawn from the top, filled brand to `pct`%, with the
 *  percentage centred in the hole. */
function ProgressRing({
  cx,
  cy,
  r = 30,
  pct,
}: {
  cx: number;
  cy: number;
  r?: number;
  pct: number;
}) {
  const stroke = 10;
  const circ = 2 * Math.PI * r;
  const on = (circ * pct) / 100;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" className="stroke-slate-100" strokeWidth={stroke} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        className="stroke-brand-500"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${on} ${circ - on}`}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <Label x={cx} y={cy + 1} anchor="middle" size={14} weight={700} tone="strong">
        {pct}%
      </Label>
    </g>
  );
}

/** A single five-pointed star, filled amber when `on`, otherwise an empty
 *  slate outline. */
function Star({ cx, cy, r = 13, on }: { cx: number; cy: number; r?: number; on: boolean }) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(cx + rad * Math.cos(ang)).toFixed(2)} ${(cy + rad * Math.sin(ang)).toFixed(2)}`);
  }
  return (
    <path
      d={`M${pts.join(' L')} Z`}
      className={on ? 'fill-amber-400 stroke-amber-500' : 'fill-white stroke-slate-300'}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  );
}

/** A row of five stars, the first `filled` of them amber. */
function StarRow({
  x,
  cy,
  r = 13,
  filled,
  gap,
}: {
  x: number;
  cy: number;
  r?: number;
  filled: number;
  gap?: number;
}) {
  const step = gap ?? r * 2 + 8;
  return (
    <g>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} cx={x + i * step} cy={cy} r={r} on={i < filled} />
      ))}
    </g>
  );
}

const PIE_SLICES: { label: string; value: number; cls: string }[] = [
  { label: 'Design', value: 40, cls: 'fill-brand-500' },
  { label: 'Build', value: 30, cls: 'fill-emerald-500' },
  { label: 'Test', value: 18, cls: 'fill-violet-500' },
  { label: 'Ship', value: 12, cls: 'fill-amber-500' },
];

/** A pie chart of the shared slice set, drawn around (`cx`,`cy`). */
function Pie({ cx, cy, r = 56 }: { cx: number; cy: number; r?: number }) {
  const total = PIE_SLICES.reduce((s, x) => s + x.value, 0);
  // Sweep the slices in a plain loop rather than map(): the callback would
  // close over the running angle, and reassigning a captured binding
  // mid-render is what react-hooks/refs flags.
  const wedges: { key: number; d: string; cls: string }[] = [];
  let acc = -Math.PI / 2;
  for (const [i, s] of PIE_SLICES.entries()) {
    const frac = s.value / total;
    const a0 = acc;
    const a1 = acc + frac * Math.PI * 2;
    acc = a1;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    wedges.push({
      key: i,
      d: `M${cx} ${cy} L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`,
      cls: s.cls,
    });
  }
  return (
    <g>
      {wedges.map((wedge) => (
        <path key={wedge.key} d={wedge.d} className={`${wedge.cls} stroke-white`} strokeWidth={2} />
      ))}
    </g>
  );
}

/** A legend keying the shared pie slices: a colour chip, label, and value.
 *  `valueX` is the value column's right edge, relative to `x`. */
function PieLegend({ x, y, valueX = 88 }: { x: number; y: number; valueX?: number }) {
  return (
    <g>
      {PIE_SLICES.map((s, i) => {
        const ry = y + i * 24;
        return (
          <g key={i}>
            <rect x={x} y={ry} width={12} height={12} rx={3} className={s.cls} />
            <Label x={x + 20} y={ry + 7} size={9} tone="body" weight={500}>
              {s.label}
            </Label>
            <Label x={x + valueX} y={ry + 7} size={9} tone="muted" anchor="end">
              {s.value}%
            </Label>
          </g>
        );
      })}
    </g>
  );
}

/** A horizontal timeline rail with evenly spaced milestone dots and labels. */
function TimelineRail({ x, y, w, points }: { x: number; y: number; w: number; points: string[] }) {
  const n = points.length;
  const step = w / (n - 1);
  return (
    <g>
      <line
        x1={x}
        y1={y}
        x2={x + w}
        y2={y}
        className="stroke-brand-300"
        strokeWidth={3}
        strokeLinecap="round"
      />
      {points.map((p, i) => {
        const px = x + i * step;
        return (
          <g key={i}>
            <circle
              cx={px}
              cy={y}
              r={7}
              className="fill-brand-500 stroke-white"
              strokeWidth={2.5}
            />
            <Label x={px} y={y + 20} anchor="middle" size={9} weight={600} tone="body">
              {p}
            </Label>
          </g>
        );
      })}
    </g>
  );
}

// --- Scenes ------------------------------------------------------------------

/** Overview montage: every data element on one canvas (progress bar + ring,
 *  star rating, pie chart, and a timeline rail). */
export function DataElementsOverview() {
  return (
    <Scene w={420} h={240}>
      <Panel x={20} y={18} w={172} h={70} title="PROGRESS">
        <ProgressBar x={32} y={52} w={148} h={22} pct={70} />
      </Panel>
      <Panel x={208} y={18} w={88} h={70}>
        <ProgressRing cx={252} cy={53} r={22} pct={65} />
      </Panel>
      <Panel x={312} y={18} w={88} h={70} title="RATING">
        <StarRow x={326} cy={62} r={8} filled={4} gap={17} />
      </Panel>
      <Panel x={20} y={104} w={172} h={120} title="PIE">
        <Pie cx={70} cy={172} r={38} />
        <PieLegend x={122} y={140} valueX={58} />
      </Panel>
      <Panel x={208} y={104} w={192} h={120} title="TIMELINE">
        <TimelineRail x={234} y={170} w={144} points={['Plan', 'Build', 'Beta', 'GA']} />
      </Panel>
    </Scene>
  );
}

/** A progress bar at ~70% beside a progress ring: the two progress elements. */
export function ProgressBarAndRing() {
  return (
    <Scene w={420} h={200}>
      <Panel x={36} y={42} w={216} h={116} title="PROGRESS">
        <Label x={50} y={80} size={9} tone="muted">
          Bar
        </Label>
        <ProgressBar x={50} y={94} w={188} h={26} pct={70} />
        <Label x={50} y={138} size={9} tone="muted">
          Fills from the left
        </Label>
      </Panel>
      <Panel x={272} y={42} w={112} h={116} title="DONUT">
        <ProgressRing cx={328} cy={108} r={32} pct={70} />
      </Panel>
    </Scene>
  );
}

/** A star rating showing four of five filled, the amber accent default. */
export function StarRating() {
  return (
    <Scene w={420} h={170}>
      <StarRow x={94} cy={78} r={20} filled={4} gap={56} />
      <Label x={210} y={130} anchor="middle" size={12} weight={600} tone="muted">
        4 of 5
      </Label>
    </Scene>
  );
}

/** A pie chart split into four labelled slices with a legend key beside it. */
export function PieChartWithLegend() {
  return (
    <Scene w={420} h={220}>
      <Pie cx={138} cy={110} r={74} />
      <Panel x={262} y={48} w={132} h={124} title="LEGEND">
        <PieLegend x={278} y={82} />
      </Panel>
    </Scene>
  );
}

/** A small bar chart beside a line chart, both multi-category. */
export function BarAndLineCharts() {
  const bars = [34, 58, 46, 72, 50];
  const line = [60, 38, 52, 30, 44, 22];
  const baseY = 150;
  return (
    <Scene w={420} h={200}>
      {/* Bar chart */}
      <Panel x={24} y={24} w={176} h={158} title="BAR">
        <line
          x1={44}
          y1={baseY}
          x2={184}
          y2={baseY}
          className="stroke-slate-200"
          strokeWidth={1.5}
        />
        {bars.map((v, i) => {
          const bx = 50 + i * 27;
          return (
            <rect
              key={i}
              x={bx}
              y={baseY - v}
              width={18}
              height={v}
              rx={3}
              className={i % 2 === 0 ? 'fill-brand-500' : 'fill-brand-300'}
            />
          );
        })}
      </Panel>
      {/* Line chart */}
      <Panel x={216} y={24} w={180} h={158} title="LINE">
        <line
          x1={234}
          y1={baseY}
          x2={384}
          y2={baseY}
          className="stroke-slate-200"
          strokeWidth={1.5}
        />
        <polyline
          points={line.map((v, i) => `${238 + i * 29} ${baseY - v}`).join(' ')}
          fill="none"
          className="stroke-brand-500"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {line.map((v, i) => (
          <circle
            key={i}
            cx={238 + i * 29}
            cy={baseY - v}
            r={3.5}
            className="fill-white stroke-brand-500"
            strokeWidth={2}
          />
        ))}
      </Panel>
    </Scene>
  );
}

/** A horizontal timeline rail with four evenly spaced, labelled milestones. */
export function TimelineRailScene() {
  return (
    <Scene w={420} h={150}>
      <TimelineRail x={48} y={68} w={324} points={['Kickoff', 'Design', 'Build', 'Launch']} />
      <TextBar x={158} y={108} w={104} tone="faint" />
    </Scene>
  );
}
