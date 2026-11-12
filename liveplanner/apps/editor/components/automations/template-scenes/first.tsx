'use client';

// The first eight templates' scenes: finishing, assigning, due dates, forms, Slack, triage, unblocking.
// Part of TemplateScene.tsx (docs/specs/026-plan/automations.md "The Automations screen": Templates).

import {
  AlertGlyph,
  AVATARS,
  after,
  at,
  Avatar,
  Bubble,
  Card,
  CheckGlyph,
  Column,
  Count,
  Cursor,
  FlagGlyph,
  MailGlyph,
  MessageGlyph,
  NEXT_COLUMN,
  Pill,
  ZapGlyph,
  type ToneClasses,
} from '../scene-parts';

export function StampFinish({ tone }: { tone: ToneClasses }) {
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

export function AssignOnStart({ tone }: { tone: ToneClasses }) {
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

export function OverdueNudge({ tone }: { tone: ToneClasses }) {
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

export function FormResponses({ tone }: { tone: ToneClasses }) {
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
          <span className="text-[7px] font-semibold text-slate-500 dark:text-slate-400">
            In turn
          </span>
          <span className="relative ml-auto flex gap-[3px]">
            {(['KP', 'JR', 'MS'] as const).map((w) => (
              <span
                key={w}
                className={`grid size-3 place-items-center rounded-full text-[5px] font-bold text-white ${AVATARS[w]}`}
              >
                <span className="text-optical-centre">{w}</span>
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

export function ShippedToSlack({ tone }: { tone: ToneClasses }) {
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
          <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400">#</span>
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

export function TriageBugs({ tone }: { tone: ToneClasses }) {
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
              <span className="text-optical-centre">{w}</span>
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

export function UnblockNext({ tone }: { tone: ToneClasses }) {
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
          <span className="ats-out absolute right-1.5 top-1.5 text-slate-400" style={after(560)}>
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

export function DueSoon({ tone }: { tone: ToneClasses }) {
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
          <span className="text-[7px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
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
