// A photo read's AI credits, as this browser knows them (docs/specs/021-event-storming/note-reader.md "AI credits
// (Pro)"): which diagram the notes are read into (its owner pays) and who owns it, the read under way (its notes,
// which set what it costs, how the person chose to read it, and the pass the api gave it, so one photo is paid for
// once), and what the api said about the payer's credits. Told by the api, never worked out here, save the one guess
// the choice before a read needs: whether the read will be charged at all. With Pro off the api says none of it, the
// requests carry none of it, and this stays empty.
import type { ReadCredits } from '@livediagram/api-schema';
import type { ItemHead } from '@liveworkspace/subscription';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

/** The diagram open now, and the share code it was opened through. */
export type ReadTarget = { documentId: string | null; shareCode: string | null };

export type ReadCreditsState = {
  /** Who pays (`p:<accountId>` or `t:<teamId>`); null until the api has said the read is counted. */
  owner: string | null;
  /** What the read cost, as the api spent it; null until it has said. */
  cost: number | null;
  /** What the payer has used and may use, where this person may know it. */
  count: { used: number; max: number } | null;
  /** The payer's month is used, in the numbers the api refused with: the photo is read on this device. */
  spent: { used: number; max: number } | null;
};

/** The read under way: its id, the photo's notes (0 before a photo is found), whether it is expected to spend AI
 *  credits (read-charged.ts), whether the person chose to read it on this device, and its pass once the api gave
 *  one. */
export type ReadRun = {
  id: string;
  notes: number;
  charged: boolean;
  onDevice: boolean;
  pass: string | null;
};

const NONE: ReadCreditsState = { owner: null, cost: null, count: null, spent: null };

let target: ReadTarget = { documentId: null, shareCode: null };
// A diagram's owner and team, as its load named them: whether a read into it is a guest's (charged to nobody).
let head: { documentId: string } & ItemHead = { documentId: '' };
let run: ReadRun | null = null;
let state: ReadCreditsState = NONE;
// The payer's count the last counted read of a diagram answered, kept across photos so the next choice can say what
// is left before anything is sent.
let lastCount: { documentId: string | null; used: number; max: number } | null = null;
const listeners = createListeners();

function set(next: ReadCreditsState): void {
  state = next;
  listeners.notify();
}

/** The editor says which diagram is open (and the link it came through), so a read names it. */
export function setReadTarget(next: ReadTarget): void {
  target = next;
}

export function readTarget(): ReadTarget {
  return target;
}

/** A diagram's owner and team, from its load. */
export function setReadOwner(documentId: string, next: ItemHead): void {
  head = { documentId, owner: next.owner ?? null, team: next.team ?? null };
}

/** The open diagram's owner and team, where its load named them; nothing for any other diagram. */
export function readOwner(): ItemHead {
  return head.documentId === target.documentId ? { owner: head.owner, team: head.team } : {};
}

// 16 characters of `A-Z a-z 0-9 _ -`, as the api takes a read's id.
function newReadId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let bin = '';
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_');
}

/** A new photo of `notes` notes: a new read, with no pass yet, and nothing said about credits. */
export function startReadRun(notes = 0, charged = false): void {
  run = { id: newReadId(), notes, charged, onDevice: false, pass: null };
  if (state !== NONE) set(NONE);
}

/** The read under way: every batch of a photo, and each note read again in its review. */
export function readRun(): ReadRun {
  return (run ??= { id: newReadId(), notes: 0, charged: false, onDevice: false, pass: null });
}

/** The person chose to read this photo on the device: its re-reads stay there too. */
export function readOnDevice(): void {
  readRun().onDevice = true;
}

/** Whether the read holds a pass that has not lapsed (`<lapses>.<signature>`). */
export function readPassLive(now: number = Date.now()): boolean {
  const pass = run?.pass;
  if (!pass) return false;
  return Number(pass.slice(0, pass.indexOf('.'))) > now;
}

/** Whether a box read again now goes to the device: a charged read made there, or whose pass has lapsed (or never
 *  came, the choice still open), so a re-read never spends without asking. */
export function rereadOnDevice(now: number = Date.now()): boolean {
  const { charged, onDevice } = readRun();
  return charged && (onDevice || !readPassLive(now));
}

/** A counted read's answer: its pass for the later requests, who paid and what it cost, and their count where this
 *  person may know. */
export function noteReadCredits(credits: ReadCredits | undefined): void {
  if (!credits) return;
  if (credits.pass) readRun().pass = credits.pass;
  const { used, max } = credits;
  const told = typeof used === 'number' && typeof max === 'number' ? { used, max } : null;
  if (told) lastCount = { documentId: target.documentId, ...told };
  const count = told ?? state.count;
  const cost = typeof credits.cost === 'number' ? credits.cost : state.cost;
  if (state.owner === credits.owner && state.count === count && state.cost === cost) return;
  set({ ...state, owner: credits.owner, cost, count });
}

/** The api refused the read: the payer's month of AI credits is used. */
export function noteReadCreditsUsed(refusal: { owner: string; used: number; max: number }): void {
  if (refusal.max > 0) {
    lastCount = { documentId: target.documentId, used: refusal.used, max: refusal.max };
  }
  set({
    owner: refusal.owner,
    cost: null,
    count: null,
    spent: { used: refusal.used, max: refusal.max },
  });
}

export function readCredits(): ReadCreditsState {
  return state;
}

/** What the last counted read of the open diagram said its payer has used, for this person to know; null else. */
export function knownReadCount(): { used: number; max: number } | null {
  return lastCount && lastCount.documentId === target.documentId
    ? { used: lastCount.used, max: lastCount.max }
    : null;
}

// The hook lives with its one client caller (ReadCreditsHost): the api client imports this store, and the root layout
// imports the api client, so a React hook here breaks every server page.
export const subscribeReadCredits = listeners.subscribe;

/** Tests only: back to nothing known. */
export function resetReadCreditsForTests(): void {
  target = { documentId: null, shareCode: null };
  head = { documentId: '' };
  run = null;
  lastCount = null;
  set(NONE);
}
