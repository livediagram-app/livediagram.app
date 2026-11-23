'use client';

// From a Plan (liveworkspace/docs/specs/004-index/live-data.md "The element"; each reader app's docs/specs/009-elements/
// pie-chart.md "Live data from a plan"): a chart or table kept in step with one of the person's plans. Pick the plan,
// then the source (a Sheet range typed as A1, a board's cards counted, or a Dashboard metric), with a preview of what
// the element will draw and, for a read of several series, which feed it. Linking reads with this person's own access
// and saves the values in the item, so anyone who cannot open the plan still sees them. One copy for every reader app;
// SheetLinksHost loads it on demand.
import { useEffect, useEffectEvent, useId, useState } from 'react';
import {
  Button,
  CloseIcon,
  CompactEmptyState,
  DialogHeader,
  DialogFooter,
  NoMatches,
  PlanIcon,
  SegmentedToggle,
  SheetLinkIcon,
} from '@liveworkspace/ui';
import {
  sourceKindOf,
  type ChartSheetSource,
  type LiveSourceKind,
} from '@liveworkspace/element-model/chart-sheet-source';
import {
  CHART_TYPE_LABELS,
  chartTypeOf,
  type ChartType,
} from '@liveworkspace/element-model/chart-types';
import { pickSeries } from '@liveworkspace/element-model/live-data-table';
import {
  IndexError,
  SHEET_A1_MAX,
  type BoardCountBy,
  type BoardCountFilter,
  type Item,
  type PlanDataAsk,
  type SheetListing,
} from '@liveworkspace/index-client';
import { Dialog } from '../dialogs/Dialog';
import { SearchInput } from '../primitives/SearchInput';
import { indexClient } from '../../lib/index-client';
import type { SheetLinkNoun } from './SheetLinkedCharts';
import { BoardCountFields, FIELD_LABEL, MetricFields, usePlanDataListing } from './PlanDataFields';
import { SeriesChips } from './SeriesChips';
import {
  drawnTable,
  isLiveTable,
  sourceAfterRead,
  type Linkable,
  type LiveRead,
} from './sheet-links';
import { readSheetLink, type SheetLinkGrantOf } from './useSheetLinkedCharts';

// Spec constants (each reader app's blueprints/data-charts.md): how long typing settles before the preview reads, and how many plans
// the picker lists.
export const LINK_PREVIEW_DEBOUNCE_MS = 300;
const PLAN_LIST_LIMIT = 30;
// The rows the preview shows; the rest are counted.
const PREVIEW_ROWS = 6;

type Load<T> = { state: 'loading' } | { state: 'ready'; value: T } | { state: 'failed' };
type Keyed<T> = { key: string; value: T };
type Preview =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ready'; read: LiveRead }
  | { state: 'refused'; message: string };

const KIND_OPTIONS: { value: LiveSourceKind; label: string; description: string }[] = [
  { value: 'sheet', label: 'Sheet Range', description: 'A range of one of its Sheets.' },
  { value: 'board', label: 'Board Counts', description: "A board's cards, counted." },
  { value: 'metric', label: 'Dashboard Metric', description: 'A number its Dashboards work out.' },
];

// Why a preview could not be read, in words.
function previewRefusal(err: unknown, kind: LiveSourceKind): string {
  if (err instanceof IndexError) {
    if (err.code === 'invalid_range') return 'That is not a range. Type one like A1:C8.';
    if (err.code === 'range_gone') return 'That range is outside the sheet.';
    if (err.status === 404)
      return kind === 'sheet'
        ? 'This sheet cannot be opened any more.'
        : kind === 'board'
          ? 'This board cannot be read any more.'
          : 'This metric cannot be read any more.';
  }
  return `Couldn't read the ${kind === 'sheet' ? 'sheet' : 'plan'}. Try again in a moment.`;
}

// Waits `ms` after the last change of `value` before answering it.
function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

const ROW =
  'flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300';
const ROW_IDLE = 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/70';
const ROW_ON =
  'bg-brand-50 text-brand-800 ring-1 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-100 dark:ring-brand-500/30';

// The ask a board or metric source reads with.
const askOf = (
  kind: 'board' | 'metric',
  boardId: string | null,
  by: BoardCountBy,
  filter: BoardCountFilter,
  metric: string | null,
): PlanDataAsk | null => {
  if (kind === 'metric') return metric ? { kind: 'metric', metric } : null;
  if (!boardId) return null;
  return { kind: 'board', boardId, by, ...(Object.keys(filter).length ? { filter } : {}) };
};

export function LinkSheetDialog({
  chart,
  itemId,
  grantOf,
  noun,
  onLink,
  onClose,
}: {
  chart: Linkable;
  itemId: string | null;
  grantOf: SheetLinkGrantOf;
  noun: SheetLinkNoun;
  onLink: (source: ChartSheetSource, read: LiveRead) => void;
  onClose: () => void;
}) {
  const rangeId = useId();
  const rangeHintId = useId();
  const current = chart.chartSheetSource;
  const isTable = isLiveTable(chart);
  const [query, setQuery] = useState('');
  const settledQuery = useSettled(query.trim(), LINK_PREVIEW_DEBOUNCE_MS);
  const [planId, setPlanId] = useState<string | null>(current?.itemId ?? null);
  const [kind, setKind] = useState<LiveSourceKind>(current ? sourceKindOf(current) : 'sheet');
  const [sheetId, setSheetId] = useState<string | null>(
    current?.kind === undefined || current.kind === 'sheet' ? (current?.sheetId ?? null) : null,
  );
  const [a1, setA1] = useState(
    current?.kind === undefined || current.kind === 'sheet' ? (current?.a1 ?? '') : '',
  );
  const [boardId, setBoardId] = useState<string | null>(
    current?.kind === 'board' ? current.boardId : null,
  );
  const [by, setBy] = useState<BoardCountBy>(current?.kind === 'board' ? current.by : 'column');
  const [filter, setFilter] = useState<BoardCountFilter>(
    current?.kind === 'board' ? (current.filter ?? {}) : {},
  );
  const [metric, setMetric] = useState<string | null>(
    current?.kind === 'metric' ? current.metric : null,
  );
  const [series, setSeries] = useState<number[] | undefined>(current?.series);
  const settledA1 = useSettled(a1.trim(), LINK_PREVIEW_DEBOUNCE_MS);
  const [linking, setLinking] = useState(false);
  // Each answer is kept with what it answered, so one for an older search, plan or source reads as still loading.
  const [plansFor, setPlansFor] = useState<Keyed<Load<Item[]>> | null>(null);
  const [sheetsFor, setSheetsFor] = useState<Keyed<Load<SheetListing[]>> | null>(null);
  const [previewFor, setPreviewFor] = useState<Keyed<Preview> | null>(null);
  const planData = usePlanDataListing(planId, kind !== 'sheet');

  // The person's plans, the most recent first, narrowed by the search.
  useEffect(() => {
    const abort = new AbortController();
    indexClient
      .listItems(
        {
          app: 'liveplanner',
          view: 'recent',
          limit: PLAN_LIST_LIMIT,
          ...(settledQuery ? { q: settledQuery } : {}),
        },
        { signal: abort.signal },
      )
      .then((page) =>
        setPlansFor({ key: settledQuery, value: { state: 'ready', value: page.items } }),
      )
      .catch(() => {
        if (!abort.signal.aborted) setPlansFor({ key: settledQuery, value: { state: 'failed' } });
      });
    return () => abort.abort();
  }, [settledQuery]);
  const plans: Load<Item[]> =
    plansFor?.key === settledQuery ? plansFor.value : { state: 'loading' };

  // The picked plan's sheets; a sheet picked before is kept, else the first, its filled cells as the range.
  useEffect(() => {
    if (!planId || kind !== 'sheet') return;
    const abort = new AbortController();
    indexClient
      .listSheets(planId, { signal: abort.signal })
      .then((list) => {
        setSheetsFor({ key: planId, value: { state: 'ready', value: list.sheets } });
        setSheetId((was) => {
          const keep = list.sheets.find((s) => s.id === was);
          const pick = keep ?? list.sheets[0];
          if (!keep && pick) setA1(pick.a1);
          return pick?.id ?? null;
        });
      })
      .catch(() => {
        if (!abort.signal.aborted) setSheetsFor({ key: planId, value: { state: 'failed' } });
      });
    return () => abort.abort();
  }, [planId, kind]);
  const sheets: Load<SheetListing[]> | null = !planId
    ? null
    : sheetsFor?.key === planId
      ? sheetsFor.value
      : { state: 'loading' };

  // A board or metric picked by default once the plan's listing is in: the first board, the first metric.
  const listing = planData?.state === 'ready' ? planData.listing : null;
  const shownBoard =
    listing && !listing.boards.some((b) => b.id === boardId)
      ? (listing.boards[0]?.id ?? null)
      : boardId;
  const shownMetric =
    listing && !listing.metrics.some((m) => m.id === metric)
      ? (listing.metrics[0]?.id ?? null)
      : metric;

  // What the element will draw, a moment after typing stops: the range, or the board's counts or the metric.
  const ask = kind === 'sheet' ? null : askOf(kind, shownBoard, by, filter, shownMetric);
  const previewKey =
    planId && kind === 'sheet'
      ? sheetId && settledA1
        ? `sheet|${planId}|${sheetId}|${settledA1}`
        : null
      : planId && ask
        ? `data|${planId}|${JSON.stringify(ask)}`
        : null;
  // The read for the key now shown: the range, or the board's counts or the metric (`ask` is part of the key).
  const readPreview = useEffectEvent((id: string, signal: AbortSignal): Promise<LiveRead> =>
    kind === 'sheet'
      ? indexClient.readSheetRange(id, { sheetId: sheetId!, a1: settledA1 }, { signal })
      : indexClient.readPlanData(id, ask!, { signal }),
  );
  const refusalOf = useEffectEvent((err: unknown) => previewRefusal(err, kind));
  useEffect(() => {
    if (!planId || !previewKey) return;
    const abort = new AbortController();
    readPreview(planId, abort.signal)
      .then((r) => setPreviewFor({ key: previewKey, value: { state: 'ready', read: r } }))
      .catch((err: unknown) => {
        if (!abort.signal.aborted)
          setPreviewFor({ key: previewKey, value: { state: 'refused', message: refusalOf(err) } });
      });
    return () => abort.abort();
  }, [planId, previewKey]);
  const preview: Preview = !previewKey
    ? { state: 'idle' }
    : previewFor?.key === previewKey
      ? previewFor.value
      : { state: 'loading' };

  const pickSheet = (s: SheetListing) => {
    setSheetId(s.id);
    setA1(s.a1);
  };
  const pickPlan = (id: string) => {
    setPlanId(id);
    setSeries(undefined);
  };

  const settledInput = kind !== 'sheet' || settledA1 === a1.trim();
  const ready = preview.state === 'ready' && settledInput ? preview.read : null;
  const empty = ready !== null && ready.table.categories.length === 0;

  // Link: read once more, asking the plan to say when it changes, then kept with its values. Offered only with a
  // preview that has something to draw (`linkable`).
  const linkable = ready && !empty ? ready : null;
  const link = async (read: LiveRead) => {
    setLinking(true);
    const common = {
      app: 'liveplanner' as const,
      itemId: read.itemId,
      itemName: read.itemName,
      readAt: read.readAt,
      ...(series ? { series } : {}),
    };
    const source: ChartSheetSource =
      'sheetName' in read
        ? {
            ...common,
            sheetId: read.sheetId,
            range: read.range,
            sheetName: read.sheetName,
            a1: read.a1,
          }
        : ask!.kind === 'board'
          ? { ...common, ...ask!, sourceName: read.sourceName, label: read.label }
          : { ...common, ...ask!, sourceName: read.sourceName, label: read.label };
    const status = await readSheetLink(source, itemId, grantOf);
    const fresh = status.kind === 'live' ? status.read : read;
    onLink(sourceAfterRead(source, fresh), fresh);
  };

  const planList =
    plans.state === 'loading' ? (
      <ListSkeleton />
    ) : plans.state === 'failed' ? (
      <CompactEmptyState
        size="small"
        icon={<PlanIcon />}
        title="Couldn't load your plans"
        description="Check your connection and try again."
      />
    ) : plans.value.length === 0 ? (
      settledQuery ? (
        <NoMatches things="plans" query={settledQuery} onClear={() => setQuery('')} />
      ) : (
        <CompactEmptyState
          size="small"
          icon={<PlanIcon />}
          title="No plans yet"
          description={`Make a plan in liveplanner, then take this ${isTable ? 'table' : 'chart'}'s numbers from it.`}
        />
      )
    ) : (
      <ul className="flex flex-col gap-0.5" aria-label="Plans">
        {plans.value.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              aria-pressed={p.id === planId}
              onClick={() => pickPlan(p.id)}
              className={`${ROW} ${p.id === planId ? ROW_ON : ROW_IDLE}`}
            >
              <PlanIcon size={16} className="shrink-0 text-slate-500 dark:text-slate-400" />
              <span className="min-w-0 flex-1 truncate">{p.title || 'Untitled plan'}</span>
            </button>
          </li>
        ))}
      </ul>
    );

  const sheetList = !planId ? (
    <p className="px-2.5 py-2 text-sm text-slate-500 dark:text-slate-400">Pick a plan first.</p>
  ) : !sheets || sheets.state === 'loading' ? (
    <ListSkeleton rows={2} />
  ) : sheets.state === 'failed' ? (
    <CompactEmptyState
      size="small"
      icon={<SheetLinkIcon />}
      title="Couldn't open this plan"
      description="You may not have access to it any more."
    />
  ) : sheets.value.length === 0 ? (
    <CompactEmptyState
      size="small"
      icon={<SheetLinkIcon />}
      title="No sheets in this plan"
      description="Add a Sheet tab to the plan in liveplanner first."
    />
  ) : (
    <ul className="flex flex-col gap-0.5" aria-label="Sheets">
      {sheets.value.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            aria-pressed={s.id === sheetId}
            onClick={() => pickSheet(s)}
            className={`${ROW} ${s.id === sheetId ? ROW_ON : ROW_IDLE}`}
          >
            <SheetLinkIcon size={16} className="shrink-0 text-slate-500 dark:text-slate-400" />
            <span className="min-w-0 flex-1 truncate">{s.name || 'Sheet'}</span>
            <span className="shrink-0 font-mono text-[11px] text-slate-500 dark:text-slate-400">
              {s.a1}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );

  const sheetFields = (
    <>
      <div className="max-h-40 min-h-16 overflow-y-auto">{sheetList}</div>
      <label htmlFor={rangeId} className={`${FIELD_LABEL} mt-1`}>
        Range
      </label>
      <input
        id={rangeId}
        value={a1}
        onChange={(e) => setA1(e.target.value.toUpperCase())}
        maxLength={SHEET_A1_MAX}
        disabled={!sheetId}
        spellCheck={false}
        autoComplete="off"
        aria-describedby={rangeHintId}
        placeholder="A1:C8"
        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-sm text-slate-800 transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-brand-500/20"
      />
      <p id={rangeHintId} className="text-xs text-slate-500 dark:text-slate-400">
        The first row names each series; the first column labels each{' '}
        {isTable
          ? 'row'
          : (chart as { shape?: string }).shape === 'pie-chart'
            ? 'slice'
            : (chart as { shape?: string }).shape === 'line-chart'
              ? 'point'
              : 'bar'}
        .
      </p>
    </>
  );

  const seriesNames = ready?.table.series.map((s) => s.name) ?? [];
  const firstAlone =
    !isTable &&
    drawnTable(chart, {
      categories: [],
      series: [
        { name: '', values: [] },
        { name: '', values: [] },
      ],
    }).leftOut > 0;

  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel="Data From a Plan"
      size="xl"
      phoneSheet
      className="max-h-[90vh]"
    >
      <DialogHeader
        title="Data From a Plan"
        subtitle={`Keep this ${isTable ? 'table' : 'chart'} in step with one of your plans.`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <CloseIcon size={18} />
        </button>
      </DialogHeader>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-x-5 gap-y-4 overflow-y-auto px-6 py-4 sm:grid-cols-2">
        {/* Across both columns, so each label holds one line; on a narrow screen a whole segment wraps, never a word. */}
        <section className="flex min-w-0 flex-col gap-2 sm:col-span-2">
          <h3 className={FIELD_LABEL}>Source</h3>
          <SegmentedToggle
            value={kind}
            onChange={(k) => {
              setKind(k);
              setSeries(undefined);
            }}
            options={KIND_OPTIONS}
            label="Source"
            className="flex-wrap self-start [&>button]:whitespace-nowrap"
          />
        </section>
        <section className="flex min-w-0 flex-col gap-2">
          <h3 className={FIELD_LABEL}>Plan</h3>
          {/* A row of its own: the search box grows across, never down, when the column beside is the taller one. */}
          <div className="flex">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search your plans"
              ariaLabel="Search your plans"
              clearAriaLabel="Clear the search"
              clearDescription="Clear the plan search."
              size="row"
            />
          </div>
          <div className="max-h-56 min-h-24 overflow-y-auto">{planList}</div>
        </section>
        <section className="flex min-w-0 flex-col gap-2">
          <h3 className={FIELD_LABEL}>{KIND_OPTIONS.find((o) => o.value === kind)?.label}</h3>
          {kind === 'sheet' ? (
            sheetFields
          ) : kind === 'board' ? (
            <BoardCountFields
              load={planData}
              boardId={shownBoard}
              by={by}
              filter={filter}
              onBoard={setBoardId}
              onBy={setBy}
              onFilter={setFilter}
            />
          ) : (
            <MetricFields load={planData} metric={shownMetric} onMetric={setMetric} />
          )}
        </section>
        <section className="flex min-w-0 flex-col gap-2 sm:col-span-2" aria-live="polite">
          <h3 className={FIELD_LABEL}>Preview</h3>
          {seriesNames.length > 1 ? (
            <SeriesChips
              names={seriesNames}
              picked={series}
              onChange={setSeries}
              firstAlone={firstAlone}
            />
          ) : null}
          <PreviewTable
            preview={preview}
            empty={empty}
            chart={chart}
            series={series}
            idle={
              kind === 'sheet'
                ? `Pick a sheet and a range to see what the ${isTable ? 'table' : 'chart'} draws.`
                : `Pick a plan and a ${kind === 'board' ? 'board' : 'metric'} to see what it draws.`
            }
          />
        </section>
      </div>
      <DialogFooter>
        <p className="mr-auto hidden text-xs text-slate-500 sm:block dark:text-slate-400">
          The numbers are saved in the {noun}, so people who can't open the plan still see them.
        </p>
        <Button variant="secondary" onClick={onClose} className="shrink-0">
          Cancel
        </Button>
        <Button
          onClick={linkable ? () => void link(linkable) : undefined}
          disabled={!linkable || linking}
          className="shrink-0 whitespace-nowrap"
        >
          {linking ? 'Linking…' : current ? 'Update Link' : 'Link'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div
      className="flex flex-col gap-1.5 px-1 py-1"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="h-8 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none dark:bg-slate-800"
        />
      ))}
    </div>
  );
}

function PreviewTable({
  preview,
  empty,
  chart,
  series,
  idle,
}: {
  preview: Preview;
  empty: boolean;
  chart: Linkable;
  series: number[] | undefined;
  idle: string;
}) {
  const box =
    'flex min-h-28 items-center justify-center rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400';
  if (preview.state === 'idle') return <div className={box}>{idle}</div>;
  if (preview.state === 'loading')
    return (
      <div className={`${box} animate-pulse motion-reduce:animate-none`}>Reading the plan…</div>
    );
  if (preview.state === 'refused')
    return <div className={`${box} text-amber-700 dark:text-amber-300`}>{preview.message}</div>;
  if (empty)
    return (
      <div className={box}>
        {'sheetName' in preview.read
          ? 'Nothing to draw in this range. Pick one with labels and numbers.'
          : 'No cards to count here yet. Try another board or fewer filters.'}
      </div>
    );
  // Only what the element will draw: a pie or bar draws the first picked series alone.
  const { table, leftOut } = drawnTable(chart, pickSeries(preview.read.table, series));
  const { categories } = table;
  const shown = categories.slice(0, PREVIEW_ROWS);
  const more = categories.length - shown.length;
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/60">
            <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="sr-only">Label</span>
            </th>
            {table.series.map((s, i) => (
              <th
                key={i}
                className="px-3 py-1.5 text-right text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((c, r) => (
            <tr key={r} className="border-t border-slate-100 dark:border-slate-800">
              <td className="max-w-48 truncate px-3 py-1.5 text-slate-700 dark:text-slate-200">
                {c}
              </td>
              {table.series.map((s, i) => (
                <td
                  key={i}
                  className="px-3 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300"
                >
                  {s.values[r]?.toLocaleString() ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {more > 0 ? (
        <p className="border-t border-slate-100 px-3 py-1.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          and {more} more {more === 1 ? 'row' : 'rows'}
        </p>
      ) : null}
      {/* Only a pie, doughnut, column or bar leaves series out, so the chart has a type. */}
      {leftOut > 0 ? (
        <p
          data-preview-left-out=""
          className="border-t border-slate-100 px-3 py-1.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400"
        >
          A {CHART_TYPE_LABELS[chartTypeOf(chart as never) as ChartType].toLowerCase()} chart draws
          the first series.
        </p>
      ) : null}
    </div>
  );
}
