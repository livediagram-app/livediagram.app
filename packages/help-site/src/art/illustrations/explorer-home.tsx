// Explorer Home illustration (each product's liveworkspace/docs/specs/017-help/help-centre.md): Recent's timeline, and the
// rail with Most Used and Shared With You Recently. Drawn from the real labels in the shared Explorer's HomePane. Composed from the shared
// primitives, so the house style holds. A product names its own recent items.

import { appSamples } from '../app-samples';
import { Label, Scene } from '../primitives';

// --- Local parts -------------------------------------------------------------

/** The white Explorer pane every scene here sits in. */
function Pane({ x = 16, y = 12, w = 388, h }: { x?: number; y?: number; w?: number; h: number }) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={10}
      className="fill-white stroke-slate-200"
      strokeWidth={0.75}
    />
  );
}

/** Home (HomePane): Recent as a timeline on the left, newest first under a heading per day, each row led by its time
 *  and a mark (a spark for one made, a ring for one opened); the rail on the right with Most Used (ranked rows, each
 *  with its 14-day day chart and its opens) and Shared With You Recently. */
export function HomeOverview({ recent }: { recent?: readonly string[] }) {
  const { work } = appSamples();
  const names = recent ?? work.slice(4, 8);
  const rows: { day?: string; time: string; name: string; made: boolean; line: string }[] = [
    {
      day: 'Today',
      time: '09:42',
      name: names[0] ?? 'Roadmap',
      made: true,
      line: 'Made · My Work',
    },
    { time: '08:15', name: names[1] ?? 'Launch', made: false, line: 'Opened · Marketing' },
    {
      day: 'Yesterday',
      time: '16:30',
      name: names[2] ?? 'Pricing',
      made: false,
      line: 'Opened · My Work',
    },
    { time: '11:05', name: names[3] ?? 'Handover', made: false, line: 'Opened · Product' },
  ];
  const used = work.slice(0, 4);
  // Each Most Used row's 14 days, 0 to 3 opens a day: a fixed pattern, so the drawing never changes between builds.
  const days = [
    [0, 1, 2, 0, 3, 2, 1, 3, 2, 3, 1, 2, 3, 3],
    [1, 0, 0, 2, 1, 0, 2, 1, 0, 1, 2, 0, 1, 2],
    [0, 0, 1, 0, 0, 1, 0, 2, 1, 0, 0, 1, 1, 0],
    [0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
  ];
  const opens = [31, 14, 8, 5];
  const left = 32;
  const rail = 248;
  let y = 54;
  return (
    <Scene w={420} h={298} bg="plain">
      <Pane h={274} />
      {/* Recent, the timeline. */}
      <Label x={left} y={34} size={12} weight={700} tone="strong">
        Recent
      </Label>
      <Label x={228} y={34} size={10} weight={600} tone="accent" anchor="end">
        See More
      </Label>
      <line
        x1={left + 37}
        y1={62}
        x2={left + 37}
        y2={262}
        className="stroke-slate-200"
        strokeWidth={1}
      />
      {rows.map((row) => {
        const parts = [];
        if (row.day) {
          // A day after the first gets room above its heading, off the row before it.
          if (y > 54) y += 10;
          parts.push(
            <Label key={`${row.time}-day`} x={left} y={y} size={10} weight={700} tone="muted">
              {row.day}
            </Label>,
          );
          y += 16;
        }
        const cy = y + 10;
        parts.push(
          <g key={row.time}>
            <Label x={left} y={cy + 3} size={9} tone="muted">
              {row.time}
            </Label>
            {row.made ? (
              <path
                d={`M${left + 37} ${cy - 5} L${left + 38.6} ${cy - 1.6} L${left + 42} ${cy} L${left + 38.6} ${cy + 1.6} L${left + 37} ${cy + 5} L${left + 35.4} ${cy + 1.6} L${left + 32} ${cy} L${left + 35.4} ${cy - 1.6} Z`}
                className="fill-brand-600"
              />
            ) : (
              <circle
                cx={left + 37}
                cy={cy}
                r={3.5}
                className="fill-white stroke-slate-400"
                strokeWidth={1.25}
              />
            )}
            <rect
              x={left + 48}
              y={y}
              width={28}
              height={20}
              rx={3}
              className="fill-slate-100 stroke-slate-200"
              strokeWidth={0.75}
            />
            <Label x={left + 82} y={cy - 1} size={10} weight={600} tone="body">
              {row.name}
            </Label>
            <Label x={left + 82} y={cy + 10} size={8.5} tone="muted">
              {row.line}
            </Label>
          </g>,
        );
        y += 30;
        return parts;
      })}
      {/* The rail: Most Used, then Shared With You Recently. */}
      <rect
        x={rail - 8}
        y={22}
        width={156}
        height={240}
        rx={8}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={0.75}
      />
      <Label x={rail} y={40} size={11} weight={700} tone="strong">
        Most Used
      </Label>
      {used.map((name, i) => {
        const ry = 52 + i * 30;
        return (
          <g key={name}>
            <Label x={rail} y={ry + 10} size={9} weight={700} tone="muted">
              {i + 1}
            </Label>
            <Label x={rail + 12} y={ry + 9} size={10} weight={600} tone="body">
              {name}
            </Label>
            {(days[i] ?? []).map((n, d) => (
              <rect
                key={d}
                x={rail + 12 + d * 5.5}
                y={ry + 15}
                width={4.5}
                height={4.5}
                rx={1}
                className={
                  ['fill-slate-200', 'fill-brand-200', 'fill-brand-400', 'fill-brand-600'][n]
                }
              />
            ))}
            <Label x={rail + 142} y={ry + 20} size={8.5} tone="muted" anchor="end">
              {`${opens[i]} opens`}
            </Label>
          </g>
        );
      })}
      <Label x={rail} y={186} size={11} weight={700} tone="strong">
        Shared With You Recently
      </Label>
      {['Pricing', 'Workshop'].map((name, i) => (
        <g key={name}>
          <rect
            x={rail}
            y={198 + i * 28}
            width={24}
            height={18}
            rx={3}
            className="fill-white stroke-slate-200"
            strokeWidth={0.75}
          />
          <Label x={rail + 30} y={211 + i * 28} size={10} weight={600} tone="body">
            {name}
          </Label>
        </g>
      ))}
    </Scene>
  );
}
