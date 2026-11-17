'use client';

// Subscribe to Calendar's What It Shows (docs/specs/026-plan/calendar-feed.md "The options"): a line saying in words
// what the calendar will hold, the plan's card types as pills to pick (several at once; a type spans every board that
// shows it, and none picked is every type), and Only My Cards and Include Done Cards as switch rows in one card. The
// dialog decides what a change does: the choice to make the link with, or a save that keeps the link.
import { useId } from 'react';
import type { CalendarFeedOptions, CalendarFeedType } from '@liveplanner/api-schema';
import { lucideGlyph } from '@liveplanner/ui';
import { Switch, SwitchRow } from '@liveworkspace/ui';
import { lucideCircleCheck, lucideLayers, lucideUser } from '@liveworkspace/icons/lucide';
import { PlanTypeGlyph } from '@/components/plan/plan-type-glyph';
import { ChoicePills } from '@/components/primitives/ChoicePills';

const AllIcon = lucideGlyph(lucideLayers, 14);
const MineIcon = lucideGlyph(lucideUser, 16);
const DoneIcon = lucideGlyph(lucideCircleCheck, 16);

const HEADING = 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
// The All Types pill's id (a type id is never empty).
const ALL = '';

// "Bugs", "Bugs and Tasks", "Bugs, Tasks and Ideas".
const listOf = (names: readonly string[]) =>
  names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** What the feed will hold, in one sentence. */
export function feedSummary(names: readonly string[], options: CalendarFeedOptions): string {
  const what = names.length ? `Every ${listOf(names)} card` : 'Every card';
  const whose = options.mine ? ' that names you' : '';
  const done = options.includeDone ? ', done ones included' : ', leaving out done ones';
  return `${what}${whose} with a Start or Due date${done}.`;
}

export function CalendarFeedOptionsSection({
  types,
  options,
  disabled = false,
  onChange,
}: {
  types: readonly CalendarFeedType[];
  options: CalendarFeedOptions;
  disabled?: boolean;
  onChange: (next: CalendarFeedOptions) => void;
}) {
  const id = useId();
  // The picked types the plan still has (one deleted since drops out, as the feed drops it).
  const picked = (options.typeIds ?? []).filter((t) => types.some((x) => x.id === t));
  const names = types.filter((t) => picked.includes(t.id)).map((t) => t.name);
  const pick = (next: readonly string[]) =>
    onChange({ ...options, typeIds: next.length ? [...next] : null, boardId: null });
  const toggle = (typeId: string) =>
    pick(picked.includes(typeId) ? picked.filter((t) => t !== typeId) : [...picked, typeId]);
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 id={`${id}-heading`} className={HEADING}>
          What It Shows
        </h3>
        <p
          aria-live="polite"
          data-calendar-feed-summary=""
          className="text-[13px] leading-snug text-slate-600 dark:text-slate-300"
        >
          {feedSummary(names, options)}
        </p>
      </div>

      {types.length > 0 ? (
        <div className="flex flex-col gap-2" data-calendar-feed-types="">
          <span
            id={`${id}-types`}
            className="text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            Card Types
          </span>
          <ChoicePills
            label="Card Types"
            data="calendar-feed-types"
            disabled={disabled}
            pills={[
              { id: ALL, label: 'All Types', icon: <AllIcon /> },
              ...types.map((t) => ({
                id: t.id,
                label: t.name,
                icon: <PlanTypeGlyph glyph={t.glyph} color={t.color} size={14} />,
              })),
            ]}
            pressed={(pid) => (pid === ALL ? picked.length === 0 : picked.includes(pid))}
            onPick={(pid) => (pid === ALL ? pick([]) : toggle(pid))}
          />
        </div>
      ) : null}

      <div className="flex flex-col divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
        <FilterRow
          icon={<MineIcon />}
          label="Only My Cards"
          hint="Just the cards that name you in a person field, as Assigned to You does."
          checked={options.mine}
          disabled={disabled}
          onToggle={() => onChange({ ...options, mine: !options.mine })}
        />
        <FilterRow
          icon={<DoneIcon />}
          label="Include Done Cards"
          hint="Off, finished work drops out of your calendar."
          checked={options.includeDone}
          disabled={disabled}
          onToggle={() => onChange({ ...options, includeDone: !options.includeDone })}
        />
      </div>
    </section>
  );
}

// One switch row: its glyph on a tile, its name and hint, the switch at its end; the whole row is the switch.
function FilterRow({
  icon,
  label,
  hint,
  checked,
  disabled,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <SwitchRow
      track="none"
      checked={checked}
      disabled={disabled}
      onChange={onToggle}
      layout="flex w-full items-center gap-3 text-left"
      className="bg-white px-3.5 py-3 text-left transition-colors duration-micro hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-default disabled:opacity-60 dark:bg-slate-900 dark:hover:bg-slate-800/60"
    >
      <span
        aria-hidden
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-micro ${
          checked
            ? 'bg-brand-700 text-white dark:bg-brand-600'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
        }`}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</span>
        <span className="text-xs leading-snug text-slate-600 dark:text-slate-400">{hint}</span>
      </span>
      <Switch presentational checked={checked} />
    </SwitchRow>
  );
}
