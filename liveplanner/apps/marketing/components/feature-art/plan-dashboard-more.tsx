// More feature art for Plan's Dashboard tab (docs/specs/026-plan/plan-tabs.md "Dashboard tab", help:
// canvas/plan-mode/dashboards): the dashboards Start Planning suggests from your boards, and figures
// and charts read from a Sheet (the utilities written on the page and arranging its slots are in
// ./plan-dashboard-page, re-exported here). Drawn from ./mode-parts on the 300 by 96 stage; the
// pieces arrive on the fa-f-* loops and settle to the finished page under reduced motion.

import { at, BAR, Cursor, INK, MUTED, Stage, SURFACE, WELL, YOU } from './mode-parts';
import { TYPE } from './plan-parts';
import { EMERALD, SLOT, Slot } from './plan-dashboard-slot';

// The utilities written on the page and arranging its slots live in ./plan-dashboard-page.
export { DashboardUtilitiesArt, DashboardArrangeArt } from './plan-dashboard-page';

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
