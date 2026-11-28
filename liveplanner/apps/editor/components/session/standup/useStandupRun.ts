'use client';

// Running a Stand-up (docs/specs/026-plan/session-tabs.md "Stand-up"): the queue read live as every kind's, in board
// order and held, grouped into people; the room's card and so its person; and the facilitator's Done (Discussed on
// each of the person's cards, the room on to the next person), Blocked (the flag, its reason as a comment, Flagged),
// Stage (the card moved, kept so Undo takes it back) and Undo Last. The comment strip is anyone's who may comment.
// The timebox is per person: moving between one person's cards keeps the clock running.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  boardOrder,
  isFlagged,
  itemStatus,
  itemTitle,
  personKeyOf,
  sessionQueue,
  standupPeople,
  standupSeed,
  type Item,
  type StandupPerson,
} from '@liveplanner/items';
import {
  lastStandupStep,
  withCurrent,
  withNoDecisions,
  withOutcome,
  withPersonDone,
  sessionStep,
  withoutPersonDone,
  withoutStep,
  type SessionTabState,
} from '@liveplanner/project';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import { useCardThreadsContext } from '@/components/plan/threads/CardThreadsContext';
import { track } from '@/lib/telemetry';
import { recordOutcome, undoDecision } from '../session-writes';
import { heldOrder } from '../useSessionRun';
import { blockedComment, personName, standupThreadOf, standupThreadTitle } from './standup-words';

export type StandupRun = ReturnType<typeof useStandupRun>;

export function useStandupRun({
  tabId,
  session,
  plan,
  runs,
  selfName,
  run,
}: {
  tabId: string;
  session: SessionTabState;
  plan: PlanContextValue;
  // Whether this screen holds the baton and may run the session.
  runs: boolean;
  selfName: string;
  run: (tabId: string, change: (s: SessionTabState) => SessionTabState) => void;
}) {
  const { items, types } = plan;
  const { setup, decided, currentId, peopleDone } = session;
  const threads = useCardThreadsContext();
  const planStatuses = useMemo(() => [...plan.statusNames.keys()], [plan.statusNames]);
  const queue = useMemo(
    () => sessionQueue({ items: items.values(), types, pick: setup, decided }),
    [items, types, setup, decided],
  );
  // Every card in board order, held as this screen first queued it (a flagged or moved card keeps its place).
  const held = useMemo(
    () => heldOrder(tabId, setup, boardOrder([...queue.decided, ...queue.toGo], planStatuses)),
    [tabId, setup, queue, planStatuses],
  );
  // Shuffled Daily's seed: the day this screen opened the session (UTC), so the order never reshuffles mid-session.
  const [seed] = useState(() => standupSeed(tabId, Date.now()));
  const people = useMemo(
    () => standupPeople(held, { order: setup.personOrder, seed }),
    [held, setup.personOrder, seed],
  );
  // The cards as J and K walk them: person by person.
  const list = useMemo(() => people.flatMap((p) => p.cards), [people]);
  const isDone = (key: string) => !!peopleDone?.[key];
  const allDone = people.length > 0 && people.every((p) => isDone(p.key));
  const firstUp = people.find((p) => !isDone(p.key))?.cards[0] ?? null;
  // The room's card: the one the tab names while queued, else the first card of the first person not Done, else none.
  const current: Item | null = allDone
    ? null
    : ((currentId ? list.find((i) => i.id === currentId) : undefined) ?? firstUp);
  const currentKey = current ? personKeyOf(current) : null;
  const personOf = (key: string | null): StandupPerson | null =>
    people.find((p) => p.key === key) ?? null;
  // This screen's own look at another card (a peek): never the room's.
  const [peekId, setPeekId] = useState<string | null>(null);
  const peek = peekId && peekId !== current?.id ? (items.get(peekId) ?? null) : null;
  const shown = peek ?? current;

  // The facilitator's screen settles the room on a real card when the tab names none still queued.
  const settledId = current?.id ?? null;
  const settledKey = currentKey;
  useEffect(() => {
    if (!runs || settledId === (currentId ?? null)) return;
    run(tabId, (s) => {
      const was = s.currentId ? items.get(s.currentId) : undefined;
      const same = !!was && personKeyOf(was) === settledKey;
      return withCurrent(s, settledId, Date.now(), same);
    });
  }, [runs, settledId, settledKey, currentId, run, tabId, items]);

  const goTo = useCallback(
    (itemId: string) => {
      // Once everyone is Done, a card opens as a look on this screen alone.
      if (!runs || allDone) {
        setPeekId(itemId);
        return;
      }
      setPeekId(null);
      const card = items.get(itemId);
      const same = !!card && personKeyOf(card) === currentKey;
      run(tabId, (s) => (s.currentId === itemId ? s : withCurrent(s, itemId, Date.now(), same)));
    },
    [runs, allDone, items, currentKey, run, tabId],
  );

  const step = (by: 1 | -1) => {
    if (!runs || !current) return;
    const at = list.findIndex((i) => i.id === current.id);
    const next = list[Math.min(list.length - 1, Math.max(0, at + by))];
    if (next && next.id !== current.id) goTo(next.id);
  };

  // A comment on `itemId` in the day's stand-up thread (a reply when it is open, else a new one); whether it was kept.
  const addNote = useCallback(
    async (itemId: string, raw: string): Promise<boolean> => {
      const text = raw.trim();
      if (!threads?.canComment || !text) return false;
      const title = standupThreadTitle(Date.now());
      const open = standupThreadOf(threads.threads.threadsOf(itemId), title);
      const out = await threads.threads.act(
        open ? { kind: 'reply', threadId: open.id, text } : { kind: 'start', itemId, text, title },
      );
      if (out === false) {
        debugLog('[session] comment.failed', { itemId });
        return false;
      }
      plan.announce('Comment added');
      return true;
    },
    [threads, plan],
  );

  // Done: each of the room's person's cards not decided yet recorded Discussed, the person kept as Done, and the room
  // on to the first card of the next person not Done (wrapping), else complete.
  const done = () => {
    const person = personOf(currentKey);
    if (!runs || !person || isDone(person.key)) return;
    const at = people.indexOf(person);
    const after = [...people.slice(at + 1), ...people.slice(0, at)];
    const next = after.find((p) => !isDone(p.key)) ?? null;
    const ids = person.cards.map((c) => c.id);
    for (const id of ids) if (!decided?.[id]) recordOutcome(plan, 'standup', id, 'discussed');
    const nextId = next?.cards[0]?.id ?? null;
    run(tabId, (s) => withPersonDone(s, person.key, selfName, Date.now(), ids, nextId));
    const who = personName(person.person);
    plan.announce(
      next ? `${who} done. Next: ${personName(next.person)}` : `${who} done. Stand-up complete`,
    );
    track('Plan', 'Used', 'SessionDiscussed');
  };

  // Blocked: the room's card flagged (when not already), its reason a comment in the day's thread, Flagged kept with
  // the reason; the room stays on the card.
  const block = (reason: string) => {
    const item = current;
    const why = reason.trim();
    if (!runs || !item || !why) return;
    const flagSet = !isFlagged(item);
    if (flagSet) void plan.patchItem(item.id, { set: { flagged: true } });
    void addNote(item.id, blockedComment(why));
    recordOutcome(plan, 'standup', item.id, 'flagged', { reason: why });
    run(tabId, (s) =>
      withOutcome(s, item.id, 'flagged', selfName, Date.now(), {
        reason: why,
        ...(flagSet ? { flagSet: true as const } : {}),
      }),
    );
    plan.announce(`Blocked: ${itemTitle(item)}`);
    track('Plan', 'Used', 'SessionFlagged');
  };

  // Stage: the room's card moved to `to` (the column's end), its own step so Undo takes back the move alone; a card
  // not decided yet is recorded Discussed, so it stays in the queue whatever its new stage.
  const moveStage = (to: string) => {
    const item = current;
    const from = item ? itemStatus(item) : undefined;
    if (!runs || !item || !from || to === from) return;
    plan.moveItem(item.id, { status: to, before: null });
    const had = decided?.[item.id];
    if (!had) recordOutcome(plan, 'standup', item.id, 'discussed');
    run(tabId, (s) =>
      withOutcome(s, item.id, had?.outcome ?? 'discussed', had?.by ?? selfName, Date.now(), {
        from,
        to,
        fromRank: item.rank,
      }),
    );
    plan.announce(`Moved to ${plan.statusNames.get(to) ?? to}`);
  };

  // Undo of a person's Done: no longer Done, the Discussed it recorded taken back, the room on their first card.
  const undoPerson = (key: string) => {
    const was = peopleDone?.[key];
    if (!runs || !was) return;
    const { cleared } = withoutPersonDone(session, key);
    for (const id of cleared) recordOutcome(plan, 'standup', id, 'discussed', { undone: true });
    const first = personOf(key)?.cards[0]?.id ?? null;
    run(tabId, (s) => withCurrent(withoutPersonDone(s, key).state, first, Date.now()));
    setPeekId(null);
    plan.announce('Done undone');
    track('Plan', 'Used', 'SessionUndone');
  };

  // Undo Last: the newest Done, Blocked or Stage move taken back, one step at a time (a Stage move after a Blocked
  // takes back the move, and the next Undo the flag).
  const last = lastStandupStep(session);
  const undoLast = () => {
    if (!runs || !last) return;
    if (last.kind === 'person') {
      undoPerson(last.key);
      return;
    }
    const { itemId, decision } = last;
    const step = sessionStep(decision);
    const moveOnly = !!decision.prior && !!step.from && !step.flagSet;
    undoDecision(plan, 'standup', itemId, step, !moveOnly);
    const card = items.get(itemId);
    const same = !!card && personKeyOf(card) === currentKey;
    run(tabId, (s) => withCurrent(withoutStep(s, itemId), itemId, Date.now(), same));
    setPeekId(null);
    plan.announce(`${step.from ? 'Move' : 'Blocked'} undone`);
    track('Plan', 'Used', 'SessionUndone');
  };

  const startAgain = () => {
    if (runs) run(tabId, withNoDecisions);
  };

  return {
    queue,
    people,
    list,
    current,
    currentKey,
    shown,
    peeking: !!peek,
    backToRoom: () => setPeekId(null),
    allDone,
    isDone,
    goTo,
    next: () => step(1),
    previous: () => step(-1),
    done,
    block,
    moveStage,
    addNote,
    canComment: !!threads?.canComment,
    undoPerson,
    last,
    undoLast,
    startAgain,
  };
}
