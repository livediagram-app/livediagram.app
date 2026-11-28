'use client';

// A Stand-up session's page (docs/specs/026-plan/session-tabs.md "Stand-up"): every kind's frame, header, card,
// timebox, facilitator and Session Complete, with the person as its unit: the sidebar grouped by person, the progress
// bar over people, the comment strip and Stand-up's action bar (Blocked, Stage, Done) under the card, the Blocked
// dialog, and the blockers on Session Complete.
import { useMemo, useRef, useState } from 'react';
import { cardRefOrKey, isFlagged, itemStatus, typeIn, typeStatusesOf } from '@liveplanner/items';
import { SESSION_KINDS, sessionStep } from '@liveplanner/project';
import { Callout } from '@liveworkspace/ui/callout';
import { FeedbackStrip } from '../review/FeedbackStrip';
import { SessionCard } from '../SessionCard';
import { SessionComplete } from '../SessionComplete';
import { SessionFrame } from '../SessionFrame';
import { SessionHeader } from '../SessionHeader';
import type { SessionPageProps } from '../SessionPage';
import { SessionProgress } from '../SessionProgress';
import { SessionSetupDialog } from '../SessionSetupDialog';
import { setupWords } from '../session-setup';
import { refOf, undoLabel } from '../session-words';
import { useSessionFacilitator } from '../useSessionFacilitator';
import { useSessionKeys } from '../useSessionKeys';
import { useSessionTimebox } from '../useSessionTimebox';
import { BlockedDialog } from './BlockedDialog';
import { BlockersSummary } from './BlockersSummary';
import { BLOCKED_KEY, DONE_KEY, StandupActionBar } from './StandupActionBar';
import { StandupSidebar } from './StandupSidebar';
import { COMMENT_WORDS, personLine, personName } from './standup-words';
import { useStandupRun } from './useStandupRun';

export function StandupPage({
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
  const [blocking, setBlocking] = useState<string | null>(null);
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
  const room = useStandupRun({
    tabId: tab.id,
    session,
    plan,
    runs,
    selfName: self.name,
    run: actions.runSession,
  });
  const timebox = useSessionTimebox(session);
  const doneRef = useRef<HTMLButtonElement>(null);
  const decided = session.decided;
  const { current, shown, people } = room;
  const person = people.find((p) => p.key === room.currentKey) ?? null;
  const last = room.last;
  const lastLabel = !last
    ? null
    : last.kind === 'person'
      ? `Done ${personName(people.find((p) => p.key === last.key)?.person ?? null)}`
      : sessionStep(last.decision).from
        ? `Moved ${refOf(last.itemId, plan.items, plan.types)}`
        : undoLabel(last.itemId, last.decision, plan.items, plan.types);
  const undoLast = runs && last && lastLabel ? { label: lastLabel, onUndo: room.undoLast } : null;
  const onCard = !!current && !room.peeking && shown?.id === current.id;
  const keys: Record<string, () => void> = {};
  if (onCard && person && !room.isDone(person.key)) keys[DONE_KEY] = () => doneRef.current?.click();
  if (onCard && current && !isFlagged(current)) keys[BLOCKED_KEY] = () => setBlocking(current.id);
  if (undoLast) keys['u'] = undoLast.onUndo;
  useSessionKeys({
    on: runs && !settingsOpen && !blocking,
    outcomes: keys,
    next: room.next,
    previous: room.previous,
  });
  // The progress bar's units: the people, a Done one decided.
  const units = useMemo(() => people.map((p) => ({ id: p.key })), [people]);
  const doneUnits = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(session.peopleDone ?? {}).map((k) => [k, { outcome: 'discussed' as const }]),
      ),
    [session.peopleDone],
  );
  const doneCount = people.filter((p) => room.isDone(p.key)).length;
  const place = person ? people.indexOf(person) + 1 : doneCount;
  const holderName = baton.holder ? (baton.mine ? 'You' : baton.holder.name) : null;
  const header = (
    <SessionHeader
      label={kind.label}
      count={people.length ? `${place} of ${people.length} people` : ''}
      line={timebox?.up ? 'Time’s up' : setupWords(session.setup, plan.types, plan.statusNames)}
      baton={baton}
      onSettings={mayEdit ? () => setSettingsOpen(true) : undefined}
    >
      <SessionProgress
        label={kind.label}
        list={units}
        decided={doneUnits}
        currentId={room.currentKey}
        timebox={timebox}
        noun="people done"
      />
      {room.queue.capped ? (
        <p className="text-[11px] text-slate-500">Showing the first {room.list.length} cards.</p>
      ) : null}
    </SessionHeader>
  );
  const sidebar = (fold: () => void) => (
    <StandupSidebar
      label={kind.label}
      people={people}
      types={plan.types}
      statusNames={plan.statusNames}
      decided={decided}
      isDone={room.isDone}
      currentId={current?.id ?? null}
      currentKey={room.currentKey}
      shownId={shown?.id ?? null}
      onOpen={(id) => {
        room.goTo(id);
        fold();
      }}
    />
  );
  const statusName = (id: string) => plan.statusNames.get(id) ?? id;
  const planStatuses = [...plan.statusNames.keys()];
  const shownRef = shown ? cardRefOrKey(shown, plan.types) : '';
  const detail = shown ? (
    <>
      {room.peeking ? (
        <Callout
          tone="warning"
          role="status"
          className="m-3 mb-0"
          action={{
            label: room.allDone
              ? 'Back to Summary'
              : `Back to ${holderName && holderName !== 'You' ? `${holderName}’s` : 'the Room’s'} Card`,
            onSelect: room.backToRoom,
          }}
        >
          You are looking at another card.
        </Callout>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col" data-session-card={shown.id}>
        <SessionCard plan={plan} item={shown} />
      </div>
      <FeedbackStrip
        key={`comment:${shown.id}`}
        cardRef={shownRef}
        canAdd={room.canComment}
        words={COMMENT_WORDS}
        onAdd={(text) => room.addNote(shown.id, text)}
      />
      {room.peeking || !person || !current ? null : (
        <StandupActionBar
          runs={runs}
          holderName={holderName}
          name={personName(person.person)}
          line={personLine(
            personName(person.person),
            person.cards.indexOf(current) + 1,
            person.cards.length,
            decided?.[current.id]?.outcome === 'flagged' ? decided[current.id]!.reason : undefined,
          )}
          cardRef={shownRef}
          flagged={isFlagged(current)}
          stage={itemStatus(current) ?? ''}
          stages={typeStatusesOf(typeIn(plan.types, current.type), planStatuses)}
          statusName={statusName}
          doneBy={session.peopleDone?.[person.key]?.by ?? null}
          timebox={timebox}
          last={undoLast}
          completeRef={doneRef}
          onBlocked={() => setBlocking(current.id)}
          onStage={room.moveStage}
          onDone={room.done}
          onUndoDone={() => room.undoPerson(person.key)}
        />
      )}
      {blocking && current && blocking === current.id && runs && !room.peeking ? (
        <BlockedDialog
          key={`blocked:${current.id}`}
          item={current}
          cardRef={shownRef}
          onCancel={() => setBlocking(null)}
          onConfirm={(reason) => {
            setBlocking(null);
            room.block(reason);
          }}
        />
      ) : null}
    </>
  ) : (
    <SessionComplete
      outcomes={kind.outcomes}
      summary={
        <BlockersSummary
          decided={decided}
          items={plan.items}
          types={plan.types}
          onOpen={room.goTo}
        />
      }
      empty={room.list.length === 0}
      decided={decided}
      runs={runs}
      last={undoLast}
      onReviewSkipped={null}
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
