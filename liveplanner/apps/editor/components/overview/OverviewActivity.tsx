import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { CompactEmptyState, HoverCard, lucideGlyph } from '@liveplanner/ui';
import type { ItemTypeDef } from '@liveplanner/items';
import {
  lucideArrowRight,
  lucideHistory,
  lucidePencil,
  lucidePlus,
  lucideSparkles,
  lucideTrash2,
} from '@liveworkspace/icons/lucide';
import { CardTypeChip } from '@/components/plan/CardTypeChipFace';
import { PersonDisc } from '@/components/plan/PersonDisc';
import { formatRelativeTime } from '@/lib/relative-time';
import {
  ACTIVITY_SHOWN,
  activityDaysOf,
  type ActivityEntry,
  type ActivityKind,
} from './overview-activity';
import type { CardTypeTileSummary } from './overview-card-types';
import { OverviewSection, TILE_CLASS } from './OverviewSection';
import { useActivityEnter } from './useActivityEnter';

const HistoryGlyph = lucideGlyph(lucideHistory, 20);
const ArrowGlyph = lucideGlyph(lucideArrowRight, 12);

// The badge on a person's disc: what they did.
const KIND_GLYPH: Record<ActivityKind, ReturnType<typeof lucideGlyph>> = {
  added: lucideGlyph(lucidePlus, 9),
  moved: lucideGlyph(lucideArrowRight, 9),
  changed: lucideGlyph(lucidePencil, 9),
  deleted: lucideGlyph(lucideTrash2, 9),
  'created-plan': lucideGlyph(lucideSparkles, 9),
};

const BADGE_CARD =
  'bg-slate-100 text-slate-600 ring-2 ring-white dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-900';
const BADGE_SETUP =
  'bg-brand-700 text-white ring-2 ring-white dark:bg-brand-600 dark:ring-slate-900';

const exact = (at: number) =>
  new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

// The rail's column: the person's disc with what they did as a badge, or, under a disc, the badge alone on the rail.
function Marker({ entry, leads }: { entry: ActivityEntry; leads: boolean }) {
  const Glyph = KIND_GLYPH[entry.kind];
  const tone = entry.setup ? BADGE_SETUP : BADGE_CARD;
  if (!leads)
    return (
      <span className="relative flex h-7 w-7 items-start justify-center pt-0.5">
        <span
          data-dot={entry.setup ? 'setup' : 'card'}
          className={`flex h-5 w-5 items-center justify-center rounded-full ${tone}`}
        >
          <Glyph />
        </span>
      </span>
    );
  return (
    <span className="relative flex h-7 w-7">
      <PersonDisc person={entry.by} size={28} className="ring-2 ring-white dark:ring-slate-900" />
      <span
        data-dot={entry.setup ? 'setup' : 'card'}
        className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full ${tone}`}
      >
        <Glyph />
      </span>
    </span>
  );
}

const ActivityItem = memo(function ActivityItem({
  entry,
  index,
  leads,
  type,
  now,
  listShown,
  onOpenCard,
}: {
  entry: ActivityEntry;
  index: number;
  leads: boolean;
  type: Pick<ItemTypeDef, 'label' | 'color' | 'glyph'> | undefined;
  now: number;
  listShown: RefObject<boolean>;
  onOpenCard: (itemId: string) => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  useActivityEnter(ref, index, listShown);
  const when = formatRelativeTime(Math.max(0, now - entry.at));
  const body = (
    <>
      <Marker entry={entry} leads={leads} />
      <span className="flex min-w-0 flex-col gap-1.5 pt-px">
        <span className="text-[13px] leading-snug text-slate-600 dark:text-slate-300">
          <strong className="font-semibold text-slate-900 dark:text-slate-100">
            {entry.by.name}
          </strong>{' '}
          {entry.verb}
          {entry.title !== null ? (
            <>
              {' '}
              <strong className="break-words font-semibold text-slate-900 dark:text-slate-100">
                {entry.title}
              </strong>
            </>
          ) : null}
        </span>
        {type || entry.to ? (
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            {type ? (
              <CardTypeChip
                type={type}
                size="sm"
                className="max-w-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            ) : null}
            {entry.to ? (
              <>
                <span aria-hidden className="text-slate-400">
                  <ArrowGlyph />
                </span>
                <span
                  data-moved-to=""
                  className="inline-flex h-6 min-w-0 max-w-full items-center rounded-full border border-slate-200 bg-white px-2.5 text-[12px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <span className="truncate">{entry.to}</span>
                </span>
              </>
            ) : null}
          </span>
        ) : null}
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {entry.where} ·{' '}
          <HoverCard title={exact(entry.at)}>
            <time dateTime={new Date(entry.at).toISOString()}>{when}</time>
          </HoverCard>
        </span>
      </span>
    </>
  );
  const grid = 'grid w-full grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-lg px-2 py-2 text-left';
  return (
    <li ref={ref} data-activity-entry={entry.kind} className="relative">
      {entry.itemId ? (
        <button
          type="button"
          aria-label={`${entry.by.name} ${entry.text}, ${entry.where}, ${when}`}
          onClick={() => onOpenCard(entry.itemId!)}
          className={`${grid} cursor-pointer transition hover:bg-slate-50 hover:shadow-sm hover:ring-1 hover:ring-slate-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 dark:hover:bg-slate-800/60 dark:hover:ring-slate-700/70`}
        >
          {body}
        </button>
      ) : (
        <div className={grid}>{body}</div>
      )}
    </li>
  );
});

// The Overview's Recent Activity (docs/specs/026-plan/plan-overview.md "Recent Activity"): entries grouped by day on a
// rail, newest first, eight until See All; each person's disc once per run, a badge for what they did, the card's type
// chip and, for a move, the column it went to. Entries fan in as the page opens (useActivityEnter).
export function OverviewActivity({
  entries,
  cardTypes,
  now,
  onOpenCard,
}: {
  entries: readonly ActivityEntry[];
  // The plan's card types (as Card Types tiles them), for each entry's chip.
  cardTypes: readonly CardTypeTileSummary[];
  now: number;
  onOpenCard: (itemId: string) => void;
}) {
  const [all, setAll] = useState(false);
  const more = entries.length > ACTIVITY_SHOWN;
  const days = useMemo(
    () => activityDaysOf(all ? entries : entries.slice(0, ACTIVITY_SHOWN), now),
    [entries, all, now],
  );
  const types = useMemo(
    () => new Map(cardTypes.map((t) => [t.type.id, t.type] as const)),
    [cardTypes],
  );
  // Whether the list was already on screen: an entry mounting after that arrives rather than fans in.
  const listShown = useRef(false);
  useEffect(() => {
    listShown.current = true;
  }, []);
  return (
    <OverviewSection
      id="overview-activity"
      title="Recent Activity"
      subtitle="What people did to cards lately"
      action={
        more ? (
          <button
            type="button"
            aria-expanded={all}
            onClick={() => setAll((v) => !v)}
            className="cursor-pointer rounded px-1 text-xs font-semibold text-brand-700 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-brand-300 dark:hover:text-brand-200"
          >
            {all ? 'Show Fewer' : 'See All'}
          </button>
        ) : null
      }
    >
      {entries.length === 0 ? (
        <div className={`${TILE_CLASS} px-4 py-8`}>
          <CompactEmptyState
            icon={<HistoryGlyph />}
            title="No Activity Yet"
            description="Changes to cards will show here, as people add and move them."
          />
        </div>
      ) : (
        <div className={`${TILE_CLASS} flex flex-col gap-3 p-2`}>
          {days.map((day) => (
            <section key={day.key} aria-label={day.label} className="flex flex-col gap-0.5">
              <h3 className="px-2 pb-1 pt-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {day.label}
              </h3>
              <ol className="relative flex flex-col gap-0.5">
                {/* The rail, through the middle of the discs' column; each disc's ring cuts it. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute bottom-5 left-[22px] top-5 w-px bg-slate-200 dark:bg-slate-800"
                />
                {day.rows.map(({ entry, index, leads }) => (
                  <ActivityItem
                    key={`${entry.key}@${entry.at}`}
                    entry={entry}
                    index={index}
                    leads={leads}
                    type={entry.typeId ? types.get(entry.typeId) : undefined}
                    now={now}
                    listShown={listShown}
                    onOpenCard={onOpenCard}
                  />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </OverviewSection>
  );
}
