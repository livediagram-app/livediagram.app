// The Timeline article's figure (docs/specs/009-elements/concept-graphics.md "Timeline").

import { Label, Scene } from './primitives';

// The Timeline as dropping one draws it (docs/specs/009-elements/concept-graphics.md "Timeline"): the numbers are
// `timelineLayout(380, 170, 4)` from @liveplanner/document, pinned here so the figure is what the editor draws;
// rerun that call and paste its numbers if the layout ever changes. The spine and arrowhead in the accent, a dot per
// milestone in the accent and ringed in the paper, a stem out to its when (in the accent) and its name.
const TIMELINE = {
  y: 85,
  spineEnd: 378,
  head: 10.2,
  dotR: 9.4,
  milestones: [
    { x: 45.6, above: true, s1: 54.2, s2: 75.7, ny: 42.7, ly: 24.8 },
    { x: 136.8, above: false, s1: 94.4, s2: 115.8, ny: 127.3, ly: 145.2 },
    { x: 227.9, above: true, s1: 54.2, s2: 75.7, ny: 42.7, ly: 24.8 },
    { x: 319.1, above: false, s1: 94.4, s2: 115.8, ny: 127.3, ly: 145.2 },
  ],
} as const;

function Timeline({
  x,
  y,
  milestones,
}: {
  x: number;
  y: number;
  milestones: readonly (readonly [when: string, name: string])[];
}) {
  const t = TIMELINE;
  return (
    <g transform={`translate(${x} ${y})`}>
      <line
        x1={0}
        y1={t.y}
        x2={t.spineEnd}
        y2={t.y}
        className="stroke-brand-500"
        strokeOpacity={0.55}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <polygon
        points={`380,${t.y} ${380 - t.head},${t.y - t.head * 0.6} ${380 - t.head},${t.y + t.head * 0.6}`}
        className="fill-brand-500"
      />
      {t.milestones.map((m, i) => (
        <g key={i}>
          <line
            x1={m.x}
            y1={m.s1}
            x2={m.x}
            y2={m.s2}
            className="stroke-brand-500"
            strokeOpacity={0.5}
            strokeWidth={1.5}
          />
          <circle
            cx={m.x}
            cy={t.y}
            r={t.dotR}
            className="fill-brand-500 stroke-white"
            strokeWidth={3}
          />
          <Label x={m.x} y={m.ny + 3.5} anchor="middle" size={10} weight={700} tone="accent">
            {milestones[i]?.[0]}
          </Label>
          <Label x={m.x} y={m.ly + 4.5} anchor="middle" size={13} weight={600} tone="strong">
            {milestones[i]?.[1]}
          </Label>
        </g>
      ))}
    </g>
  );
}

export function TimelineScene() {
  return (
    <Scene w={420} h={190}>
      <Timeline
        x={20}
        y={10}
        milestones={[
          ['Jan', 'Kick-off'],
          ['Mar', 'First prototype'],
          ['Jun', 'Beta'],
          ['Sep', 'Launch'],
        ]}
      />
    </Scene>
  );
}
