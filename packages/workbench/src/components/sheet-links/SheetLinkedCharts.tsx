'use client';

// Charts and tables with live data from a liveplanner plan (each reader app's docs/specs/009-elements/pie-chart.md
// "Live data from a plan", liveworkspace/docs/specs/004-index/live-data.md): the editor's side, one copy for every
// reader app. SheetLinksHost reads the open tab's linked elements (useSheetLinkedCharts) and hands the canvas and the
// element menu what each person sees, and the From a Plan, Update, Freeze, Unfreeze and Unlink actions. Outside it (a
// thumbnail, an export, the read-only renderers) a linked element draws its saved values and shows nothing more.
import { FLOATING_CONTROL_GAP, FLOATING_CONTROL_SIZE } from '../chrome/floating-controls';
import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { SheetLinkIcon } from '@liveworkspace/ui';
import {
  sourceKindOf,
  type ChartSheetSource,
} from '@liveworkspace/element-model/chart-sheet-source';
import { useCanvasZoom } from '../canvas/CanvasZoomContext';
import { liveEmbedItemHref } from '../live-embed/live-embed-target';
import { useRelativeNow } from '../../lib/relative-now';
import { useSheetLinkedCharts, type SheetLinkGrantOf } from './useSheetLinkedCharts';
import {
  chartAsSeen,
  isChart,
  isLinkable,
  isLiveTable,
  liveFields,
  sheetLinkLine,
  type Linkable,
  type LiveRead,
  type SheetChart,
  type SheetLinkElement,
  type SheetLinkStatus,
  type SheetLinkTone,
} from './sheet-links';

// Loaded on demand: only an Editor who opens it pays for it.
const LinkSheetDialog = lazy(() =>
  import('./LinkSheetDialog').then((m) => ({ default: m.LinkSheetDialog })),
);

// What the item is called in its product's words ("saved in the document", "saved in the canvas", "saved in the design").
export type SheetLinkNoun = 'document' | 'canvas' | 'design';

export type SheetLinks = {
  statusOf: (source: ChartSheetSource) => SheetLinkStatus;
  // An Editor on an unlocked item: From a Plan, Update, Freeze, Unfreeze and Unlink.
  canEdit: boolean;
  openLink: (elementId: string) => void;
  update: (source: ChartSheetSource) => void;
  unlink: (elementId: string) => void;
  // Freeze keeps the numbers and stops reading; Unfreeze reads again (live-data.md "The element").
  freeze: (elementId: string) => void;
  unfreeze: (elementId: string) => void;
  // The plan in liveplanner, for Open Plan.
  planHref: (source: ChartSheetSource) => string;
  // A chart not linked yet: its sample numbers kept as its own, the mark dropped (pie-chart.md "Not linked yet").
  keepNumbers: (elementId: string) => void;
};

// The chart with its not-linked-yet mark dropped, or the same chart when it has none.
function withoutPending<E extends SheetLinkElement>(e: E): E {
  if (!('chartSheetPending' in e)) return e;
  const { chartSheetPending: _gone, ...kept } = e as E & SheetChart;
  return kept as unknown as E;
}

export const SheetLinksContext = createContext<SheetLinks | null>(null);

export const useSheetLinks = (): SheetLinks | null => useContext(SheetLinksContext);

// The telemetry types a link sends (`Element·Changed·<type>`), through the product's own `track`.
export type SheetLinkEvent =
  | 'ChartSheetLink'
  | 'ChartBoardLink'
  | 'ChartMetricLink'
  | 'TableLiveLink'
  | 'ChartSheetUnlink'
  | 'LiveDataFreeze'
  | 'LiveDataUnfreeze';

// The event a new link sends: a table's whatever its source, a chart's by its source's kind.
export function linkEventOf(el: Linkable, source: ChartSheetSource): SheetLinkEvent {
  if (isLiveTable(el)) return 'TableLiveLink';
  const kind = sourceKindOf(source);
  return kind === 'board'
    ? 'ChartBoardLink'
    : kind === 'metric'
      ? 'ChartMetricLink'
      : 'ChartSheetLink';
}

// The element with its link marked frozen, or no longer frozen.
function withFrozen<E extends SheetLinkElement>(e: E, frozen: boolean): E {
  const source = (e as { chartSheetSource?: ChartSheetSource }).chartSheetSource;
  if (!source || !!source.frozen === frozen) return e;
  const { frozen: _was, ...rest } = source;
  return { ...e, chartSheetSource: frozen ? { ...rest, frozen: true } : rest };
}

export function SheetLinksHost<E extends SheetLinkElement>({
  elements,
  itemId,
  canEdit,
  commit,
  tick,
  grantOf,
  ready,
  onTrack,
  noun,
  children,
}: {
  elements: readonly E[];
  // The reader item's id: its grant asks the plan to say when a Sheet changes.
  itemId: string | null;
  canEdit: boolean;
  commit: (map: (els: E[]) => E[]) => void;
  tick: (map: (els: E[]) => E[]) => void;
  grantOf: SheetLinkGrantOf;
  // Sign-in has answered and the item has loaded: the first reads wait for it (useSheetLinkedCharts).
  ready: boolean;
  onTrack: (event: SheetLinkEvent) => void;
  noun: SheetLinkNoun;
  children: ReactNode;
}) {
  const { statusOf, update, seed } = useSheetLinkedCharts({
    elements,
    itemId,
    canSave: canEdit,
    tick,
    grantOf,
    ready,
  });
  const [linkingId, setLinkingId] = useState<string | null>(null);
  // The elements as they are now, for Unfreeze, without remaking the actions on every edit.
  const elementsNow = useRef(elements);
  useEffect(() => {
    elementsNow.current = elements;
  });
  const linking = linkingId
    ? elements.find((e): e is E & Linkable => e.id === linkingId && isLinkable(e))
    : undefined;

  const value = useMemo<SheetLinks>(
    () => ({
      statusOf,
      canEdit,
      openLink: (id) => setLinkingId(id),
      update,
      unlink: (id) => {
        commit((els) =>
          els.map((e) => {
            if (e.id !== id || !isLinkable(e) || !e.chartSheetSource) return e;
            const { chartSheetSource: _gone, ...kept } = e;
            return kept as unknown as E;
          }),
        );
        onTrack('ChartSheetUnlink');
      },
      freeze: (id) => {
        commit((els) => els.map((e) => (e.id === id ? withFrozen(e, true) : e)));
        onTrack('LiveDataFreeze');
      },
      unfreeze: (id) => {
        const el = elementsNow.current.find((e) => e.id === id);
        const was = el && isLinkable(el) ? el.chartSheetSource : undefined;
        if (!was?.frozen) return;
        commit((els) => els.map((e) => (e.id === id ? withFrozen(e, false) : e)));
        // Read again now: the numbers kept while frozen may be days old.
        const { frozen: _was, ...source } = was;
        update(source);
        onTrack('LiveDataUnfreeze');
      },
      planHref: (source) => liveEmbedItemHref('liveplanner', source.itemId, window.location.host),
      keepNumbers: (id) =>
        commit((els) => els.map((e) => (e.id === id && isChart(e) ? withoutPending(e) : e))),
    }),
    [statusOf, canEdit, update, commit, onTrack],
  );

  // A link made: the read's values and the link in one undo step, and that read kept as the element's first. A chart
  // not linked yet loses that mark in the same step.
  const link = (el: E & Linkable, source: ChartSheetSource, read: LiveRead) => {
    commit((els) =>
      els.map((e) => {
        if (e.id !== el.id || !isLinkable(e)) return e;
        const linked = { ...withoutPending(e), chartSheetSource: source } as E & Linkable;
        return { ...linked, ...liveFields(linked, read.table) };
      }),
    );
    seed(source, read);
    onTrack(linkEventOf(el, source));
  };

  return (
    <SheetLinksContext.Provider value={value}>
      {children}
      {linking && canEdit ? (
        <Suspense fallback={null}>
          <LinkSheetDialog
            chart={linking}
            itemId={itemId}
            grantOf={grantOf}
            noun={noun}
            onLink={(source, read) => {
              link(linking, source, read);
              setLinkingId(null);
            }}
            onClose={() => setLinkingId(null)}
          />
        </Suspense>
      ) : null}
    </SheetLinksContext.Provider>
  );
}

// A table on the canvas with live data from a plan (live-data.md "Tables"): the read's cells over the saved ones, read
// only while it is linked (a read would write over a typed cell), and its live line. Mounted for tables alone, so no
// other element subscribes to the links.
export function LiveTableFace<E extends SheetLinkElement>({
  element,
  selected,
  children,
}: {
  element: E;
  selected: boolean;
  children: (seen: E, linked: boolean) => ReactNode;
}) {
  const seen = useChartAsSeen(element);
  const linked = (element as { chartSheetSource?: unknown }).chartSheetSource !== undefined;
  return (
    <>
      {children(seen, linked)}
      <SheetLinkLine element={element} selected={selected} />
    </>
  );
}

// The chart or table as this person sees it: a live read's values over the saved ones.
export function useChartAsSeen<E extends SheetLinkElement>(element: E): E {
  const links = useSheetLinks();
  if (!links || !isLinkable(element) || !element.chartSheetSource) return element;
  return chartAsSeen(element, links.statusOf(element.chartSheetSource));
}

// Screen pixels from the chart's bottom edge to the line: past the quick-connect plus the editors draw centred below a
// selected element (its gap plus its size), and 6 more, so the two never meet however narrow the chart.
export const SHEET_LINK_LINE_GAP = FLOATING_CONTROL_GAP + FLOATING_CONTROL_SIZE + 6;

const DOT: Record<SheetLinkTone, string> = {
  live: 'bg-emerald-500',
  quiet: 'bg-slate-400 dark:bg-slate-500',
  warn: 'bg-amber-500',
};

// "Live from Launch Plan · updated 2 min ago" below a linked chart's or table's bottom edge, left-aligned, while it is
// hovered or selected: clear of the selection toolbar above and of the quick-connect plus below (SHEET_LINK_LINE_GAP).
// A small live dot at its top-right corner shows whether or not it is hovered. Neither takes a pointer, so neither ever
// gets in the way of a drag.
export function SheetLinkLine({
  element,
  selected,
}: {
  element: SheetLinkElement;
  selected: boolean;
}) {
  const links = useSheetLinks();
  if (!links || !isLinkable(element) || !element.chartSheetSource) return null;
  return (
    <SheetLinkPill
      source={element.chartSheetSource}
      status={links.statusOf(element.chartSheetSource)}
      selected={selected}
    />
  );
}

// The line itself, mounted only for a linked chart, so only those follow the zoom. It is counter-scaled (1/zoom) like
// the canvas's other chrome, so it reads at one size on screen at any zoom; a long plan name truncates past 20rem, the
// freshness always shows.
function SheetLinkPill({
  source,
  status,
  selected,
}: {
  source: ChartSheetSource;
  status: SheetLinkStatus | undefined;
  selected: boolean;
}) {
  const now = useRelativeNow();
  const zoom = useCanvasZoom();
  const line = sheetLinkLine(source, status, now);
  return (
    <>
      <LiveMark tone={line.tone} zoom={zoom} />
      <div
        data-sheet-link-line
        style={{
          transform: `scale(${1 / zoom})`,
          transformOrigin: 'top left',
          marginTop: SHEET_LINK_LINE_GAP / zoom,
        }}
        className={`pointer-events-none absolute top-full left-0 z-10 flex max-w-80 items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 py-0.5 pr-2.5 pl-1.5 text-[11px] leading-4 whitespace-nowrap text-slate-600 shadow-sm transition-opacity duration-150 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-300 ${
          selected ? 'opacity-100' : 'opacity-0 group-hover/el:opacity-100'
        }`}
      >
        <span className="relative flex h-4 w-4 shrink-0 items-center justify-center text-slate-500 dark:text-slate-400">
          <SheetLinkIcon size={12} />
          <span
            aria-hidden
            className={`absolute -right-0.5 -bottom-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-white dark:ring-slate-900 ${DOT[line.tone]}`}
          />
        </span>
        <span className="min-w-0 truncate">
          {line.lead}{' '}
          <span className="font-medium text-slate-800 dark:text-slate-100">{line.name}</span>
        </span>
        <span aria-hidden className="text-slate-300 dark:text-slate-600">
          ·
        </span>
        <span
          className={`shrink-0 ${line.tone === 'warn' ? 'text-amber-700 dark:text-amber-300' : ''}`}
        >
          {line.detail}
        </span>
      </div>
    </>
  );
}

// The small live mark at a linked element's top-right corner, always shown: a dot in the line's tone (green while the
// numbers are live). Still, so a page of linked charts costs no animation. Counter-scaled like the line.
function LiveMark({ tone, zoom }: { tone: SheetLinkTone; zoom: number }) {
  return (
    <span
      aria-hidden
      data-live-mark={tone}
      style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'top right' }}
      className="pointer-events-none absolute -top-1 -right-1 z-10 flex h-2.5 w-2.5"
    >
      <span
        className={`inline-flex h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${DOT[tone]}`}
      />
    </span>
  );
}
