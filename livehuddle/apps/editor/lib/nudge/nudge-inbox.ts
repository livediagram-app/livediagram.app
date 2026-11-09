'use client';

// Nudge on this screen (docs/specs/012-collaboration/nudge.md; blueprint blueprints/nudge.md): the door the
// Collaborators list sends through, the per-person cooldown its buttons read, and the inbox the room connection hands
// received nudges and refusals to. The room is the rule (one per 2 minutes per pair); this cooldown is what the button
// shows, by the person's collaboration key so their reconnect does not reset it.

import { useEffect, useState } from 'react';
import {
  createNudgeLedger,
  NUDGE_COOLDOWN_MS,
  parseNudge,
  parseNudgeRefused,
  type NudgeRefusedOp,
} from '@livehuddle/api-schema';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

/** A person as the Collaborators list knows them: presence id, collaboration key, name. */
export type NudgeTarget = { id: string; key?: string; name: string };

const SELF = 'self';
const personOf = (target: { id: string; key?: string }) => target.key ?? target.id;

let ledger = createNudgeLedger(NUDGE_COOLDOWN_MS);
const cooling = createListeners();

/** How long until you may nudge this person again; 0 when you may now. */
export function nudgeCooldownLeft(target: { id: string; key?: string }, now = Date.now()): number {
  return ledger.remaining(SELF, personOf(target), now);
}

/** Note a nudge sent now: the person's button cools for 2 minutes. */
function noteNudged(target: { id: string; key?: string }, now: number): boolean {
  if (!ledger.check(SELF, personOf(target), now).ok) return false;
  cooling.notify();
  return true;
}

/** The room refused: the button takes the room's time left. */
export function holdNudgeCooldown(
  target: { id: string; key?: string },
  retryInMs: number,
  now = Date.now(),
): void {
  ledger.hold(SELF, personOf(target), now, retryInMs);
  cooling.notify();
}

// --- Sending ----------------------------------------------------------------------------------------------------------

let sender: ((targetId: string) => void) | null = null;

/** Point the Nudge buttons at the room (useNudges), or at nothing. */
export function setNudgeSender(next: ((targetId: string) => void) | null): void {
  sender = next;
}

/** Send one nudge unless this person is cooling or there is no room: whether it went. */
export function sendNudge(target: NudgeTarget, now = Date.now()): boolean {
  if (!sender) return false;
  if (!noteNudged(target, now)) return false;
  sender(target.id);
  return true;
}

/**
 * The ms left on this person's cooldown, re-read once a second while it runs and never otherwise, so only a cooling
 * button renders on the clock. Woken by a send or a refusal.
 */
export function useNudgeCooldown(target: { id: string; key?: string }): number {
  const person = personOf(target);
  const [left, setLeft] = useState(() => ledger.remaining(SELF, person, Date.now()));
  useEffect(() => {
    let handle: ReturnType<typeof setTimeout> | undefined;
    const read = () => {
      clearTimeout(handle);
      const ms = ledger.remaining(SELF, person, Date.now());
      setLeft(ms);
      // Wake at the next whole second, so the countdown never skips one.
      if (ms > 0) handle = setTimeout(read, ms % 1000 || 1000);
    };
    if (ledger.remaining(SELF, person, Date.now()) > 0) handle = setTimeout(read, 0);
    const stop = cooling.subscribe(read);
    return () => {
      clearTimeout(handle);
      stop();
    };
  }, [person]);
  return left;
}

// --- Receiving --------------------------------------------------------------------------------------------------------

type NudgeEvent = { kind: 'nudged'; from: string } | { kind: 'refused'; op: NudgeRefusedOp };

const inbox = new Set<(event: NudgeEvent) => void>();

/** A nudge or a refusal from the room connection (`from` is the sender, or the target for a refusal). */
export function receiveNudgeOp(from: string, raw: unknown): void {
  const nudge = parseNudge(raw);
  const refused = nudge ? null : parseNudgeRefused(raw);
  if (!nudge && !refused) return;
  const event: NudgeEvent = nudge ? { kind: 'nudged', from } : { kind: 'refused', op: refused! };
  for (const listener of inbox) listener(event);
}

/** Told of every nudge and refusal this screen receives; returns the unsubscribe. */
export function onNudge(listener: (event: NudgeEvent) => void): () => void {
  inbox.add(listener);
  return () => inbox.delete(listener);
}

/** Forget everything (tests). */
export function resetNudges(): void {
  ledger = createNudgeLedger(NUDGE_COOLDOWN_MS);
  sender = null;
  inbox.clear();
}
