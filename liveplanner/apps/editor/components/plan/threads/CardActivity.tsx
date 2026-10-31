'use client';

// A card's activity in its panel (docs/specs/026-plan/items.md "History" "Where it shows"): its own Activity section
// below Comments, never mixed with the threads. A disclosure, closed by default and remembered in this browser; open,
// the card's history entries as quiet one-line rows, newest first, the rows past the first few under Show N More, and
// the notes for loading, no history, a failed read and a This Browser plan. History is read only while it is open.

import { useId, useMemo, useState, type ReactNode } from 'react';
import { GlyphDisc, IDENTITY_FILL, Tooltip, identityVars, lucideGlyph } from '@liveplanner/ui';
import { lucideChevronDown, lucideSparkles } from '@liveworkspace/icons/lucide';
import { initialsOf } from '@liveplanner/project';
import { typeIn, type Item, type ItemHistoryEntry } from '@liveplanner/items';
import {
  useLocalStorageValue,
  writeLocalStorageValue,
} from '@liveworkspace/workbench/hooks/ui/useLocalStorageValue';
import { formatRelativeTimeCompact, useRelativeNow } from '@/lib/relative-time';
import { track } from '@/lib/telemetry';
import { useCardHistory, type CardHistory } from '@/hooks/plan/useCardHistory';
import type { ItemsScope } from '@/lib/api/items';
import { usePlan } from '../PlanContext';
import { useCardThreadsContext } from './CardThreadsContext';
import { activityParts, type ActivityContext } from './activity-words';

const AiIcon = lucideGlyph(lucideSparkles, 10);
const Chevron = lucideGlyph(lucideChevronDown, 13);

// The activity rows drawn before Show N More.
export const ACTIVITY_ROWS_SHOWN = 8;

// Whether the Activity section is open: closed unless opened, remembered in this browser. The key the old Activity
// switch used, so whoever turned that on (`on`) finds the section open.
export const CARD_ACTIVITY_KEY = 'liveplanner:v2:card-activity';

export function useActivityOpen(): [boolean, (open: boolean) => void] {
  const open = useLocalStorageValue(CARD_ACTIVITY_KEY) === 'on';
  const set = (next: boolean) => {
    // Sent before it is kept, as every toggle's event is (docs/specs/017-telemetry/telemetry.md).
    track('Plan', 'Toggled', next ? 'ActivityOn' : 'ActivityOff');
    writeLocalStorageValue(CARD_ACTIVITY_KEY, next ? 'on' : 'off');
  };
  return [open, set];
}

// The card's Activity section, keyed by the card so Show N More starts folded on each one. Nothing without a plan to
// read from (a preview).
export function CardActivitySection({ item }: { item: Item }) {
  const ctx = useCardThreadsContext();
  const scope = ctx?.threads.scope;
  if (!scope) return null;
  return <ActivitySectionOf key={item.id} item={item} scope={scope} />;
}

function ActivitySectionOf({ item, scope }: { item: Item; scope: ItemsScope }) {
  const plan = usePlan();
  const [open, setOpen] = useActivityOpen();
  const [all, setAll] = useState(false);
  const bodyId = useId();
  const history = useCardHistory({
    scope,
    itemId: item.id,
    rev: item.rev,
    enabled: open,
  });
  const activityCtx = useMemo<ActivityContext>(
    () => ({
      statusNames: plan?.statusNames ?? new Map(),
      types: plan?.types ?? [],
      type: plan ? typeIn(plan.types, item.type) : undefined,
      items: plan?.items ?? new Map(),
    }),
    [plan, item.type],
  );
  const shown = all ? history.entries : history.entries.slice(0, ACTIVITY_ROWS_SHOWN);
  const hidden = history.entries.length - shown.length;
  return (
    <section
      data-card-activity=""
      className="mb-8 border-t border-slate-200 pt-4 dark:border-slate-700"
    >
      <h3 className="mb-2 text-[13px] font-semibold text-slate-800 dark:text-slate-100">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen(!open)}
          className="-mx-1.5 inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 transition hover:bg-slate-100 motion-reduce:transition-none pointer-coarse:py-2 dark:hover:bg-slate-800"
        >
          <span
            aria-hidden
            className={`text-slate-500 transition-transform motion-reduce:transition-none dark:text-slate-400 ${open ? '' : '-rotate-90'}`}
          >
            <Chevron />
          </span>
          Activity
        </button>
      </h3>
      {open ? (
        <div id={bodyId} className="flex flex-col gap-1">
          {shown.length > 0 ? (
            <ul aria-label="Activity" className="flex flex-col gap-1">
              {shown.map((entry, i) => (
                <ActivityRow key={i} entry={entry} ctx={activityCtx} />
              ))}
            </ul>
          ) : null}
          {hidden > 0 ? <ShowMoreActivity hidden={hidden} onShow={() => setAll(true)} /> : null}
          <ActivityNote history={history} />
        </div>
      ) : null}
    </section>
  );
}

// A small disc of the author's initials on their colour.
function AuthorDisc({ name, color }: { name: string; color: string }) {
  return (
    <span aria-hidden className="flex size-5 shrink-0 items-center justify-center">
      <GlyphDisc
        size={16}
        className={`text-[7px] font-bold text-white ${IDENTITY_FILL}`}
        style={identityVars(color)}
      >
        {initialsOf(name)}
      </GlyphDisc>
    </span>
  );
}

// One history entry: the author, what they did, an agent's sparkle, an undo's mark, and when.
export function ActivityRow({ entry, ctx }: { entry: ItemHistoryEntry; ctx: ActivityContext }) {
  const now = useRelativeNow();
  const when = new Date(entry.at);
  const parts = activityParts(ctx, entry);
  return (
    <li
      data-activity=""
      className="flex items-start gap-2 py-0.5 pr-2 text-[12px] leading-5 text-slate-600 dark:text-slate-300"
    >
      <AuthorDisc name={entry.by.name} color={entry.by.color} />
      <p className="min-w-0 flex-1 text-pretty">
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {entry.mine ? 'You' : entry.by.name}
        </span>
        {entry.tag === 'ai' ? (
          <Tooltip label="Generated by AI">
            <span
              data-activity-ai=""
              role="img"
              aria-label="Generated by AI"
              className="ml-1 inline-flex size-4 translate-y-[2px] items-center justify-center rounded-full bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
            >
              <AiIcon aria-hidden />
            </span>
          </Tooltip>
        ) : null}{' '}
        {parts.map((p, i) =>
          p.strong ? (
            <span key={i} className="font-medium text-slate-800 dark:text-slate-100">
              {p.text}
            </span>
          ) : (
            <span key={i}>{p.text}</span>
          ),
        )}
        {entry.tag === 'undo' ? (
          <span className="text-slate-500 dark:text-slate-400"> (Undo)</span>
        ) : null}
        {/* A no-break space keeps the dot on the time's line when a row wraps. */}
        <span className="text-slate-400">{' · '}</span>
        <Tooltip
          label={when.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
        >
          <time
            dateTime={when.toISOString()}
            className="whitespace-nowrap text-slate-500 dark:text-slate-400"
          >
            {formatRelativeTimeCompact(now - entry.at)}
          </time>
        </Tooltip>
      </p>
    </li>
  );
}

// Show N More: the activity rows held back.
export function ShowMoreActivity({ hidden, onShow }: { hidden: number; onShow: () => void }) {
  return (
    <button
      type="button"
      onClick={onShow}
      className="-mx-1.5 inline-flex w-fit cursor-pointer items-center rounded-md px-1.5 py-1 text-[12px] font-medium text-brand-700 transition hover:bg-brand-50 motion-reduce:transition-none pointer-coarse:py-2 dark:text-brand-300 dark:hover:bg-brand-500/10"
    >
      Show {hidden} More
    </button>
  );
}

// What the panel says in place of rows: nothing kept yet, a failed read, or a plan that keeps none.
export function ActivityNote({ history }: { history: CardHistory }): ReactNode {
  const note = (children: ReactNode) => (
    <p data-activity-note="" className="text-[12px] leading-5 text-slate-500 dark:text-slate-400">
      {children}
    </p>
  );
  if (history.status === 'loading') return note('Loading activity…');
  if (history.status === 'offline') return note('Plans in This Browser keep no card history.');
  if (history.status === 'error')
    return note(
      <>
        Couldn’t load this card’s activity.{' '}
        <button
          type="button"
          onClick={history.retry}
          className="cursor-pointer font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
        >
          Try Again
        </button>
      </>,
    );
  if (history.status === 'ready' && history.entries.length === 0)
    return note('No activity recorded yet.');
  return null;
}
