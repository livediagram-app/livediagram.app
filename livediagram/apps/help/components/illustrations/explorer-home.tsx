// Explorer Home illustration (docs/specs/018-help/help-app.md): Jump Back In and Shared With You
// Recently. Drawn from the real labels in the shared Explorer's HomePane. Composed from the shared
// primitives, so the house style holds.

import { Label, Scene } from '@liveworkspace/help-site/art/primitives';

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
      strokeWidth={1.5}
    />
  );
}

/** A section heading with its quiet link at the right and the hairline rule under it (Home). */
function SectionHeading({ y, title, link }: { y: number; title: string; link: string }) {
  return (
    <g>
      <Label x={32} y={y} size={12} weight={700} tone="strong">
        {title}
      </Label>
      <Label x={388} y={y} size={10} weight={600} tone="accent" anchor="end">
        {link}
      </Label>
      <line x1={32} y1={y + 10} x2={388} y2={y + 10} className="stroke-slate-200" strokeWidth={1} />
    </g>
  );
}

/** A small canvas snapshot: a box or two joined by a line, on a pale well. */
function Snapshot({
  x,
  y,
  w,
  h,
  motif = 0,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  motif?: number;
}) {
  const cy = y + h / 2;
  // Too narrow for a motif: one shape stands in for the drawing.
  if (w < 50) {
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={4}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1}
        />
        <rect
          x={x + w / 2 - 7}
          y={cy - 4}
          width={14}
          height={8}
          rx={2}
          className={motif % 2 ? 'fill-brand-200' : 'fill-brand-300'}
        />
      </g>
    );
  }
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={6}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1}
      />
      {motif % 3 === 0 && (
        <g>
          <rect x={x + 10} y={cy - 5} width={16} height={10} rx={2} className="fill-brand-300" />
          <path
            d={`M${x + 26} ${cy} H${x + w - 26}`}
            className="stroke-brand-400"
            strokeWidth={1.4}
          />
          <rect
            x={x + w - 26}
            y={cy - 5}
            width={16}
            height={10}
            rx={2}
            className="fill-brand-100"
          />
        </g>
      )}
      {motif % 3 === 1 && (
        <g>
          {[0, 1, 2].map((i) => (
            <rect
              key={i}
              x={x + 10 + i * ((w - 20) / 3)}
              y={y + 6}
              width={(w - 20) / 3 - 4}
              height={h - 12}
              rx={2}
              className={i === 1 ? 'fill-brand-200' : 'fill-brand-100'}
            />
          ))}
        </g>
      )}
      {motif % 3 === 2 && (
        <g>
          <circle cx={x + w / 2} cy={cy - 3} r={5} className="fill-brand-300" />
          <path
            d={`M${x + w / 2} ${cy + 2} V${cy + 6} M${x + w / 2 - 14} ${cy + 6} H${x + w / 2 + 14}`}
            className="stroke-slate-300"
            strokeWidth={1.4}
            fill="none"
          />
        </g>
      )}
    </g>
  );
}

/** Home: Jump Back In (most used on top, last used below) and Shared With You Recently. */
export function HomeOverview() {
  const tiles = [
    ['Roadmap', 'Payments', 'Onboarding', 'Data model'],
    ['Retro', 'Auth flow', 'Sprint 12', 'Brainstorm'],
  ];
  return (
    <Scene w={420} h={262} bg="plain">
      <Pane h={238} />
      <SectionHeading y={30} title="Jump Back In" link="See More" />
      {tiles.map((row, r) =>
        row.map((name, c) => (
          <g key={name}>
            <Snapshot x={32 + c * 90} y={50 + r * 52} w={80} h={30} motif={r * 4 + c} />
            <Label x={32 + c * 90} y={89 + r * 52} size={10} tone="body">
              {name}
            </Label>
          </g>
        )),
      )}
      <SectionHeading y={168} title="Shared With You Recently" link="See All" />
      {['Pricing', 'Handover', 'Launch plan', 'Workshop'].map((name, c) => (
        <g key={name}>
          <Snapshot x={32 + c * 90} y={186} w={80} h={30} motif={c + 2} />
          <Label x={32 + c * 90} y={225} size={10} tone="body">
            {name}
          </Label>
        </g>
      ))}
    </Scene>
  );
}
