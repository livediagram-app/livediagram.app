// Feature art for laying out Plan's Dashboard tab (docs/specs/026-plan/plan-tabs.md "Dashboard tab",
// re-exported by ./plan-dashboard-more): the utilities written on the page, and arranging its slots.
// Drawn from ./mode-parts on the 300 by 96 stage; the pieces arrive on the fa-f-* loops and settle to
// the finished page under reduced motion.

import { at, BAR, Cursor, INK, MUTED, Stage, TEAMMATE, WELL, YOU } from './mode-parts';
import { TYPE } from './plan-parts';
import { EMERALD, SLOT, Slot } from './plan-dashboard-slot';

/** A tick box, filled when done. */
function Tick({ x, y, done }: { x: number; y: number; done: boolean }) {
  return (
    <>
      <rect
        className={done ? undefined : 'stroke-slate-300 dark:stroke-slate-500'}
        x={x}
        y={y}
        width="6"
        height="6"
        rx="1.5"
        fill={done ? EMERALD : 'none'}
        stroke={done ? undefined : '#cbd5e1'}
        strokeWidth="0.7"
      />
      {done ? (
        <path
          d={`M${x + 1.5} ${y + 3.1}l1.3 1.3 2.3 -2.6`}
          stroke="#fff"
          strokeWidth="0.9"
          fill="none"
          strokeLinecap="round"
        />
      ) : null}
    </>
  );
}
const CHECKLIST = ['Pricing signed off', 'Support rota set', 'Launch post'] as const;

/** Utilities written on the page: a title, a status, a checklist ticking over and a key date. */
export function DashboardUtilitiesArt() {
  return (
    <Stage>
      {/* A Title, naming the section, sits on the page without a card. */}
      <text className={INK} x={10} y={14} fontSize="7.5" fontWeight="800" fill="#1e293b">
        Launch week
      </text>
      <text className={MUTED} x={70} y={14} fontSize="5" fontWeight="500" fill="#64748b">
        Where we are, at a glance
      </text>

      <Slot x={8} y={22} w={90} h={68} label="Status" d={0.1}>
        <rect
          className="fill-emerald-50 dark:fill-emerald-500/15"
          x={13}
          y={37}
          width="42"
          height="10"
          rx="5"
          fill="#ecfdf5"
        />
        <circle cx={19} cy={42} r="2" fill={EMERALD} />
        <text
          className="fill-emerald-700 dark:fill-emerald-200"
          x={24}
          y={44}
          fontSize="5.2"
          fontWeight="700"
          fill="#047857"
        >
          On Track
        </text>
        <text className={INK} x={13} y={59} fontSize="5" fill="#1e293b">
          Beta invites are out,
        </text>
        <text className={INK} x={13} y={66} fontSize="5" fill="#1e293b">
          pricing agreed.
        </text>
        <text className={MUTED} x={13} y={82} fontSize="4.4" fill="#64748b">
          Changed 2 days ago
        </text>
      </Slot>

      <Slot x={104} y={22} w={100} h={68} label="Checklist" d={0.25}>
        {CHECKLIST.map((item, i) => (
          <g key={item}>
            <Tick x={110} y={34 + i * 13} done={i < 2} />
            <text className={INK} x={120} y={39 + i * 13} fontSize="5.2" fill="#1e293b">
              {item}
            </text>
          </g>
        ))}
        {/* The last item ticked as the loop runs, and the count ticks over with it. */}
        <g className="fa-f-on" style={at(0)}>
          <Tick x={110} y={60} done />
        </g>
        <g className="fa-f-out" style={at(0)}>
          <text
            className={MUTED}
            x={198}
            y={82}
            textAnchor="end"
            fontSize="4.6"
            fontWeight="600"
            fill="#64748b"
          >
            2 of 3 done
          </text>
        </g>
        <g className="fa-f-on" style={at(0)}>
          <text
            className="fill-emerald-600 dark:fill-emerald-300"
            x={198}
            y={82}
            textAnchor="end"
            fontSize="4.6"
            fontWeight="700"
            fill="#059669"
          >
            3 of 3 done
          </text>
        </g>
      </Slot>
      <g className="fa-f-carry" style={at(0, { '--fx': '70px', '--fy': '20px' })}>
        <g transform="translate(114 64)">
          <Cursor colour={TEAMMATE} name="JR" />
        </g>
      </g>

      <Slot x={210} y={22} w={82} h={68} label="Key Date" d={0.4}>
        <rect
          x={216}
          y={34}
          width="22"
          height="24"
          rx="3"
          fill={YOU}
          fillOpacity="0.12"
          stroke={YOU}
          strokeWidth="0.7"
        />
        <text x={227} y={41.5} textAnchor="middle" fontSize="4.4" fontWeight="700" fill={YOU}>
          NOV
        </text>
        <text
          className={INK}
          x={227}
          y={54}
          textAnchor="middle"
          fontSize="9"
          fontWeight="800"
          fill="#1e293b"
        >
          14
        </text>
        <text className={INK} x={243} y={44} fontSize="5.4" fontWeight="700" fill="#1e293b">
          Launch day
        </text>
        <text className={MUTED} x={243} y={52} fontSize="4.6" fill="#64748b">
          12 days to go
        </text>
      </Slot>
    </Stage>
  );
}

/** A slot's grip: the small handle on the middle of its top edge. */
function Grip({ x, y }: { x: number; y: number }) {
  return (
    <rect
      className="fill-slate-300 dark:fill-slate-500"
      x={x - 7}
      y={y - 1.2}
      width="14"
      height="2.4"
      rx="1.2"
      fill="#cbd5e1"
    />
  );
}

/** Two slots swapped by their grips, and a row shared differently by the bar between its slots. */
export function DashboardArrangeArt() {
  const top = { y: 8, h: 38 };
  const low = { y: 52, h: 38 };
  return (
    <Stage>
      {/* Row one: the chart and the figure swap places; the middle slot stays. */}
      <Slot x={104} y={top.y} w={92} h={top.h} label="Due Soon">
        <text className={INK} x={109} y={top.y + 28} fontSize="11" fontWeight="800" fill="#1e293b">
          4
        </text>
        <Grip x={150} y={top.y} />
      </Slot>
      <g className="fa-f-carry" style={at(0, { '--fx': '-188px' })}>
        <Slot x={200} y={top.y} w={92} h={top.h} label="Completion">
          <text
            className={INK}
            x={205}
            y={top.y + 28}
            fontSize="11"
            fontWeight="800"
            fill="#1e293b"
          >
            68%
          </text>
          <Grip x={246} y={top.y} />
        </Slot>
      </g>
      <g className="fa-f-carry" style={at(0, { '--fx': '188px' })}>
        <Slot x={8} y={top.y} w={92} h={top.h} label="Cards by Status">
          {[10, 16, 24].map((h, i) => (
            <rect
              key={h}
              x={20 + i * 22}
              y={top.y + 34 - h}
              width="14"
              height={h}
              rx="1.5"
              fill={[TYPE.task, TYPE.idea, EMERALD][i]}
            />
          ))}
          <rect
            x={8 - 1.5}
            y={top.y - 1.5}
            width={95}
            height={top.h + 3}
            rx="4"
            fill="none"
            stroke={YOU}
            strokeWidth="1"
          />
          <Grip x={54} y={top.y} />
        </Slot>
        <g transform={`translate(54 ${top.y + 1})`}>
          <Cursor colour={YOU} name="You" />
        </g>
      </g>

      {/* Row two: a board and a note, the bar between them dragged to give the board more room. */}
      <Slot x={8} y={low.y} w={182} h={low.h} label="Launch board">
        {[0, 1, 2].map((c) => (
          <g key={c}>
            <rect
              className={WELL}
              x={14 + c * 58}
              y={low.y + 13}
              width="54"
              height="21"
              rx="2"
              strokeWidth="0.5"
            />
            <rect
              className={SLOT}
              x={17 + c * 58}
              y={low.y + 17}
              width="48"
              height="6"
              rx="1.2"
              strokeWidth="0.4"
            />
            <rect
              x={17 + c * 58}
              y={low.y + 17}
              width="1.4"
              height="6"
              rx="0.7"
              fill={c === 2 ? EMERALD : TYPE.project}
            />
          </g>
        ))}
      </Slot>
      <Slot x={200} y={low.y} w={92} h={low.h} label="Note">
        <rect className={BAR} x={205} y={low.y + 16} width="70" height="3" rx="1.5" />
        <rect className={BAR} x={205} y={low.y + 23} width="56" height="3" rx="1.5" />
      </Slot>
      <rect
        className="fa-f-ring"
        x={193}
        y={low.y + 6}
        width="4"
        height={low.h - 12}
        rx="2"
        fill={TEAMMATE}
      />
      <g transform={`translate(196 ${low.y + 22})`}>
        <Cursor colour={TEAMMATE} name="JR" />
      </g>
    </Stage>
  );
}
