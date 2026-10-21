// Feature art for Plan's views and header widgets (docs/specs/026-plan/plan-views.md, board-widgets.md):
// the Gantt view beside the other views, and Due Soon narrowing the board. Split from ./plan, whose
// card and people it draws with.

import { at, Avatar, Cursor, INK, MUTED, Stage, SURFACE, TEAMMATE, YOU } from './mode-parts';
import {
  AK,
  AMBER_RING,
  JR,
  type Person,
  PlanCard,
  SM,
  TM,
  TYPE,
  type TypeKey,
} from './plan-parts';

/** The Gantt view, drawn from the board's cards, beside the other four views. */
export function PlanViewsArt() {
  const views = ['Gantt', 'Calendar', 'By field', 'Priority', 'Search'];
  const rows: { name: string; x: number; w: number; type: TypeKey; who: Person }[] = [
    { name: 'Research', x: 84, w: 52, type: 'project', who: AK },
    { name: 'Design', x: 118, w: 58, type: 'task', who: JR },
    { name: 'Build', x: 158, w: 80, type: 'task', who: SM },
    { name: 'Launch', x: 232, w: 44, type: 'action', who: TM },
  ];
  return (
    <Stage>
      <rect className={SURFACE} x="10" y="4" width="280" height="88" rx="5" strokeWidth="0.8" />
      {/* The five views; Gantt open. */}
      {views.map((v, i) => {
        const x = 16 + i * 40;
        return (
          <g key={v}>
            {i === 0 ? (
              <rect
                className="fill-brand-100 dark:fill-brand-500/25"
                x={x}
                y={8}
                width="36"
                height="11"
                rx="3"
                fill="#ede9fe"
              />
            ) : null}
            <text
              className={i === 0 ? 'fill-brand-700 dark:fill-brand-200' : MUTED}
              x={x + 18}
              y={15.6}
              textAnchor="middle"
              fontSize="6"
              fontWeight={i === 0 ? 700 : 500}
              fill={i === 0 ? '#6d28d9' : '#64748b'}
            >
              {v}
            </text>
          </g>
        );
      })}
      <path
        className="stroke-slate-100 dark:stroke-slate-700"
        d="M10 23 H290"
        stroke="#f1f5f9"
        strokeWidth="0.8"
      />

      {/* Weeks across the top, a line a week. */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i}>
          <path
            className="stroke-slate-100 dark:stroke-slate-700/70"
            d={`M${78 + i * 34} 27 V88`}
            stroke="#f1f5f9"
            strokeWidth="0.8"
          />
          <text
            className={MUTED}
            x={95 + i * 34}
            y={33}
            textAnchor="middle"
            fontSize="5.2"
            fontWeight="600"
            fill="#94a3b8"
          >
            {`W${i + 1}`}
          </text>
        </g>
      ))}
      {rows.map((r, i) => {
        const y = 40 + i * 12.5;
        return (
          <g key={r.name}>
            <rect x={18} y={y + 1} width="2" height="6" rx="1" fill={TYPE[r.type]} />
            <text className={INK} x={24} y={y + 6.6} fontSize="6.2" fontWeight="600" fill="#1e293b">
              {r.name}
            </text>
            <g className="fa-f-grow-x" style={at(0.2 + i * 0.2)}>
              <rect
                x={r.x}
                y={y}
                width={r.w}
                height="8"
                rx="4"
                fill={TYPE[r.type]}
                fillOpacity="0.9"
              />
              <Avatar
                x={r.x + r.w - 4}
                y={y + 4}
                initials={r.who.initials}
                colour={r.who.colour}
                r={3.2}
              />
            </g>
          </g>
        );
      })}
      {/* Today. */}
      <path d="M170 36 V80" stroke={TEAMMATE} strokeWidth="1" strokeDasharray="2 1.6" />
      <rect x={159} y={80} width="22" height="8" rx="4" fill={TEAMMATE} />
      <text x={170} y={85.7} textAnchor="middle" fontSize="5.2" fontWeight="700" fill="#fff">
        Today
      </text>
    </Stage>
  );
}

/** The header widgets: pressing Due Soon narrows the board to the cards due soon. */
export function BoardWidgetsArt() {
  return (
    <Stage>
      {/* Completion: a ring. */}
      <rect className={SURFACE} x="12" y="6" width="66" height="30" rx="4" strokeWidth="0.8" />
      <circle
        className="stroke-slate-100 dark:stroke-slate-700"
        cx="27"
        cy="21"
        r="8"
        fill="none"
        stroke="#f1f5f9"
        strokeWidth="3"
      />
      <circle
        cx="27"
        cy="21"
        r="8"
        fill="none"
        stroke="#10b981"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${0.68 * 50.3} 50.3`}
        transform="rotate(-90 27 21)"
      />
      <text className={INK} x={40} y={20} fontSize="8.5" fontWeight="800" fill="#1e293b">
        68%
      </text>
      <text className={MUTED} x={40} y={28.5} fontSize="5.6" fontWeight="500" fill="#64748b">
        Completion
      </text>

      {/* Due Soon: pressed. */}
      <rect
        className="fill-amber-50 stroke-amber-400 dark:fill-amber-500/15 dark:stroke-amber-400"
        x="84"
        y="6"
        width="64"
        height="30"
        rx="4"
        fill="#fffbeb"
        stroke={AMBER_RING}
        strokeWidth="1.1"
      />
      <rect
        className="fa-f-ring"
        x="82"
        y="4"
        width="68"
        height="34"
        rx="5.5"
        fill="none"
        stroke={AMBER_RING}
        strokeWidth="0.8"
      />
      <text
        className="fill-amber-600 dark:fill-amber-300"
        x={91}
        y={24.6}
        fontSize="12"
        fontWeight="800"
        fill="#d97706"
      >
        3
      </text>
      <text
        className="fill-amber-800 dark:fill-amber-200"
        x={102}
        y={18}
        fontSize="5.8"
        fontWeight="700"
        fill="#92400e"
      >
        Due soon
      </text>
      <text
        className="fill-amber-700 dark:fill-amber-200/80"
        x={102}
        y={26}
        fontSize="5.2"
        fontWeight="500"
        fill="#b45309"
      >
        this week
      </text>

      {/* WIP Alerts and Top Voted. */}
      <rect className={SURFACE} x="154" y="6" width="64" height="30" rx="4" strokeWidth="0.8" />
      <text
        className="fill-rose-500 dark:fill-rose-300"
        x={161}
        y={24.6}
        fontSize="12"
        fontWeight="800"
        fill="#f43f5e"
      >
        1
      </text>
      <text className={INK} x={171} y={18} fontSize="5.8" fontWeight="700" fill="#1e293b">
        WIP alerts
      </text>
      <text className={MUTED} x={171} y={26} fontSize="5.2" fontWeight="500" fill="#64748b">
        Doing is over
      </text>
      <rect className={SURFACE} x="224" y="6" width="64" height="30" rx="4" strokeWidth="0.8" />
      <circle cx="234" cy="18.5" r="2.4" fill={TEAMMATE} />
      <circle cx="240" cy="18.5" r="2.4" fill={TEAMMATE} />
      <circle cx="237" cy="24" r="2.4" fill={TEAMMATE} />
      <text className={INK} x={247} y={18} fontSize="5.8" fontWeight="700" fill="#1e293b">
        Top voted
      </text>
      <text className={MUTED} x={247} y={26} fontSize="5.2" fontWeight="500" fill="#64748b">
        Dark theme
      </text>

      {/* The board under it: the cards due soon stay, the rest step back. */}
      <PlanCard
        x={12}
        y={46}
        w={66}
        title="Launch post"
        id="TSK-30"
        type="action"
        who={AK}
        ring={AMBER_RING}
      />
      <g className="fa-f-dim">
        <PlanCard x={84} y={46} w={64} title="Billing" id="PRJ-2" type="project" who={SM} />
      </g>
      <PlanCard
        x={154}
        y={46}
        w={64}
        title="Login bug"
        id="BUG-21"
        type="bug"
        who={TM}
        ring={AMBER_RING}
      />
      <g className="fa-f-dim">
        <PlanCard x={224} y={46} w={64} title="Logo" id="IDEA-3" type="idea" who={JR} />
        <PlanCard x={12} y={70} w={66} title="Search" id="TSK-20" who={SM} />
      </g>
      <PlanCard x={84} y={70} w={64} title="Press kit" id="TSK-31" who={JR} ring={AMBER_RING} />
      <g className="fa-f-dim">
        <PlanCard x={154} y={70} w={64} title="Pricing" id="TSK-14" who={AK} />
        <PlanCard x={224} y={70} w={64} title="Docs" id="TSK-9" who={TM} />
      </g>
      <g transform="translate(134 28)">
        <g className="fa-f-in">
          <Cursor colour={YOU} />
        </g>
      </g>
    </Stage>
  );
}
