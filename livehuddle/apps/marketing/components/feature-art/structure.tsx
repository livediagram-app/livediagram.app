// Feature illustrations for the structural elements (docs/specs/009-elements/lane.md,
// embed-providers.md) and the Explorer's Timeline: swimlanes (embeds and the activity feed are in
// ./embeds-timeline). Shared marks live in ./canvas-marks.
import {
  ARROW,
  INK,
  INK_SHADE,
  INK_TEXT,
  Scene,
  Selection,
} from '@liveworkspace/marketing-site/components/feature-art/canvas-marks';
import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';

// Swimlanes: three lanes, their titles in a gutter, a process crossing them (a step, a decision,
// a hand-off); one lane mid-drag, its steps riding along inside it.
export function LanesArt() {
  const lanes = ['Customer', 'Support', 'Engineering'];
  const laneH = 25;
  const y0 = 10;
  const x0 = 12;
  const w = 276;
  const gutter = 54;
  const mid = (i: number) => y0 + i * laneH + laneH / 2;
  const step = (label: string, cx: number, lane: number) => (
    <g key={label}>
      <rect
        className="fill-(--art-paper) stroke-(--art-ink-stroke)"
        x={cx - 21}
        y={mid(lane) - 7.5}
        width="42"
        height="15"
        rx="4"
        strokeWidth="1.2"
      />
      <text
        className={INK_TEXT}
        x={cx}
        y={mid(lane) + 2.3}
        fontSize="6.2"
        fontWeight="600"
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );
  const right = (x1: number, x2: number, y: number) => (
    <g key={`${x1}-${y}`}>
      <path className={ARROW} d={`M${x1} ${y} H${x2 - 4}`} strokeWidth="1" fill="none" />
      <path className="fill-(--art-arrow)" d={`M${x2} ${y} l-4.5 -2.6 v5.2z`} />
    </g>
  );
  const down = (x: number, y1: number, y2: number) => (
    <g key={`${x}-${y1}`}>
      <path className={ARROW} d={`M${x} ${y1} V${y2 - 4}`} strokeWidth="1" fill="none" />
      <path className="fill-(--art-arrow)" d={`M${x} ${y2} l-2.6 -4.5 h5.2z`} />
    </g>
  );
  return (
    <Frame canvas>
      <Scene>
        {lanes.map((lane, i) => (
          <g key={lane}>
            <rect
              className={INK}
              x={x0}
              y={y0 + i * laneH}
              width={w}
              height={laneH}
              strokeWidth="1"
            />
            <rect
              className={`${INK_SHADE} stroke-(--art-ink-stroke)`}
              x={x0}
              y={y0 + i * laneH}
              width={gutter}
              height={laneH}
              strokeWidth="1"
            />
            <text className={INK_TEXT} x={x0 + 6} y={mid(i) + 2.3} fontSize="6.2" fontWeight="700">
              {lane}
            </text>
          </g>
        ))}
        {/* The process, crossing lanes: a request, triage, a decision, a fix, a release. */}
        {step('Request', 100, 0)}
        {right(121, 141, mid(0))}
        {step('Triage', 162, 0)}
        {down(162, mid(0) + 7.5, mid(1) - 9.5)}
        <path
          className="fill-(--art-paper) stroke-(--art-ink-stroke)"
          d={`M162 ${mid(1) - 9.5} l14 9.5 -14 9.5 -14 -9.5z`}
          strokeWidth="1.2"
        />
        <text
          className={INK_TEXT}
          x="162"
          y={mid(1) + 2.2}
          fontSize="6"
          fontWeight="700"
          textAnchor="middle"
        >
          Bug?
        </text>
        {right(176, 200, mid(1))}
        {step('Fix', 221, 1)}
        {down(221, mid(1) + 7.5, mid(2) - 7.5)}
        {step('Release', 221, 2)}
        {right(242, 258, mid(2))}
        <circle cx="266" cy={mid(2)} r="7" className="fill-(--art-ink-stroke)" />
        <path
          d={`M262.8 ${mid(2)} l2.2 2.2 4.2 -4.4`}
          stroke="#fff"
          strokeWidth="1.3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Selection x={x0} y={y0 + 2 * laneH} w={w} h={laneH} className="fa-d-ring" />
      </Scene>
    </Frame>
  );
}
