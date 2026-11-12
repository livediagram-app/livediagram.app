import type { ReactNode } from 'react';
import { FONT, at } from '@/components/art-tokens';
import { Count } from './hero-board-parts';
import type { CardDef } from './hero-plan-card';

// The rule side of the Automations scene (hero-automations-board.tsx), after the Automations screen
// (docs/specs/026-plan/automations.md "The rule builder", "The Automations screen"): the rule as the builder
// draws it, its steps as cards joined by a line, each lighting or ticking as a run reaches it; the Audit
// Trail under it, newest run first, with Runs today ticking over; and the Slack post a run sends.

// One run of the rule, timed from its card's drop.
export type Run = { card: CardDef; when: number; stamp: number; post: number; logged: number };
type At = { x: number; y: number; w: number };

const PANEL = 'fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700';
const SUNK = 'fill-slate-50 stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700';
const INK = 'fill-(--art-text) dark:fill-slate-100';
const MUTED = 'fill-slate-500 dark:fill-slate-400';
const SHADOW = { filter: 'drop-shadow(0 4px 10px rgb(15 23 42 / 0.08))' };

const STEP_H = 36;
const STEP_PITCH = 48;
const STEPS_TOP = 44;
const AUDIT_TOP = 190;
const ROW_H = 20;
const ROW_PITCH = 24;
const RULE_PANEL_H = 256;

// The rule's three steps, each with its kind, its sentence and its glyph's tint.
const STEPS = [
  { kind: 'When', text: 'Card Moved to Done', tint: '#f59e0b' },
  { kind: 'Then', text: 'Set Completed On', tint: '#10b981' },
  { kind: 'Then', text: 'Post to Slack', tint: '#7c3aed' },
] as const;

// A mark that shows from `d` and, if a later run will show it again, gives way just before that one.
function Lit({ d, until, children }: { d: number; until?: number; children: ReactNode }) {
  const mark = (
    <g className="hm-pop" style={at(d)}>
      {children}
    </g>
  );
  return until === undefined ? (
    mark
  ) : (
    <g className="hm-out" style={at(until)}>
      {mark}
    </g>
  );
}

// Each step's glyph, drawn round its disc's centre: the trigger's bolt, a date, a channel.
function StepGlyph({ i, cx, cy }: { i: number; cx: number; cy: number }) {
  const tint = STEPS[i]!.tint;
  const line = { fill: 'none', stroke: tint, strokeWidth: 1.2, strokeLinecap: 'round' } as const;
  if (i === 0)
    return <path d={`M${cx + 0.8} ${cy - 4.6}l-3.6 5.4h3l-.6 3.8 3.6-5.4h-3z`} fill={tint} />;
  if (i === 1)
    return (
      <g {...line} strokeLinejoin="round">
        <rect x={cx - 4} y={cy - 3.4} width="8" height="7.4" rx="1.4" />
        <path d={`M${cx - 4} ${cy - 0.8}h8M${cx - 2} ${cy - 4.8}v2M${cx + 2} ${cy - 4.8}v2`} />
      </g>
    );
  return (
    <path
      {...line}
      d={`M${cx - 1.4} ${cy - 4.4}l-1 8.8M${cx + 2} ${cy - 4.4}l-1 8.8M${cx - 4} ${cy - 1.4}h8M${cx - 4.4} ${cy + 1.6}h8`}
    />
  );
}

function Tick({ cx, cy }: { cx: number; cy: number }) {
  return (
    <>
      <circle cx={cx} cy={cy} r="5.5" fill="#10b981" />
      <path
        d={`M${cx - 2.4} ${cy}l1.6 1.6 3.2-3.4`}
        stroke="#ffffff"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

/** The rule in its builder: its name and On chip, then When and the two Thens, lit by each run. */
export function RulePanel({ at: p, d, runs }: { at: At; d: number; runs: Run[] }) {
  const sx = p.x + 10;
  const sw = p.w - 20;
  const stepY = (i: number) => p.y + STEPS_TOP + i * STEP_PITCH;
  // When each step is reached in a run: the When as it lights, each Then as it ticks.
  const reached = (run: Run, i: number) => [run.when, run.stamp, run.post][i]!;
  return (
    <>
      <g className="hm-fade" style={at(d)}>
        <rect
          x={p.x}
          y={p.y}
          width={p.w}
          height={RULE_PANEL_H}
          rx="10"
          className={PANEL}
          style={SHADOW}
        />
        <text x={p.x + 12} y={p.y + 15} fontFamily={FONT} fontSize="7.5" className={MUTED}>
          Automations ›
        </text>
        {/* On: the rule's chip, its dot in the switch's green. */}
        <rect
          x={p.x + p.w - 34}
          y={p.y + 8}
          width="24"
          height="11"
          rx="5.5"
          className="fill-emerald-50 dark:fill-emerald-500/15"
        />
        <circle cx={p.x + p.w - 28} cy={p.y + 13.5} r="2" fill="#10b981" />
        <text
          x={p.x + p.w - 23.5}
          y={p.y + 16.2}
          fontFamily={FONT}
          fontSize="7"
          fontWeight="700"
          className="fill-emerald-700 dark:fill-emerald-300"
        >
          On
        </text>
      </g>
      <text
        className={`hm-type ${INK}`}
        style={at(d + 0.2, { '--steps': 21 })}
        x={p.x + 12}
        y={p.y + 30}
        fontFamily={FONT}
        fontSize="10"
        fontWeight="800"
      >
        Stamp the Finish Date
      </text>

      {/* The line joining the steps, behind their cards. */}
      <path
        className="hm-fade stroke-slate-300 dark:stroke-slate-600"
        style={at(d + 0.5)}
        d={`M${sx + 16} ${stepY(0) + STEP_H}V${stepY(STEPS.length - 1)}`}
        strokeWidth="1.2"
      />
      {STEPS.map((step, i) => {
        const y = stepY(i);
        const cy = y + STEP_H / 2;
        return (
          <g key={step.text}>
            <g className="hm-pop" style={at(d + 0.3 + i * 0.2)}>
              <rect x={sx} y={y} width={sw} height={STEP_H} rx="7" className={SUNK} />
              <circle cx={sx + 16} cy={cy} r="9" fill={step.tint} fillOpacity="0.14" />
              <StepGlyph i={i} cx={sx + 16} cy={cy} />
              <text
                x={sx + 31}
                y={y + 14}
                fontFamily={FONT}
                fontSize="6.6"
                fontWeight="700"
                letterSpacing="0.6"
                className={MUTED}
              >
                {step.kind.toUpperCase()}
              </text>
              <text
                x={sx + 31}
                y={y + 26}
                fontFamily={FONT}
                fontSize="8.6"
                fontWeight="700"
                className={INK}
              >
                {step.text}
              </text>
            </g>
            {/* Each run: the When rings in the trigger's amber, each Then ticks. */}
            {runs.map((run, r) => {
              const until = runs[r + 1] ? runs[r + 1]!.when - 0.15 : undefined;
              return i === 0 ? (
                <g key={r} className="hm-out" style={at(run.when + 1.1)}>
                  <rect
                    className="hm-pop"
                    style={at(run.when)}
                    x={sx - 2}
                    y={y - 2}
                    width={sw + 4}
                    height={STEP_H + 4}
                    rx="9"
                    fill="none"
                    stroke={step.tint}
                    strokeWidth="2"
                  />
                </g>
              ) : (
                <Lit key={r} d={reached(run, i)} until={until}>
                  <Tick cx={sx + sw - 12} cy={cy} />
                </Lit>
              );
            })}
          </g>
        );
      })}
    </>
  );
}

/** The Audit Trail under the rule: each run as a row, newest first, and Runs today counting them. */
export function AuditTrail({ at: p, d, runs }: { at: At; d: number; runs: Run[] }) {
  const top = p.y + AUDIT_TOP;
  const rowY = (r: number) => top + 10 + r * ROW_PITCH;
  return (
    <>
      <g className="hm-fade" style={at(d + 0.9)}>
        <path
          d={`M${p.x + 10} ${top - 14}H${p.x + p.w - 10}`}
          className="stroke-slate-200 dark:stroke-slate-700"
          strokeWidth="0.8"
        />
        <text
          x={p.x + 12}
          y={top}
          fontFamily={FONT}
          fontSize="8.5"
          fontWeight="700"
          className={INK}
        >
          Audit Trail
        </text>
        <text
          x={p.x + p.w - 26}
          y={top}
          textAnchor="end"
          fontFamily={FONT}
          fontSize="7.5"
          className={MUTED}
        >
          Runs today
        </text>
      </g>
      <Count
        x={p.x + p.w - 12}
        y={top}
        values={[
          { text: '41', from: d + 0.9 },
          ...runs.map((run, i) => ({ text: `${42 + i}`, from: run.logged })),
        ]}
      />
      {runs.map((run, r) => {
        // Each later run's row lands on top, pushing this one down a row.
        const later = runs.slice(r + 1);
        let row = <AuditRow x={p.x + 10} y={rowY(0)} w={p.w - 20} card={run.card} d={run.logged} />;
        for (const next of later)
          row = (
            <g className="hm-move" style={at(next.logged - 0.2, { '--dy': `${ROW_PITCH}px` })}>
              {row}
            </g>
          );
        return <g key={run.card.title}>{row}</g>;
      })}
    </>
  );
}

function AuditRow({
  x,
  y,
  w,
  card,
  d,
}: {
  x: number;
  y: number;
  w: number;
  card: CardDef;
  d: number;
}) {
  return (
    <g className="hm-pop" style={at(d)}>
      <rect x={x} y={y} width={w} height={ROW_H} rx="5" className={SUNK} />
      <text
        x={x + 8}
        y={y + 13}
        fontFamily={FONT}
        fontSize="7.6"
        fontWeight="700"
        className={MUTED}
      >
        #{card.n}
      </text>
      <text x={x + 26} y={y + 13} fontFamily={FONT} fontSize="8" fontWeight="600" className={INK}>
        {card.title}
      </text>
      <rect
        x={x + w - 56}
        y={y + 4.5}
        width="28"
        height="11"
        rx="5.5"
        className="fill-emerald-100 dark:fill-emerald-500/25"
      />
      <text
        x={x + w - 42}
        y={y + 12.4}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize="7"
        fontWeight="700"
        className="fill-emerald-700 dark:fill-emerald-200"
      >
        Done
      </text>
      <text
        x={x + w - 8}
        y={y + 13}
        textAnchor="end"
        fontFamily={FONT}
        fontSize="7.2"
        className={MUTED}
      >
        0.3s
      </text>
    </g>
  );
}

/** The message a run posts to its Slack channel, with its link back to the card. */
export function SlackPost({ at: p, title, d }: { at: At; title: string; d: number }) {
  return (
    <g className="hm-pop" style={at(d)}>
      <rect x={p.x} y={p.y} width={p.w} height="48" rx="9" className={PANEL} style={SHADOW} />
      <rect x={p.x + 10} y={p.y + 10} width="20" height="20" rx="5" fill="#4a154b" />
      <path
        d={`M${p.x + 18.2} ${p.y + 15}l-1 10M${p.x + 22.2} ${p.y + 15}l-1 10M${p.x + 15.6} ${p.y + 18.6}h9M${p.x + 15} ${p.y + 22}h9`}
        stroke="#ffffff"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <text
        x={p.x + 38}
        y={p.y + 17}
        fontFamily={FONT}
        fontSize="8.5"
        fontWeight="800"
        className={INK}
      >
        #launches
        <tspan dx="5" fontSize="7" fontWeight="500" className={MUTED}>
          Automation · now
        </tspan>
      </text>
      <text x={p.x + 38} y={p.y + 29} fontFamily={FONT} fontSize="8.5" className={INK}>
        {title} is done.
      </text>
      <text
        x={p.x + 38}
        y={p.y + 40}
        fontFamily={FONT}
        fontSize="7.5"
        fontWeight="700"
        className="fill-brand-600 dark:fill-brand-300"
      >
        Open in liveplanner
      </text>
    </g>
  );
}
