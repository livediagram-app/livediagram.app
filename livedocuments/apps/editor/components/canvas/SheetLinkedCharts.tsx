'use client';

// Charts linked to a liveplanner sheet (docs/specs/009-elements/pie-chart.md "Charts linked to a liveplanner sheet";
// blueprints/data-charts.md "Linked to a sheet"): the editor's side. SheetLinksHost reads the open tab's linked charts
// (useSheetLinkedCharts) and hands the canvas and the element menu what each person sees, and the Link, Update and
// Unlink actions. Outside it (a thumbnail, an export, the read-only renderers) a linked chart draws its saved values
// and shows nothing more.
import dynamic from 'next/dynamic';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { SheetLinkIcon } from '@livedocuments/ui';
import { useCanvasZoom } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';
import {
  chartFieldsFromTable,
  type ChartSheetSource,
  type Element,
  type ShapeElement,
} from '@livedocuments/document';
import type { SheetRangeRead } from '@liveworkspace/index-client';
import { useSheetLinkedCharts } from '@/hooks/canvas/useSheetLinkedCharts';
import { useRelativeNow } from '@/lib/relative-time';
import { chartAsSeen, sheetLinkLine, type SheetLinkStatus } from '@/lib/sheet-links';
import { track } from '@/lib/telemetry';

const LinkSheetDialog = dynamic(
  () => import('@/components/dialogs/LinkSheetDialog').then((m) => m.LinkSheetDialog),
  { ssr: false },
);

export type SheetLinks = {
  statusOf: (source: ChartSheetSource) => SheetLinkStatus;
  // An Editor on an unlocked document: Link to Sheet, Update and Unlink.
  canEdit: boolean;
  openLink: (elementId: string) => void;
  update: (source: ChartSheetSource) => void;
  unlink: (elementId: string) => void;
};

export const SheetLinksContext = createContext<SheetLinks | null>(null);

export const useSheetLinks = (): SheetLinks | null => useContext(SheetLinksContext);

export function SheetLinksHost({
  elements,
  documentId,
  canEdit,
  commit,
  tick,
  children,
}: {
  elements: readonly Element[];
  documentId: string | null;
  canEdit: boolean;
  commit: (map: (els: Element[]) => Element[]) => void;
  tick: (map: (els: Element[]) => Element[]) => void;
  children: ReactNode;
}) {
  const { statusOf, update, seed } = useSheetLinkedCharts({
    elements,
    documentId,
    canSave: canEdit,
    tick,
  });
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const linking = linkingId
    ? elements.find((e): e is ShapeElement => e.id === linkingId && e.type === 'shape')
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
            if (e.id !== id || e.type !== 'shape' || !e.chartSheetSource) return e;
            const { chartSheetSource: _gone, ...kept } = e;
            return kept;
          }),
        );
        track('Element', 'Changed', 'ChartSheetUnlink');
      },
    }),
    [statusOf, canEdit, update, commit],
  );

  // A link made: the read's values and the link in one undo step, and that read kept as the chart's first.
  const link = (id: string, source: ChartSheetSource, read: SheetRangeRead) => {
    commit((els) =>
      els.map((e) =>
        e.id === id && e.type === 'shape'
          ? { ...e, ...chartFieldsFromTable(e, read.table), chartSheetSource: source }
          : e,
      ),
    );
    seed(source, read);
    track('Element', 'Changed', 'ChartSheetLink');
  };

  return (
    <SheetLinksContext.Provider value={value}>
      {children}
      {linking && canEdit ? (
        <LinkSheetDialog
          chart={linking}
          documentId={documentId}
          onLink={(source, read) => {
            link(linking.id, source, read);
            setLinkingId(null);
          }}
          onClose={() => setLinkingId(null)}
        />
      ) : null}
    </SheetLinksContext.Provider>
  );
}

// The chart as this person sees it: a live read's values over the saved ones.
export function useChartAsSeen(element: Element): Element {
  const links = useSheetLinks();
  if (!links || element.type !== 'shape' || !element.chartSheetSource) return element;
  return chartAsSeen(element, links.statusOf(element.chartSheetSource));
}

const DOT: Record<'live' | 'quiet' | 'warn', string> = {
  live: 'bg-emerald-500',
  quiet: 'bg-slate-400 dark:bg-slate-500',
  warn: 'bg-amber-500',
};

// "Linked to Q3 Budget · updated 2 min ago" just above a linked chart's top edge, while it is hovered or selected. It
// takes no pointer, so it never gets in the way of a drag.
export function SheetLinkLine({ element, selected }: { element: Element; selected: boolean }) {
  const links = useSheetLinks();
  if (!links || element.type !== 'shape' || !element.chartSheetSource) return null;
  return (
    <SheetLinkPill
      source={element.chartSheetSource}
      status={links.statusOf(element.chartSheetSource)}
      selected={selected}
    />
  );
}

// The line itself, mounted only for a linked chart, so only those follow the zoom. It is counter-scaled (1/zoom) like
// the canvas's other chrome, so it reads at one size on screen at any zoom; a long plan name truncates past 20rem, the freshness always shows.
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
        transformOrigin: 'bottom left',
        marginBottom: 6 / zoom,
      }}
      className={`pointer-events-none absolute bottom-full left-0 z-10 flex max-w-80 items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 py-0.5 pr-2.5 pl-1.5 text-[11px] leading-4 whitespace-nowrap text-slate-600 shadow-sm transition-opacity duration-150 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-300 ${
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
