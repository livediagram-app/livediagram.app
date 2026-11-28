'use client';

// Every Session tab's page frame (docs/specs/026-plan/session-tabs.md "The page"): drawn over the canvas area as a
// Dashboard's is (CanvasCover), the sidebar on the left (on a phone a fold-down queue under the header) and the card
// side on the right. Each kind's page (SessionPage's queue kinds, Stand-up's StandupPage) fills it.
import { useCallback, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { SessionKindId } from '@liveplanner/items';
import type { Tab } from '@liveplanner/project';
import { CANVAS_ROOT_SELECTOR } from '@liveworkspace/workbench/lib/canvas-selectors';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { CanvasCover } from '@/components/plan/CanvasCover';
import { DashboardMenuName } from '@/components/plan/dashboard/DashboardMenuName';
import { useCanvasLayerInsets } from '@/hooks/ui/useCanvasLayerInsets';

export function SessionFrame({
  tab,
  sessionKind,
  kindLabel,
  onRename,
  header,
  sidebar,
  detail,
  after,
}: {
  tab: Tab;
  sessionKind: SessionKindId;
  kindLabel: string;
  onRename?: ((name: string) => void) | undefined;
  header: ReactNode;
  // The queue, given how to fold a phone's queue away again (once a card is opened from it).
  sidebar: (fold: () => void) => ReactNode;
  // The card side: the card and its action bar, or Session Complete.
  detail: ReactNode;
  // Drawn outside the cover (Session Settings).
  after?: ReactNode;
}) {
  const [canvas, setCanvas] = useState<HTMLElement | null>(null);
  const mark = useCallback((node: HTMLElement | null) => {
    if (node) setCanvas(document.querySelector<HTMLElement>(CANVAS_ROOT_SELECTOR));
  }, []);
  const layout = useCanvasLayerInsets(canvas, false);
  const phone = useIsMobileViewport();
  const [queueOpen, setQueueOpen] = useState(false);
  const queue = sidebar(() => setQueueOpen(false));
  return (
    <>
      <span hidden ref={mark} />
      <DashboardMenuName tab={tab} kindLabel={kindLabel} onRename={onRename} />
      {canvas
        ? createPortal(
            <CanvasCover layout={layout} marker={{ 'data-session-page': '' }} enter opaque>
              <div
                role="region"
                aria-label={`${tab.name} session`}
                // The bottom padding clears the canvas's bottom toolbars (about 64 px with their margin), as a Dashboard's does,
                // so the action bar sits above them; on a phone also the home indicator's safe area.
                className="flex h-full min-h-0 bg-white pb-[4.5rem] max-sm:flex-col max-sm:pb-[calc(4.5rem+env(safe-area-inset-bottom))] xl:pb-0 dark:bg-slate-950"
                data-session-kind={sessionKind}
              >
                {phone ? (
                  <div className="flex shrink-0 flex-col border-b border-slate-200 dark:border-slate-800">
                    {header}
                    <button
                      type="button"
                      aria-expanded={queueOpen}
                      onClick={() => setQueueOpen((o) => !o)}
                      className="mx-4 mb-3 flex h-9 cursor-pointer items-center justify-between rounded-lg border border-slate-200 px-3 text-[13px] font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                    >
                      Queue
                      <span className="text-slate-500">{queueOpen ? 'Hide' : 'Show'}</span>
                    </button>
                    {queueOpen ? (
                      <div className="flex max-h-[40vh] min-h-0 flex-col">{queue}</div>
                    ) : null}
                  </div>
                ) : (
                  <aside
                    aria-label={`${kindLabel} queue`}
                    className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40"
                  >
                    {header}
                    {queue}
                  </aside>
                )}
                <section
                  aria-label="Card"
                  className="relative flex min-h-0 min-w-0 flex-1 flex-col"
                >
                  {detail}
                </section>
              </div>
            </CanvasCover>,
            canvas,
          )
        : null}
      {after}
    </>
  );
}
