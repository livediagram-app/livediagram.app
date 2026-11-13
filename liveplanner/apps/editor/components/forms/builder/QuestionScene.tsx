'use client';

// Each Add a Question tile's picture (docs/specs/030-forms/forms.md "The form card, top to bottom"): the question on a
// small form card, about to be answered and answered on hover or focus (typed, picked, ticked, rated), in its group's
// colour, on the pickers' stage (TileStage). Moved by app/automation-scenes.css. Decoration only: aria-hidden.

import type { ReactNode } from 'react';
import type { QuestionType } from '@liveplanner/forms';
import { lucideGlyph } from '@liveplanner/ui';
import {
  lucideAtSign,
  lucideCalendar,
  lucideCheck,
  lucideClock,
  lucideLink,
  lucidePhone,
} from '@liveworkspace/icons/lucide';
import {
  PANEL,
  TONES,
  TileStage,
  after,
  at,
  type ToneClasses,
} from '@/components/tile-picker/tile-scene';
import { QUESTION_GROUPS } from './question-groups';

const TickGlyph = lucideGlyph(lucideCheck, 7);
const AtGlyph = lucideGlyph(lucideAtSign, 8);
const PhoneGlyph = lucideGlyph(lucidePhone, 8);
const LinkGlyph = lucideGlyph(lucideLink, 8);
const DayGlyph = lucideGlyph(lucideCalendar, 8);
const ClockGlyph = lucideGlyph(lucideClock, 8);

// Typed text rests unwritten and writes itself from the left.
const TYPED = 'scaleX(0)';
const POP = 'scale(0.3)';

/** The form card a question sits on: its prompt, then the answer. */
function Question({
  className = 'w-[74%]',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`relative flex shrink-0 flex-col gap-[5px] px-2 pb-2 pt-[7px] ${PANEL} ${className}`}
    >
      <span className="h-[3px] w-[46%] rounded-full bg-slate-400 dark:bg-slate-500" />
      {children}
    </div>
  );
}

/** An answer box, its border taking the tone as it is answered. */
function Box({
  tone,
  className = 'h-[15px]',
  children,
}: {
  tone: ToneClasses;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span
      className={`relative flex w-full items-center gap-1 rounded-[4px] border border-slate-200 bg-white px-1 dark:border-slate-600 dark:bg-slate-900 ${className}`}
    >
      <span
        className={`ats-in pointer-events-none absolute -inset-px rounded-[4px] border ${tone.border}`}
      />
      {children}
    </span>
  );
}

/** A line of text typing itself in, `d` ms in. */
function Typed({ w, d = 0, strong = true }: { w: string; d?: number; strong?: boolean }) {
  return (
    <span
      className={`ats-t block h-[3px] shrink-0 origin-left rounded-full ${strong ? 'bg-slate-500 dark:bg-slate-300' : 'bg-slate-300 dark:bg-slate-600'} ${w}`}
      style={at('none', TYPED, d)}
    />
  );
}

/** The caret, showing once the typing is done. */
function Caret({ tone, d }: { tone: ToneClasses; d: number }) {
  return <span className={`ats-in h-[8px] w-px shrink-0 ${tone.dot}`} style={after(d)} />;
}

/** A choice's mark (a radio or a box) and its option, picked or not. */
function Option({
  tone,
  round,
  picked,
  d = 0,
  w,
}: {
  tone: ToneClasses;
  round: boolean;
  picked: boolean;
  d?: number;
  w: string;
}) {
  const shape = round ? 'rounded-full' : 'rounded-[2px]';
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`relative size-[8px] shrink-0 border border-slate-300 bg-white dark:border-slate-500 dark:bg-slate-900 ${shape}`}
      >
        {picked ? (
          <span
            className={`ats-t ats-in ats-pop absolute -inset-px grid place-items-center ${shape} ${tone.solid}`}
            style={at('none', POP, d)}
          >
            {round ? (
              <span className="size-[3px] rounded-full bg-white" />
            ) : (
              <TickGlyph aria-hidden size={6} />
            )}
          </span>
        ) : null}
      </span>
      <span className={`h-[3px] rounded-full bg-slate-200 dark:bg-slate-600 ${w}`} />
    </span>
  );
}

const STAR = 'M5 0.7l1.3 2.7 3 .4-2.2 2.1.5 3L5 7.5 2.4 8.9l.5-3L.7 3.8l3-.4Z';

function Star({ lit, d = 0 }: { lit: boolean; d?: number }) {
  return (
    <span className="relative size-[12px] shrink-0">
      <svg
        viewBox="0 0 10 10"
        className="absolute inset-0 size-full text-slate-300 dark:text-slate-600"
      >
        <path d={STAR} fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" />
      </svg>
      {lit ? (
        <svg
          viewBox="0 0 10 10"
          className="ats-t ats-in ats-pop absolute inset-0 size-full text-amber-400 dark:text-amber-300"
          style={at('none', POP, d)}
        >
          <path
            d={STAR}
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );
}

/** A month's days as a grid of small cells, `on` the days picked and `band` a range between them. */
function Month({
  tone,
  on,
  band,
}: {
  tone: ToneClasses;
  on: readonly number[];
  band?: readonly [number, number];
}) {
  return (
    <div className={`relative flex w-[60%] shrink-0 flex-col gap-1 p-1.5 ${PANEL}`}>
      <span className="flex items-center justify-between px-px">
        <span className="h-[3px] w-[38%] rounded-full bg-slate-400 dark:bg-slate-500" />
        <span className={`size-[4px] rounded-full ${tone.dot}`} />
      </span>
      <span className="relative grid grid-cols-7 gap-[3px]">
        {band ? (
          <span
            className={`ats-t pointer-events-none absolute top-0 z-[1] h-[6px] origin-left rounded-[2px] ${tone.soft}`}
            style={{
              ...at('none', TYPED, 200),
              left: `calc(${band[0]} * (100% + 3px) / 7)`,
              width: `calc(${band[1] - band[0] + 1} * (100% + 3px) / 7 - 3px)`,
            }}
          />
        ) : null}
        {Array.from({ length: 14 }, (_, i) => (
          <span
            key={i}
            className="relative h-[6px] rounded-[2px] bg-slate-100 dark:bg-slate-700/80"
          >
            {on.includes(i) ? (
              <span
                className={`ats-t ats-in ats-pop absolute -inset-px z-[2] rounded-[2px] ${tone.solid}`}
                style={at('none', POP, band && i === band[1] ? 520 : 80)}
              />
            ) : null}
          </span>
        ))}
      </span>
    </div>
  );
}

const SCENES: Readonly<Record<QuestionType, (p: { tone: ToneClasses }) => ReactNode>> = {
  short: ({ tone }) => (
    <Question>
      <Box tone={tone}>
        <Typed w="w-[58%]" />
        <Caret tone={tone} d={420} />
      </Box>
    </Question>
  ),
  paragraph: ({ tone }) => (
    <Question>
      <Box tone={tone} className="h-[27px] flex-col items-start justify-center gap-[3px] py-1">
        <Typed w="w-[88%]" />
        <Typed w="w-[76%]" d={180} />
        <span className="flex w-full items-center gap-[2px]">
          <Typed w="w-[40%]" d={360} />
          <Caret tone={tone} d={620} />
        </span>
      </Box>
    </Question>
  ),
  single: ({ tone }) => (
    <Question>
      <Option tone={tone} round picked={false} w="w-[48%]" />
      <Option tone={tone} round picked d={140} w="w-[62%]" />
      <Option tone={tone} round picked={false} w="w-[40%]" />
    </Question>
  ),
  multi: ({ tone }) => (
    <Question>
      <Option tone={tone} round={false} picked d={60} w="w-[54%]" />
      <Option tone={tone} round={false} picked={false} w="w-[42%]" />
      <Option tone={tone} round={false} picked d={260} w="w-[60%]" />
    </Question>
  ),
  checkbox: ({ tone }) => (
    <div className={`relative flex w-[74%] shrink-0 items-center gap-2 px-2 py-2.5 ${PANEL}`}>
      <span className="relative size-[11px] shrink-0 rounded-[3px] border border-slate-300 bg-white dark:border-slate-500 dark:bg-slate-900">
        <span
          className={`ats-t ats-in ats-pop absolute -inset-px grid place-items-center rounded-[3px] ${tone.solid}`}
          style={at('none', POP, 120)}
        >
          <TickGlyph aria-hidden size={8} />
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[4px]">
        <span className="h-[3px] w-[78%] rounded-full bg-slate-400 dark:bg-slate-500" />
        <span className="h-[3px] w-[48%] rounded-full bg-slate-200 dark:bg-slate-600" />
      </span>
    </div>
  ),
  rating: () => (
    <Question>
      <span className="flex items-center gap-[3px]">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} lit={i < 4} d={i * 90} />
        ))}
      </span>
    </Question>
  ),
  number: ({ tone }) => (
    <Question className="w-[58%]">
      <Box tone={tone}>
        <span className="inline-grid text-[8px] font-semibold leading-none tabular-nums text-slate-700 dark:text-slate-200">
          <span className="ats-out col-start-1 row-start-1" style={after(300)}>
            0
          </span>
          <span className={`ats-in col-start-1 row-start-1 ${tone.label}`} style={after(300)}>
            42
          </span>
        </span>
        <span className="ml-auto flex flex-col gap-px text-slate-400 dark:text-slate-400">
          <svg viewBox="0 0 6 3" className="h-[3px] w-[6px]">
            <path d="M0 3L3 0L6 3Z" fill="currentColor" />
          </svg>
          <svg viewBox="0 0 6 3" className="h-[3px] w-[6px]">
            <path d="M0 0L3 3L6 0Z" fill="currentColor" />
          </svg>
        </span>
      </Box>
    </Question>
  ),
  date: ({ tone }) => <Month tone={tone} on={[9]} />,
  datetime: ({ tone }) => (
    <Question className="w-[78%]">
      <span className="flex gap-1">
        <Box tone={tone} className="h-[15px] flex-[1.4]">
          <span className={tone.label}>
            <DayGlyph aria-hidden size={7} />
          </span>
          <Typed w="w-[52%]" />
        </Box>
        <Box tone={tone} className="h-[15px] flex-1">
          <span className={tone.label}>
            <ClockGlyph aria-hidden size={7} />
          </span>
          <span
            className="ats-in text-[7px] font-semibold leading-none tabular-nums text-slate-700 dark:text-slate-200"
            style={after(360)}
          >
            9:30
          </span>
        </Box>
      </span>
    </Question>
  ),
  daterange: ({ tone }) => <Month tone={tone} on={[1, 5]} band={[1, 5]} />,
  email: ({ tone }) => (
    <Question>
      <Box tone={tone}>
        <span className={`shrink-0 ${tone.label}`}>
          <AtGlyph aria-hidden size={7} />
        </span>
        <Typed w="w-[56%]" />
        <span
          className={`ats-t ats-in ats-pop ml-auto grid size-[9px] shrink-0 place-items-center rounded-full ${tone.solid}`}
          style={at('none', POP, 460)}
        >
          <TickGlyph aria-hidden size={6} />
        </span>
      </Box>
    </Question>
  ),
  phone: ({ tone }) => (
    <>
      <Question className="w-[54%]">
        <Box tone={tone}>
          <span className={`shrink-0 ${tone.label}`}>
            <PhoneGlyph aria-hidden size={7} />
          </span>
          <Typed w="w-[60%]" />
        </Box>
      </Question>
      <div className={`grid w-[22%] shrink-0 grid-cols-3 gap-[3px] p-1.5 ${PANEL}`}>
        {Array.from({ length: 9 }, (_, i) => (
          <span
            key={i}
            className={`h-[5px] rounded-[2px] ${i === 4 ? `ats-press ${tone.dot}` : 'bg-slate-200 dark:bg-slate-600'}`}
          />
        ))}
      </div>
    </>
  ),
  link: ({ tone }) => (
    <Question>
      <Box tone={tone}>
        <span className={`shrink-0 ${tone.label}`}>
          <LinkGlyph aria-hidden size={7} />
        </span>
        <span className={`shrink-0 text-[7px] font-semibold leading-none ${tone.label}`}>
          https://
        </span>
        <Typed w="w-[34%]" d={120} />
      </Box>
    </Question>
  ),
};

const TONE_OF = new Map(
  QUESTION_GROUPS.flatMap((g) => g.types.map((t) => [t, TONES[g.tone]] as const)),
);

/** The picture at the top of an Add a Question tile. */
export function QuestionScene({ type }: { type: QuestionType }) {
  const tone = TONE_OF.get(type) ?? TONES.blue;
  const Scene = SCENES[type];
  return (
    <TileStage tone={tone}>
      <Scene tone={tone} />
    </TileStage>
  );
}
