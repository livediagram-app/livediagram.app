// Feature art for Plan's Dashboard tab (docs/specs/026-plan/, help: canvas/plan-mode/dashboards): a
// page of rows split into slots, each showing one thing live. A row of figures over a board, a chart
// and a Sheet, drawn from ./mode-parts on the 300 by 96 stage; the slots arrive on the fa-f-* loops
// and settle to the finished page under reduced motion.

import type { ReactNode } from 'react';

import { at, INK, MUTED, Stage, SURFACE, WELL } from './mode-parts';
import { TYPE } from './plan-parts';

const SLOT = 'fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600';
const GRID = 'stroke-slate-200 dark:stroke-slate-600';

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
  d: number;
  children: ReactNode;
}) {
  return (
    <g className="fa-f-in" style={at(d)}>
      <rect className={SLOT} x={x} y={y} width={w} height={h} rx="3" strokeWidth="0.7" />
      <text className={MUTED} x={x + 4} y={y + 7} fontSize="4.6" fontWeight="600" fill="#64748b">
        {label}
      </text>
      {children}
    </g>
  );
}

/** A figure slot: a caption and one big number. */
function Figure({ x, label, value, d }: { x: number; label: string; value: string; d: number }) {
  return (
    <Slot x={x} y={16} w={86} h={22} label={label} d={d}>
      <text className={INK} x={x + 4} y={33.5} fontSize="10" fontWeight="700" fill="#1e293b">
        {value}
      </text>
    </Slot>
  );
}

/** A Dashboard tab: figures across the top, then a board, a chart and a Sheet, each live in its slot. */
export function DashboardArt() {
  const bars = [
    { label: 'AK', w: 34, colour: TYPE.project },
    { label: 'SM', w: 48, colour: TYPE.task },
    { label: 'JR', w: 22, colour: TYPE.action },
  ];
  return (
    <Stage>
      <rect className={SURFACE} x="8" y="4" width="284" height="88" rx="5" strokeWidth="0.8" />
      <text className={INK} x={14} y={12} fontSize="5.8" fontWeight="700" fill="#1e293b">
        Sprint Overview
      </text>

      {/* Row one: three figures. */}
      <Figure x={14} label="Completion" value="68%" d={0.1} />
      <Figure x={106} label="Due Soon" value="4" d={0.25} />
      <Figure x={198} label="Open Cards" value="23" d={0.4} />

      {/* Row two: a board, a chart, a Sheet. */}
      <Slot x={14} y={42} w={86} h={46} label="Sprint Board" d={0.6}>
        {['To Do', 'Doing', 'Done'].map((col, c) => (
          <g key={col}>
            <rect
              className={WELL}
              x={18 + c * 27}
              y={51}
              width="24"
              height="33"
              rx="2"
              strokeWidth="0.5"
            />
            <text
              className={MUTED}
              x={20 + c * 27}
              y={56.5}
              fontSize="3.8"
              fontWeight="600"
              fill="#64748b"
            >
              {col}
            </text>
            {Array.from({ length: 3 - c }, (_, i) => (
              <g key={i}>
                <rect
                  className={SLOT}
                  x={20 + c * 27}
                  y={59 + i * 8}
                  width="20"
                  height="6.5"
                  rx="1.2"
                  strokeWidth="0.4"
                />
                <rect
                  x={20 + c * 27}
                  y={59 + i * 8}
                  width="1.4"
                  height="6.5"
                  rx="0.7"
                  fill={c === 2 ? TYPE.project : TYPE.task}
                />
              </g>
            ))}
          </g>
        ))}
      </Slot>

      <Slot x={106} y={42} w={86} h={46} label="Cards by Person" d={0.75}>
        {bars.map((b, i) => (
          <g key={b.label}>
            <text
              className={MUTED}
              x={110}
              y={57.5 + i * 10}
              fontSize="4.4"
              fontWeight="600"
              fill="#64748b"
            >
              {b.label}
            </text>
            <rect
              className="fa-f-grow-x"
              style={at(1 + i * 0.15)}
              x={122}
              y={53.5 + i * 10}
              width={b.w}
              height="5.5"
              rx="1.5"
              fill={b.colour}
            />
          </g>
        ))}
      </Slot>

      <Slot x={198} y={42} w={88} h={46} label="Budget Sheet" d={0.9}>
        {[0, 1, 2, 3, 4].map((r) => (
          <path
            key={`r${r}`}
            className={GRID}
            d={`M202 ${51 + r * 8} H282`}
            stroke="#e2e8f0"
            strokeWidth="0.5"
          />
        ))}
        {[0, 1, 2].map((c) => (
          <path
            key={`c${c}`}
            className={GRID}
            d={`M${228 + c * 18} 51 V83`}
            stroke="#e2e8f0"
            strokeWidth="0.5"
          />
        ))}
        {[
          ['Venue', '1,200'],
          ['Food', '860'],
          ['Travel', '540'],
          ['Total', '2,600'],
        ].map(([name, value], r) => (
          <g key={name}>
            <text
              className={r === 3 ? INK : MUTED}
              x={204}
              y={57 + r * 8}
              fontSize="4.2"
              fontWeight={r === 3 ? 700 : 500}
              fill={r === 3 ? '#1e293b' : '#64748b'}
            >
              {name}
            </text>
            <text
              className={INK}
              x={262}
              y={57 + r * 8}
              textAnchor="end"
              fontSize="4.2"
              fontWeight={r === 3 ? 700 : 500}
              fill="#1e293b"
            >
              {value}
            </text>
          </g>
        ))}
      </Slot>
    </Stage>
  );
}
