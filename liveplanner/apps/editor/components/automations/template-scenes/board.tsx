'use client';

// The board templates' scenes: cleaning up, escalating, reopening, reviews, due dates, blocked cards, fixes, the backlog and AI.
// Part of TemplateScene.tsx (docs/specs/026-plan/automations.md "The Automations screen": Templates).

import type { CSSProperties, ReactNode } from 'react';
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
  ZapGlyph,
  type ToneClasses,
} from '../scene-parts';

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

export function CleanUpDone({ tone }: { tone: ToneClasses }) {
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

export function EscalateUrgent({ tone }: { tone: ToneClasses }) {
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

export function ReopenOnComment({ tone }: { tone: ToneClasses }) {
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

export function RouteReviews({ tone }: { tone: ToneClasses }) {
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

export function DueOnStart({ tone }: { tone: ToneClasses }) {
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

export function FlagBlocked({ tone }: { tone: ToneClasses }) {
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

export function VerifyFix({ tone }: { tone: ToneClasses }) {
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

export function BackToBacklog({ tone }: { tone: ToneClasses }) {
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

export function SortIncoming({ tone }: { tone: ToneClasses }) {
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

export function SummariseRequests({ tone }: { tone: ToneClasses }) {
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
