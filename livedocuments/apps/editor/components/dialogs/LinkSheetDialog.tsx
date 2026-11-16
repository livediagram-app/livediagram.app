'use client';

// Link to Sheet (docs/specs/009-elements/pie-chart.md "Charts linked to a liveplanner sheet"): a chart kept in step
// with a sheet in one of the person's plans. Pick the plan, then its sheet, then the range (typed as A1, filled in with
// the sheet's filled cells), with a preview of what the chart will draw. Linking reads the range with this person's
// own access and saves its values in the document, so anyone who cannot open the plan still sees them.
import { useEffect, useId, useState } from 'react';
import {
  Button,
  CloseIcon,
  CompactEmptyState,
  DialogHeader,
  DialogFooter,
  NoMatches,
  PlanIcon,
  SheetLinkIcon,
} from '@livedocuments/ui';
import type { ChartSheetSource, ShapeElement } from '@livedocuments/document';
import {
  IndexError,
  SHEET_A1_MAX,
  type Item,
  type SheetListing,
  type SheetRangeRead,
} from '@liveworkspace/index-client';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { SearchInput } from '@liveworkspace/workbench/components/primitives/SearchInput';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { readSheetLink } from '@/hooks/canvas/useSheetLinkedCharts';

// Spec constants (blueprints/data-charts.md): how long typing settles before the preview reads, and how many plans
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
  | { state: 'ready'; read: SheetRangeRead }
  | { state: 'refused'; message: string };

// Why a preview could not be read, in words.
function previewRefusal(err: unknown): string {
  if (err instanceof IndexError) {
    if (err.code === 'invalid_range') return 'That is not a range. Type one like A1:C8.';
    if (err.code === 'range_gone') return 'That range is outside the sheet.';
    if (err.status === 404) return 'This sheet cannot be opened any more.';
  }
  return "Couldn't read the sheet. Try again in a moment.";
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
const LABEL = 'text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400';

export function LinkSheetDialog({
  chart,
  documentId,
  onLink,
  onClose,
}: {
  chart: ShapeElement;
  documentId: string | null;
  onLink: (source: ChartSheetSource, read: SheetRangeRead) => void;
  onClose: () => void;
}) {
  const rangeId = useId();
  const rangeHintId = useId();
  const current = chart.chartSheetSource;
  const [query, setQuery] = useState('');
  const settledQuery = useSettled(query.trim(), LINK_PREVIEW_DEBOUNCE_MS);
  const [planId, setPlanId] = useState<string | null>(current?.itemId ?? null);
  const [sheetId, setSheetId] = useState<string | null>(current?.sheetId ?? null);
  const [a1, setA1] = useState(current?.a1 ?? '');
  const settledA1 = useSettled(a1.trim(), LINK_PREVIEW_DEBOUNCE_MS);
  const [linking, setLinking] = useState(false);
  // Each answer is kept with what it answered, so one for an older search, plan or range reads as still loading.
  const [plansFor, setPlansFor] = useState<Keyed<Load<Item[]>> | null>(null);
  const [sheetsFor, setSheetsFor] = useState<Keyed<Load<SheetListing[]>> | null>(null);
  const [previewFor, setPreviewFor] = useState<Keyed<Preview> | null>(null);

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
    if (!planId) return;
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
  }, [planId]);
  const sheets: Load<SheetListing[]> | null = !planId
    ? null
    : sheetsFor?.key === planId
      ? sheetsFor.value
      : { state: 'loading' };

  // What the chart will draw: the range read as it would be linked, a moment after typing stops.
  const previewKey = planId && sheetId && settledA1 ? `${planId}|${sheetId}|${settledA1}` : null;
  useEffect(() => {
    if (!planId || !sheetId || !settledA1 || !previewKey) return;
    const abort = new AbortController();
    indexClient
      .readSheetRange(planId, { sheetId, a1: settledA1 }, { signal: abort.signal })
      .then((read) => setPreviewFor({ key: previewKey, value: { state: 'ready', read } }))
      .catch((err: unknown) => {
        if (!abort.signal.aborted)
          setPreviewFor({
            key: previewKey,
            value: { state: 'refused', message: previewRefusal(err) },
          });
      });
    return () => abort.abort();
  }, [planId, sheetId, settledA1, previewKey]);
  const preview: Preview = !previewKey
    ? { state: 'idle' }
    : previewFor?.key === previewKey
      ? previewFor.value
      : { state: 'loading' };

  const pickSheet = (s: SheetListing) => {
    setSheetId(s.id);
    setA1(s.a1);
  };

  const ready = preview.state === 'ready' && settledA1 === a1.trim() ? preview.read : null;
  const empty = ready !== null && ready.table.categories.length === 0;

  // Link: the range read once more, asking the plan to say when the sheet changes, then kept with its values.
  const link = async () => {
    if (!ready || empty) return;
    setLinking(true);
    const source: ChartSheetSource = {
      app: 'liveplanner',
      itemId: ready.itemId,
      sheetId: ready.sheetId,
      range: ready.range,
      itemName: ready.itemName,
      sheetName: ready.sheetName,
      a1: ready.a1,
      readAt: ready.readAt,
    };
    const status = await readSheetLink(source, documentId);
    const read = status.kind === 'live' ? status.read : ready;
    onLink({ ...source, range: read.range, a1: read.a1, readAt: read.readAt }, read);
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
          description="Make a plan with a sheet in liveplanner, then link this chart to it."
        />
      )
    ) : (
      <ul className="flex flex-col gap-0.5" aria-label="Plans">
        {plans.value.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              aria-pressed={p.id === planId}
              onClick={() => setPlanId(p.id)}
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

  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel="Link to Sheet"
      size="xl"
      phoneSheet
      className="max-h-[90vh]"
    >
      <DialogHeader
        title="Link to Sheet"
        subtitle="Keep this chart in step with a sheet in one of your plans."
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
        <section className="flex min-w-0 flex-col gap-2">
          <h3 className={LABEL}>Plan</h3>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search your plans"
            ariaLabel="Search your plans"
            clearAriaLabel="Clear the search"
            clearDescription="Clear the plan search."
            size="row"
          />
          <div className="max-h-56 min-h-24 overflow-y-auto">{planList}</div>
        </section>
        <section className="flex min-w-0 flex-col gap-2">
          <h3 className={LABEL}>Sheet</h3>
          <div className="max-h-40 min-h-16 overflow-y-auto">{sheetList}</div>
          <label htmlFor={rangeId} className={`${LABEL} mt-1`}>
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
            {chart.shape === 'pie-chart' ? 'slice' : chart.shape === 'line-chart' ? 'point' : 'bar'}
            .
          </p>
        </section>
        <section className="flex min-w-0 flex-col gap-2 sm:col-span-2" aria-live="polite">
          <h3 className={LABEL}>Preview</h3>
          <PreviewTable preview={preview} empty={empty} />
        </section>
      </div>
      <DialogFooter>
        <p className="mr-auto hidden text-xs text-slate-500 sm:block dark:text-slate-400">
          The values are saved in the document, so people who can't open the plan still see them.
        </p>
        <Button variant="secondary" onClick={onClose} className="shrink-0">
          Cancel
        </Button>
        <Button
          onClick={() => void link()}
          disabled={!ready || empty || linking}
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

function PreviewTable({ preview, empty }: { preview: Preview; empty: boolean }) {
  const box =
    'flex min-h-28 items-center justify-center rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400';
  if (preview.state === 'idle')
    return <div className={box}>Pick a sheet and a range to see what the chart draws.</div>;
  if (preview.state === 'loading')
    return (
      <div className={`${box} animate-pulse motion-reduce:animate-none`}>Reading the sheet…</div>
    );
  if (preview.state === 'refused')
    return <div className={`${box} text-amber-700 dark:text-amber-300`}>{preview.message}</div>;
  if (empty)
    return (
      <div className={box}>Nothing to draw in this range. Pick one with labels and numbers.</div>
    );
  const { categories, series } = preview.read.table;
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
            {series.map((s, i) => (
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
              {series.map((s, i) => (
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
    </div>
  );
}
