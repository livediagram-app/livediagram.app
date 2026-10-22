// The public telemetry dashboard (docs/specs/017-telemetry/telemetry.md), for the help article
// privacy-and-security/what-we-collect/telemetry-dashboard: the three window cards over the 30-day
// trend line, the view tabs (Dashboard and Search apart, the rest in the Detail carousel), and the
// first Dashboard group's cards. Labels are the dashboard's own (apps/telemetry/app).
// Composed only from the shared primitives and plain SVG, so the house style holds.

import { Scene, Panel, Label } from './primitives';

// A made-up 30-day series, the same shape every time the figure renders.
const DAILY = [
  14, 16, 13, 18, 17, 15, 19, 21, 18, 20, 23, 19, 22, 24, 21, 25, 23, 26, 24, 22, 27, 25, 28, 26,
  29, 27, 31, 28, 30, 33,
];

/** A polyline through `values`, scaled into the box x..x+w, y..y+h (higher value, higher up). */
function linePoints(values: number[], x: number, y: number, w: number, h: number): string {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const step = w / (values.length - 1);
  return values
    .map((v, i) => `${x + i * step},${y + h - ((v - min) / (max - min || 1)) * h}`)
    .join(' ');
}

/** One of the three window cards; the active one is brand-filled with its dot. */
function WindowCard({
  x,
  label,
  total,
  active = false,
}: {
  x: number;
  label: string;
  total: string;
  active?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={18}
        width={120}
        height={46}
        rx={8}
        className={active ? 'fill-brand-50 stroke-brand-500' : 'fill-white stroke-slate-200'}
        strokeWidth={1.5}
      />
      <Label x={x + 10} y={30} size={8} weight={700} tone={active ? 'accent' : 'muted'}>
        {label}
      </Label>
      {active && <circle cx={x + 110} cy={30} r={3} className="fill-brand-500" />}
      <Label x={x + 10} y={49} size={15} weight={700} tone="strong">
        {total}
      </Label>
    </g>
  );
}

/** A view tab: brand-filled when it is the open view. */
function ViewTab({
  x,
  w,
  label,
  active = false,
}: {
  x: number;
  w: number;
  label: string;
  active?: boolean;
}) {
  return (
    <g>
      {active && <rect x={x} y={162} width={w} height={20} rx={5} className="fill-brand-600" />}
      <Label
        x={x + w / 2}
        y={173}
        anchor="middle"
        size={9}
        weight={600}
        tone={active ? 'onAccent' : 'body'}
      >
        {label}
      </Label>
    </g>
  );
}

/** A Dashboard metric card: its title, the window's count and its 30-day line. */
function MetricCard({
  x,
  title,
  count,
  series,
}: {
  x: number;
  title: string;
  count: string;
  series: number[];
}) {
  return (
    <g>
      <rect
        x={x}
        y={212}
        width={124}
        height={52}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={x + 10} y={224} size={9} weight={600} tone="strong">
        {title}
      </Label>
      <Label x={x + 10} y={244} size={13} weight={700} tone="strong">
        {count}
      </Label>
      <polyline
        points={linePoints(series, x + 62, 236, 52, 18)}
        fill="none"
        className="stroke-brand-500"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </g>
  );
}

/** The dashboard: Today / Last 7 days / Last 30 days over the daily trend line (the selected window
 *  highlighted), the view tabs with Dashboard open, and the Visitors group's first cards. */
export function TelemetryDashboardOverview() {
  const chartX = 28;
  const chartW = 364;
  const chartY = 96;
  const chartH = 34;
  // Last 7 days is the window the page opens on: the last seven days of the line are highlighted.
  const highlightFrom = DAILY.length - 7;
  const points = linePoints(DAILY, chartX, chartY, chartW, chartH).split(' ');
  return (
    <Scene w={420} h={276} bg="plain">
      {/* The window panel: the three cards are the filter for every view below */}
      <Panel x={8} y={8} w={404} h={136} />
      <WindowCard x={18} label="TODAY" total="1,284" />
      <WindowCard x={150} label="LAST 7 DAYS" total="8,931" active />
      <WindowCard x={282} label="LAST 30 DAYS" total="36,402" />
      <Label x={18} y={80} size={9} weight={700} tone="strong">
        Daily Volume, Last 30 Days (UTC)
      </Label>
      <Label x={402} y={80} size={8} tone="muted" anchor="end">
        Last 7 days highlighted
      </Label>
      <polyline
        points={points.slice(0, highlightFrom + 1).join(' ')}
        fill="none"
        className="stroke-slate-300"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        points={points.slice(highlightFrom).join(' ')}
        fill="none"
        className="stroke-brand-500"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* The view tabs: Dashboard and Search apart, the rest in the Detail carousel */}
      <rect
        x={8}
        y={156}
        width={118}
        height={32}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <ViewTab x={13} w={62} label="Dashboard" active />
      <ViewTab x={78} w={44} label="Search" />
      <rect
        x={134}
        y={156}
        width={278}
        height={32}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={142} y={173} size={7} weight={700} tone="muted">
        DETAIL
      </Label>
      <ViewTab x={172} w={38} label="Pages" />
      <ViewTab x={212} w={44} label="Palette" />
      <ViewTab x={258} w={40} label="Modes" />
      <ViewTab x={300} w={64} label="Look & Feel" />
      <path
        d="M398 168 l5 5 l-5 5"
        fill="none"
        className="stroke-slate-400"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* The Dashboard view: groups of metric cards, each with its 30-day line */}
      <Label x={10} y={202} size={8} weight={700} tone="muted">
        VISITORS
      </Label>
      <MetricCard x={8} title="All Visitors" count="2,140" series={DAILY.slice(10)} />
      <MetricCard x={148} title="Account Activity" count="312" series={DAILY.slice(4, 24)} />
      <MetricCard x={288} title="Page Views by App" count="6,875" series={DAILY.slice(6)} />
    </Scene>
  );
}
