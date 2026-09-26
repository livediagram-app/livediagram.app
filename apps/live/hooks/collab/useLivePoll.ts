'use client';

// Live poll (spec/88): the ephemeral pulse-check. Everything here is
// MEMORY-ONLY by design — no tab field, no commitTabs, no autosave, no
// change-log line, nothing that could reach D1. The poll exists as three
// room ops and the state below, and dies with the last client holding it.
//
// The inbound half lives in useRoomConnection (which owns the socket); it
// writes through the setters this hook returns. The outbound half is here.

import { useCallback, useRef, useState } from 'react';
import {
  pollSupersedes,
  sanitisePoll,
  sanitisePollAnswer,
  type LivePoll,
  type RoomOutgoing,
} from '@livediagram/api-schema';
import { pollStyleUsesRoster } from '@livediagram/diagram';
import { pollCollaboratorOptions, type PollCandidate } from '@/lib/poll-collaborators';
import { track } from '@/lib/telemetry';

type RoomHandle = { send: (msg: RoomOutgoing) => void };

// One participant's answer, keyed by the room's sender id. The key is used
// ONLY to make a person changing their mind replace their earlier answer;
// it is never rendered (spec/88 — results carry no identity).
export type PollAnswers = Map<string, string | null>;

export function useLivePoll(deps: {
  roomRef: React.RefObject<RoomHandle | null>;
  // The people currently in the diagram, for a `collaborators` poll (spec/88).
  // A ref for the same reason as `sessionBlockedRef` below — the roster changes
  // constantly and is only ever read at the instant a poll starts — and because
  // reading it here is what lets BOTH poll surfaces (the Studio composer and a
  // Session button, spec/105) get the substitution without either knowing about
  // it. Optional so a caller that never starts a roster poll can omit it.
  collaboratorsRef?: React.RefObject<readonly PollCandidate[]>;
  // Live "somebody else is facilitating" (spec/149). A ref because the poll
  // hook is created before the facilitator hook (which needs the room, which
  // needs this), and the value is only ever read at press time.
  sessionBlockedRef?: React.RefObject<boolean>;
  // Our collab key (spec/152); see `selfKey` below.
  selfKeyRef?: React.RefObject<string>;
}) {
  const { roomRef, sessionBlockedRef, collaboratorsRef, selfKeyRef } = deps;
  // Our collab key (spec/152): what our own answer is keyed by, and how a poll
  // we started is known as ours after a refresh. Read at call time: identity
  // hydrates after this hook, and its handlers must stay stable.
  const selfKey = useCallback(() => selfKeyRef?.current || 'self', [selfKeyRef]);
  const [poll, setPoll] = useState<LivePoll | null>(null);
  const [answers, setAnswers] = useState<PollAnswers>(() => new Map());
  // Have we responded yet? Answering or skipping both count, and both
  // unlock the results panel. null = not responded.
  const [myAnswer, setMyAnswer] = useState<{ value: string | null } | null>(null);
  // Local-only hide, so a participant isn't stuck with a panel when the
  // host disconnects without ending the poll.
  const [dismissed, setDismissed] = useState(false);
  // Which poll id we opened, if any. A ref rather than state because
  // nothing renders off it directly — `isHost` below derives it. Being the
  // host is local-only: it decides who sees the host controls (End poll /
  // copy), is deliberately not on the wire since no peer needs to know,
  // and a reload drops the whole poll anyway.
  const hostedPollRef = useRef<string | null>(null);
  // Mirror of `poll` for the handlers below. They need to READ the current
  // poll (to drop ops for a poll we don't have) while also writing other
  // state; doing that inside a setPoll updater would make the updater
  // impure and double-fire under StrictMode.
  const pollRef = useRef<LivePoll | null>(null);
  // The poll id we have already counted a response to (Tab·Voted·Poll,
  // spec/22). A participant can change their answer, and the room replaces
  // it, so the card counts people who responded, not presses: a change of
  // mind is not a second response.
  const countedPollRef = useRef<string | null>(null);
  const setActivePoll = useCallback((next: LivePoll | null) => {
    pollRef.current = next;
    setPoll(next);
  }, []);

  // Wipe every trace of a poll locally. Used by both end paths (ours and
  // a peer's poll-end) so a stale answer set can never bleed into the
  // next poll.
  const clearPoll = useCallback(() => {
    setActivePoll(null);
    setAnswers(new Map());
    setMyAnswer(null);
    setDismissed(false);
    hostedPollRef.current = null;
  }, [setActivePoll]);

  // A poll arrived from a peer (or we opened our own). Replaces whatever
  // was on screen — one poll at a time per diagram, like one timer per tab.
  const openPoll = useCallback(
    (next: LivePoll) => {
      setActivePoll(next);
      setAnswers(new Map());
      setMyAnswer(null);
      setDismissed(false);
    },
    [setActivePoll],
  );

  const receivePoll = useCallback(
    (incoming: LivePoll) => {
      const clean = sanitisePoll(incoming);
      // A malformed poll (no question, a choice poll with one option) is
      // dropped rather than rendered — see sanitisePoll.
      if (!clean) return;
      // The poll already on screen (the room replays it to every session on
      // hello, spec/152): keep its answers. And when two polls start at once,
      // the rule the room and every peer share picks the one we stay on;
      // otherwise the starter of one ends up answering the other.
      if (!pollSupersedes(clean, pollRef.current)) return;
      hostedPollRef.current = clean.hostKey && clean.hostKey === selfKey() ? clean.id : null;
      openPoll(clean);
    },
    [openPoll, selfKey],
  );

  // One participant answered. Keyed by WHO answered (their collab key), so
  // re-answering replaces their earlier answer instead of stacking a second
  // one, including across a reconnect, which mints a new presence id (spec/152).
  // The sender id is only the fallback for a client too old to send a key.
  const receiveAnswer = useCallback(
    (from: string, pollId: string, value: string | null, key?: string) => {
      const current = pollRef.current;
      // Ignore an answer for a poll we don't have, or a stale one aimed at a
      // poll that's already been replaced.
      if (!current || current.id !== pollId) return;
      const clean = sanitisePollAnswer(current, value);
      const who = key ?? from;
      setAnswers((prev) => new Map(prev).set(who, clean));
      // Our own answer, coming back in the room's replay after a refresh.
      if (who === selfKey()) setMyAnswer({ value: clean });
    },
    [selfKey],
  );

  const receivePollEnd = useCallback(
    (pollId: string) => {
      const current = pollRef.current;
      if (!current || current.id !== pollId) return;
      clearPoll();
    },
    [clearPoll],
  );

  const startPoll = useCallback(
    (draft: Omit<LivePoll, 'id' | 'startedAt'>) => {
      // Somebody else is facilitating (spec/149), so the room would refuse the
      // op anyway: the room gates `poll-start` / `poll-end` itself, because
      // unlike the timer they are their own op kinds. This keeps the local
      // panel from opening on a frame that is going to be dropped.
      if (sessionBlockedRef?.current) return;
      // A roster poll's answers are the room, resolved HERE rather than by
      // either composer: a Session button is configured long before the room it
      // runs in exists, and the Studio's own list would be a second copy to
      // keep in step. `sanitisePoll` then applies the same floor and cap it
      // applies to a written list, so a poll with fewer than two people in the
      // room is refused exactly like a one-answer `choice` poll.
      const options = pollStyleUsesRoster(draft.style)
        ? pollCollaboratorOptions(collaboratorsRef?.current ?? [])
        : draft.options;
      const next = sanitisePoll({
        ...draft,
        options,
        id: crypto.randomUUID(),
        startedAt: Date.now(),
        hostKey: selfKey(),
      });
      if (!next) return;
      hostedPollRef.current = next.id;
      openPoll(next);
      roomRef.current?.send({ kind: 'op', op: { kind: 'poll-start', poll: next } });
      track('Tab', 'Started', 'Poll');
    },
    [roomRef, openPoll, sessionBlockedRef, collaboratorsRef, selfKey],
  );

  // Answer (or skip, with `null`). Applied locally under our own key: the room
  // fans ops out to peers but not back to the sender, so our own answer would
  // otherwise be missing from our own tally.
  const answerPoll = useCallback(
    (value: string | null) => {
      const current = pollRef.current;
      if (!current) return;
      const clean = sanitisePollAnswer(current, value);
      setMyAnswer({ value: clean });
      setAnswers((prev) => new Map(prev).set(selfKey(), clean));
      roomRef.current?.send({
        kind: 'op',
        op: { kind: 'poll-answer', pollId: current.id, value: clean, key: selfKey() },
      });
      if (countedPollRef.current !== current.id) {
        countedPollRef.current = current.id;
        track('Tab', 'Voted', 'Poll');
      }
    },
    [roomRef, selfKey],
  );

  const endPoll = useCallback(() => {
    if (sessionBlockedRef?.current) return;
    const current = pollRef.current;
    if (!current) return;
    roomRef.current?.send({ kind: 'op', op: { kind: 'poll-end', pollId: current.id } });
    clearPoll();
    track('Tab', 'Ended', 'Poll');
  }, [roomRef, clearPoll]);

  // Hide our own panel without ending the poll for anyone else. The
  // escape hatch for a participant whose host vanished mid-poll.
  const dismissPoll = useCallback(() => setDismissed(true), []);

  return {
    poll,
    answers,
    myAnswer,
    dismissed,
    isHost: poll !== null && hostedPollRef.current === poll.id,
    startPoll,
    answerPoll,
    endPoll,
    dismissPoll,
    // Inbound handlers, handed to useRoomConnection.
    receivePoll,
    receiveAnswer,
    receivePollEnd,
  };
}
