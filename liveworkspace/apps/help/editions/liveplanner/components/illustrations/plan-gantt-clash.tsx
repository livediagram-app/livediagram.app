// A Gantt Chart's dependency clash and the offer to move the cards that follow (docs/specs/026-plan/plan-views.md
// "Dependency clashes", "Moving the cards that follow"). The words are the editor's own: clashText's tooltip and
// useGanttMoveFollowing's toast (gantt-clash.tsx).

import { Scene, Label } from '@liveworkspace/help-site/art/primitives';

const NAMES = 118;
const ROW_H = 30;
const TOP = 34;

type Row = { num: number; title: string; start: number; w: number; colour: string };

const ROWS: readonly Row[] = [
  { num: 4, title: 'Design', start: 150, w: 110, colour: 'fill-indigo-500' },
  { num: 5, title: 'Build', start: 220, w: 120, colour: 'fill-teal-500' },
  { num: 6, title: 'Launch', start: 360, w: 40, colour: 'fill-amber-500' },
];

/** Design runs late, so Build now starts before it is due: an amber arrow, the clash mark with its tooltip, and the
 *  toast offering Move 2 Cards or Leave Them. */
export function PlanGanttClashScene() {
  const W = 440;
  const rowY = (i: number) => TOP + i * ROW_H;
  const design = ROWS[0]!;
  const build = ROWS[1]!;
  const designEnd = design.start + design.w;
  const buildY = rowY(1) + 9;
  const TOAST_Y = TOP + ROWS.length * ROW_H + 16;
  return (
    <Scene w={W} h={TOP + ROWS.length * ROW_H + 80}>
      {/* The chart's frame and its header. */}
      <rect
        x={10}
        y={8}
        width={W - 20}
        height={ROWS.length * ROW_H + 34}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      <Label x={24} y={23} size={10.5} weight={700} tone="strong">
        Gantt Chart
      </Label>
      <line
        x1={NAMES}
        x2={NAMES}
        y1={TOP - 4}
        y2={TOP + ROWS.length * ROW_H}
        className="stroke-slate-200"
      />
      {ROWS.map((r, i) => (
        <g key={r.num}>
          <Label x={24} y={rowY(i) + 15} size={9.5} tone="body">
            {`#${r.num} ${r.title}`}
          </Label>
          <rect x={r.start} y={rowY(i) + 8} width={r.w} height={14} rx={4} className={r.colour} />
        </g>
      ))}
      {/* The Blocked By arrow from Design's due end to Build's start, in the clash amber. */}
      <path
        d={`M${designEnd} ${rowY(0) + 15} h8 v${ROW_H - 9} H${build.start - 6}`}
        className="fill-none stroke-amber-600"
        strokeWidth={1.6}
      />
      <path
        d={`M${build.start - 9} ${buildY + 2} l4 4 -4 4`}
        className="fill-none stroke-amber-600"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* The clash mark over Build's left end, and its tooltip. */}
      <circle
        cx={build.start}
        cy={buildY}
        r={6}
        className="fill-amber-600 stroke-white"
        strokeWidth={1.2}
      />
      <Label
        x={build.start}
        y={buildY + 0.5}
        size={8.5}
        weight={700}
        tone="onAccent"
        anchor="middle"
      >
        !
      </Label>
      <rect
        x={build.start + 14}
        y={rowY(2) + 4}
        width={196}
        height={20}
        rx={5}
        className="fill-slate-800"
      />
      <Label x={build.start + 22} y={rowY(2) + 14} size={8.5} weight={500} tone="onAccent">
        Starts 3 days before #4 Design is due
      </Label>
      {/* The toast after the drag: its message, then Move and Leave Them. */}
      <g>
        <rect x={30} y={TOAST_Y} width={W - 60} height={54} rx={10} className="fill-slate-900" />
        <Label x={44} y={TOAST_Y + 16} size={9} weight={500} tone="onAccent">
          2 cards that follow #4 Design now start before it is due.
        </Label>
        <rect
          x={W - 210}
          y={TOAST_Y + 26}
          width={80}
          height={20}
          rx={6}
          className="fill-brand-600"
        />
        <Label x={W - 170} y={TOAST_Y + 36} size={9} weight={600} tone="onAccent" anchor="middle">
          Move 2 Cards
        </Label>
        <Label x={W - 84} y={TOAST_Y + 36} size={9} weight={600} tone="onAccent" anchor="middle">
          Leave Them
        </Label>
      </g>
    </Scene>
  );
}
