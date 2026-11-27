// Picker candidates + the roll (docs/specs/012-collaboration/picker.md). Pure, so what a press can possibly
// land on is testable without a room or a canvas.
//
// The spin the user watches is animation over a result decided at press time,
// which is why the decision lives here on its own: a peer must never watch a
// different reel land on a different name.

import { randomPick } from './random';

// Who a candidate can be: each editor's Participant has these, and more its picker face draws.
export type PickerPerson = { id: string; name: string };

export const PICKER_SPIN_MS = 1600;

// A candidate as the face draws it: the text that can be written to the
// element, plus who it is when the source is the room, so a person spins past
// with their own avatar rather than as a line of text.
export type PickerCandidate<Participant extends PickerPerson = PickerPerson> = {
  label: string;
  participant?: Participant;
};

// Who or what a picker can land on. Participants come from live presence at
// press time, including yourself, because a picker that refuses to choose the
// only person in the room is a broken picker, and "who demos next" with one
// person present has exactly one honest answer.
export function pickerCandidates<Participant extends PickerPerson>(input: {
  source: 'participants' | 'options';
  options: string[] | undefined;
  participants: Participant[];
}): PickerCandidate<Participant>[] {
  if (input.source === 'options') {
    return (input.options ?? [])
      .map((option) => option.trim())
      .filter((option) => option.length > 0)
      .map((label) => ({ label }));
  }
  const seen = new Set<string>();
  const people: PickerCandidate<Participant>[] = [];
  for (const participant of input.participants) {
    const label = participant.name.trim();
    // One person listed twice (self arriving from local identity AND from
    // presence) is one candidate; two people genuinely called "Alex" are two,
    // which is why the ID and not the name is the key.
    if (!label || seen.has(participant.id)) continue;
    seen.add(participant.id);
    people.push({ label, participant });
  }
  return people;
}

// Remove Once Drawn (docs/specs/012-collaboration/picker.md "Remove once drawn"): the pool is
// every candidate whose name has not been drawn since the last Reset. Matched by label, the same
// text the result holds, so a name drawn once is out however many people carry it.
export function undrawnCandidates<C extends PickerCandidate>(
  candidates: C[],
  drawn: readonly string[] | undefined,
  removeDrawn: boolean | undefined,
): C[] {
  if (!removeDrawn || !drawn?.length) return candidates;
  const out = new Set(drawn);
  return candidates.filter((c) => !out.has(c.label));
}

// The drawn list after a roll landed on `label`: appended once, so a replayed write can't double it.
export function drawnAfter(drawn: readonly string[] | undefined, label: string): string[] {
  const list = drawn ?? [];
  return list.includes(label) ? [...list] : [...list, label];
}

// Which of the drawn names still count against this pool: a name deleted from a written list
// stops counting, so "5 of 8 left" never goes below what the list holds. Order kept (the draw order).
export function drawnStillListed<C extends PickerCandidate>(
  candidates: C[],
  drawn: readonly string[] | undefined,
): string[] {
  if (!drawn?.length) return [];
  const listed = new Set(candidates.map((c) => c.label));
  return drawn.filter((label, i) => listed.has(label) && drawn.indexOf(label) === i);
}

// One roll. Null when there is nothing to choose from, which the face renders
// as "nothing to pick from" rather than silently doing nothing.
export function rollPicker<C extends PickerCandidate>(candidates: C[]): C | null {
  if (candidates.length === 0) return null;
  // With one candidate the answer is that candidate, no theatre needed, but
  // the caller still spins so the room sees the roll happen.
  return randomPick(candidates) ?? null;
}

// The reel: candidates flicking past, ending on the result so the last frame
// and the answer agree. Long enough that a two-name list still reads as a spin
// rather than a flicker.
export function spinReel<C extends PickerCandidate>(candidates: C[], result: C, frames = 18): C[] {
  if (candidates.length === 0) return [];
  const reel: C[] = [];
  for (let i = 0; i < frames; i++) reel.push(candidates[i % candidates.length]!);
  reel.push(result);
  return reel;
}

// When each frame lands, in ms from the press. The gaps GROW towards the end (a
// quadratic ease-out), which is what makes it read as a wheel slowing to a stop
// rather than a list flicked at a constant rate, the last few names are the
// ones the room is actually watching.
export function spinFrameDelays(frameCount: number, totalMs = PICKER_SPIN_MS): number[] {
  if (frameCount <= 0) return [];
  const delays: number[] = [];
  for (let i = 0; i < frameCount; i++) {
    const progress = i / frameCount;
    delays.push(Math.round(totalMs * progress * progress));
  }
  return delays;
}

// What a canvas offers one viewer for a picker (each editor's useBehaviourElements.pickerFor).
export type PickerOffer<C extends PickerCandidate = PickerCandidate> = {
  candidates: C[];
  shared: boolean;
  roll?: () => C | null;
  reset?: () => void;
};

// What this viewer may press. Spinning is running the session (share-roles.md): an Editor's alone, so
// a read-only surface gets the reel to watch and no button. Reset is for whoever spins FOR THE ROOM,
// so an Editor rolling privately under somebody else's facilitation gets no Reset.
export function pickerOffer<C extends PickerCandidate>(
  offer: Required<PickerOffer<C>> | undefined,
  readOnly: boolean | undefined,
): PickerOffer<C> | undefined {
  if (!offer) return undefined;
  return {
    candidates: offer.candidates,
    shared: offer.shared,
    roll: readOnly ? undefined : offer.roll,
    reset: readOnly || !offer.shared ? undefined : offer.reset,
  };
}

// The picker fields a draw and a Reset write (docs/specs/012-collaboration/picker.md "Remove once drawn").
type PickerRound = {
  pickerRemoveDrawn?: boolean;
  pickerResult?: string;
  pickerDrawn?: string[];
  pickerRolledAt?: number;
};

// A roll landing on `label`, applied to the element as it is NOW (not as it was when the face rendered),
// so the result, the drawn list and the press's stamp go out in one write and never disagree. The stamp
// always moves on, even past a clock behind the last presser's, so the room replays a name landing twice
// in a row ("The room watches the same spin").
export function withDraw<E extends PickerRound>(el: E, label: string, now = Date.now()): E {
  const pickerRolledAt = Math.max(now, (el.pickerRolledAt ?? 0) + 1);
  if (!el.pickerRemoveDrawn) return { ...el, pickerResult: label, pickerRolledAt };
  return {
    ...el,
    pickerResult: label,
    pickerDrawn: drawnAfter(el.pickerDrawn, label),
    pickerRolledAt,
  };
}

// Reset: every name back in the pool and no result, the fields dropped rather than left undefined.
export function withRoundCleared<E extends PickerRound>(el: E): E {
  const next = { ...el };
  delete next.pickerResult;
  delete next.pickerDrawn;
  delete next.pickerRolledAt;
  return next;
}
