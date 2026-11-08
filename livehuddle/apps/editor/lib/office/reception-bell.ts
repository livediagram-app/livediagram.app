'use client';

// The reception bell (docs/specs/009-elements/workday-pieces.md "Reception Desk", "The wire"): the Ring Bell button in a
// desk's Welcome bubble sends one `avatar-bell`, one per 5 seconds; the room broadcasts it, and each screen that
// receives it decides whether it stands in earshot (the desk's room, or within BELL_RADIUS of a desk in no room). Who
// hears it hears a ding, sees the bell ring out on the desk, and is told who rang. Nothing is stored or replayed.
//
// The canvas's call hook (useCanvasCall) points the ringer at the room and listens for rings; the desk's face reads
// the stores below. Each store wakes only the faces it concerns.

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { BELL_THROTTLE_MS, parseAvatarBell, type AvatarBellOp } from '@livehuddle/api-schema';
import { meetingPieceRoom, zoneAt, type CallZone, type Element } from '@livehuddle/document';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { useToast } from '@/hooks/ui/useToast';
import type { CallSignal } from '@/lib/calls/call-config';
import { track } from '@/lib/telemetry';
import { playTones } from '@/lib/timer-chime';

/** How far round a desk standing in no room its bell is heard, from the desk's middle. */
export const BELL_RADIUS = 480;
/** The ding: one bright note (A6) with a quieter overtone, and its fade. */
const DING: readonly { hz: number; at: number }[] = [
  { hz: 1760, at: 0 },
  { hz: 3520, at: 0.005 },
];
const DING_S = 1.1;
const DING_GAIN = 0.1;

type Point = { x: number; y: number };

// --- Ringing ----------------------------------------------------------------------------------------------------------

let ringer: ((deskId: string) => void) | null = null;
// Everyone told of a ring on this tab, in earshot or not: the Receptionist walks over (docs/specs/008-canvas/receptionist.md
// "The reception bell"). `from` is the ringer's id, or SELF_RINGER for a ring from this screen.
const rungBy = new Set<(deskId: string, from: string) => void>();
export const SELF_RINGER = 'self';

/** Told of every ring of a desk's bell on this tab, yours and everyone's; returns the unsubscribe. */
export function onBellRung(listener: (deskId: string, from: string) => void): () => void {
  rungBy.add(listener);
  return () => rungBy.delete(listener);
}
let rungAt = 0;
const rungListeners = createListeners();

/** Point the Ring Bell button at the room (the canvas's call hook), or at nothing. */
export function setBellRinger(next: ((deskId: string) => void) | null): void {
  ringer = next;
}

/**
 * Ring a desk's bell: once per BELL_THROTTLE_MS. Sent to the room while walking with one to ring through (the canvas's
 * call hook points the ringer at it); heard here either way, so a Space with no room still answers the press.
 */
export function ringBell(deskId: string, now = Date.now()): boolean {
  if (now - rungAt < BELL_THROTTLE_MS) return false;
  rungAt = now;
  rungListeners.notify();
  track('Canvas', 'Used', 'ReceptionBell');
  ringer?.(deskId);
  for (const listener of rungBy) listener(deskId, SELF_RINGER);
  // The ringer hears its own ring, as the receivers in earshot do.
  hearRing(deskId);
  // The button reads Rang until the window is over.
  setTimeout(() => rungListeners.notify(), BELL_THROTTLE_MS);
  return true;
}

/** Whether you rang a bell inside the last BELL_THROTTLE_MS: the button reads Rang. */
export function useBellRung(): boolean {
  return useSyncExternalStore(
    rungListeners.subscribe,
    () => Date.now() - rungAt < BELL_THROTTLE_MS,
    () => false,
  );
}

/** Forget the last ring (tests). */
export function resetBell(): void {
  rungAt = 0;
  ringer = null;
  rings.clear();
  rungBy.clear();
}

// --- The ring on the desk ---------------------------------------------------------------------------------------------

const rings = new Map<string, number>();
const ringListeners = createListeners();

/** The desk's bell rings out: its count goes up, so its face plays the waves again. */
function bumpBell(deskId: string): void {
  rings.set(deskId, (rings.get(deskId) ?? 0) + 1);
  ringListeners.notify();
}

/** How many times this desk's bell has rung on this screen; changes only for the desk it concerns. */
export function useBellRings(deskId: string): number {
  return useSyncExternalStore(
    ringListeners.subscribe,
    () => rings.get(deskId) ?? 0,
    () => 0,
  );
}

/** A ring heard here: the ding and the waves on the desk. */
function hearRing(deskId: string): void {
  playTones(DING, DING_S, DING_GAIN);
  bumpBell(deskId);
}

// --- Receiving ----------------------------------------------------------------------------------------------------------

const inbox = new Set<(from: string, op: AvatarBellOp) => void>();

/** An `avatar-bell` from `from` (the room connection); anything malformed is dropped, and nothing is kept. */
export function receiveBellOp(from: string, raw: unknown): void {
  const op = parseAvatarBell(raw);
  if (!op) return;
  for (const listener of inbox) listener(from, op);
  for (const listener of rungBy) listener(op.deskId, from);
}

function onBell(listener: (from: string, op: AvatarBellOp) => void): () => void {
  inbox.add(listener);
  return () => inbox.delete(listener);
}

/** Each Reception Desk on the board: its middle and the room it belongs to (pure, for the tests). */
export function receptionDesks(
  elements: readonly Element[],
  zones: readonly CallZone[],
): Map<string, { at: Point; room: string | null }> {
  const desks = new Map<string, { at: Point; room: string | null }>();
  for (const el of elements) {
    if (el.type !== 'shape' || el.shape !== 'reception-desk') continue;
    desks.set(el.id, {
      at: { x: el.x + el.width / 2, y: el.y + el.height / 2 },
      room: meetingPieceRoom(el, zones),
    });
  }
  return desks;
}

/**
 * Whether you hear a desk's bell: you walk, and stand in its room, or near a desk in no room. A desk that is not on the
 * board (another tab's, or deleted) rings nobody.
 */
export function hearsBell(
  desk: { at: Point; room: string | null } | undefined,
  self: Point | null,
  zones: readonly CallZone[],
): boolean {
  if (!desk || !self) return false;
  if (desk.room !== null) return zoneAt(self, zones) === desk.room;
  return Math.hypot(self.x - desk.at.x, self.y - desk.at.y) <= BELL_RADIUS;
}

/** What the toast says to someone in earshot. */
export function bellToast(name: string | null | undefined): string {
  return `${name?.trim() || 'Someone'} rang the bell at Reception`;
}

export function useReceptionBell(deps: {
  elements: readonly Element[];
  zones: readonly CallZone[];
  inMode: boolean;
  self: Point | null;
  walkers: readonly { id: string; name: string }[];
  doNotDisturb: boolean;
  send?: (signal: CallSignal) => void;
}): void {
  const { elements, zones, inMode, send } = deps;
  const desks = useMemo(() => receptionDesks(elements, zones), [elements, zones]);
  const toast = useToast();
  // Read when a ring arrives, never subscribed to: a step changes nothing here.
  const latest = useLatest({ ...deps, desks, toast });
  // Only while walking with a room to ring through; a board with no desk needs no ringer.
  const canRing = inMode && !!send && desks.size > 0;
  useEffect(() => {
    if (!canRing || !send) return;
    setBellRinger((deskId) => send({ kind: 'avatar-bell', deskId }));
    return () => setBellRinger(null);
  }, [canRing, send]);
  useEffect(
    () =>
      onBell((from, op) => {
        const now = latest.current;
        if (!now.inMode || now.doNotDisturb) return;
        if (!hearsBell(now.desks.get(op.deskId), now.self, now.zones)) return;
        hearRing(op.deskId);
        now.toast.info(bellToast(now.walkers.find((w) => w.id === from)?.name));
      }),
    [latest],
  );
}
