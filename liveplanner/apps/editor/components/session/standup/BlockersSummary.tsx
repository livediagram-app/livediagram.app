'use client';

// Stand-up's Session Complete summary (docs/specs/026-plan/session-tabs.md "Stand-up", "When everyone is done"):
// Blockers, every card marked blocked in the session in the order it was marked, each with its number, title, person
// and reason, pressing one opening it; "No blockers today" with none.
import {
  cardRefOrKey,
  itemAssignee,
  itemTitle,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import type { SessionDecision } from '@liveplanner/project';
import { FLAG_COLOUR } from '@liveplanner/project';
import { lucideFlag } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveplanner/ui';
import { personName } from './standup-words';

const FlagIcon = lucideGlyph(lucideFlag, 14);

// The cards marked blocked in the session, still on the plan, in the order they were marked.
export function blockersOf(
  decided: Readonly<Record<string, SessionDecision>> | undefined,
  items: ReadonlyMap<string, Item>,
): { item: Item; reason: string }[] {
  return Object.entries(decided ?? {})
    .filter(([, d]) => d.outcome === 'flagged')
    .sort(([, a], [, b]) => a.at - b.at)
    .flatMap(([id, d]) => {
      const item = items.get(id);
      return item ? [{ item, reason: d.reason ?? '' }] : [];
    });
}

export function BlockersSummary({
  decided,
  items,
  types,
  onOpen,
}: {
  decided: Readonly<Record<string, SessionDecision>> | undefined;
  items: ReadonlyMap<string, Item>;
  types: readonly ItemTypeDef[];
  onOpen: (itemId: string) => void;
}) {
  const blockers = blockersOf(decided, items);
  return (
    <section
      className="flex w-full max-w-md flex-col gap-2 text-left"
      aria-labelledby="standup-blockers"
    >
      <h3
        id="standup-blockers"
        className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
      >
        Blockers
      </h3>
      {blockers.length ? (
        <ul className="flex flex-col gap-1.5">
          {blockers.map(({ item, reason }) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                data-blocker={item.id}
                className="flex w-full cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <span className="mt-0.5 shrink-0" style={{ color: FLAG_COLOUR }}>
                  <FlagIcon aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">
                    <span className="text-slate-500 dark:text-slate-400">
                      {cardRefOrKey(item, types)}
                    </span>{' '}
                    {itemTitle(item)}
                  </span>
                  <span className="block truncate text-[12px] text-slate-500 dark:text-slate-400">
                    {personName(itemAssignee(item) ?? null)}
                    {reason ? ` · ${reason}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-slate-500 dark:text-slate-400">No blockers today.</p>
      )}
    </section>
  );
}
