// Add Field's tile pictures (docs/specs/026-plan/item-types.md "Each kind is a tile"): where a bare sample value would
// say nothing (a Calculated field's "3"), the strip draws the idea instead, small: a card and its child cards, field
// chips worked into a result, linked cards summed. A kind whose value explains itself keeps its sample (KindSample).
// Only a picture: the strip is inert and hidden from assistive tech, so nothing here takes focus or a press.
import type { ReactNode } from 'react';
import { CheckIcon } from '@liveplanner/ui';
import { KindSample } from './CustomFieldKindParts';
import { PersonDisc } from './PersonDisc';
import type { PickKind } from './add-field-kinds';

const INK = 'text-slate-700 dark:text-slate-200';
const QUIET = 'text-slate-500 dark:text-slate-400';
const LINE = 'border-slate-200 dark:border-slate-700';

/** A tiny card: a title bar and an optional body line, as a board draws one, scaled right down. */
function MiniCard({
  children,
  tone,
  wide,
}: {
  children?: ReactNode;
  tone?: 'brand' | 'warn';
  wide?: boolean;
}) {
  const edge =
    tone === 'brand'
      ? 'border-brand-300 dark:border-brand-500/60'
      : tone === 'warn'
        ? 'border-amber-300 dark:border-amber-500/60'
        : LINE;
  return (
    <span
      className={`flex shrink-0 flex-col gap-0.5 rounded-[5px] border bg-white px-1.5 py-1 dark:bg-slate-900 ${edge} ${
        wide ? 'w-[4.5rem]' : 'w-11'
      }`}
    >
      <span className="h-[3px] w-4/5 rounded-full bg-slate-300 dark:bg-slate-600" />
      {children ?? <span className="h-[3px] w-1/2 rounded-full bg-slate-200 dark:bg-slate-700" />}
    </span>
  );
}

function Arrow() {
  return (
    <svg width="18" height="10" viewBox="0 0 18 10" className={`shrink-0 ${QUIET}`}>
      <path
        d="M1 5h14M11.5 1.5L15.5 5l-4 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The value a picture ends on: what the field shows on the card. */
function Result({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-md bg-brand-50 px-1.5 py-0.5 text-[12px] font-semibold tabular-nums text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30">
      {children}
    </span>
  );
}

/** A field named in a formula or a lookup. */
function FieldChip({ name, value }: { name: string; value: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border bg-white px-1.5 py-0.5 text-[11px] dark:bg-slate-900 ${LINE}`}
    >
      <span className={QUIET}>{name}</span>
      <span className={`font-semibold tabular-nums ${INK}`}>{value}</span>
    </span>
  );
}

function Tick({ on }: { on: boolean }) {
  return (
    <span
      className={`flex size-2.5 shrink-0 items-center justify-center rounded-[3px] border ${
        on
          ? 'border-brand-700 bg-brand-700 text-white dark:border-brand-400 dark:bg-brand-400 dark:text-slate-900'
          : 'border-slate-300 dark:border-slate-600'
      } [&_svg]:size-2`}
    >
      {on ? <CheckIcon size={8} /> : null}
    </span>
  );
}

const PEOPLE = {
  SR: { id: 'sr', name: 'Sam Rivera', color: '#7c3aed' },
  AL: { id: 'al', name: 'Ana Lee', color: '#0891b2' },
  JO: { id: 'jo', name: 'Jo Okafor', color: '#b4461c' },
} as const;

/** Someone on the plan, as a card draws them, a little smaller. */
function Initials({ who }: { who: keyof typeof PEOPLE }) {
  return (
    <span className="flex shrink-0 scale-[0.8] rounded-full ring-1 ring-white dark:ring-slate-900">
      <PersonDisc person={PEOPLE[who]} />
    </span>
  );
}

/** A month's few weeks with picked days filled: one day, or a span. */
function MonthGrid({ picked }: { picked: readonly number[] }) {
  const on = new Set(picked);
  return (
    <span
      className={`grid shrink-0 grid-cols-7 gap-[2px] rounded-[5px] border bg-white p-1 dark:bg-slate-900 ${LINE}`}
    >
      {Array.from({ length: 21 }, (_, i) => (
        <span
          key={i}
          className={`size-[5px] rounded-[1px] ${
            on.has(i) ? 'bg-brand-700 dark:bg-brand-400' : 'bg-slate-200 dark:bg-slate-700'
          }`}
        />
      ))}
    </span>
  );
}

function Clock() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" className={`shrink-0 ${INK}`}>
      <circle cx="11" cy="11" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M11 6v5l3.5 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Joins({ count }: { count: 1 | 3 }) {
  // Lines from one card out to `count` cards, drawn between them.
  const ys = count === 1 ? [16] : [5, 16, 27];
  return (
    <svg width="22" height="32" viewBox="0 0 22 32" className={`shrink-0 ${QUIET}`}>
      {ys.map((y) => (
        <path
          key={y}
          d={`M1 16C11 16 11 ${y} 21 ${y}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
        />
      ))}
    </svg>
  );
}

const ART: Partial<Record<PickKind, () => ReactNode>> = {
  // Child Count and Children Done: a card's child cards, counted.
  calculated: () => (
    <span className="flex items-center gap-2">
      <MiniCard tone="brand" />
      <Joins count={3} />
      <span className="flex flex-col gap-[3px]">
        {[true, true, false].map((done, i) => (
          <span
            key={i}
            className={`flex items-center gap-1 rounded-[4px] border bg-white px-1 py-[2px] dark:bg-slate-900 ${LINE}`}
          >
            <Tick on={done} />
            <span className="h-[3px] w-5 rounded-full bg-slate-300 dark:bg-slate-600" />
          </span>
        ))}
      </span>
      <Arrow />
      <Result>2/3</Result>
    </span>
  ),
  formula: () => (
    <span className={`flex items-center gap-1.5 text-[12px] ${QUIET}`}>
      <FieldChip name="Estimate" value="5" />
      <span aria-hidden>×</span>
      <FieldChip name="Rate" value="£240" />
      <span aria-hidden>=</span>
      <Result>£1,200</Result>
    </span>
  ),
  rollup: () => (
    <span className="flex items-center gap-2">
      <span className="flex gap-1">
        {['2', '3', '5'].map((n) => (
          <MiniCard key={n}>
            <span className={`text-[10px] font-semibold leading-none tabular-nums ${INK}`}>
              {n}
            </span>
          </MiniCard>
        ))}
      </span>
      <Arrow />
      <Result>Sum 10</Result>
    </span>
  ),
  lookup: () => (
    <span className="flex items-center gap-2">
      <MiniCard wide>
        <span className="flex items-center gap-1 text-[9px] leading-none">
          <span className={QUIET}>Owner</span>
          <span className={`font-semibold ${INK}`}>Ana</span>
        </span>
      </MiniCard>
      <Arrow />
      <MiniCard tone="brand" wide>
        <span className="flex items-center gap-1 text-[9px] leading-none">
          <Initials who="AL" />
          <span className={`font-semibold ${INK}`}>Ana</span>
        </span>
      </MiniCard>
    </span>
  ),
  card: () => (
    <span className="flex items-center gap-1">
      <MiniCard tone="brand" />
      <Joins count={1} />
      <MiniCard />
    </span>
  ),
  cards: () => (
    <span className="flex items-center gap-1">
      <MiniCard tone="brand" />
      <Joins count={3} />
      <span className="flex flex-col gap-[2px]">
        <span className="h-2 w-9 rounded-[3px] border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900" />
        <span className="h-2 w-9 rounded-[3px] border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900" />
        <span className="h-2 w-9 rounded-[3px] border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900" />
      </span>
    </span>
  ),
  'blocked-by': () => (
    <span className="flex items-center gap-1.5">
      <MiniCard />
      <svg
        width="22"
        height="10"
        viewBox="0 0 22 10"
        className="shrink-0 text-amber-600 dark:text-amber-400"
      >
        <path d="M1 5h20" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
        <path d="M11 1v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <MiniCard tone="warn" />
      <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30">
        Blocked
      </span>
    </span>
  ),
  date: () => (
    <span className="flex items-center gap-2">
      <MonthGrid picked={[11]} />
      <span className={`text-[12px] font-medium tabular-nums ${INK}`}>12 Oct 2026</span>
    </span>
  ),
  datetime: () => (
    <span className="flex items-center gap-2">
      <MonthGrid picked={[11]} />
      <Clock />
      <span className={`text-[12px] font-medium tabular-nums ${INK}`}>Fri 31 Oct, 17:00</span>
    </span>
  ),
  daterange: () => (
    <span className="flex items-center gap-2">
      <MonthGrid picked={[9, 10, 11, 12]} />
      <span className={`text-[12px] font-medium tabular-nums ${INK}`}>31 Oct to 3 Nov</span>
    </span>
  ),
  'datetime-range': () => (
    <span className="flex items-center gap-2">
      <MonthGrid picked={[9, 10, 11]} />
      <span className={`flex flex-col text-[11px] leading-tight tabular-nums ${INK}`}>
        <span>31 Oct, 09:00</span>
        <span className={QUIET}>to 2 Nov, 17:00</span>
      </span>
    </span>
  ),
  duration: () => (
    <span className="flex items-center gap-2">
      <Clock />
      <span className={`text-[14px] font-semibold tabular-nums ${INK}`}>2h 30m</span>
    </span>
  ),
  checkbox: () => (
    <span className={`flex flex-col gap-1 text-[11px] ${INK}`}>
      <span className="flex items-center gap-1.5">
        <Tick on />
        Signed off
      </span>
      <span className="flex items-center gap-1.5">
        <Tick on={false} />
        <span className={QUIET}>Not yet</span>
      </span>
    </span>
  ),
  checklist: () => (
    <span className="flex items-center gap-2.5">
      <span className={`flex flex-col gap-[3px] text-[10px] leading-none ${INK}`}>
        {(
          [
            ['Draft copy', true],
            ['Review', true],
            ['Publish', false],
          ] as const
        ).map(([t, on]) => (
          <span key={t} className="flex items-center gap-1">
            <Tick on={on} />
            <span className={on ? `line-through ${QUIET}` : ''}>{t}</span>
          </span>
        ))}
      </span>
      <Result>2/3</Result>
    </span>
  ),
  comments: () => (
    <span className="flex flex-col gap-1">
      <span className="flex items-center gap-1">
        <Initials who="SR" />
        <span
          className={`rounded-md rounded-tl-none border bg-white px-1.5 py-[1px] text-[10px] dark:bg-slate-900 ${LINE} ${INK}`}
        >
          Can we ship Friday?
        </span>
      </span>
      <span className="ml-3 flex items-center gap-1">
        <Initials who="AL" />
        <span
          className={`rounded-md rounded-tl-none border bg-white px-1.5 py-[1px] text-[10px] dark:bg-slate-900 ${LINE} ${INK}`}
        >
          Yes, after review
        </span>
      </span>
    </span>
  ),
  votes: () => (
    <span className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1 rounded-md border border-brand-300 bg-brand-50 px-1.5 py-0.5 text-[12px] font-semibold tabular-nums text-brand-700 dark:border-brand-500/50 dark:bg-brand-500/15 dark:text-brand-300">
        <svg width="9" height="8" viewBox="0 0 9 8" aria-hidden>
          <path d="M4.5 0.5L8.5 7.5h-8z" fill="currentColor" />
        </svg>
        3
      </span>
      <span className="flex -space-x-1">
        <Initials who="SR" />
        <Initials who="AL" />
        <Initials who="JO" />
      </span>
    </span>
  ),
  image: () => (
    <span className="flex items-center gap-1.5">
      {['#bae6fd', '#fde68a'].map((sky) => (
        <svg
          key={sky}
          width="40"
          height="30"
          viewBox="0 0 40 30"
          className="shrink-0 overflow-hidden rounded-[4px]"
        >
          <rect width="40" height="30" fill={sky} />
          <circle cx="30" cy="9" r="4" fill="#fbbf24" />
          <path d="M0 30L13 14l9 10 6-6 12 12z" fill="#0f766e" />
        </svg>
      ))}
    </span>
  ),
};

/** The picture on a kind's tile in Add Field's gallery. */
export function KindTileArt({ kind }: { kind: PickKind }) {
  const draw = ART[kind];
  return draw ? <>{draw()}</> : <KindSample kind={kind} />;
}

/** Kinds drawn as a picture rather than their sample value (for tests). */
export const PICTURED_KINDS = Object.keys(ART) as PickKind[];
