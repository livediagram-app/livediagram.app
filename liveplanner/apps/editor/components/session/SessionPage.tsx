'use client';

// A Session tab's page (docs/specs/026-plan/session-tabs.md "The page"): drawn over the canvas area as a Dashboard's
// is (CanvasCover), the queue on the left (a fold-down list on a phone) and the room's card on the right with its
// action bar. Its state is the tab's `session`, so every screen shows the same card; the cards are the plan's own.
import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { itemStatus } from '@liveplanner/items';
import {
  SESSION_KINDS,
  type SessionFacilitator,
  type SessionTabState,
  type Tab,
} from '@liveplanner/project';
import { lucideSettings } from '@liveworkspace/icons/lucide';
import { Tooltip, lucideGlyph } from '@liveplanner/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { CANVAS_ROOT_SELECTOR } from '@liveworkspace/workbench/lib/canvas-selectors';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { CanvasCover } from '@/components/plan/CanvasCover';
import { DashboardMenuName } from '@/components/plan/dashboard/DashboardMenuName';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import type { SessionTabActions } from '@/hooks/plan/useSessionTabActions';
import { useCanvasLayerInsets } from '@/hooks/ui/useCanvasLayerInsets';
import type { Participant } from '@/lib/identity';
import { SessionActionBar } from './SessionActionBar';
import { SessionCard } from './SessionCard';
import { SessionComplete } from './SessionComplete';
import { SessionFacilitatorChip } from './SessionFacilitatorChip';
import { SessionProgress } from './SessionProgress';
import { SessionSetupDialog } from './SessionSetupDialog';
import { SessionSidebar } from './SessionSidebar';
import { setupWords } from './session-setup';
import { useSessionFacilitator } from './useSessionFacilitator';
import { useSessionKeys } from './useSessionKeys';
import { useSessionRun } from './useSessionRun';
import { useSessionTimebox } from './useSessionTimebox';

const SettingsIcon = lucideGlyph(lucideSettings, 16);

export function SessionPage({
  tab,
  session,
  plan,
  mayEdit,
  actions,
  self,
  presence,
  renameTab,
}: {
  tab: Tab;
  session: SessionTabState;
  plan: PlanContextValue;
  // An Editor on an unlocked tab: may hold the baton and change the set-up.
  mayEdit: boolean;
  actions: SessionTabActions;
  self: SessionFacilitator;
  presence: readonly Participant[];
  renameTab?: ((tabId: string, name: string) => void) | undefined;
}) {
  const [canvas, setCanvas] = useState<HTMLElement | null>(null);
  const mark = useCallback((node: HTMLElement | null) => {
    if (node) setCanvas(document.querySelector<HTMLElement>(CANVAS_ROOT_SELECTOR));
  }, []);
  const layout = useCanvasLayerInsets(canvas, false);
  const phone = useIsMobileViewport();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const kind = SESSION_KINDS[session.sessionKind];
  const baton = useSessionFacilitator({
    tabId: tab.id,
    session,
    self,
    mayHold: mayEdit,
    presence,
    run: actions.runSession,
  });
  const runs = mayEdit && baton.mine;
  const room = useSessionRun({
    tabId: tab.id,
    session,
    plan,
    runs,
    selfName: self.name,
    run: actions.runSession,
  });
  const timebox = useSessionTimebox(session);
  const refineRef = useRef<HTMLButtonElement>(null);
  useSessionKeys({
    on: runs && !settingsOpen && !!room.current,
    refine: () => refineRef.current?.click(),
    skip: () => room.decide('skipped'),
    flag: () => room.decide('flagged'),
    next: room.next,
    previous: room.previous,
  });
  // A phone folds the queue away again once a card is opened from it.
  const open = (id: string) => {
    room.goTo(id);
    setQueueOpen(false);
  };
  const shown = room.shown;
  const decided = session.decided;
  const total = room.list.length;
  // How far through: the room's card's place, or the end once none is left.
  const place = room.current ? room.list.indexOf(room.current) + 1 : total;
  const holderName = baton.holder ? (baton.mine ? 'You' : baton.holder.name) : null;
  const header = (
    <div className="flex flex-col gap-2.5 px-4 pb-3 pt-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-slate-900 dark:text-slate-50">
            {kind.label}
            <span className="ml-2 text-[13px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
              {total ? `${place} of ${total}` : ''}
            </span>
          </h2>
          <p className="truncate text-[12px] text-slate-500 dark:text-slate-400">
            {timebox?.up ? 'Time’s up' : setupWords(session.setup, plan.types, plan.statusNames)}
          </p>
        </div>
        {mayEdit ? (
          <Tooltip label="Session Settings">
            <button
              type="button"
              aria-label="Session Settings"
              onClick={() => setSettingsOpen(true)}
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <SettingsIcon aria-hidden />
            </button>
          </Tooltip>
        ) : null}
      </div>
      <SessionFacilitatorChip baton={baton} />
      <SessionProgress
        label={kind.label}
        list={room.list}
        decided={decided}
        currentId={room.current?.id ?? null}
        timebox={timebox}
      />
      {room.queue.capped ? (
        <p className="text-[11px] text-slate-500">Showing the first {total} cards.</p>
      ) : null}
    </div>
  );
  const sidebar = (
    <SessionSidebar
      label={kind.label}
      list={room.list}
      types={plan.types}
      decided={decided}
      currentId={room.current?.id ?? null}
      shownId={shown?.id ?? null}
      onOpen={open}
    />
  );
  const statusName = (id: string) => plan.statusNames.get(id) ?? id;
  const detail = shown ? (
    <>
      {room.peeking ? (
        <Callout
          tone="warning"
          role="status"
          className="m-3 mb-0"
          action={{
            label: `Back to ${holderName && holderName !== 'You' ? `${holderName}’s` : 'the Room’s'} Card`,
            onSelect: room.backToRoom,
          }}
        >
          You are looking at another card.
        </Callout>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col" data-session-card={shown.id}>
        <SessionCard plan={plan} item={shown} />
      </div>
      {room.peeking ? null : (
        <SessionActionBar
          item={shown}
          decision={decided?.[shown.id]}
          runs={runs}
          holderName={holderName}
          targetName={(() => {
            const to = room.target(shown);
            return to ? statusName(to) : null;
          })()}
          // A card the room is on is queued, so in one of the picked stages; a peeked one hides the bar.
          statusName={statusName(itemStatus(shown)!)}
          timebox={timebox}
          refineRef={refineRef}
          onDecide={room.decide}
          onUndo={() => room.undo(shown.id)}
        />
      )}
    </>
  ) : (
    <SessionComplete
      empty={total === 0}
      decided={decided}
      runs={runs}
      onReviewSkipped={(() => {
        const skipped = room.queue.decided.find((i) => decided?.[i.id]?.outcome === 'skipped');
        return skipped ? () => room.goTo(skipped.id) : null;
      })()}
      onStartAgain={room.startAgain}
      onSettings={mayEdit ? () => setSettingsOpen(true) : undefined}
    />
  );
  return (
    <>
      <span hidden ref={mark} />
      <DashboardMenuName
        tab={tab}
        kindLabel={kind.label}
        onRename={mayEdit && renameTab ? (name) => renameTab(tab.id, name) : undefined}
      />
      {canvas
        ? createPortal(
            <CanvasCover layout={layout} marker={{ 'data-session-page': '' }} enter opaque>
              <div
                role="region"
                aria-label={`${tab.name} session`}
                // The bottom padding clears the canvas's bottom toolbars (about 64 px with their margin), as a Dashboard's does,
                // so the action bar sits above them; on a phone also the home indicator's safe area.
                className="flex h-full min-h-0 bg-white pb-[4.5rem] max-sm:flex-col max-sm:pb-[calc(4.5rem+env(safe-area-inset-bottom))] xl:pb-0 dark:bg-slate-950"
                data-session-kind={session.sessionKind}
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
                      <div className="flex max-h-[40vh] min-h-0 flex-col">{sidebar}</div>
                    ) : null}
                  </div>
                ) : (
                  <aside
                    aria-label={`${kind.label} queue`}
                    className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40"
                  >
                    {header}
                    {sidebar}
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
      {settingsOpen ? (
        <SessionSetupDialog
          sessionKind={session.sessionKind}
          initial={session.setup}
          plan={plan}
          settings
          onDone={(setup) => {
            actions.changeSetup(setup);
            setSettingsOpen(false);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </>
  );
}
