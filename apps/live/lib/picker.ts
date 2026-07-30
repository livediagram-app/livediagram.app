// Picker candidates + the roll (spec/107). Pure, so what a press can possibly
// land on is testable without a room or a canvas.
//
// The spin the user watches is animation over a result decided at press time,
// which is why the decision lives here on its own: a peer must never watch a
// different reel land on a different name.

import { randomPick } from './random';

export const PICKER_SPIN_MS = 900;

// Who or what a picker can land on. Participants come from live presence at
// press time — including yourself, because a picker that refuses to choose the
// only person in the room is a broken picker, and "who demos next" with one
// person present has exactly one honest answer.
export function pickerCandidates(input: {
  source: 'participants' | 'options';
  options: string[] | undefined;
  participantNames: string[];
}): string[] {
  if (input.source === 'options') {
    return (input.options ?? [])
      .map((option) => option.trim())
      .filter((option) => option.length > 0);
  }
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of input.participantNames) {
    const name = raw.trim();
    // Two people called "Alex" are two candidates, but one person listed twice
    // (self appearing in presence AND in the local identity) is one.
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

// One roll. Null when there is nothing to choose from, which the face renders
// as "nothing to pick from" rather than silently doing nothing.
export function rollPicker(candidates: string[]): string | null {
  if (candidates.length === 0) return null;
  // With one candidate the answer is that candidate — no theatre needed, but
  // the caller still spins so the room sees the roll happen.
  return randomPick(candidates) ?? null;
}

// The names to flick through during the spin: the candidates, repeated enough
// that a short list still reads as a reel, ending on the result so the last
// frame and the answer agree.
export function spinReel(candidates: string[], result: string, frames = 12): string[] {
  if (candidates.length === 0) return [];
  const reel: string[] = [];
  for (let i = 0; i < frames; i++) reel.push(candidates[i % candidates.length]!);
  reel.push(result);
  return reel;
}
