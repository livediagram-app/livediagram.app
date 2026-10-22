// More feature art for Plan's Dashboard tab (docs/specs/026-plan/plan-tabs.md "Dashboard tab", help:
// canvas/plan-mode/dashboards): the dashboards Start Planning suggests from your boards, figures and
// charts read from a Sheet, the utilities written on the page, and arranging its slots. Drawn from
// ./mode-parts on the 300 by 96 stage; the pieces arrive on the fa-f-* loops and settle to the finished
// page under reduced motion.

import type { ReactNode } from 'react';

import { at, BAR, Cursor, INK, MUTED, Stage, SURFACE, TEAMMATE, WELL, YOU } from './mode-parts';
import { TYPE } from './plan-parts';

const SLOT = 'fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600';
const EMERALD = '#10b981';

/** One slot's frame and its small caption. */
function Slot({
  x,
  y,
  w,
  h,
  label,
  d,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  d?: number;
  children?: ReactNode;
}) {
  return (
    <g
      className={d === undefined ? undefined : 'fa-f-in'}
      style={d === undefined ? undefined : at(d)}
    >
      <rect className={SLOT} x={x} y={y} width={w} height={h} rx="3" strokeWidth="0.7" />
      <text className={MUTED} x={x + 5} y={y + 9} fontSize="5" fontWeight="600" fill="#64748b">
        {label}
      </text>
      {children}
    </g>
  );
}

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

// The suggestions Start Planning offers a project with boards, each badged For You.
const SUGGESTED = [
  { title: 'Launch Timeline', chips: ['Gantt', 'Due Soon'] },
  { title: 'Sprint Health', chips: ['Points', 'People'] },
  { title: 'Team Overview', chips: ['Boards', 'Calendar'] },
] as const;

/** Start Planning's Dashboards: layouts built around your boards, badged For You, one picked. */
export function SuggestedDashboardsArt() {
  const tileX = (i: number) => 84 + i * 70;
  return (
    <Stage>
      <rect className={SURFACE} x="8" y="4" width="284" height="88" rx="5" strokeWidth="0.8" />
      <text className={INK} x={15} y={15} fontSize="6" fontWeight="700" fill="#1e293b">
        Start Planning
      </text>

      {/* The rail, Dashboards chosen. */}
      {['Boards', 'Sheets', 'Dashboards', 'Forms'].map((name, i) => {
        const on = name === 'Dashboards';
        return (
          <g key={name}>
            {on ? (
              <rect
                className="fill-brand-50 dark:fill-brand-500/15"
                x="12"
                y={22 + i * 15}
                width="62"
                height="11"
                rx="2.5"
                fill="#f5f3ff"
              />
            ) : null}
            <text
              className={on ? 'fill-brand-700 dark:fill-brand-200' : MUTED}
              x={17}
              y={29.5 + i * 15}
              fontSize="5.4"
              fontWeight={on ? 700 : 500}
              fill={on ? '#6d28d9' : '#64748b'}
            >
              {name}
            </text>
          </g>
        );
      })}

      {SUGGESTED.map((s, i) => {
        const x = tileX(i);
        return (
          <g key={s.title} className="fa-f-in" style={at(0.15 + i * 0.15)}>
            <rect className={WELL} x={x} y={20} width="64" height="66" rx="3.5" strokeWidth="0.7" />
            {/* A thumbnail of its rows: figures over a chart and a board. */}
            {[0, 1, 2].map((f) => (
              <rect
                key={f}
                className={SLOT}
                x={x + 5 + f * 18.5}
                y={25}
                width="16"
                height="7"
                rx="1.2"
                strokeWidth="0.5"
              />
            ))}
            <rect
              className={SLOT}
              x={x + 5}
              y={34.5}
              width="34"
              height="15"
              rx="1.2"
              strokeWidth="0.5"
            />
            <rect
              className={SLOT}
              x={x + 41.5}
              y={34.5}
              width="17.5"
              height="15"
              rx="1.2"
              strokeWidth="0.5"
            />
            <rect x={x + 8} y={43} width="5" height="4" rx="0.6" fill={TYPE.task} />
            <rect x={x + 15} y={39} width="5" height="8" rx="0.6" fill={TYPE.project} />
            <rect x={x + 22} y={41} width="5" height="6" rx="0.6" fill={TYPE.action} />
            <text className={INK} x={x + 5} y={59} fontSize="5.4" fontWeight="700" fill="#1e293b">
              {s.title}
            </text>
            <rect x={x + 5} y={63} width="22" height="7" rx="3.5" fill={YOU} />
            <text x={x + 16} y={68} textAnchor="middle" fontSize="4.4" fontWeight="700" fill="#fff">
              For You
            </text>
            {s.chips.map((chip, c) => (
              <text
                key={chip}
                className={MUTED}
                x={x + 5 + c * 26}
                y={79}
                fontSize="4.4"
                fontWeight="500"
                fill="#64748b"
              >
                {chip}
              </text>
            ))}
          </g>
        );
      })}

      {/* The first is picked. */}
      <rect
        className="fa-f-ring"
        x={tileX(0) - 2}
        y="18"
        width="68"
        height="70"
        rx="5"
        fill="none"
        stroke={YOU}
        strokeWidth="0.9"
      />
      <g className="fa-f-carry" style={at(0, { '--fx': '120px', '--fy': '-6px' })}>
        <g transform={`translate(${tileX(0) + 44} 46)`}>
          <Cursor colour={YOU} name="You" />
        </g>
      </g>
    </Stage>
  );
}

const MONTHS = [
  { name: 'Jan', value: 12 },
  { name: 'Feb', value: 15 },
  { name: 'Mar', value: 21 },
] as const;

/** A Sheet's cells feeding a figure against its target, a trend and a chart on the dashboard. */
export function SheetFigureArt() {
  return (
    <Stage>
      {/* The Sheet: a month and its sales, the range the chart reads outlined. */}
      <rect className={SURFACE} x="8" y="4" width="98" height="88" rx="4" strokeWidth="0.8" />
      <text className={INK} x={14} y={14} fontSize="5.6" fontWeight="700" fill="#1e293b">
        Sales
      </text>
      {['Month', 'Sales (k)'].map((head, c) => (
        <text
          key={head}
          className={MUTED}
          x={14 + c * 40}
          y={27}
          fontSize="4.8"
          fontWeight="600"
          fill="#64748b"
        >
          {head}
        </text>
      ))}
      {MONTHS.map((m, r) => (
        <g key={m.name}>
          <path
            className="stroke-slate-200 dark:stroke-slate-600"
            d={`M12 ${31 + r * 13}H102`}
            stroke="#e2e8f0"
            strokeWidth="0.5"
          />
          <text className={INK} x={14} y={40 + r * 13} fontSize="5.2" fill="#1e293b">
            {m.name}
          </text>
          <text
            className={INK}
            x={80}
            y={40 + r * 13}
            textAnchor="end"
            fontSize="5.2"
            fontWeight="600"
            fill="#1e293b"
          >
            {m.value}
          </text>
        </g>
      ))}
      <path
        className="stroke-slate-200 dark:stroke-slate-600"
        d="M12 70H102"
        stroke="#e2e8f0"
        strokeWidth="0.5"
      />
      <text className={INK} x={14} y={80} fontSize="5.2" fontWeight="700" fill="#1e293b">
        Total
      </text>
      <text
        className={INK}
        x={80}
        y={80}
        textAnchor="end"
        fontSize="5.2"
        fontWeight="700"
        fill="#1e293b"
      >
        48
      </text>
      <rect
        className="fa-f-ring"
        x="52"
        y="32"
        width="34"
        height="38"
        rx="2"
        fill="none"
        stroke={YOU}
        strokeWidth="0.8"
        strokeDasharray="2 1.5"
      />

      {/* The dashboard's slots, reading it live. */}
      <Slot x={116} y={4} w={84} h={40} label="Sales this quarter" d={0.2}>
        <text className={INK} x={121} y={27} fontSize="11" fontWeight="800" fill="#1e293b">
          £48k
        </text>
        <text className={MUTED} x={157} y={27} fontSize="4.6" fontWeight="500" fill="#64748b">
          of £60k
        </text>
        <rect className={BAR} x={121} y={33} width="72" height="3.5" rx="1.75" />
        <rect
          className="fa-f-grow-x"
          style={at(0.5)}
          x={121}
          y={33}
          width={72 * 0.8}
          height="3.5"
          rx="1.75"
          fill={EMERALD}
        />
      </Slot>
      <Slot x={206} y={4} w={86} h={40} label="Trend" d={0.35}>
        <text className={INK} x={211} y={27} fontSize="11" fontWeight="800" fill="#1e293b">
          21k
        </text>
        <text
          className="fill-emerald-600 dark:fill-emerald-300"
          x={211}
          y={37}
          fontSize="4.8"
          fontWeight="700"
          fill="#059669"
        >
          ▲ 40% on Feb
        </text>
      </Slot>
      <Slot x={116} y={50} w={176} h={42} label="Sales by month" d={0.5}>
        {MONTHS.map((m, i) => (
          <g key={m.name}>
            <text
              className={MUTED}
              x={122}
              y={67 + i * 8}
              fontSize="4.6"
              fontWeight="600"
              fill="#64748b"
            >
              {m.name}
            </text>
            <rect
              className="fa-f-grow-x"
              style={at(0.8 + i * 0.15)}
              x={136}
              y={63.5 + i * 8}
              width={m.value * 6.5}
              height="4.5"
              rx="1.5"
              fill={YOU}
            />
          </g>
        ))}
      </Slot>
    </Stage>
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
