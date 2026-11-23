'use client';

// The From a Plan dialog's Board Counts and Dashboard Metric fields (liveworkspace/docs/specs/004-index/live-data.md
// "The element"): the plan's boards, what to count their cards by and the filters, or its metrics, from the plan's
// listing (`GET /items/:id/plan-data`, on the person's own access).
import { useEffect, useId, useState } from 'react';
import { CompactEmptyState, SegmentedToggle, Select, SheetLinkIcon } from '@liveworkspace/ui';
import {
  BOARD_COUNT_BYS,
  type BoardCountBy,
  type BoardCountFilter,
  type PlanDataListing,
} from '@liveworkspace/index-client';
import { indexClient } from '../../lib/index-client';

export type PlanDataLoad =
  { state: 'loading' } | { state: 'ready'; listing: PlanDataListing } | { state: 'failed' };

// The plan's listing, read once per plan picked.
export function usePlanDataListing(planId: string | null, wanted: boolean): PlanDataLoad | null {
  const [loaded, setLoaded] = useState<{ planId: string; load: PlanDataLoad } | null>(null);
  useEffect(() => {
    if (!planId || !wanted) return;
    const abort = new AbortController();
    indexClient
      .listPlanData(planId, { signal: abort.signal })
      .then((listing) => setLoaded({ planId, load: { state: 'ready', listing } }))
      .catch(() => {
        if (!abort.signal.aborted) setLoaded({ planId, load: { state: 'failed' } });
      });
    return () => abort.abort();
  }, [planId, wanted]);
  if (!planId || !wanted) return null;
  return loaded?.planId === planId ? loaded.load : { state: 'loading' };
}

const COUNT_BY_WORDS: Record<BoardCountBy, { label: string; description: string }> = {
  column: { label: 'Column', description: 'How many cards each column holds.' },
  label: { label: 'Label', description: 'How many cards carry each label.' },
  assignee: { label: 'Assignee', description: 'How many cards each person has.' },
  priority: { label: 'Priority', description: 'How many cards have each priority.' },
};
const COUNT_BY_OPTIONS = BOARD_COUNT_BYS.map((value) => ({ value, ...COUNT_BY_WORDS[value] }));

const ROW =
  'flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300';
const ROW_IDLE = 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/70';
const ROW_ON =
  'bg-brand-50 text-brand-800 ring-1 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-100 dark:ring-brand-500/30';
export const FIELD_LABEL =
  'text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400';

function PickList<T extends { id: string }>({
  items,
  picked,
  onPick,
  label,
  nameOf,
}: {
  items: readonly T[];
  picked: string | null;
  onPick: (id: string) => void;
  label: string;
  nameOf: (item: T) => string;
}) {
  return (
    <ul className="flex flex-col gap-0.5" aria-label={label}>
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            aria-pressed={item.id === picked}
            onClick={() => onPick(item.id)}
            className={`${ROW} ${item.id === picked ? ROW_ON : ROW_IDLE}`}
          >
            <SheetLinkIcon size={16} className="shrink-0 text-slate-500 dark:text-slate-400" />
            <span className="min-w-0 flex-1 truncate">{nameOf(item)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Waiting({ load }: { load: PlanDataLoad | null }) {
  if (!load)
    return (
      <p className="px-2.5 py-2 text-sm text-slate-500 dark:text-slate-400">Pick a plan first.</p>
    );
  if (load.state === 'loading')
    return (
      <div
        className="flex flex-col gap-1.5 px-1 py-1"
        role="status"
        aria-busy="true"
        aria-label="Loading"
      >
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-8 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none dark:bg-slate-800"
          />
        ))}
      </div>
    );
  return (
    <CompactEmptyState
      size="small"
      icon={<SheetLinkIcon />}
      title="Couldn't open this plan"
      description="You may not have access to it any more."
    />
  );
}

type FilterKey = keyof BoardCountFilter;

export function BoardCountFields({
  load,
  boardId,
  by,
  filter,
  onBoard,
  onBy,
  onFilter,
}: {
  load: PlanDataLoad | null;
  boardId: string | null;
  by: BoardCountBy;
  filter: BoardCountFilter;
  onBoard: (id: string) => void;
  onBy: (by: BoardCountBy) => void;
  onFilter: (filter: BoardCountFilter) => void;
}) {
  const filterId = useId();
  if (load?.state !== 'ready') return <Waiting load={load} />;
  const { boards, filters } = load.listing;
  if (boards.length === 0)
    return (
      <CompactEmptyState
        size="small"
        icon={<SheetLinkIcon />}
        title="No boards in this plan"
        description="Add a Board tab to the plan in liveplanner first."
      />
    );
  const choices: { key: FilterKey; label: string; options: { id: string; name: string }[] }[] = [
    {
      key: 'priority',
      label: 'Priority',
      options: filters.priorities.map((p) => ({ id: p.id, name: p.label })),
    },
    { key: 'label', label: 'Label', options: filters.labels.map((l) => ({ id: l, name: l })) },
    { key: 'person', label: 'Assignee', options: filters.people },
    {
      key: 'type',
      label: 'Card Type',
      options: filters.types.map((t) => ({ id: t.id, name: t.label })),
    },
  ];
  const setPart = (key: FilterKey, value: string) => {
    const { [key]: _was, ...rest } = filter;
    onFilter(value ? { ...rest, [key]: value } : rest);
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="max-h-32 min-h-10 overflow-y-auto">
        <PickList
          items={boards}
          picked={boardId}
          onPick={onBoard}
          label="Boards"
          nameOf={(b) => b.name || 'Board'}
        />
      </div>
      <span className={`${FIELD_LABEL} mt-1`}>Count Cards By</span>
      <SegmentedToggle
        value={by}
        onChange={onBy}
        options={COUNT_BY_OPTIONS}
        label="Count cards by"
        className="self-start"
      />
      <span className={`${FIELD_LABEL} mt-1`} id={filterId}>
        Only Cards With
      </span>
      <div className="grid grid-cols-2 gap-1.5" role="group" aria-labelledby={filterId}>
        {choices.map((c) => (
          <Select
            key={c.key}
            aria-label={`Only cards with this ${c.label.toLowerCase()}`}
            value={filter[c.key] ?? ''}
            onChange={(e) => setPart(c.key, e.target.value)}
            disabled={c.options.length === 0}
          >
            <option value="">Any {c.label}</option>
            {c.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        ))}
      </div>
    </div>
  );
}

export function MetricFields({
  load,
  metric,
  onMetric,
}: {
  load: PlanDataLoad | null;
  metric: string | null;
  onMetric: (id: string) => void;
}) {
  if (load?.state !== 'ready') return <Waiting load={load} />;
  if (load.listing.metrics.length === 0)
    return (
      <CompactEmptyState
        size="small"
        icon={<SheetLinkIcon />}
        title="No metrics in this plan"
        description="Add a Board tab to the plan in liveplanner first."
      />
    );
  return (
    <div className="max-h-64 min-h-16 overflow-y-auto">
      <PickList
        items={load.listing.metrics}
        picked={metric}
        onPick={onMetric}
        label="Metrics"
        nameOf={(m) => m.label}
      />
    </div>
  );
}
