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
  sanitisePoll,
  sanitisePollAnswer,
  type LivePoll,
  type RoomOutgoing,
} from '@livediagram/api-schema';
import { track } from '@/lib/telemetry';

type RoomHandle = { send: (msg: RoomOutgoing) => void };

// One participant's answer, keyed by the room's sender id. The key is used
// ONLY to make a person changing their mind replace their earlier answer;
// it is never rendered (spec/88 — results carry no identity).
export type PollAnswers = Map<string, string | null>;

export type LivePollState = {
  poll: LivePoll | null;
  answers: PollAnswers;
  // Did WE open this poll? Local-only: it decides who sees the host
  // controls (End poll / copy). Deliberately not on the wire — no peer
  // needs to know, and a reload drops the whole poll anyway.
  isHost: boolean;
  // Have we responded yet? Answering or skipping both count, and both
  // unlock the results panel. null = not responded.
  myAnswer: { value: string | null } | null;
  // Local-only hide, so a participant isn't stuck with a panel when the
  // host disconnects without ending the poll.
  dismissed: boolean;
};

export function useLivePoll(deps: { roomRef: React.RefObject<RoomHandle | null> }) {
  const { roomRef } = deps;
  const [poll, setPoll] = useState<LivePoll | null>(null);
  const [answers, setAnswers] = useState<PollAnswers>(() => new Map());
  const [myAnswer, setMyAnswer] = useState<{ value: string | null } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  // Which poll id we opened, if any. A ref rather than state because
  // nothing renders off it directly — `isHost` below derives it.
  const hostedPollRef = useRef<string | null>(null);
  // Mirror of `poll` for the handlers below. They need to READ the current
  // poll (to drop ops for a poll we don't have) while also writing other
  // state; doing that inside a setPoll updater would make the updater
  // impure and double-fire under StrictMode.
  const pollRef = useRef<LivePoll | null>(null);
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
      hostedPollRef.current = null;
      openPoll(clean);
    },
    [openPoll],
  );

  // One participant answered. Keyed by sender, so re-answering replaces
  // their earlier answer instead of stacking a second one.
  const receiveAnswer = useCallback((from: string, pollId: string, value: string | null) => {
    const current = pollRef.current;
    // Ignore an answer for a poll we don't have, or a stale one aimed at a
    // poll that's already been replaced.
    if (!current || current.id !== pollId) return;
    const clean = sanitisePollAnswer(current, value);
    setAnswers((prev) => new Map(prev).set(from, clean));
  }, []);

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
      const next = sanitisePoll({ ...draft, id: crypto.randomUUID(), startedAt: Date.now() });
      if (!next) return;
      hostedPollRef.current = next.id;
      openPoll(next);
      roomRef.current?.send({ kind: 'op', op: { kind: 'poll-start', poll: next } });
      track('Tab', 'Started', 'Poll');
    },
    [roomRef, openPoll],
  );

  // Answer (or skip, with `null`). Applied locally under a fixed 'self'
  // key: the room fans ops out to peers but not back to the sender, so our
  // own answer would otherwise be missing from our own tally.
  const answerPoll = useCallback(
    (value: string | null) => {
      const current = pollRef.current;
      if (!current) return;
      const clean = sanitisePollAnswer(current, value);
      setMyAnswer({ value: clean });
      setAnswers((prev) => new Map(prev).set('self', clean));
      roomRef.current?.send({
        kind: 'op',
        op: { kind: 'poll-answer', pollId: current.id, value: clean },
      });
      track('Tab', 'Voted', 'Poll');
    },
    [roomRef],
  );

  const endPoll = useCallback(() => {
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
