'use client';

// Each template tile's living preview (docs/specs/026-plan/automations.md "The Automations screen": Templates): a
// small board moment that rests just before the rule acts and plays on hover. The motion is the classes in
// app/automation-scenes.css; the parts are scene-parts.tsx. Decoration only: the whole scene is aria-hidden.

import type { CSSProperties, ReactNode } from 'react';
import type { AutomationTemplateId } from '@liveplanner/items';
import {
  AlertGlyph,
  ArchiveGlyph,
  AVATARS,
  after,
  at,
  Avatar,
  Bubble,
  CalendarGlyph,
  Card,
  CheckGlyph,
  Column,
  Count,
  Cursor,
  FlagGlyph,
  LinkGlyph,
  MailGlyph,
  MessageGlyph,
  NEXT_COLUMN,
  Pill,
  SparklesGlyph,
  TONES,
  ZapGlyph,
  type SceneTone,
  type ToneClasses,
} from './scene-parts';

export type { SceneTone } from './scene-parts';

// ---- The scenes ----

function StampFinish({ tone }: { tone: ToneClasses }) {
  return (
    <>
      <Column tone={tone} label="Review" count={<Count from={2} to={1} />}>
        <div className="ats-t ats-drag relative z-10" style={at(NEXT_COLUMN)}>
          <Card>
            <span
              className="ats-t ats-out absolute right-1 top-1 text-red-500"
              style={at('translate(3px, 16px) rotate(40deg)', 'none', 520)}
            >
              <FlagGlyph aria-hidden />
            </span>
            <Pill
              className={`ats-t ats-in ats-pop -right-1.5 -top-2 ${tone.solid}`}
              style={at('none', 'scale(0.3) rotate(-12deg)', 640)}
            >
              <CheckGlyph aria-hidden />
              Today
            </Pill>
            <Cursor className="-bottom-2 right-3" />
          </Card>
        </div>
        <Card ghost wide="w-3/5" />
      </Column>
      <Column tone={tone} label="Done" count={<Count from={3} to={4} />}>
        <div className="h-[26px] shrink-0" />
        <Card ghost wide="w-2/3" />
      </Column>
    </>
  );
}

function AssignOnStart({ tone }: { tone: ToneClasses }) {
  return (
    <>
      <Column tone={tone} label="To Do" count={<Count from={3} to={2} />}>
        <div className="ats-t ats-drag relative z-10" style={at(NEXT_COLUMN)}>
          <Card>
            <span className="absolute bottom-1 right-1 size-3.5 rounded-full border border-dashed border-slate-300 dark:border-slate-600" />
            <Avatar
              who="AL"
              className="ats-t ats-in ats-pop bottom-1 right-1"
              style={at('none', 'translateY(-16px) scale(0.5)', 660)}
            />
            <Cursor name="Alex" className="-bottom-3 right-5" />
          </Card>
        </div>
        <Card ghost wide="w-3/5" />
      </Column>
      <Column tone={tone} label="In Progress" count={<Count from={1} to={2} />}>
        <div className="h-[26px] shrink-0" />
        <Card ghost>
          <Avatar who="JR" className="bottom-1 right-1" />
        </Card>
      </Column>
    </>
  );
}

function OverdueNudge({ tone }: { tone: ToneClasses }) {
  return (
    <>
      <div
        className={`relative flex w-[30%] shrink-0 flex-col items-center justify-center gap-1 rounded-lg bg-white/75 ring-1 dark:bg-slate-900/55 ${tone.ring}`}
      >
        <svg viewBox="0 0 40 40" className="size-9" aria-hidden>
          <circle
            cx="20"
            cy="20"
            r="16"
            className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
            strokeWidth="2"
          />
          {[0, 90, 180, 270].map((a) => (
            <line
              key={a}
              x1="20"
              y1="6.5"
              x2="20"
              y2="8.5"
              className="stroke-slate-300 dark:stroke-slate-500"
              strokeWidth="1.5"
              strokeLinecap="round"
              transform={`rotate(${a} 20 20)`}
            />
          ))}
          <g
            className="ats-t"
            style={{ ...at('rotate(0deg)', 'rotate(-8deg)', 0), transformOrigin: '20px 20px' }}
          >
            <line
              x1="20"
              y1="20"
              x2="11.5"
              y2="20"
              className="stroke-slate-700 dark:stroke-slate-200"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </g>
          <g
            className="ats-t"
            style={{ ...at('rotate(0deg)', 'rotate(-110deg)', 0), transformOrigin: '20px 20px' }}
          >
            <line
              x1="20"
              y1="20"
              x2="20"
              y2="8.5"
              className={tone.line}
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </g>
          <circle cx="20" cy="20" r="1.8" className="fill-slate-700 dark:fill-slate-200" />
        </svg>
        <span className="text-[10px] font-bold leading-none tabular-nums text-slate-800 dark:text-slate-100">
          9:00
        </span>
        <span className={`text-[7px] font-semibold uppercase tracking-[0.06em] ${tone.label}`}>
          Weekdays
        </span>
      </div>
      <Column tone={tone} label="Due" count={2}>
        {[0, 1].map((n) => (
          <Card key={n} wide={n ? 'w-3/5' : 'w-4/5'}>
            <Pill className={`right-1 top-1 shadow-none ${tone.soft}`}>Overdue</Pill>
            <span
              className="ats-t ats-in ats-pop absolute right-[46px] top-[5px] text-red-500"
              style={at('none', 'translateY(-6px) scale(0.3)', 460 + n * 120)}
            >
              <FlagGlyph aria-hidden />
            </span>
            <Avatar who={n ? 'KP' : 'MS'} className="bottom-[3px] left-[46%] size-3 text-[5px]" />
          </Card>
        ))}
        <Bubble
          tone={tone}
          className="ats-t ats-in -right-1.5 -top-2.5 z-10"
          style={at('none', 'translate(-46px, 30px) scale(0.4) rotate(-20deg)', 760)}
        >
          <MailGlyph aria-hidden />
        </Bubble>
      </Column>
    </>
  );
}

function FormResponses({ tone }: { tone: ToneClasses }) {
  return (
    <>
      <div className="relative flex w-[38%] shrink-0 flex-col gap-1 overflow-hidden rounded-lg bg-white p-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.1),0_0_0_1px_rgba(15,23,42,0.05)] dark:bg-slate-800 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
        <div className={`-mx-1.5 -mt-1.5 mb-0.5 h-2 ${tone.dot}`} />
        <div className="h-1 w-3/4 rounded-full bg-slate-300 dark:bg-slate-600" />
        <div className="flex h-3 items-center rounded-sm px-1 ring-1 ring-slate-200 dark:ring-slate-600">
          <div className="h-[3px] w-1/2 rounded-full bg-slate-300 dark:bg-slate-500" />
        </div>
        <div className="h-3 rounded-sm ring-1 ring-slate-200 dark:ring-slate-600" />
        <div
          className={`ats-press mt-auto grid h-3 w-3/5 place-items-center self-start rounded-sm text-[6px] font-bold text-white ${tone.solid}`}
        >
          Submit
        </div>
        <Cursor className="bottom-0 left-[46%]" />
      </div>
      <Column tone={tone} label="Responses" count={<Count from={4} to={5} d={300} />}>
        <div
          className="ats-t ats-in ats-drag relative z-10"
          style={at('none', 'translateX(-115%) scale(0.85)', 220)}
        >
          <Card>
            <Avatar
              who="JR"
              className="ats-t ats-in ats-pop bottom-1 right-1"
              style={at('none', 'scale(0.4)', 640)}
            />
            <Bubble
              tone={tone}
              className="ats-t ats-in ats-pop -right-1.5 -top-2.5 size-4 rounded-[5px]"
              style={at('none', 'translateY(6px) scale(0.3)', 820)}
            >
              <MessageGlyph aria-hidden />
            </Bubble>
          </Card>
        </div>
        <div className="mt-auto flex items-center gap-1 px-0.5">
          <span className="text-[7px] font-semibold text-slate-400">In turn</span>
          <span className="relative ml-auto flex gap-[3px]">
            {(['KP', 'JR', 'MS'] as const).map((w) => (
              <span
                key={w}
                className={`grid size-3 place-items-center rounded-full text-[5px] font-bold text-white ${AVATARS[w]}`}
              >
                {w}
              </span>
            ))}
            <span
              className={`ats-t absolute -left-[2px] -top-[2px] size-4 rounded-full ring-[1.5px] ring-offset-0 ${tone.label} ring-current`}
              style={at('translateX(15px)', 'none', 600)}
            />
          </span>
        </div>
      </Column>
    </>
  );
}

function ShippedToSlack({ tone }: { tone: ToneClasses }) {
  return (
    <>
      <Column tone={tone} label="Done" className="w-[40%] flex-none">
        <Card>
          <Pill className={`bottom-1 left-1.5 shadow-none ${tone.soft}`}>launch</Pill>
          <span className="absolute right-1 top-1 grid size-3 place-items-center rounded-full bg-emerald-500 text-white">
            <CheckGlyph aria-hidden />
          </span>
        </Card>
        <Card ghost wide="w-3/5" />
      </Column>
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-white shadow-[0_6px_16px_-8px_rgba(15,23,42,0.35),0_0_0_1px_rgba(15,23,42,0.06)] dark:bg-slate-800 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
        <div className="flex items-center gap-1 border-b border-slate-100 px-1.5 py-1 dark:border-slate-700">
          <span className="text-[9px] font-bold text-slate-400">#</span>
          <span className="text-[8.5px] font-bold text-slate-800 dark:text-slate-100">launch</span>
          <span className="ml-auto flex gap-0.5">
            <span className="size-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            <span className="size-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          </span>
        </div>
        <div className="flex flex-1 flex-col justify-end gap-1.5 p-1.5">
          <div
            className="ats-t flex items-start gap-1 opacity-60"
            style={at('translateY(-4px)', 'none', 160)}
          >
            <span className="size-3 shrink-0 rounded bg-rose-400" />
            <div className="flex flex-1 flex-col gap-[3px] pt-px">
              <div className="h-[3px] w-1/3 rounded-full bg-slate-300 dark:bg-slate-600" />
              <div className="h-[3px] w-4/5 rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
          <div
            className="ats-t ats-in flex items-start gap-1"
            style={at('none', 'translateY(14px)', 260)}
          >
            <span className={`grid size-3 shrink-0 place-items-center rounded ${tone.solid}`}>
              <ZapGlyph aria-hidden />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-[3px] pt-px">
              <div className="h-[3px] w-2/5 rounded-full bg-slate-400 dark:bg-slate-500" />
              <div className="h-[3px] w-full rounded-full bg-slate-200 dark:bg-slate-700" />
              <span
                className={`mt-px self-start truncate rounded-sm px-1 text-[6.5px] font-semibold leading-[10px] ${tone.soft}`}
              >
                Open in liveplanner
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function TriageBugs({ tone }: { tone: ToneClasses }) {
  return (
    <>
      <Column tone={tone} label="Triage" count={<Count from={1} to={2} d={200} />}>
        <div
          className="ats-t ats-in ats-pop relative z-10"
          style={at('none', 'translateY(-48px) rotate(-6deg)', 60)}
        >
          <Card className="overflow-hidden pl-2.5">
            <span className="absolute inset-y-0 left-0 w-[3px] bg-red-500" />
            <span className="absolute right-1 top-1 text-red-500">
              <AlertGlyph aria-hidden />
            </span>
            <Pill
              className={`ats-t ats-in ats-pop bottom-[3px] left-2.5 shadow-none ${tone.soft}`}
              style={at('none', 'scale(0.3)', 440)}
            >
              triage
            </Pill>
            <Avatar
              who="KP"
              className="ats-t ats-in ats-pop bottom-1 right-1"
              style={at('none', 'scale(0.3)', 620)}
            />
          </Card>
        </div>
        <Card ghost wide="w-3/5" />
      </Column>
      <Column tone={tone} label="On Triage" className="w-[28%] flex-none">
        <div className="relative flex flex-col items-center gap-1.5 pt-0.5">
          {(['MS', 'KP', 'JR'] as const).map((w) => (
            <span
              key={w}
              className={`grid size-4 place-items-center rounded-full text-[6px] font-bold text-white ${AVATARS[w]}`}
            >
              {w}
            </span>
          ))}
          <span
            className={`ats-t absolute left-1/2 top-[0px] -ml-[11px] size-[22px] rounded-full ring-2 ${tone.label} ring-current`}
            style={at('translateY(22px)', 'none', 560)}
          />
        </div>
      </Column>
    </>
  );
}

function UnblockNext({ tone }: { tone: ToneClasses }) {
  return (
    <div className="relative flex flex-1 items-center gap-0">
      <div className="relative w-[40%] shrink-0">
        <Card className="h-[34px]">
          <Pill
            className={`ats-t ats-in ats-pop bottom-1 left-1.5 shadow-none ${tone.solid}`}
            style={at('none', 'scale(0.3)', 80)}
          >
            <CheckGlyph aria-hidden />
            Done
          </Pill>
          <Pill
            className="ats-out bottom-1 left-1.5 bg-slate-100 text-slate-500 shadow-none dark:bg-slate-700 dark:text-slate-300"
            style={after(80)}
          >
            In Review
          </Pill>
        </Card>
      </div>
      <svg
        viewBox="0 0 40 12"
        preserveAspectRatio="none"
        className="h-3 min-w-0 flex-1"
        aria-hidden
      >
        <path
          d="M1 6H34"
          className="stroke-slate-300 dark:stroke-slate-600"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          fill="none"
        />
        <path
          d="M1 6H34"
          className={`ats-in ats-flow ${tone.line}`}
          style={after(200)}
          strokeWidth="1.8"
          fill="none"
        />
        <path
          d="M33 2.5 38 6l-5 3.5"
          className={`ats-in ${tone.line}`}
          style={after(200)}
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M33 2.5 38 6l-5 3.5"
          className="ats-out stroke-slate-300 dark:stroke-slate-600"
          style={after(200)}
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="relative w-[40%] shrink-0">
        <Card className="h-[34px]" wide="w-3/4">
          <span
            className="ats-out absolute right-1.5 top-1.5 text-slate-400 dark:text-slate-500"
            style={after(560)}
          >
            <svg width="11" height="12" viewBox="0 0 11 12" aria-hidden>
              <g
                className="ats-t"
                style={{
                  ...at('translate(2px, -2.5px) rotate(18deg)', 'none', 360),
                  transformOrigin: '8.5px 5px',
                }}
              >
                <path
                  d="M2.5 5.5V3.8a3 3 0 0 1 6 0v1.7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </g>
              <rect x="1" y="5.5" width="9" height="6" rx="1.5" fill="currentColor" />
            </svg>
          </span>
          <Pill
            className={`ats-t ats-in ats-pop bottom-1 left-1.5 ${tone.soft}`}
            style={at('none', 'scale(0.3)', 720)}
          >
            <MessageGlyph aria-hidden />
            Ready to start
          </Pill>
        </Card>
      </div>
    </div>
  );
}

function DueSoon({ tone }: { tone: ToneClasses }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  return (
    <div
      className={`relative flex flex-1 items-end gap-1 rounded-lg bg-white/75 p-1.5 pt-6 ring-1 dark:bg-slate-900/55 ${tone.ring}`}
    >
      {days.map((d, n) => (
        <div
          key={d}
          className="relative flex h-[52px] min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md bg-white pt-1 shadow-[0_0_0_1px_rgba(15,23,42,0.06)] dark:bg-slate-800 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
        >
          <span className="text-[7px] font-semibold uppercase tracking-wide text-slate-400">
            {d}
          </span>
          <span className="text-[10px] font-bold leading-none tabular-nums text-slate-800 dark:text-slate-100">
            {17 + n}
          </span>
          {n === 4 ? (
            <>
              <span className={`mt-auto mb-1 h-2 w-4/5 rounded-[3px] ${tone.soft}`} />
              <span className="absolute right-1 top-1 size-1.5 rounded-full bg-red-500" />
              <span
                className={`ats-t absolute -inset-px rounded-md ring-2 ${tone.label} ring-current`}
                style={at('translateX(calc(-200% - 8px))', 'none', 120)}
              />
            </>
          ) : null}
          {n === 2 ? (
            <>
              <span
                className={`ats-in absolute bottom-full left-1/2 mb-1 h-2 w-[calc(200%+8px)] rounded-t border-x-[1.5px] border-t-[1.5px] border-current ${tone.label}`}
                style={after(520)}
              >
                <span className="absolute -top-[7px] left-1/2 -translate-x-1/2 rounded bg-white px-0.5 text-[6.5px] font-bold leading-[10px] dark:bg-slate-900">
                  2 days
                </span>
              </span>
              <Bubble
                tone={tone}
                className="ats-t ats-in ats-pop bottom-1 left-1/2 -ml-2.5"
                style={at('translateY(-2px)', 'translateY(8px) scale(0.3)', 700)}
              >
                <MailGlyph aria-hidden />
              </Bubble>
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// The back of a column, the way a card moving left travels.
const PREV_COLUMN = 'translateX(calc(-100% - 22px))';

/** A small chip set inline in a row (Pill is placed absolutely). */
function Chip({
  className = '',
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 whitespace-nowrap rounded px-1 text-[7px] font-bold leading-[11px] ${className}`}
      style={style}
    >
      {children}
    </span>
  );
}

function CleanUpDone({ tone }: { tone: ToneClasses }) {
  return (
    <>
      <Column tone={tone} label="Done" count={<Count from={2} to={1} d={520} />}>
        <div
          className="ats-t ats-out ats-drag relative z-10"
          style={at('translate(calc(100% + 26px), 18px) scale(0.35)', 'none', 80)}
        >
          <Card>
            <Pill className="right-1 top-1 bg-slate-100 text-slate-500 shadow-none dark:bg-slate-700 dark:text-slate-300">
              21d
            </Pill>
          </Card>
        </div>
        <Card wide="w-3/5">
          <Pill className={`right-1 top-1 shadow-none ${tone.soft}`}>2d</Pill>
        </Card>
      </Column>
      <div
        className={`relative flex w-[34%] shrink-0 flex-col items-center justify-center gap-1 rounded-lg bg-white/75 ring-1 dark:bg-slate-900/55 ${tone.ring}`}
      >
        <Pill className="left-1.5 top-1.5 bg-slate-900/[0.05] text-slate-500 shadow-none dark:bg-white/10 dark:text-slate-300">
          <CalendarGlyph aria-hidden />
          Mon 9:00
        </Pill>
        <span
          className={`ats-t ats-pop mt-3 grid size-8 place-items-center rounded-lg ${tone.soft}`}
          style={at('scale(1.12)', 'none', 520)}
        >
          <ArchiveGlyph aria-hidden />
        </span>
        <span className="text-[7.5px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
          Archived{' '}
          <span className="relative inline-grid tabular-nums">
            <Count from={0} to={1} d={560} />
          </span>
        </span>
      </div>
    </>
  );
}

function EscalateUrgent({ tone }: { tone: ToneClasses }) {
  return (
    <>
      <Column tone={tone} label="In Progress" count={3}>
        <Card className="h-[38px]">
          <span className="absolute bottom-1.5 left-1.5 inline-grid">
            <Chip
              className="ats-out col-start-1 row-start-1 bg-amber-100 text-amber-800 dark:bg-amber-500/25 dark:text-amber-100"
              style={after(160)}
            >
              High
            </Chip>
            <Chip
              className={`ats-t ats-in ats-pop col-start-1 row-start-1 ${tone.solid}`}
              style={at('none', 'scale(0.4)', 160)}
            >
              Urgent
            </Chip>
          </span>
          <span
            className="ats-t ats-in ats-pop absolute right-1 top-1 text-red-500"
            style={at('none', 'translateY(-6px) scale(0.3)', 400)}
          >
            <FlagGlyph aria-hidden />
          </span>
          <Avatar who="MS" className="bottom-1.5 right-1" />
        </Card>
        <Card ghost wide="w-3/5" />
      </Column>
      <div className="flex w-[40%] shrink-0 flex-col justify-center gap-1.5">
        {[
          { glyph: <MailGlyph aria-hidden />, label: 'Email', d: 620 },
          {
            glyph: <span className="text-[10px] font-bold leading-none">#</span>,
            label: 'urgent',
            d: 780,
          },
        ].map((r) => (
          <div
            key={r.label}
            className="ats-t ats-in flex items-center gap-1.5 rounded-lg bg-white p-1.5 shadow-[0_4px_12px_-6px_rgba(15,23,42,0.35),0_0_0_1px_rgba(15,23,42,0.06)] dark:bg-slate-800 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
            style={at('none', 'translateX(-28px) scale(0.85)', r.d)}
          >
            <span className={`grid size-4 shrink-0 place-items-center rounded-md ${tone.solid}`}>
              {r.glyph}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="text-[7px] font-bold leading-none text-slate-700 dark:text-slate-200">
                {r.label}
              </span>
              <span className="h-[3px] w-4/5 rounded-full bg-slate-200 dark:bg-slate-700" />
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function ReopenOnComment({ tone }: { tone: ToneClasses }) {
  return (
    <>
      <Column tone={tone} label="In Progress" count={<Count from={1} to={2} d={760} />}>
        <div className="h-[26px] shrink-0" />
        <Card ghost wide="w-3/5" />
      </Column>
      <Column tone={tone} label="Done" count={<Count from={4} to={3} d={760} />}>
        <div className="ats-t ats-drag relative z-10" style={at(PREV_COLUMN, 'none', 420)}>
          <Card>
            <span
              className="absolute right-1 top-1 grid size-3 place-items-center rounded-full bg-emerald-500 text-white ats-out"
              style={after(700)}
            >
              <CheckGlyph aria-hidden />
            </span>
            <span
              className="ats-t ats-in ats-pop absolute right-1 top-1 text-red-500"
              style={at('none', 'scale(0.3)', 980)}
            >
              <FlagGlyph aria-hidden />
            </span>
            <span
              className="ats-t ats-in ats-pop absolute -top-3.5 left-1 z-10 flex items-center gap-0.5 rounded-md rounded-bl-none bg-white px-1 py-0.5 shadow-[0_3px_8px_-2px_rgba(15,23,42,0.35)] dark:bg-slate-700"
              style={{
                ...at('none', 'translateY(6px) scale(0.4)', 0),
                transformOrigin: 'bottom left',
              }}
            >
              <span className={`size-2.5 rounded-full ${AVATARS.JR}`} />
              <span className="text-[7px] font-semibold text-slate-700 dark:text-slate-100">
                Still broken?
              </span>
            </span>
          </Card>
        </div>
        <Card ghost wide="w-2/3" />
      </Column>
    </>
  );
}

function Rotation({ tone, d }: { tone: ToneClasses; d: number }) {
  return (
    <div className="mt-auto flex items-center gap-1 px-0.5">
      <span className="text-[7px] font-semibold text-slate-400">In turn</span>
      <span className="relative ml-auto flex gap-[3px]">
        {(['KP', 'JR', 'MS'] as const).map((w) => (
          <span
            key={w}
            className={`grid size-3 place-items-center rounded-full text-[5px] font-bold text-white ${AVATARS[w]}`}
          >
            {w}
          </span>
        ))}
        <span
          className={`ats-t absolute -left-[2px] -top-[2px] size-4 rounded-full ring-[1.5px] ${tone.label} ring-current`}
          style={at('translateX(15px)', 'none', d)}
        />
      </span>
    </div>
  );
}

function RouteReviews({ tone }: { tone: ToneClasses }) {
  return (
    <>
      <Column tone={tone} label="In Progress" count={<Count from={2} to={1} />}>
        <div className="ats-t ats-drag relative z-10" style={at(NEXT_COLUMN)}>
          <Card>
            <span className="absolute bottom-1 right-1 size-3.5 rounded-full border border-dashed border-slate-300 dark:border-slate-600" />
            <Avatar
              who="JR"
              className="ats-t ats-in ats-pop bottom-1 right-1"
              style={at('none', 'translateY(-16px) scale(0.5)', 760)}
            />
            <Bubble
              tone={tone}
              className="ats-t ats-in ats-pop -right-1.5 -top-2.5 size-4 rounded-[5px]"
              style={at('none', 'translateY(6px) scale(0.3)', 920)}
            >
              <MessageGlyph aria-hidden />
            </Bubble>
            <Cursor className="-bottom-2 right-5" />
          </Card>
        </div>
        <Card ghost wide="w-3/5" />
      </Column>
      <Column tone={tone} label="Review" count={<Count from={0} to={1} />}>
        <div className="h-[26px] shrink-0" />
        <Rotation tone={tone} d={620} />
      </Column>
    </>
  );
}

function DueOnStart({ tone }: { tone: ToneClasses }) {
  return (
    <>
      <Column tone={tone} label="To Do" count={<Count from={3} to={2} />}>
        <div className="ats-t ats-drag relative z-10" style={at(NEXT_COLUMN)}>
          <Card>
            <span
              className="ats-out absolute bottom-1 right-1 h-2.5 w-9 rounded-[3px] border border-dashed border-slate-300 dark:border-slate-600"
              style={after(660)}
            />
            <Pill
              className={`ats-t ats-in ats-pop bottom-[3px] right-1 shadow-none ${tone.soft}`}
              style={at('none', 'scale(0.3)', 660)}
            >
              <CalendarGlyph aria-hidden />
              Due 24 Nov
            </Pill>
            <Pill
              className={`ats-t ats-in -top-2.5 right-2 ${tone.solid}`}
              style={at('translateY(-3px)', 'translateY(6px)', 820)}
            >
              +7 days
            </Pill>
            <Cursor className="-bottom-2 left-3" />
          </Card>
        </div>
        <Card ghost wide="w-3/5" />
      </Column>
      <Column tone={tone} label="In Progress" count={<Count from={1} to={2} />}>
        <div className="h-[26px] shrink-0" />
        <Card ghost wide="w-2/3" />
      </Column>
    </>
  );
}

function FlagBlocked({ tone }: { tone: ToneClasses }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-1.5 px-[6%]">
      <Card className="h-[38px]" wide="w-2/3">
        <span className="absolute bottom-1.5 left-1.5 flex gap-0.5">
          <Chip className="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200">
            design
          </Chip>
          <Chip
            className={`ats-t ats-in ats-pop ${tone.soft}`}
            style={at('none', 'translateY(-12px) scale(0.5)', 60)}
          >
            blocked
          </Chip>
        </span>
        <span
          className="ats-t ats-in ats-pop absolute right-1.5 top-1.5 text-red-500"
          style={at('none', 'translateY(-6px) scale(0.3)', 360)}
        >
          <FlagGlyph aria-hidden />
        </span>
        <Avatar who="AL" className="bottom-1.5 right-1.5" />
      </Card>
      <div
        className="ats-t ats-in flex items-center gap-1.5 self-end rounded-lg rounded-tr-none bg-white px-1.5 py-1 shadow-[0_4px_12px_-6px_rgba(15,23,42,0.35),0_0_0_1px_rgba(15,23,42,0.06)] dark:bg-slate-800 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
        style={{ ...at('none', 'translateY(-8px) scale(0.9)', 600), transformOrigin: 'top right' }}
      >
        <span className={`grid size-3.5 shrink-0 place-items-center rounded ${tone.solid}`}>
          <ZapGlyph aria-hidden />
        </span>
        <span className="text-[7.5px] font-semibold text-slate-700 dark:text-slate-100">
          What is it waiting on?
        </span>
      </div>
    </div>
  );
}

function VerifyFix({ tone }: { tone: ToneClasses }) {
  return (
    <>
      <Column tone={tone} label="To Do" count={<Count from={2} to={3} d={360} />}>
        <div
          className="ats-t ats-in ats-pop relative z-10"
          style={at('none', 'translateX(calc(100% + 22px)) scale(0.55)', 260)}
        >
          <Card wide="w-1/2">
            <Pill className={`bottom-[3px] left-1.5 shadow-none ${tone.soft}`}>Verify fix</Pill>
            <Avatar who="KP" className="bottom-1 right-1" />
          </Card>
        </div>
        <Card ghost wide="w-3/5" />
      </Column>
      <Column tone={tone} label="Done" count={4}>
        <Card className="overflow-hidden pl-2.5">
          <span className="absolute inset-y-0 left-0 w-[3px] bg-red-500" />
          <span className="absolute right-1 top-1 text-red-500">
            <AlertGlyph aria-hidden />
          </span>
          <span className="absolute bottom-1 right-1 grid size-3 place-items-center rounded-full bg-emerald-500 text-white">
            <CheckGlyph aria-hidden />
          </span>
        </Card>
        <Card ghost wide="w-2/3" />
        <Bubble
          tone={tone}
          className="ats-t ats-in ats-pop -left-[15px] top-[23px] z-20 size-4 rounded-full"
          style={at('none', 'scale(0.3)', 620)}
        >
          <LinkGlyph aria-hidden />
        </Bubble>
      </Column>
    </>
  );
}

function BackToBacklog({ tone }: { tone: ToneClasses }) {
  return (
    <>
      <Column tone={tone} label="To Do" count={<Count from={2} to={3} />}>
        <div className="h-[26px] shrink-0" />
        <Card ghost wide="w-3/5" />
      </Column>
      <Column tone={tone} label="In Progress" count={<Count from={2} to={1} />}>
        <div className="ats-t ats-drag relative z-10" style={at(PREV_COLUMN)}>
          <Card>
            <Avatar
              who="AL"
              className="ats-t ats-out bottom-1 right-1"
              style={at('translate(8px, -18px) scale(0.4)', 'none', 640)}
            />
            <Pill
              className={`ats-out bottom-[3px] right-6 shadow-none ${tone.soft}`}
              style={after(760)}
            >
              Due 20 Nov
            </Pill>
            <Cursor className="-bottom-2 left-2" />
          </Card>
        </div>
        <Card ghost wide="w-2/3">
          <Avatar who="MS" className="bottom-1 right-1" />
        </Card>
      </Column>
    </>
  );
}

function SortIncoming({ tone }: { tone: ToneClasses }) {
  return (
    <Column
      tone={tone}
      label="New Cards"
      count={<Count from={3} to={4} d={80} />}
      className="mx-[6%]"
    >
      <div
        className="ats-t ats-in ats-pop relative z-10"
        style={at('none', 'translateY(-44px) rotate(-4deg)', 0)}
      >
        <Card className="h-[40px]" wide="w-1/2">
          <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-md">
            <span
              className="ats-t ats-in absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-brand-300/40 to-transparent dark:via-brand-300/20"
              style={at('translateX(220%)', 'translateX(-120%)', 280)}
            />
          </span>
          <span className="absolute bottom-1.5 left-1.5 flex gap-0.5">
            <Chip
              className="ats-t ats-in ats-pop bg-red-100 text-red-700 dark:bg-red-500/25 dark:text-red-100"
              style={at('none', 'scale(0.3)', 620)}
            >
              <AlertGlyph aria-hidden />
              Bug
            </Chip>
            <Chip
              className="ats-t ats-in ats-pop bg-amber-100 text-amber-800 dark:bg-amber-500/25 dark:text-amber-100"
              style={at('none', 'scale(0.3)', 740)}
            >
              High
            </Chip>
            <Chip
              className={`ats-t ats-in ats-pop ${tone.soft}`}
              style={at('none', 'scale(0.3)', 860)}
            >
              login
            </Chip>
          </span>
          <Bubble
            tone={tone}
            className="ats-t ats-in ats-pop -right-1.5 -top-2.5 size-[18px]"
            style={at('none', 'scale(0.3) rotate(-30deg)', 300)}
          >
            <SparklesGlyph aria-hidden />
          </Bubble>
        </Card>
      </div>
    </Column>
  );
}

function SummariseRequests({ tone }: { tone: ToneClasses }) {
  return (
    <>
      <div className="relative flex w-[32%] shrink-0 flex-col gap-1 overflow-hidden rounded-lg bg-white p-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.1),0_0_0_1px_rgba(15,23,42,0.05)] dark:bg-slate-800 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
        <div className={`-mx-1.5 -mt-1.5 mb-0.5 h-2 ${tone.dot}`} />
        {['w-full', 'w-4/5', 'w-full', 'w-2/3', 'w-3/4'].map((w, n) => (
          <div key={n} className={`h-[3px] rounded-full bg-slate-200 dark:bg-slate-700 ${w}`} />
        ))}
        <div className={`ats-press mt-auto h-2.5 w-3/5 rounded-sm ${tone.solid}`} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
        <div
          className="ats-t ats-in ats-drag relative z-10"
          style={at('none', 'translateX(-60%) scale(0.85)', 140)}
        >
          <Card>
            <Pill
              className="ats-t ats-in ats-pop right-1 top-1 bg-amber-100 text-amber-800 shadow-none dark:bg-amber-500/25 dark:text-amber-100"
              style={at('none', 'scale(0.3)', 960)}
            >
              Medium
            </Pill>
          </Card>
        </div>
        <div
          className="ats-t ats-in flex gap-1.5 rounded-lg bg-white p-1.5 shadow-[0_4px_12px_-6px_rgba(15,23,42,0.35),0_0_0_1px_rgba(15,23,42,0.06)] dark:bg-slate-800 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
          style={at('none', 'translateY(8px)', 380)}
        >
          <span className={`grid size-3.5 shrink-0 place-items-center rounded ${tone.solid}`}>
            <SparklesGlyph aria-hidden />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-[3px] pt-px">
            {[
              { w: 'w-full', d: 520 },
              { w: 'w-11/12', d: 640 },
              { w: 'w-3/5', d: 760 },
            ].map((b) => (
              <span
                key={b.d}
                className={`ats-t h-[3px] origin-left rounded-full bg-slate-300 dark:bg-slate-600 ${b.w}`}
                style={at('none', 'scaleX(0)', b.d)}
              />
            ))}
          </span>
        </div>
      </div>
    </>
  );
}

// A small child row on a parent card, ticked when done.
function ChildRow({ done, d }: { done: boolean; d?: number }) {
  return (
    <span className="flex h-[10px] items-center gap-1 rounded-[3px] bg-slate-50 px-1 dark:bg-slate-900/60">
      <span
        className={`grid size-[7px] shrink-0 place-items-center rounded-full ${done ? 'bg-emerald-500' : 'ring-1 ring-slate-300 dark:ring-slate-600'} ${d === undefined ? '' : 'ats-t ats-in ats-pop'}`}
        style={d === undefined ? undefined : at('none', 'scale(0.2)', d)}
      />
      <span className="h-[2px] w-3/5 rounded-full bg-slate-300 dark:bg-slate-600" />
    </span>
  );
}

function CloseParent({ tone }: { tone: ToneClasses }) {
  return (
    <>
      <Column tone={tone} label="In Progress" count={<Count from={1} to={0} d={620} />}>
        <div className="ats-t ats-drag relative z-10" style={at(NEXT_COLUMN, 'none', 520)}>
          <div className="relative flex flex-col gap-[3px] rounded-md bg-white p-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.1),0_0_0_1px_rgba(15,23,42,0.05)] dark:bg-slate-800">
            <div className="h-1 w-4/5 rounded-full bg-slate-300 dark:bg-slate-600" />
            <ChildRow done />
            <ChildRow done />
            <span className="relative">
              <ChildRow done={false} />
              <span className="absolute inset-0">
                <ChildRow done d={140} />
              </span>
            </span>
          </div>
        </div>
      </Column>
      <Column tone={tone} label="Done" count={<Count from={2} to={3} d={620} />}>
        <Card ghost wide="w-3/5" />
      </Column>
    </>
  );
}

function TellUnblocked({ tone }: { tone: ToneClasses }) {
  return (
    <Column tone={tone} label="To Do" className="mx-[4%]">
      <Card>
        <Pill
          className="ats-out bottom-[3px] right-6 bg-red-100 text-red-700 shadow-none dark:bg-red-500/25 dark:text-red-100"
          style={after(200)}
        >
          Blocked
        </Pill>
        <Avatar who="JR" className="bottom-1 right-1" />
        <span
          className="ats-t ats-in ats-pop absolute -top-4 right-2 z-10 flex items-center gap-0.5 rounded-md rounded-br-none bg-white px-1 py-0.5 shadow-[0_3px_8px_-2px_rgba(15,23,42,0.35)] dark:bg-slate-700"
          style={{
            ...at('none', 'translateY(6px) scale(0.4)', 380),
            transformOrigin: 'bottom right',
          }}
        >
          <span className={`rounded px-0.5 text-[6.5px] font-bold leading-[9px] ${tone.soft}`}>
            @JR
          </span>
          <span className="text-[6.5px] font-semibold leading-none text-slate-600 dark:text-slate-200">
            Ready to start
          </span>
        </span>
      </Card>
      <Card ghost wide="w-1/2" />
    </Column>
  );
}

function NudgeStuck({ tone }: { tone: ToneClasses }) {
  return (
    <Column tone={tone} label="In Progress" className="mx-[4%]">
      <Card ghost wide="w-2/3" />
      <Card>
        <Pill className={`bottom-[3px] right-6 shadow-none ${tone.soft}`}>5 days</Pill>
        <Avatar who="MS" className="bottom-1 right-1" />
        <span
          className="ats-t ats-in ats-pop absolute -right-1 -top-1.5 grid size-3.5 place-items-center rounded bg-red-500 text-white"
          style={at('none', 'scale(0.3) rotate(-20deg)', 160)}
        >
          <FlagGlyph aria-hidden />
        </span>
        <span
          className="ats-t ats-in ats-pop absolute -top-4 left-1 z-10 flex items-center gap-0.5 rounded-md rounded-bl-none bg-white px-1 py-0.5 shadow-[0_3px_8px_-2px_rgba(15,23,42,0.35)] dark:bg-slate-700"
          style={{
            ...at('none', 'translateY(6px) scale(0.4)', 400),
            transformOrigin: 'bottom left',
          }}
        >
          <span className={`rounded px-0.5 text-[6.5px] font-bold leading-[9px] ${tone.soft}`}>
            @MS
          </span>
          <span className="text-[6.5px] font-semibold leading-none text-slate-600 dark:text-slate-200">
            How is it going?
          </span>
        </span>
      </Card>
    </Column>
  );
}

function DoneWhenResolved({ tone }: { tone: ToneClasses }) {
  return (
    <>
      <Column tone={tone} label="Review" count={<Count from={1} to={0} d={560} />}>
        <div className="ats-t ats-drag relative z-10" style={at(NEXT_COLUMN, 'none', 460)}>
          <Card>
            <span className="absolute bottom-1 right-1 inline-grid">
              <span className="col-start-1 row-start-1 flex items-center gap-0.5 text-[7px] font-bold text-slate-500 dark:text-slate-300">
                <MessageGlyph aria-hidden />1
              </span>
              <span
                className="ats-t ats-in ats-pop col-start-1 row-start-1 grid size-3 place-items-center rounded-full bg-emerald-500 text-white"
                style={at('none', 'scale(0.2)', 160)}
              >
                <CheckGlyph aria-hidden />
              </span>
            </span>
          </Card>
        </div>
      </Column>
      <Column tone={tone} label="Done" count={<Count from={1} to={2} d={560} />}>
        <Card ghost wide="w-3/5" />
      </Column>
    </>
  );
}

const SCENES: Readonly<Record<AutomationTemplateId, (p: { tone: ToneClasses }) => ReactNode>> = {
  'stamp-finish': StampFinish,
  'assign-on-start': AssignOnStart,
  'overdue-nudge': OverdueNudge,
  'form-responses': FormResponses,
  'shipped-to-slack': ShippedToSlack,
  'triage-bugs': TriageBugs,
  'unblock-next': UnblockNext,
  'due-soon': DueSoon,
  'clean-up-done': CleanUpDone,
  'escalate-urgent': EscalateUrgent,
  'reopen-on-comment': ReopenOnComment,
  'route-reviews': RouteReviews,
  'due-on-start': DueOnStart,
  'flag-blocked': FlagBlocked,
  'verify-fix': VerifyFix,
  'back-to-backlog': BackToBacklog,
  'sort-incoming': SortIncoming,
  'summarise-requests': SummariseRequests,
  'close-parent': CloseParent,
  'tell-unblocked': TellUnblocked,
  'nudge-stuck': NudgeStuck,
  'done-when-resolved': DoneWhenResolved,
};

/** The scene at the top of a template tile, in the template's colour. */
export function TemplateScene({ id, tone }: { id: AutomationTemplateId; tone: SceneTone }) {
  const t = TONES[tone];
  const Scene = SCENES[id];
  return (
    <span
      aria-hidden
      className={`relative flex h-[116px] shrink-0 gap-2 overflow-hidden border-b border-slate-100 bg-gradient-to-br p-3 dark:border-slate-800 ${t.wash}`}
    >
      <span
        className={`pointer-events-none absolute inset-0 ${t.dots}`}
        style={{
          backgroundImage: 'radial-gradient(currentColor 1px, transparent 1.2px)',
          backgroundSize: '10px 10px',
          maskImage: 'linear-gradient(115deg, transparent 20%, #000 95%)',
          WebkitMaskImage: 'linear-gradient(115deg, transparent 20%, #000 95%)',
        }}
      />
      <Scene tone={t} />
    </span>
  );
}
