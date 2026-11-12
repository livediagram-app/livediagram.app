'use client';

// Each Pick a Trigger tile's picture (docs/specs/026-plan/automations.md "The rule builder"): the moment the trigger
// hears, resting just before and playing on hover or focus, in its group's colour. Drawn from scene-parts.tsx, moved by
// app/automation-scenes.css. Decoration only: aria-hidden.

import type { ReactNode } from 'react';
import type { AutomationTriggerKind } from '@liveplanner/items';
import { lucideGlyph } from '@liveplanner/ui';
import { lucideClock, lucideWebhook } from '@liveworkspace/icons/lucide';
import {
  AlertGlyph,
  ArchiveGlyph,
  CheckGlyph,
  LinkGlyph,
  Avatar,
  CalendarGlyph,
  Card,
  Chip,
  Cursor,
  Lane,
  PANEL,
  Pill,
  Subject,
  TONES,
  ZapGlyph,
  after,
  at,
  type SceneTone,
  type ToneClasses,
} from './scene-parts';
import type { TriggerGroupId } from './trigger-groups';

const TRIGGER_GROUP_TONES: Readonly<Record<TriggerGroupId, SceneTone>> = {
  cards: 'violet',
  comments: 'orange',
  links: 'emerald',
  times: 'blue',
  tools: 'emerald',
};

const ClockGlyph = lucideGlyph(lucideClock, 14);
const SmallClock = lucideGlyph(lucideClock, 8);
const WebhookGlyph = lucideGlyph(lucideWebhook, 10);
const SLIDE = 'translateX(calc(100% + 26px))';

// The bolt that lights as the trigger fires.
function Fire({
  tone,
  d,
  className = '-right-1.5 -top-2',
}: {
  tone: ToneClasses;
  d: number;
  className?: string;
}) {
  return (
    <span
      className={`ats-t ats-in ats-pop absolute z-10 grid size-4 place-items-center rounded-md shadow-[0_4px_10px_-3px_rgba(15,23,42,0.4)] ${tone.solid} ${className}`}
      style={at('none', 'scale(0.3) rotate(-25deg)', d)}
    >
      <ZapGlyph aria-hidden />
    </span>
  );
}

// A ticked or open checklist row.
function Tick({ tone, d }: { tone: ToneClasses; d?: number }) {
  return (
    <span className="flex items-center gap-1">
      <span className="relative grid size-2.5 place-items-center rounded-[3px] ring-1 ring-slate-300 dark:ring-slate-600">
        <span
          className={`grid size-2.5 place-items-center rounded-[3px] ${tone.solid} ${d === undefined ? '' : 'ats-t ats-in ats-pop'}`}
          style={d === undefined ? undefined : at('none', 'scale(0.2)', d)}
        >
          <CheckGlyph aria-hidden />
        </span>
      </span>
      <span className="h-[3px] w-8 rounded-full bg-slate-300 dark:bg-slate-600" />
    </span>
  );
}

const SCENES: Readonly<Record<AutomationTriggerKind, (p: { tone: ToneClasses }) => ReactNode>> = {
  card_archived: ({ tone }) => (
    <>
      <div
        className="ats-t relative w-[36%] shrink-0"
        style={at('translate(34px, 4px) scale(0.45)', 'none', 0)}
      >
        <div className="ats-out" style={after(260)}>
          <Card />
        </div>
      </div>
      <div className={`relative grid size-9 shrink-0 place-items-center ${PANEL}`}>
        <span className={tone.label}>
          <ArchiveGlyph aria-hidden />
        </span>
        <Fire tone={tone} d={420} />
      </div>
    </>
  ),
  card_restored: ({ tone }) => (
    <>
      <div className={`relative grid size-9 shrink-0 place-items-center ${PANEL}`}>
        <span className={tone.label}>
          <ArchiveGlyph aria-hidden />
        </span>
      </div>
      <div
        className="ats-t ats-in relative w-[36%] shrink-0"
        style={at('none', 'translate(-34px, 4px) scale(0.45)', 80)}
      >
        <Card />
        <Fire tone={tone} d={420} />
      </div>
    </>
  ),
  checklist_completed: ({ tone }) => (
    <div className={`relative flex flex-col gap-1 p-1.5 ${PANEL}`}>
      <Tick tone={tone} />
      <Tick tone={tone} />
      <Tick tone={tone} d={200} />
      <Fire tone={tone} d={420} />
    </div>
  ),
  column_limit: ({ tone }) => (
    <div
      className={`relative flex h-[56px] w-[42%] shrink-0 flex-col justify-end gap-[3px] rounded-lg bg-white/70 p-1.5 ring-1 dark:bg-slate-900/50 ${tone.ring}`}
    >
      <span className="absolute right-1 top-1 inline-grid">
        <Chip
          className="ats-out col-start-1 row-start-1 bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
          style={after(260)}
        >
          3 / 3
        </Chip>
        <Chip
          className="ats-t ats-in ats-pop col-start-1 row-start-1 bg-red-100 text-red-700 dark:bg-red-500/25 dark:text-red-100"
          style={at('none', 'scale(0.4)', 260)}
        >
          4 / 3
        </Chip>
      </span>
      <div className="ats-t ats-in" style={at('none', 'translateY(-22px)', 60)}>
        <span className="block h-[9px] rounded-[3px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.08)] dark:bg-slate-800" />
      </div>
      {[0, 1].map((i) => (
        <span
          key={i}
          className="block h-[9px] rounded-[3px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.08)] dark:bg-slate-800"
        />
      ))}
      <Fire tone={tone} d={460} className="-left-1.5 -top-2" />
    </div>
  ),
  threads_resolved: ({ tone }) => (
    <Subject className="mt-4 w-[46%]">
      <span className="absolute -top-4 left-1 z-10 flex items-center gap-0.5 rounded-md rounded-bl-none bg-white px-1 py-0.5 shadow-[0_3px_8px_-2px_rgba(15,23,42,0.35)] dark:bg-slate-700">
        <span className="size-2.5 rounded-full bg-sky-500" />
        <span className="h-[3px] w-7 rounded-full bg-slate-300 dark:bg-slate-500" />
        <span
          className="ats-t ats-in ats-pop ml-0.5 grid size-2.5 place-items-center rounded-full bg-emerald-500 text-white"
          style={at('none', 'scale(0.2)', 200)}
        >
          <CheckGlyph aria-hidden />
        </span>
      </span>
      <Chip className={`absolute bottom-1 right-1 ${tone.soft}`}>
        <span className="inline-grid">
          <span className="ats-out col-start-1 row-start-1" style={after(260)}>
            1 open
          </span>
          <span className="ats-in col-start-1 row-start-1" style={after(260)}>
            All done
          </span>
        </span>
      </Chip>
      <Fire tone={tone} d={460} className="-right-1.5 top-1" />
    </Subject>
  ),
  mentioned: ({ tone }) => (
    <Subject className="mt-4 w-[46%]">
      <span
        className="ats-t ats-in ats-pop absolute -top-4 left-1 z-10 flex items-center gap-0.5 rounded-md rounded-bl-none bg-white px-1 py-0.5 shadow-[0_3px_8px_-2px_rgba(15,23,42,0.35)] dark:bg-slate-700"
        style={{ ...at('none', 'translateY(6px) scale(0.4)', 60), transformOrigin: 'bottom left' }}
      >
        <span className={`rounded px-0.5 text-[6.5px] font-bold leading-[9px] ${tone.soft}`}>
          @KP
        </span>
        <span className="h-[3px] w-6 rounded-full bg-slate-300 dark:bg-slate-500" />
      </span>
      <Avatar who="KP" className="ats-t bottom-1 right-1" style={at('scale(1.25)', 'none', 300)} />
      <Fire tone={tone} d={420} className="-right-1.5 top-1" />
    </Subject>
  ),
  card_unblocked: ({ tone }) => (
    <>
      <div className="relative w-[34%] shrink-0">
        <Card>
          <Pill
            className="ats-t ats-in ats-pop -bottom-1.5 right-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-100"
            style={at('none', 'scale(0.4)', 120)}
          >
            <CheckGlyph aria-hidden />
            Done
          </Pill>
        </Card>
      </div>
      <span className={`ats-t shrink-0 ${tone.label}`} style={at('none', 'none', 0)}>
        <LinkGlyph aria-hidden />
      </span>
      <div className="relative w-[34%] shrink-0">
        <Card>
          <Pill
            className="ats-out -bottom-1.5 right-0 bg-red-100 text-red-700 shadow-none dark:bg-red-500/25 dark:text-red-100"
            style={after(300)}
          >
            Blocked
          </Pill>
        </Card>
        <Fire tone={tone} d={440} />
      </div>
    </>
  ),
  related_done: ({ tone }) => (
    <>
      <div className="relative w-[36%] shrink-0">
        <Card>
          <Fire tone={tone} d={520} />
        </Card>
      </div>
      <div className="flex w-[30%] shrink-0 flex-col gap-[3px]">
        {[0, 120, 300].map((d, i) => (
          <span
            key={d}
            className="relative flex h-[9px] items-center rounded-[3px] bg-white px-1 shadow-[0_0_0_1px_rgba(15,23,42,0.08)] dark:bg-slate-800"
          >
            <span className="h-[2px] w-1/2 rounded-full bg-slate-300 dark:bg-slate-600" />
            <span
              className={`ml-auto grid size-[7px] place-items-center rounded-full bg-emerald-500 ${i === 2 ? 'ats-t ats-in ats-pop' : ''}`}
              style={i === 2 ? at('none', 'scale(0.2)', d) : undefined}
            />
          </span>
        ))}
      </div>
    </>
  ),
  stuck: ({ tone }) => (
    <Subject>
      <Pill
        className={`ats-t bottom-[3px] right-1 shadow-none ${tone.soft}`}
        style={at('scale(1.12)', 'none', 220)}
      >
        <SmallClock aria-hidden />5 days
      </Pill>
      <span
        className="ats-t absolute -left-2 top-1 text-[9px] font-bold leading-none text-slate-500 dark:text-slate-400"
        style={at('translateY(-3px)', 'none', 80)}
      >
        z
      </span>
      <Fire tone={tone} d={380} />
    </Subject>
  ),
  card_created: ({ tone }) => (
    <Lane tone={tone}>
      <div
        className="ats-t ats-in ats-pop relative"
        style={at('none', 'translateY(-14px) scale(0.6)', 60)}
      >
        <Card>
          <Pill className={`-left-1 -top-2 ${tone.solid}`}>New</Pill>
        </Card>
      </div>
      <Fire tone={tone} d={420} />
    </Lane>
  ),
  form_response: ({ tone }) => (
    <>
      <div className={`flex w-[34%] shrink-0 flex-col gap-1 p-1.5 ${PANEL}`}>
        <span className="h-[3px] w-3/4 rounded-full bg-slate-300 dark:bg-slate-600" />
        <span className="h-2 rounded-[3px] ring-1 ring-slate-200 dark:ring-slate-700" />
        <span
          className={`ats-press self-end rounded px-1 text-[6.5px] font-bold leading-[10px] ${tone.solid}`}
        >
          Submit
        </span>
      </div>
      <div
        className="ats-t ats-in relative w-[36%] shrink-0"
        style={at('none', 'translateX(-24px) scale(0.6)', 260)}
      >
        <Card />
        <Fire tone={tone} d={520} />
      </div>
    </>
  ),
  card_moved: ({ tone }) => (
    <>
      <Lane tone={tone}>
        <div className="ats-t ats-drag relative z-10" style={at(SLIDE)}>
          <Card />
          <Fire tone={tone} d={640} />
        </div>
      </Lane>
      <Lane tone={tone}>
        <div className="h-[26px]" />
      </Lane>
    </>
  ),
  field_changed: ({ tone }) => (
    <Subject>
      <span className="absolute bottom-1 right-1 inline-grid">
        <Chip
          className="ats-out col-start-1 row-start-1 bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
          style={after(200)}
        >
          Low
        </Chip>
        <Chip
          className="ats-t ats-in ats-pop col-start-1 row-start-1 bg-amber-100 text-amber-800 dark:bg-amber-500/25 dark:text-amber-100"
          style={at('none', 'scale(0.3)', 200)}
        >
          High
        </Chip>
      </span>
      <Fire tone={tone} d={460} />
    </Subject>
  ),
  comment_added: ({ tone }) => (
    <Subject className="mt-4 w-[46%]">
      <span
        className="ats-t ats-in ats-pop absolute -top-4 left-1 z-10 flex items-center gap-0.5 rounded-md rounded-bl-none bg-white px-1 py-0.5 shadow-[0_3px_8px_-2px_rgba(15,23,42,0.35)] dark:bg-slate-700"
        style={{ ...at('none', 'translateY(6px) scale(0.4)', 60), transformOrigin: 'bottom left' }}
      >
        <span className="size-2.5 rounded-full bg-rose-500" />
        <span className="h-[3px] w-8 rounded-full bg-slate-300 dark:bg-slate-500" />
      </span>
      <Avatar who="JR" className="bottom-1 right-1" />
      <Fire tone={tone} d={400} className="-right-1.5 top-1" />
    </Subject>
  ),
  manual: ({ tone }) => (
    <>
      <Subject className="w-[36%]" />
      <div className={`relative flex w-[38%] shrink-0 flex-col gap-[3px] p-1 ${PANEL}`}>
        <span className="h-[3px] w-2/3 rounded-full bg-slate-200 dark:bg-slate-700" />
        <span className="relative flex items-center gap-0.5 rounded-[3px] px-0.5 py-px">
          <span
            className={`ats-t ats-in absolute inset-0 origin-left rounded-[3px] ${tone.soft}`}
            style={at('none', 'scaleX(0.3)', 220)}
          />
          <span className={`relative grid size-2 place-items-center ${tone.label}`}>
            <ZapGlyph aria-hidden />
          </span>
          <span className="relative text-[6.5px] font-bold leading-none text-slate-700 dark:text-slate-100">
            Run Rule
          </span>
        </span>
        <span className="h-[3px] w-1/2 rounded-full bg-slate-200 dark:bg-slate-700" />
        <span
          className="ats-t absolute -bottom-3 right-0"
          style={at('translate(-14px, -10px)', 'translate(10px, 6px)', 0)}
        >
          <Cursor />
        </span>
      </div>
    </>
  ),
  scheduled: ({ tone }) => (
    <>
      <div className={`relative grid size-11 shrink-0 place-items-center rounded-full ${PANEL}`}>
        <span className={tone.label}>
          <ClockGlyph aria-hidden />
        </span>
        <Chip className={`absolute -bottom-1.5 ${tone.solid}`}>9:00</Chip>
      </div>
      <div className="flex w-[34%] shrink-0 flex-col gap-1">
        {[120, 260].map((d) => (
          <div key={d} className="ats-t ats-in relative" style={at('none', 'translateX(-10px)', d)}>
            <Card />
          </div>
        ))}
      </div>
      <Fire tone={tone} d={60} className="left-[34%] top-2" />
    </>
  ),
  due_in: ({ tone }) => (
    <Subject>
      <Pill
        className={`ats-t bottom-[3px] right-1 shadow-none ${tone.soft}`}
        style={at('scale(1.12)', 'none', 220)}
      >
        <CalendarGlyph aria-hidden />
        In 2 days
      </Pill>
      <Fire tone={tone} d={360} />
    </Subject>
  ),
  overdue: ({ tone }) => (
    <Subject>
      <span className="absolute bottom-[3px] right-1 inline-grid">
        <Pill
          className={`ats-out relative col-start-1 row-start-1 shadow-none ${tone.soft}`}
          style={after(220)}
        >
          <CalendarGlyph aria-hidden />
          Today
        </Pill>
        <Pill
          className="ats-t ats-in ats-pop relative col-start-1 row-start-1 bg-red-100 text-red-700 shadow-none dark:bg-red-500/25 dark:text-red-100"
          style={at('none', 'scale(0.5)', 220)}
        >
          <AlertGlyph aria-hidden />
          Overdue
        </Pill>
      </span>
      <Fire tone={tone} d={460} />
    </Subject>
  ),
  incoming_webhook: ({ tone }) => (
    <>
      <div className={`relative grid size-9 shrink-0 place-items-center ${PANEL}`}>
        <span className={tone.label}>
          <WebhookGlyph aria-hidden />
        </span>
      </div>
      <svg
        viewBox="0 0 40 12"
        preserveAspectRatio="none"
        className="h-3 min-w-0 flex-1"
        aria-hidden
      >
        <path
          d="M1 6H39"
          className="stroke-slate-300 dark:stroke-slate-600"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          fill="none"
        />
        <path
          d="M1 6H39"
          className={`ats-in ats-flow ${tone.line}`}
          strokeWidth="1.8"
          fill="none"
        />
      </svg>
      <div className="relative w-[34%] shrink-0">
        <Card />
        <Fire tone={tone} d={420} />
      </div>
    </>
  ),
};

/** The picture at the top of a Pick a Trigger tile. */
export function TriggerScene({
  kind,
  group,
}: {
  kind: AutomationTriggerKind;
  group: TriggerGroupId;
}) {
  const t = TONES[TRIGGER_GROUP_TONES[group]];
  const Scene = SCENES[kind];
  return (
    <span
      aria-hidden
      className={`relative flex h-[72px] shrink-0 items-center justify-center gap-2 overflow-hidden border-b border-slate-100 bg-gradient-to-br px-4 dark:border-slate-800 ${t.wash}`}
    >
      <span
        className={`pointer-events-none absolute inset-0 ${t.dots}`}
        style={{
          backgroundImage: 'radial-gradient(currentColor 1px, transparent 1.2px)',
          backgroundSize: '10px 10px',
          maskImage: 'linear-gradient(115deg, transparent 25%, #000 95%)',
          WebkitMaskImage: 'linear-gradient(115deg, transparent 25%, #000 95%)',
        }}
      />
      <Scene tone={t} />
    </span>
  );
}
