'use client';

// What a Dashboard slot draws (docs/specs/026-plan/plan-tabs.md "Dashboard tab"): a Board or Sheet tab compact and
// live, a plan view or a chart from a Sheet at the slot's size (the element keeps its stored size; the slot lends it
// its own), or a note.
import { useEffect, useRef, useState, type RefObject } from 'react';
import { isChartShape, type DashboardContent } from '@livepages/document';
import { PlanViewView } from '@/components/plan/views/PlanViewView';
import { PlanBoardView } from '@/components/plan/PlanBoardView';
import { PlanSheetView } from '@/components/sheets/PlanSheetView';
import { useDashboard } from './dashboard-context';
import { DashboardTabPreview } from './DashboardTabPreview';
import { DashboardNote } from './DashboardNote';
import { DashboardTitle } from './DashboardTitle';
import { DashboardStatusCard } from './DashboardStatusCard';
import { DashboardChecklistCard } from './DashboardChecklistCard';
import { DashboardKeyDateCard } from './DashboardKeyDateCard';
import { DashboardLinksCard } from './DashboardLinksCard';
import { DashboardSheetMetric } from './DashboardSheetMetric';
import { DashboardFormMetric } from './DashboardFormMetric';
import { DashboardSheetChart } from './DashboardSheetChart';

// The box's size, kept as it changes (the row resized, the window).
export function useBoxSize(
  ref: RefObject<HTMLElement | null>,
): { width: number; height: number } | null {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () =>
      setSize((prev) =>
        prev && prev.width === el.clientWidth && prev.height === el.clientHeight
          ? prev
          : { width: el.clientWidth, height: el.clientHeight },
      );
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

export function Missing({ message, slotId }: { message: string; slotId: string }) {
  const { canEdit, actions } = useDashboard();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center text-[13px] text-slate-500 dark:text-slate-400">
      {message}
      {canEdit ? (
        <button
          type="button"
          onClick={() => actions.setSlotContent(slotId, undefined)}
          className="cursor-pointer rounded-md border border-slate-200 px-2.5 py-1 text-[12px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Clear Slot
        </button>
      ) : null}
    </div>
  );
}

function SlotElement({ slotId, elementId }: { slotId: string; elementId: string }) {
  const { elements } = useDashboard();
  const ref = useRef<HTMLDivElement>(null);
  const size = useBoxSize(ref);
  const el = elements.get(elementId);
  const shape = el?.type === 'shape' ? el : null;
  // The slot's size is the element's: a view, board or Sheet lays itself out at its element's size, worked on in
  // place (a board's changes are its own, usePlanSlice commitOn).
  const sized =
    shape && size ? { ...shape, x: 0, y: 0, width: size.width, height: size.height } : null;
  return (
    <div ref={ref} className="relative h-full w-full">
      {!shape ? (
        <Missing message="This item was removed." slotId={slotId} />
      ) : !sized ? null : shape.shape === 'plan-view' ? (
        <PlanViewView element={sized} />
      ) : shape.shape === 'plan-board' ? (
        <div className="absolute inset-0">
          <PlanBoardView element={sized} />
        </div>
      ) : shape.shape === 'plan-sheet' ? (
        <div className="absolute inset-0">
          <PlanSheetView element={sized} />
        </div>
      ) : isChartShape(shape.shape) && shape.chartSource ? (
        <DashboardSheetChart element={sized} />
      ) : (
        <Missing message="This item was removed." slotId={slotId} />
      )}
    </div>
  );
}

export function DashboardSlotContent({
  slotId,
  content,
}: {
  slotId: string;
  content: DashboardContent;
}) {
  switch (content.type) {
    case 'tab':
      return <DashboardTabPreview slotId={slotId} tabId={content.tabId} of={content.of} />;
    case 'element':
      return <SlotElement slotId={slotId} elementId={content.elementId} />;
    case 'note':
      return <DashboardNote slotId={slotId} note={content} />;
    case 'title':
      return <DashboardTitle slotId={slotId} title={content} />;
    case 'status':
      return <DashboardStatusCard slotId={slotId} status={content} />;
    case 'checklist':
      return <DashboardChecklistCard slotId={slotId} checklist={content} />;
    case 'key-date':
      return <DashboardKeyDateCard slotId={slotId} keyDate={content} />;
    case 'links':
      return <DashboardLinksCard slotId={slotId} links={content} />;
    case 'sheet-metric':
      return <DashboardSheetMetric slotId={slotId} content={content} />;
    case 'form-metric':
      return <DashboardFormMetric slotId={slotId} content={content} />;
  }
}
