'use client';

// A Session tab's page (docs/specs/026-plan/session-tabs.md "The page"): drawn over the canvas area as a Dashboard's
// is (CanvasCover), the queue on the left (a fold-down list on a phone) and the room's card on the right with its
// action bar. Its state is the tab's `session`, so every screen shows the same card; the cards are the plan's own. A
// kind with a tally (Sprint Planning) adds its parts from ./planning: the tally under the progress bar, the Estimate
// strip above the action bar, an estimate pill on each row and its line on Session Complete. Bug Triage adds its parts
// from ./triage: the triage strip above the action bar, a priority pill on each row, and the close tray, which takes
// the action bar's place while a Close is asked its reason.
import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { estimateOf, itemStatus, sessionTally, typeIn, type Item } from '@liveplanner/items';
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
import { OUTCOME_LOOKS } from './session-kinds';
import { EstimatePill, EstimateStrip } from './planning/EstimateStrip';
import { PlanningSummary, PlanningTally } from './planning/PlanningTally';
import { commitMakes } from './planning/planning-words';
import { CloseTray } from './triage/CloseTray';
import { PriorityPill, TriageStrip } from './triage/TriageStrip';
import { decisionNote, undoLabel } from './session-words';

const estimatePill = (item: Item) => <EstimatePill item={item} />;
const priorityPill = (item: Item) => <PriorityPill item={item} />;

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
  const completeRef = useRef<HTMLButtonElement>(null);
  // The card the close tray is open for (Bug Triage's Close asking its reason), or none.
  const [closingId, setClosingId] = useState<string | null>(null);
  const triage = session.sessionKind === 'triage';
  const last = room.last;
  const undoLast = runs && last ? () => room.undo(last.itemId) : undefined;
  // Each of the kind's outcomes by its key; the completing one presses the fill button so its fill plays, the closing
  // one opens the close tray. U is Undo Last.
  const outcomeKeys: Record<string, () => void> = Object.fromEntries(
    kind.outcomes.map((o) => [
      OUTCOME_LOOKS[o].key,
      o === kind.completes
        ? () => completeRef.current?.click()
        : o === kind.closes
          ? () => setClosingId(room.current?.id ?? null)
          : () => room.decide(o),
    ]),
  );
  if (undoLast) outcomeKeys['u'] = undoLast;
  useSessionKeys({
    on: runs && !settingsOpen && !closingId && !!room.current,
    outcomes: outcomeKeys,
    next: room.next,
    previous: room.previous,
  });
  const decided = session.decided;
  const tallies = kind.tally === 'estimate';
  const tally = useMemo(
    () => (tallies ? sessionTally(room.list, decided) : null),
    [tallies, room.list, decided],
  );
  const capacity = session.setup.capacity;
  // What Commit would add: the room's card's estimate, while it is still to decide.
  const adding = room.current && !decided?.[room.current.id] ? estimateOf(room.current) : null;
  // A phone folds the queue away again once a card is opened from it.
  const open = (id: string) => {
    room.goTo(id);
    setQueueOpen(false);
  };
  const shown = room.shown;
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
      {tally ? <PlanningTally tally={tally} capacity={capacity} adding={adding} /> : null}
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
      aside={tallies ? estimatePill : triage ? priorityPill : undefined}
    />
  );
  const statusName = (id: string) => plan.statusNames.get(id) ?? id;
  const shownDecision = shown ? decided?.[shown.id] : undefined;
  const closing = !!shown && closingId === shown.id && !shownDecision && !room.peeking && runs;
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
      {tally ? (
        <EstimateStrip
          item={shown}
          type={typeIn(plan.types, shown.type)}
          canEdit={plan.canEditCards}
          preview={
            decided?.[shown.id] || room.peeking
              ? null
              : commitMakes(tally.points, estimateOf(shown) ?? 0, capacity)
          }
          onSet={(points) =>
            void plan.patchItem(
              shown.id,
              points === null ? { clear: ['estimate'] } : { set: { estimate: points } },
            )
          }
        />
      ) : null}
      {/* The close tray asks only its reason: the strip steps aside while it is open. */}
      {triage && !closing ? (
        <TriageStrip
          item={shown}
          type={typeIn(plan.types, shown.type)}
          canEdit={plan.canEditCards}
          onSet={(field, value) =>
            void plan.patchItem(
              shown.id,
              value === null ? { clear: [field] } : { set: { [field]: value } },
            )
          }
        />
      ) : null}
      {room.peeking ? null : closing ? (
        <CloseTray
          key={shown.id}
          item={shown}
          items={plan.items}
          types={plan.types}
          targetName={(duplicate) => {
            const to = room.closeTarget(shown, duplicate);
            return to ? statusName(to) : null;
          }}
          statusName={statusName(itemStatus(shown)!)}
          onCancel={() => setClosingId(null)}
          onConfirm={(input) => {
            setClosingId(null);
            room.decide('closed', input);
          }}
        />
      ) : (
        <SessionActionBar
          sessionKind={session.sessionKind}
          item={shown}
          decision={shownDecision}
          note={shownDecision ? decisionNote(shownDecision, plan.items, plan.types) : null}
          last={
            undoLast && last
              ? {
                  label: undoLabel(last.itemId, last.decision, plan.items, plan.types),
                  onUndo: undoLast,
                }
              : null
          }
          onCloseOpen={kind.closes ? () => setClosingId(shown.id) : undefined}
          runs={runs}
          holderName={holderName}
          targetName={(() => {
            const to = room.target(shown);
            return to ? statusName(to) : null;
          })()}
          // A card the room is on is queued, so in one of the picked stages; a peeked one hides the bar.
          statusName={statusName(itemStatus(shown)!)}
          timebox={timebox}
          completeRef={completeRef}
          onDecide={room.decide}
          onUndo={() => room.undo(shown.id)}
        />
      )}
    </>
  ) : (
    <SessionComplete
      outcomes={kind.outcomes}
      summary={tally ? <PlanningSummary tally={tally} capacity={capacity} /> : null}
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
