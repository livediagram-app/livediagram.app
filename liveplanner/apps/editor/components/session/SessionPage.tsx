'use client';

// A Session tab's page (docs/specs/026-plan/session-tabs.md "The page"): drawn over the canvas area as a Dashboard's
// is (CanvasCover), the queue on the left (a fold-down list on a phone) and the room's card on the right with its
// action bar. Its state is the tab's `session`, so every screen shows the same card; the cards are the plan's own. A
// kind with a tally (Sprint Planning) adds its parts from ./planning: the tally under the progress bar, the Estimate
// strip above the action bar, an estimate pill on each row and its line on Session Complete. Bug Triage adds its parts
// from ./triage: a priority pill on each row and the Close dialog, which asks a Close its reason (priority and
// severity are set in the card's own Details). Sprint Review adds its parts from ./review (useReviewParts): the demo
// strip over the card, the feedback strip above the action bar, Follow-up and its dialog, a presenter disc on each row
// and its feedback and follow-ups on Session Complete.
import { useMemo, useRef, useState } from 'react';
import { estimateOf, itemStatus, sessionTally, typeIn, type Item } from '@liveplanner/items';
import {
  SESSION_KINDS,
  type SessionFacilitator,
  type SessionTabState,
  type Tab,
} from '@liveplanner/project';
import { Callout } from '@liveworkspace/ui/callout';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import type { SessionTabActions } from '@/hooks/plan/useSessionTabActions';
import type { Participant } from '@/lib/identity';
import { SessionActionBar } from './SessionActionBar';
import { SessionCard } from './SessionCard';
import { SessionComplete } from './SessionComplete';
import { SessionFrame } from './SessionFrame';
import { SessionHeader } from './SessionHeader';
import { SessionProgress } from './SessionProgress';
import { SessionSetupDialog } from './SessionSetupDialog';
import { SessionSidebar } from './SessionSidebar';
import { setupWords } from './session-setup';
import { useSessionFacilitator } from './useSessionFacilitator';
import { useSessionKeys } from './useSessionKeys';
import { useSessionRun } from './useSessionRun';
import { useSessionTimebox } from './useSessionTimebox';
import { OUTCOME_LOOKS, SESSION_KIND_LOOKS } from './session-kinds';
import { EstimatePill, EstimateStrip } from './planning/EstimateStrip';
import { PlanningSummary, PlanningTally } from './planning/PlanningTally';
import { commitMakes } from './planning/planning-words';
import { CloseDialog } from './triage/CloseDialog';
import { PriorityPill } from './triage/PriorityPill';
import { decisionNote, undoLabel } from './session-words';
import { reviewedAt } from './review/review-range';
import { useReviewParts } from './review/useReviewParts';
import { StandupPage } from './standup/StandupPage';

const estimatePill = (item: Item) => <EstimatePill item={item} />;
const priorityPill = (item: Item) => <PriorityPill item={item} />;

export type SessionPageProps = {
  tab: Tab;
  session: SessionTabState;
  plan: PlanContextValue;
  // An Editor on an unlocked tab: may hold the baton and change the set-up.
  mayEdit: boolean;
  actions: SessionTabActions;
  self: SessionFacilitator;
  presence: readonly Participant[];
  renameTab?: ((tabId: string, name: string) => void) | undefined;
};

// A Session tab's page: Stand-up's, whose unit is a person (./standup), or a queue of cards for every other kind.
export function SessionPage(props: SessionPageProps) {
  return SESSION_KINDS[props.session.sessionKind].grouping === 'person' ? (
    <StandupPage {...props} />
  ) : (
    <QueueSessionPage {...props} />
  );
}

function QueueSessionPage({
  tab,
  session,
  plan,
  mayEdit,
  actions,
  self,
  presence,
  renameTab,
}: SessionPageProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const review = useReviewParts({
    on: session.sessionKind === 'review',
    tabId: tab.id,
    session,
    plan,
    runs,
    run: actions.runSession,
    shown: room.shown,
    peeking: room.peeking,
    list: room.list,
    // A queued card opens in the room; a follow-up on its board's panel.
    onOpen: (id) => (room.list.some((i) => i.id === id) ? room.goTo(id) : plan.openItem(id)),
  });
  const completeRef = useRef<HTMLButtonElement>(null);
  // The card the Close dialog is open for (Bug Triage's Close asking its reason), or none.
  const [closingId, setClosingId] = useState<string | null>(null);
  const triage = session.sessionKind === 'triage';
  const last = room.last;
  const undoLast = runs && last ? () => room.undo(last.itemId) : undefined;
  // Each of the kind's outcomes by its key; the completing one presses the fill button so its fill plays, the closing
  // one opens the Close dialog. U is Undo Last.
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
  if (review) Object.assign(outcomeKeys, review.keys);
  useSessionKeys({
    // On Session Complete only U (Undo Last) is live: there is no card to decide.
    on: runs && !settingsOpen && !closingId && !review?.following && (!!room.current || !!undoLast),
    outcomes: room.current ? outcomeKeys : undoLast ? { u: undoLast } : {},
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
  const shown = room.shown;
  const total = room.list.length;
  // How far through: the room's card's place, or the end once none is left.
  const place = room.current ? room.list.indexOf(room.current) + 1 : total;
  const holderName = baton.holder ? (baton.mine ? 'You' : baton.holder.name) : null;
  const header = (
    <SessionHeader
      label={kind.label}
      count={total ? `${place} of ${total}` : ''}
      line={timebox?.up ? 'Time’s up' : setupWords(session.setup, plan.types, plan.statusNames)}
      baton={baton}
      help={SESSION_KIND_LOOKS[session.sessionKind].helpArticle}
      onSettings={mayEdit ? () => setSettingsOpen(true) : undefined}
    >
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
    </SessionHeader>
  );
  // A phone folds the queue away again once a card is opened from it.
  const sidebar = (fold: () => void) => (
    <SessionSidebar
      label={kind.label}
      list={room.list}
      types={plan.types}
      decided={decided}
      currentId={room.current?.id ?? null}
      shownId={shown?.id ?? null}
      onOpen={(id) => {
        room.goTo(id);
        fold();
      }}
      aside={tallies ? estimatePill : triage ? priorityPill : review?.aside}
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
      {review?.demo}
      <div className="flex min-h-0 flex-1 flex-col" data-session-card={shown.id}>
        <SessionCard plan={plan} item={shown} />
      </div>
      {review?.feedback}
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
      {room.peeking ? null : (
        <SessionActionBar
          sessionKind={session.sessionKind}
          item={shown}
          decision={shownDecision}
          note={
            shownDecision
              ? [decisionNote(shownDecision, plan.items, plan.types), review?.note(shown.id)]
                  .filter(Boolean)
                  .join(' · ') || null
              : null
          }
          extra={review?.extra}
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
      {review?.dialog}
      {closing ? (
        <CloseDialog
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
      ) : null}
    </>
  ) : (
    <SessionComplete
      outcomes={kind.outcomes}
      summary={
        tally ? <PlanningSummary tally={tally} capacity={capacity} /> : (review?.summary ?? null)
      }
      empty={total === 0}
      decided={decided}
      runs={runs}
      last={
        undoLast && last
          ? {
              label: undoLabel(last.itemId, last.decision, plan.items, plan.types),
              onUndo: undoLast,
            }
          : null
      }
      onReviewSkipped={(() => {
        const skipped = room.queue.decided.find((i) => decided?.[i.id]?.outcome === 'skipped');
        return skipped ? () => room.goTo(skipped.id) : null;
      })()}
      onStartAgain={room.startAgain}
      onSettings={mayEdit ? () => setSettingsOpen(true) : undefined}
    />
  );
  return (
    <SessionFrame
      tab={tab}
      sessionKind={session.sessionKind}
      kindLabel={kind.label}
      onRename={mayEdit && renameTab ? (name) => renameTab(tab.id, name) : undefined}
      header={header}
      sidebar={sidebar}
      detail={detail}
      after={
        settingsOpen ? (
          <SessionSetupDialog
            sessionKind={session.sessionKind}
            initial={session.setup}
            plan={plan}
            settings
            lastReviewAt={review ? reviewedAt(plan, tab.id) : null}
            onDone={(setup) => {
              actions.changeSetup(setup);
              setSettingsOpen(false);
            }}
            onClose={() => setSettingsOpen(false)}
          />
        ) : null
      }
    />
  );
}
