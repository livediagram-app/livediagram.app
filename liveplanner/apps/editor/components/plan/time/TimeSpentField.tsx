'use client';

// A Time Spent field in the card panel (docs/specs/026-plan/item-types.md "Time Spent"): the total, the viewer's own
// timer (Start, or the ticking time with Stop and Discard), everyone else's running timers, the entries newest first
// with who and when, and Add Time. Every change is one time write (`onTime`), made to the card as stored, so two
// people's timers never overwrite each other. A Participant touches only their own timer and entries; an Editor any;
// a Viewer reads.
import { useId, useMemo, useState } from 'react';
import { Button, CompactEmptyState, TextInput, Tooltip, lucideGlyph } from '@liveplanner/ui';
import { lucideTimer } from '@liveworkspace/icons/lucide';
import {
  DURATION_HINT,
  TIME_ENTRIES_MAX,
  durationSpoken,
  durationText,
  newItemId,
  parseDuration,
  readTimeValue,
  runningTimerOf,
  timePerson,
  timeTotal,
  type ItemFieldValue,
  type ItemPerson,
  type TimeOp,
} from '@liveplanner/items';
import { PersonDisc } from '../PersonDisc';
import { DiscardIcon, Elapsed, PlayIcon, RunningDot, StopIcon } from './TimerReadouts';

const TimerIcon = lucideGlyph(lucideTimer, 16);

// Entries shown before Show All.
const ENTRIES_SHOWN = 5;

const pad = (n: number) => String(n).padStart(2, '0');

// When an entry was recorded: "Today, 14:02", "Yesterday, 09:30", "3 Oct, 16:45".
export function entryWhen(at: number, now: number = Date.now()): string {
  const d = new Date(at);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const day = (t: number) => new Date(t).toDateString();
  if (day(at) === day(now)) return `Today, ${time}`;
  if (day(at) === day(now - 86_400_000)) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${time}`;
}

const ROW = 'flex min-h-8 items-center gap-2 text-[13px] text-slate-700 dark:text-slate-200';
const QUIET_BUTTON =
  'flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100';

export function TimeSpentField({
  id,
  label,
  value: raw,
  self,
  canTrack,
  canEditAll,
  onTime,
  announce,
}: {
  id: string;
  label: string;
  value: ItemFieldValue | undefined;
  // This person, as items carry them; none while signing in.
  self: ItemPerson | null;
  // May track their own time (an Editor or a Participant).
  canTrack: boolean;
  // May stop and remove anyone's (an Editor).
  canEditAll: boolean;
  onTime: (op: TimeOp) => Promise<boolean>;
  announce?: (message: string) => void;
}) {
  const value = useMemo(() => readTimeValue(raw), [raw]);
  const total = timeTotal(value);
  const mine = self ? runningTimerOf(value, self.id) : undefined;
  const others = value.running.filter((r) => r.by !== self?.id);
  const entries = useMemo(() => [...value.entries].sort((a, b) => b.at - a.at), [value.entries]);
  const full = value.entries.length + value.running.length >= TIME_ENTRIES_MAX;
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const addId = useId();
  const can = canTrack && !!self;
  const mayTouch = (by: string) => canEditAll || (can && by === self?.id);
  const fullHint = 'This card holds the most time entries it can';

  const stop = async (timer: string, start: number) => {
    const ran = Date.now() - start;
    const ok = await onTime({ op: 'stop', timer, entry: newItemId() });
    if (ok && ran < 30_000) announce?.('Under a minute: nothing recorded');
  };
  const add = async (input: HTMLInputElement) => {
    const minutes = parseDuration(input.value);
    if (minutes === undefined || minutes < 1) {
      setProblem(`${DURATION_HINT}.`);
      return;
    }
    setProblem(null);
    if (await onTime({ op: 'add', entry: newItemId(), minutes })) {
      announce?.(`Added ${durationText(minutes)} to ${label}`);
      setAdding(false);
    }
  };

  const shownEntries = showAll ? entries : entries.slice(0, ENTRIES_SHOWN);
  const startButton = (
    <Tooltip label={full ? fullHint : ''}>
      <Button
        variant="primary"
        size="sm"
        className="gap-1.5 enabled:cursor-pointer"
        disabled={full}
        aria-label={full ? `Start Timer: ${fullHint}` : 'Start Timer'}
        onClick={() => void onTime({ op: 'start', timer: newItemId() })}
      >
        <PlayIcon />
        Start Timer
      </Button>
    </Tooltip>
  );
  // Nothing tracked and nothing running: the empty state, its one way forward the timer.
  const empty = value.entries.length === 0 && value.running.length === 0;
  return (
    <div id={id} role="group" aria-label={label} className="flex w-full flex-col gap-2">
      {empty ? (
        <CompactEmptyState
          size="small"
          icon={<TimerIcon />}
          title="No time yet"
          description={can ? 'Start the timer, or add time you worked.' : undefined}
          action={can ? startButton : undefined}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[18px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">
            <span aria-hidden>{durationText(total)}</span>
            <span className="sr-only">{`${label}: ${durationSpoken(total)}`}</span>
          </span>
          {can && mine ? (
            <span className="flex items-center gap-1.5">
              <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-50 px-2 text-[13px] font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
                <RunningDot />
                <Elapsed start={mine.start} />
                <span className="sr-only">Your timer is running</span>
              </span>
              <Button
                variant="secondary"
                size="sm"
                className="cursor-pointer gap-1.5"
                onClick={() => void stop(mine.id, mine.start)}
              >
                <StopIcon />
                Stop
              </Button>
              <Tooltip label="Discard timer">
                <button
                  type="button"
                  aria-label="Discard timer"
                  className={QUIET_BUTTON}
                  onClick={() => void onTime({ op: 'remove', entry: mine.id })}
                >
                  <DiscardIcon />
                </button>
              </Tooltip>
            </span>
          ) : can ? (
            startButton
          ) : null}
        </div>
      )}
      {others.length ? (
        <ul aria-label="Timers running" className="flex flex-col gap-1">
          {others.map((r) => {
            const who = timePerson(value, r.by);
            return (
              <li key={r.id} className={ROW}>
                <PersonDisc person={who} />
                <span className="min-w-0 flex-1 truncate">{who.name}</span>
                <RunningDot />
                <Elapsed start={r.start} className="text-[13px] font-medium" />
                {canEditAll ? (
                  <Tooltip label={`Stop ${who.name}'s timer`}>
                    <button
                      type="button"
                      aria-label={`Stop ${who.name}'s timer`}
                      className={QUIET_BUTTON}
                      onClick={() => void stop(r.id, r.start)}
                    >
                      <StopIcon />
                    </button>
                  </Tooltip>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {entries.length ? (
        <ul
          aria-label="Entries"
          className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800"
        >
          {shownEntries.map((e) => {
            const who = timePerson(value, e.by);
            const time = durationText(e.minutes);
            return (
              <li key={e.id} className={ROW}>
                <PersonDisc person={who} />
                <span className="min-w-0 flex-1 truncate">{who.name}</span>
                <span className="font-medium tabular-nums text-slate-900 dark:text-slate-50">
                  {time}
                </span>
                <span className="w-28 shrink-0 text-right text-[12px] text-slate-500 dark:text-slate-400">
                  {entryWhen(e.at)}
                </span>
                {mayTouch(e.by) ? (
                  <Tooltip label={`Remove ${time} by ${who.name}`}>
                    <button
                      type="button"
                      aria-label={`Remove ${time} by ${who.name}`}
                      className={QUIET_BUTTON}
                      onClick={() => void onTime({ op: 'remove', entry: e.id })}
                    >
                      <DiscardIcon />
                    </button>
                  </Tooltip>
                ) : (
                  <span className="w-7 shrink-0" aria-hidden />
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      {entries.length > ENTRIES_SHOWN && !showAll ? (
        <button
          type="button"
          className="self-start cursor-pointer text-[12px] font-medium text-brand-700 hover:underline dark:text-brand-300"
          onClick={() => setShowAll(true)}
        >
          Show All {entries.length} Entries
        </button>
      ) : null}
      {can && adding ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <label htmlFor={addId} className="sr-only">
              Time to add
            </label>
            <TextInput
              id={addId}
              autoFocus
              compact
              autoComplete="off"
              placeholder="1h 15m"
              className="w-28 tabular-nums"
              aria-invalid={problem ? true : undefined}
              aria-describedby={problem ? `${addId}-problem` : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void add(e.currentTarget);
                } else if (e.key === 'Escape') {
                  e.stopPropagation();
                  setAdding(false);
                  setProblem(null);
                }
              }}
            />
            <Button
              variant="primary"
              size="sm"
              className="cursor-pointer"
              onClick={(e) => {
                const input = e.currentTarget.parentElement?.querySelector('input');
                if (input) void add(input);
              }}
            >
              Add
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="cursor-pointer"
              onClick={() => {
                setAdding(false);
                setProblem(null);
              }}
            >
              Cancel
            </Button>
          </div>
          {problem ? (
            <span
              id={`${addId}-problem`}
              role="alert"
              className="text-[12px] text-red-700 dark:text-red-300"
            >
              {problem}
            </span>
          ) : null}
        </div>
      ) : can ? (
        <Tooltip label={full ? fullHint : ''}>
          <button
            type="button"
            disabled={full}
            aria-label={full ? `Add Time: ${fullHint}` : 'Add Time'}
            className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-300 text-[12px] font-medium text-slate-600 transition enabled:cursor-pointer enabled:hover:border-brand-400 enabled:hover:bg-brand-50 enabled:hover:text-brand-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:enabled:hover:bg-brand-500/10 dark:enabled:hover:text-brand-200"
            onClick={() => setAdding(true)}
          >
            <span aria-hidden>+</span>
            Add Time
          </button>
        </Tooltip>
      ) : null}
    </div>
  );
}
