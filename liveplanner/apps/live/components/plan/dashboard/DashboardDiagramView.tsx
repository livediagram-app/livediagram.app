'use client';

// A Diagram tab in a Dashboard slot (docs/specs/026-plan/plan-tabs.md "Dashboard tab"): the tab's drawing, live and
// still, fitted to the slot under a header of the tab's icon and name (and the slot's cog). It follows every change to
// the tab (an edit, a collaborator's), drawn as the split view's other pane draws a tab (useTabSvg). Pressing it opens
// the tab. The drawing's renderer is the export one, loaded only once a Diagram slot is shown.
import dynamic from 'next/dynamic';
import { tabHasDrawing, type Tab } from '@liveplanner/document';
import { TabModeIcon } from '@/components/chrome/editor-mode/TabModeIcon';
import { useDashboard } from './dashboard-context';
import { useSlotSettings } from './slot-menu';
import { TabWaiting } from './TabWaiting';

const DiagramImage = dynamic(
  () => import('./DashboardDiagramImage').then((m) => m.DashboardDiagramImage),
  {
    ssr: false,
    loading: () => <DrawingPlaceholder />,
  },
);

function DrawingPlaceholder() {
  return (
    <div
      aria-hidden
      className="h-full w-full animate-pulse rounded-lg bg-slate-100/60 dark:bg-slate-800/40"
    />
  );
}

export function DashboardDiagramView({
  tab,
  status,
  onRetry,
}: {
  tab: Tab;
  status: 'loaded' | 'failed' | 'loading';
  onRetry: () => void;
}) {
  const { openTab } = useDashboard();
  const slot = useSlotSettings();
  // Waiting while its content is on its way (a Pages tab has its page before then), then while there is nothing to draw.
  const empty = !tabHasDrawing(tab) || (status !== 'loaded' && tab.elements.length === 0);
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-900/[0.07] bg-white/[0.72] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.22)] dark:border-white/[0.08] dark:bg-slate-900/60">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-slate-900/[0.06] pl-3.5 pr-1.5 dark:border-white/[0.06]">
        <TabModeIcon tab={tab} style={{ color: 'currentColor' }} />
        <h3 className="min-w-0 flex-1 truncate text-[14px] font-semibold text-slate-800 dark:text-slate-100">
          {tab.name}
        </h3>
        {slot?.cog}
      </div>
      <div className="relative min-h-0 flex-1">
        {empty ? (
          <TabWaiting name={tab.name} status={status} onRetry={onRetry} />
        ) : (
          <button
            type="button"
            aria-label={`Open ${tab.name}`}
            onClick={() => openTab(tab.id)}
            className="absolute inset-0 cursor-pointer p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
          >
            <DiagramImage tab={tab} />
          </button>
        )}
      </div>
    </div>
  );
}
