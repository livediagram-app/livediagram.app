// Picker candidates + the roll (spec/107). Pure, so what a press can possibly
// land on is testable without a room or a canvas.
//
// The spin the user watches is animation over a result decided at press time,
// which is why the decision lives here on its own: a peer must never watch a
// different reel land on a different name.

import type { Participant } from './identity';
import { randomPick } from './random';

export const PICKER_SPIN_MS = 1600;

// A candidate as the face draws it: the text that can be written to the
// element, plus who it is when the source is the room — so a person spins past
// with their own avatar rather than as a line of text.
export type PickerCandidate = { label: string; participant?: Participant };

// Who or what a picker can land on. Participants come from live presence at
// press time — including yourself, because a picker that refuses to choose the
// only person in the room is a broken picker, and "who demos next" with one
// person present has exactly one honest answer.
export function pickerCandidates(input: {
  source: 'participants' | 'options';
  options: string[] | undefined;
  participants: Participant[];
}): PickerCandidate[] {
  if (input.source === 'options') {
    return (input.options ?? [])
      .map((option) => option.trim())
      .filter((option) => option.length > 0)
      .map((label) => ({ label }));
  }
  const seen = new Set<string>();
  const people: PickerCandidate[] = [];
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

// One roll. Null when there is nothing to choose from, which the face renders
// as "nothing to pick from" rather than silently doing nothing.
export function rollPicker(candidates: PickerCandidate[]): PickerCandidate | null {
  if (candidates.length === 0) return null;
  // With one candidate the answer is that candidate — no theatre needed, but
  // the caller still spins so the room sees the roll happen.
  return randomPick(candidates) ?? null;
}

// The reel: candidates flicking past, ending on the result so the last frame
// and the answer agree. Long enough that a two-name list still reads as a spin
// rather than a flicker.
export function spinReel(
  candidates: PickerCandidate[],
  result: PickerCandidate,
  frames = 18,
): PickerCandidate[] {
  if (candidates.length === 0) return [];
  const reel: PickerCandidate[] = [];
  for (let i = 0; i < frames; i++) reel.push(candidates[i % candidates.length]!);
  reel.push(result);
  return reel;
}

// When each frame lands, in ms from the press. The gaps GROW towards the end (a
// quadratic ease-out), which is what makes it read as a wheel slowing to a stop
// rather than a list flicked at a constant rate — the last few names are the
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
