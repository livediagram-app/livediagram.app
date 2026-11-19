'use client';

// Charts linked to a liveplanner sheet (each reader app's docs/specs/009-elements/pie-chart.md "Charts linked to a
// liveplanner sheet"): the editor's side, one copy for livedocuments, livediagram and livedesign. SheetLinksHost reads
// the open tab's linked charts (useSheetLinkedCharts) and hands the canvas and the element menu what each person
// sees, and the Link, Update and Unlink actions. Outside it (a thumbnail, an export, the read-only renderers) a linked
// chart draws its saved values and shows nothing more.
import { FLOATING_CONTROL_GAP, FLOATING_CONTROL_SIZE } from '../chrome/floating-controls';
import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { SheetLinkIcon } from '@liveworkspace/ui';
import type { ChartSheetSource } from '@liveworkspace/element-model/chart-sheet-source';
import { chartFieldsFromTable } from '@liveworkspace/element-model/chart-table';
import type { SheetRangeRead } from '@liveworkspace/index-client';
import { useCanvasZoom } from '../canvas/CanvasZoomContext';
import { useRelativeNow } from '../../lib/relative-now';
import { useSheetLinkedCharts, type SheetLinkGrantOf } from './useSheetLinkedCharts';
import {
  chartAsSeen,
  isChart,
  sheetLinkLine,
  type SheetChart,
  type SheetLinkElement,
  type SheetLinkStatus,
} from './sheet-links';

// Loaded on demand: only an Editor who opens it pays for it.
const LinkSheetDialog = lazy(() =>
  import('./LinkSheetDialog').then((m) => ({ default: m.LinkSheetDialog })),
);

// What the item is called in its product's words ("saved in the document", "saved in the canvas", "saved in the design").
export type SheetLinkNoun = 'document' | 'canvas' | 'design';

export type SheetLinks = {
  statusOf: (source: ChartSheetSource) => SheetLinkStatus;
  // An Editor on an unlocked item: Link to Sheet, Update and Unlink.
  canEdit: boolean;
  openLink: (elementId: string) => void;
  update: (source: ChartSheetSource) => void;
  unlink: (elementId: string) => void;
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
export type SheetLinkEvent = 'ChartSheetLink' | 'ChartSheetUnlink';

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
  const linking = linkingId
    ? elements.find((e): e is E & SheetChart => e.id === linkingId && isChart(e))
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
            if (e.id !== id || !isChart(e) || !e.chartSheetSource) return e;
            const { chartSheetSource: _gone, ...kept } = e;
            return kept as unknown as E;
          }),
        );
        onTrack('ChartSheetUnlink');
      },
      keepNumbers: (id) =>
        commit((els) => els.map((e) => (e.id === id && isChart(e) ? withoutPending(e) : e))),
    }),
    [statusOf, canEdit, update, commit, onTrack],
  );

  // A link made: the read's values and the link in one undo step, and that read kept as the chart's first. A chart not
  // linked yet loses that mark in the same step.
  const link = (id: string, source: ChartSheetSource, read: SheetRangeRead) => {
    commit((els) =>
      els.map((e) =>
        e.id === id && isChart(e)
          ? {
              ...withoutPending(e),
              ...chartFieldsFromTable(e, read.table),
              chartSheetSource: source,
            }
          : e,
      ),
    );
    seed(source, read);
    onTrack('ChartSheetLink');
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
              link(linking.id, source, read);
              setLinkingId(null);
            }}
            onClose={() => setLinkingId(null)}
          />
        </Suspense>
      ) : null}
    </SheetLinksContext.Provider>
  );
}

// The chart as this person sees it: a live read's values over the saved ones.
export function useChartAsSeen<E extends SheetLinkElement>(element: E): E {
  const links = useSheetLinks();
  if (!links || !isChart(element) || !element.chartSheetSource) return element;
  return chartAsSeen(element, links.statusOf(element.chartSheetSource));
}

// Screen pixels from the chart's bottom edge to the line: past the quick-connect plus the editors draw centred below a
// selected element (its gap plus its size), and 6 more, so the two never meet however narrow the chart.
export const SHEET_LINK_LINE_GAP = FLOATING_CONTROL_GAP + FLOATING_CONTROL_SIZE + 6;

const DOT: Record<'live' | 'quiet' | 'warn', string> = {
  live: 'bg-emerald-500',
  quiet: 'bg-slate-400 dark:bg-slate-500',
  warn: 'bg-amber-500',
};

// "Linked to Q3 Budget · updated 2 min ago" below a linked chart's bottom edge, left-aligned, while it is hovered or
// selected: clear of the selection toolbar above and of the quick-connect plus below (SHEET_LINK_LINE_GAP). It takes no
// pointer, so it never gets in the way of a drag.
export function SheetLinkLine({
  element,
  selected,
}: {
  element: SheetLinkElement;
  selected: boolean;
}) {
  const links = useSheetLinks();
  if (!links || !isChart(element) || !element.chartSheetSource) return null;
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
        Linked to{' '}
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
  );
}
