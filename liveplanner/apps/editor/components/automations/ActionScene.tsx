'use client';

// Each Add an Action tile's picture (docs/specs/026-plan/automations.md "The rule builder"): the action at work on a
// small card, resting just before and playing on hover or focus, in its group's colour. Drawn from scene-parts.tsx,
// moved by app/automation-scenes.css. Decoration only: aria-hidden.

import type { ReactNode } from 'react';
import { lucideGlyph } from '@liveplanner/ui';
import {
  lucideAtSign,
  lucideEraser,
  lucideHourglass,
  lucidePalette,
  lucidePencil,
  lucideShapes,
  lucideUsers,
  lucideWebhook,
} from '@liveworkspace/icons/lucide';
import type { ActionGroupId } from './action-groups';
import {
  AlertGlyph,
  ArchiveGlyph,
  after,
  at,
  Avatar,
  Bubble,
  CalendarGlyph,
  Card,
  CheckGlyph,
  LinkGlyph,
  FlagGlyph,
  MailGlyph,
  Pill,
  SparklesGlyph,
  TONES,
  ZapGlyph,
  Chip,
  Lane,
  PANEL,
  Subject,
  type SceneTone,
  type ToneClasses,
} from './scene-parts';
import type { AddKind } from './step-defaults';

export const ACTION_GROUP_TONES: Readonly<Record<ActionGroupId, SceneTone>> = {
  cards: 'blue',
  create: 'blue',
  archive: 'blue',
  labels: 'orange',
  flags: 'orange',
  checklists: 'emerald',
  links: 'emerald',
  people: 'emerald',
  comments: 'violet',
  timing: 'orange',
  tools: 'violet',
  ai: 'violet',
};

const PencilGlyph = lucideGlyph(lucidePencil, 10);
const EraserGlyph = lucideGlyph(lucideEraser, 10);
const WebhookGlyph = lucideGlyph(lucideWebhook, 10);
const TeamsGlyph = lucideGlyph(lucideUsers, 9);
const ShapesGlyph = lucideGlyph(lucideShapes, 9);
const PaletteGlyph = lucideGlyph(lucidePalette, 10);
const AtGlyph = lucideGlyph(lucideAtSign, 9);
const HourglassGlyph = lucideGlyph(lucideHourglass, 11);

// Set Colour's swatches, the middle one picked.
const SWATCHES = ['bg-emerald-500', 'bg-rose-500', 'bg-amber-400'] as const;

/** The AI's sparkle sweeping over a card before it writes. */
function Shimmer({ d = 0 }: { d?: number }) {
  return (
    <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-md">
      <span
        className="ats-t ats-in absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-brand-300/45 to-transparent dark:via-brand-300/25"
        style={at('translateX(220%)', 'translateX(-120%)', d)}
      />
    </span>
  );
}

function Message({
  tone,
  d,
  glyph,
  label,
}: {
  tone: ToneClasses;
  d: number;
  glyph: ReactNode;
  label: string;
}) {
  return (
    <div className={`flex w-[50%] shrink-0 flex-col overflow-hidden ${PANEL}`}>
      <div className="flex items-center gap-1 border-b border-slate-100 px-1.5 py-[3px] dark:border-slate-700">
        <span className="text-[7px] font-bold leading-none text-slate-800 dark:text-slate-100">
          {label}
        </span>
      </div>
      <div className="flex h-[24px] flex-col justify-end px-1.5 pb-1">
        <div
          className="ats-t ats-in flex items-center gap-1"
          style={at('none', 'translateY(12px)', d)}
        >
          <span className={`grid size-3 shrink-0 place-items-center rounded ${tone.solid}`}>
            {glyph}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="h-[3px] w-1/2 rounded-full bg-slate-400 dark:bg-slate-500" />
            <span className="h-[3px] w-full rounded-full bg-slate-200 dark:bg-slate-700" />
          </span>
        </div>
      </div>
    </div>
  );
}

const SLIDE = 'translateX(calc(100% + 26px))';

const ACTION_SCENES: Readonly<Record<AddKind, (p: { tone: ToneClasses }) => ReactNode>> = {
  move: ({ tone }) => (
    <>
      <Lane tone={tone}>
        <div className="ats-t ats-drag relative z-10" style={at(SLIDE)}>
          <Card />
        </div>
      </Lane>
      <Lane tone={tone}>
        <div className="h-[26px]" />
      </Lane>
    </>
  ),
  set_field: ({ tone }) => (
    <Subject>
      <span className="absolute bottom-1 right-1 inline-grid">
        <span
          className="ats-out col-start-1 row-start-1 h-2.5 w-8 rounded-[3px] border border-dashed border-slate-300 dark:border-slate-600"
          style={after(260)}
        />
        <Chip
          className={`ats-t ats-in ats-pop col-start-1 row-start-1 ${tone.soft}`}
          style={at('none', 'scale(0.3)', 260)}
        >
          High
        </Chip>
      </span>
      <span
        className={`ats-t absolute -bottom-3 -right-4 ${tone.label}`}
        style={at('translate(-6px, -6px) rotate(-12deg)', 'none', 0)}
      >
        <PencilGlyph aria-hidden />
      </span>
    </Subject>
  ),
  clear_field: ({ tone }) => (
    <Subject>
      <Pill className={`ats-out bottom-[3px] right-1 shadow-none ${tone.soft}`} style={after(300)}>
        <CalendarGlyph aria-hidden />
        20 Nov
      </Pill>
      <span
        className={`ats-t absolute -bottom-2 -right-5 ${tone.label}`}
        style={at('translateX(-26px) rotate(-8deg)', 'none', 0)}
      >
        <EraserGlyph aria-hidden />
      </span>
    </Subject>
  ),
  archive: ({ tone }) => (
    <div className="relative flex w-[46%] shrink-0 flex-col items-center">
      <div
        className="ats-t ats-drag relative z-10 w-full"
        style={at('translateY(22px) scale(0.4)', 'none', 0)}
      >
        <div className="ats-out" style={after(420)}>
          <Card />
        </div>
      </div>
      <span
        className={`ats-t ats-pop absolute -bottom-3 grid size-6 place-items-center rounded-md ${tone.soft}`}
        style={at('scale(1.15)', 'none', 460)}
      >
        <ArchiveGlyph aria-hidden />
      </span>
    </div>
  ),
  create_card: ({ tone }) => (
    <>
      <Subject className="w-[38%]" />
      <div
        className="ats-t ats-in ats-pop relative w-[38%] shrink-0"
        style={at('none', 'translateX(-90%) scale(0.5)', 120)}
      >
        <Card>
          <Pill className={`-right-1 -top-2 ${tone.solid}`}>New</Pill>
        </Card>
      </div>
    </>
  ),
  add_label: ({ tone }) => (
    <Subject>
      <span className="absolute bottom-1 left-1.5 flex gap-0.5">
        <Chip className="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200">
          ui
        </Chip>
        <Chip
          className={`ats-t ats-in ats-pop ${tone.soft}`}
          style={at('none', 'translateY(-14px) scale(0.5)', 60)}
        >
          urgent
        </Chip>
      </span>
    </Subject>
  ),
  remove_label: ({ tone }) => (
    <Subject>
      <span className="absolute bottom-1 left-1.5 flex gap-0.5">
        <Chip className="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200">
          ui
        </Chip>
        <Chip
          className={`ats-t ats-out ${tone.soft}`}
          style={at('translateY(-14px) rotate(10deg)', 'none', 60)}
        >
          blocked
        </Chip>
      </span>
    </Subject>
  ),
  flag: () => (
    <Subject>
      <span
        className="ats-t ats-in ats-pop absolute right-1 top-1 text-red-500"
        style={at('none', 'translateY(-8px) scale(0.3)', 60)}
      >
        <FlagGlyph aria-hidden />
      </span>
    </Subject>
  ),
  unflag: () => (
    <Subject>
      <span
        className="ats-t ats-out absolute right-1 top-1 text-red-500"
        style={at('translate(4px, 18px) rotate(40deg)', 'none', 60)}
      >
        <FlagGlyph aria-hidden />
      </span>
    </Subject>
  ),
  assign: () => (
    <Subject>
      <span className="absolute bottom-1 right-1 size-3.5 rounded-full border border-dashed border-slate-300 dark:border-slate-600" />
      <Avatar
        who="AL"
        className="ats-t ats-in ats-pop bottom-1 right-1"
        style={at('none', 'translateY(-18px) scale(0.5)', 60)}
      />
    </Subject>
  ),
  email: ({ tone }) => (
    <Subject>
      <Avatar who="MS" className="bottom-1 right-1" />
      <Bubble
        tone={tone}
        className="ats-t ats-in -right-2 -top-2"
        style={at('translate(26px, -4px) rotate(8deg)', 'translate(-6px, 10px) scale(0.4)', 60)}
      >
        <MailGlyph aria-hidden />
      </Bubble>
    </Subject>
  ),
  comment: () => (
    <Subject>
      <span
        className="ats-t ats-in ats-pop absolute -top-4 left-1 z-10 flex items-center gap-0.5 rounded-md rounded-bl-none bg-white px-1 py-0.5 shadow-[0_3px_8px_-2px_rgba(15,23,42,0.35)] dark:bg-slate-700"
        style={{ ...at('none', 'translateY(6px) scale(0.4)', 60), transformOrigin: 'bottom left' }}
      >
        <span className="grid size-2.5 place-items-center rounded-sm bg-brand-700 text-white dark:bg-brand-600">
          <ZapGlyph aria-hidden />
        </span>
        <span className="h-[3px] w-8 rounded-full bg-slate-300 dark:bg-slate-500" />
      </span>
    </Subject>
  ),
  notify_webhook: ({ tone }) => (
    <>
      <Subject className="w-[34%]" />
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
      <div className={`relative grid size-9 shrink-0 place-items-center ${PANEL}`}>
        <span className={tone.label}>
          <WebhookGlyph aria-hidden />
        </span>
        <span
          className={`ats-t ats-in ats-pop absolute -right-1 -top-1 size-2 rounded-full ${tone.dot}`}
          style={at('none', 'scale(0.3)', 420)}
        />
      </div>
    </>
  ),
  notify_slack: ({ tone }) => (
    <>
      <Subject className="w-[32%]" />
      <Message tone={tone} d={120} label="# launch" glyph={<ZapGlyph aria-hidden />} />
    </>
  ),
  notify_teams: ({ tone }) => (
    <>
      <Subject className="w-[32%]" />
      <Message tone={tone} d={120} label="Product Team" glyph={<TeamsGlyph aria-hidden />} />
    </>
  ),
  ai_summarise: ({ tone }) => (
    <>
      <Subject className="w-[34%]">
        <Shimmer />
      </Subject>
      <div
        className={`ats-t ats-in flex w-[44%] shrink-0 gap-1 p-1.5 ${PANEL}`}
        style={at('none', 'translateX(-10px)', 280)}
      >
        <span className={`grid size-3 shrink-0 place-items-center rounded ${tone.solid}`}>
          <SparklesGlyph aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-[3px] pt-px">
          {[
            { w: 'w-full', d: 400 },
            { w: 'w-4/5', d: 500 },
            { w: 'w-1/2', d: 600 },
          ].map((b) => (
            <span
              key={b.d}
              className={`ats-t h-[3px] origin-left rounded-full bg-slate-300 dark:bg-slate-600 ${b.w}`}
              style={at('none', 'scaleX(0)', b.d)}
            />
          ))}
        </span>
      </div>
    </>
  ),
  ai_card_type: ({ tone }) => (
    <Subject>
      <Shimmer />
      <span className="absolute bottom-1 left-1.5 inline-grid">
        <Chip
          className="ats-out col-start-1 row-start-1 bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
          style={after(360)}
        >
          Task
        </Chip>
        <Chip
          className="ats-t ats-in ats-pop col-start-1 row-start-1 bg-red-100 text-red-700 dark:bg-red-500/25 dark:text-red-100"
          style={at('none', 'scale(0.3)', 360)}
        >
          <AlertGlyph aria-hidden />
          Bug
        </Chip>
      </span>
      <Bubble
        tone={tone}
        className="ats-t ats-in ats-pop -right-1.5 -top-2.5 size-4"
        style={at('none', 'scale(0.3) rotate(-30deg)', 120)}
      >
        <SparklesGlyph aria-hidden />
      </Bubble>
    </Subject>
  ),
  ai_triage: ({ tone }) => (
    <Subject className="w-[52%]">
      <Shimmer />
      <span className="absolute bottom-1 left-1.5 flex gap-0.5">
        <Chip
          className="ats-t ats-in ats-pop bg-amber-100 text-amber-800 dark:bg-amber-500/25 dark:text-amber-100"
          style={at('none', 'scale(0.3)', 360)}
        >
          High
        </Chip>
        <Chip className={`ats-t ats-in ats-pop ${tone.soft}`} style={at('none', 'scale(0.3)', 460)}>
          login
        </Chip>
        <Chip className={`ats-t ats-in ats-pop ${tone.soft}`} style={at('none', 'scale(0.3)', 560)}>
          ui
        </Chip>
      </span>
      <Bubble
        tone={tone}
        className="ats-t ats-in ats-pop -right-1.5 -top-2.5 size-4"
        style={at('none', 'scale(0.3) rotate(-30deg)', 120)}
      >
        <SparklesGlyph aria-hidden />
      </Bubble>
    </Subject>
  ),
  set_type: ({ tone }) => (
    <Subject>
      <span className="ats-t absolute inset-y-1 left-0 w-[3px] rounded-r-full bg-slate-300 dark:bg-slate-600" />
      <span
        className="ats-t ats-in absolute inset-y-1 left-0 w-[3px] origin-top rounded-r-full bg-red-500"
        style={at('none', 'scaleY(0)', 300)}
      />
      <span className="absolute bottom-1 left-1.5 inline-grid">
        <Chip
          className="ats-out col-start-1 row-start-1 bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
          style={after(300)}
        >
          Story
        </Chip>
        <Chip
          className="ats-t ats-in ats-pop col-start-1 row-start-1 bg-red-100 text-red-700 dark:bg-red-500/25 dark:text-red-100"
          style={at('none', 'scale(0.3)', 300)}
        >
          <AlertGlyph aria-hidden />
          Bug
        </Chip>
      </span>
      <Bubble
        tone={tone}
        className="ats-t -right-1.5 -top-2.5 size-4"
        style={at('rotate(180deg)', 'none', 0)}
      >
        <ShapesGlyph aria-hidden />
      </Bubble>
    </Subject>
  ),
  set_colour: ({ tone }) => (
    <>
      <Subject className="w-[42%]">
        <span
          className="ats-t ats-in absolute inset-y-0 left-0 w-1 origin-top rounded-l-md bg-rose-500"
          style={at('none', 'scaleY(0)', 380)}
        />
      </Subject>
      <div className={`relative flex flex-col items-center gap-1 px-1.5 py-1 ${PANEL}`}>
        <span className={tone.label}>
          <PaletteGlyph aria-hidden />
        </span>
        <span className="flex gap-[3px]">
          {SWATCHES.map((c, i) => (
            <span key={c} className={`relative size-2 rounded-full ${c}`}>
              {i === 1 ? (
                <span
                  className="ats-t ats-in ats-pop absolute -inset-[2px] rounded-full ring-[1.5px] ring-slate-900 dark:ring-white"
                  style={at('none', 'scale(0.4)', 120)}
                />
              ) : null}
            </span>
          ))}
        </span>
      </div>
    </>
  ),
  restore: ({ tone }) => (
    <div className="relative flex w-[46%] shrink-0 flex-col items-center">
      <div
        className="ats-t ats-drag relative z-10 w-full"
        style={at('none', 'translateY(22px) scale(0.4)', 160)}
      >
        <div className="ats-in" style={after(160)}>
          <Card />
        </div>
      </div>
      <span
        className={`ats-t ats-out absolute -bottom-3 grid size-6 place-items-center rounded-md ${tone.soft}`}
        style={{ ...at('scale(0.8)', 'none', 520), ...after(520) }}
      >
        <ArchiveGlyph aria-hidden />
      </span>
    </div>
  ),
  copy_card: ({ tone }) => (
    <div className="relative w-[44%] shrink-0">
      <div
        className="ats-t ats-in ats-drag absolute inset-0"
        style={at('translate(18px, -9px)', 'none', 80)}
      >
        <Card>
          <Pill className={`-right-1.5 -top-2 ${tone.solid}`}>Copy</Pill>
        </Card>
      </div>
      <div className="relative">
        <Card />
      </div>
    </div>
  ),
  add_checklist: ({ tone }) => (
    <div className={`flex w-[50%] shrink-0 flex-col gap-[5px] px-2 py-1.5 ${PANEL}`}>
      {[
        { w: 'w-3/4', d: 0, done: true },
        { w: 'w-1/2', d: 160 },
        { w: 'w-2/3', d: 300 },
      ].map((r) => (
        <span
          key={r.d}
          className={`flex items-center gap-1 ${r.d ? 'ats-t ats-in' : ''}`}
          style={r.d ? at('none', 'translateX(-8px)', r.d) : undefined}
        >
          <span
            className={`grid size-2 shrink-0 place-items-center rounded-[2px] ${r.done ? tone.solid : 'ring-1 ring-slate-300 dark:ring-slate-600'}`}
          >
            {r.done ? <CheckGlyph aria-hidden /> : null}
          </span>
          <span
            className={`h-[3px] rounded-full ${r.done ? 'bg-slate-200 dark:bg-slate-700' : 'bg-slate-300 dark:bg-slate-600'} ${r.w}`}
          />
        </span>
      ))}
    </div>
  ),
  link_card: ({ tone }) => (
    <>
      <Subject className="w-[34%]" />
      <span className="relative flex min-w-0 flex-1 items-center justify-center">
        <svg viewBox="0 0 40 12" preserveAspectRatio="none" className="h-3 w-full" aria-hidden>
          <path
            d="M1 6H39"
            className="stroke-slate-300 dark:stroke-slate-600"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            fill="none"
          />
        </svg>
        <span
          className="ats-t absolute inset-x-0 top-1/2 h-[2px] origin-left -translate-y-1/2 rounded-full bg-emerald-500"
          style={at('none', 'scaleX(0)', 80)}
        />
        <Bubble
          tone={tone}
          className="ats-t ats-in ats-pop size-4"
          style={at('none', 'scale(0.3) rotate(-45deg)', 420)}
        >
          <LinkGlyph aria-hidden />
        </Bubble>
      </span>
      <Subject className="w-[34%]" />
    </>
  ),
  mention: ({ tone }) => (
    <Subject>
      <span
        className="ats-t ats-in ats-pop absolute -top-4 left-1 z-10 flex items-center gap-0.5 rounded-md rounded-bl-none bg-white px-1 py-0.5 shadow-[0_3px_8px_-2px_rgba(15,23,42,0.35)] dark:bg-slate-700"
        style={{ ...at('none', 'translateY(6px) scale(0.4)', 60), transformOrigin: 'bottom left' }}
      >
        <span className={`grid size-2.5 place-items-center rounded-sm ${tone.solid}`}>
          <AtGlyph aria-hidden />
        </span>
        <span className={`text-[7px] font-bold leading-none ${tone.label}`}>Alex</span>
        <span className="h-[3px] w-4 rounded-full bg-slate-300 dark:bg-slate-500" />
      </span>
      <Avatar who="AL" className="ats-t bottom-1 right-1" style={at('scale(1.2)', 'none', 360)} />
      <span
        className={`ats-t ats-in ats-pop absolute bottom-[14px] right-0 size-1.5 rounded-full ${tone.dot}`}
        style={at('none', 'scale(0)', 420)}
      />
    </Subject>
  ),
  resolve_threads: ({ tone }) => (
    <Subject>
      {[
        { x: 'left-1', d: 0 },
        { x: 'left-6', d: 160 },
      ].map((b) => (
        <span key={b.x} className={`absolute -top-3.5 ${b.x} z-10`}>
          <span
            className="ats-t flex items-center gap-0.5 rounded-md rounded-bl-none bg-white px-1 py-0.5 shadow-[0_3px_8px_-2px_rgba(15,23,42,0.35)] dark:bg-slate-700"
            style={at('scale(0.9)', 'none', b.d + 200)}
          >
            <span className="h-[3px] w-3 rounded-full bg-slate-300 dark:bg-slate-500" />
          </span>
          <span
            className={`ats-t ats-in ats-pop absolute -right-1 -top-1 grid size-2.5 place-items-center rounded-full ${tone.solid}`}
            style={at('none', 'scale(0.2)', b.d + 120)}
          >
            <CheckGlyph aria-hidden />
          </span>
        </span>
      ))}
    </Subject>
  ),
  wait: ({ tone }) => (
    <>
      <div
        className={`relative flex w-[30%] shrink-0 flex-col items-center gap-1 px-1.5 py-1.5 ${PANEL}`}
      >
        <span className={`ats-t ats-turn ${tone.label}`} style={at('rotate(180deg)', 'none', 0)}>
          <HourglassGlyph aria-hidden />
        </span>
        <span className="h-[3px] w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <span
            className={`ats-t ats-fill block h-full origin-left rounded-full ${tone.dot}`}
            style={at('none', 'scaleX(0)', 200)}
          />
        </span>
        <Chip className={`absolute -right-2 -top-1.5 ${tone.soft}`}>2d</Chip>
      </div>
      <div
        className="ats-t ats-in relative w-[38%] shrink-0"
        style={at('none', 'translateX(-8px)', 1000)}
      >
        <Card>
          <span
            className={`absolute right-1 top-1 grid size-2.5 place-items-center rounded-full ${tone.solid}`}
          >
            <CheckGlyph aria-hidden />
          </span>
        </Card>
      </div>
    </>
  ),
};

/** The picture at the top of an Add an Action tile. */
export function ActionScene({ kind, group }: { kind: AddKind; group: ActionGroupId }) {
  const t = TONES[ACTION_GROUP_TONES[group]];
  const Scene = ACTION_SCENES[kind];
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
