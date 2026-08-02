// Per-participant responses (spec/122): the shared element field that records
// ONE value per participant, persistently — the primitive under the estimate
// card (spec/123) and the temperature check (spec/124).
//
// A LEAF module (types only, like data-shapes.ts) because factories.ts needs
// these constants at module-init time, and importing them from './index' would
// put a runtime read inside the index ⇄ factories cycle.

// One person's answer. `participantId` is the id the room already identifies
// people by (spec/04); `at` is epoch ms, for ordering and for "who answered
// first" without a second clock.
//
// `value` is a STRING because the consumers disagree about what an answer is:
// '8', 'XL' and '?' are all valid estimates. Consumers parse what they need.
export type ParticipantResponse = { participantId: string; value: string; at: number };

// Bound for validate.ts. One entry per participant, so this is really a cap on
// room size — generous against any real session, tight against a payload
// designed to blow up an O(n) render.
export const RESPONSES_MAX = 500;
// Longest single answer we store. Every real scale token is 1-2 characters;
// the slack is for a future consumer with wordier options.
export const RESPONSE_VALUE_MAX = 40;

// Cast (or re-cast) one participant's answer. Casting again REPLACES the
// earlier answer rather than stacking a second one — the whole contract of
// spec/122, in one function so no caller can implement it differently.
export function setResponse(
  responses: ParticipantResponse[] | undefined,
  participantId: string,
  value: string,
  at: number,
): ParticipantResponse[] {
  const rest = (responses ?? []).filter((r) => r.participantId !== participantId);
  // Appended, so the list stays in "order people answered" — which is what
  // the estimate card's avatar row reads.
  return [...rest, { participantId, value, at }];
}

// Withdraw one participant's answer (pressing your own pick again).
export function clearResponse(
  responses: ParticipantResponse[] | undefined,
  participantId: string,
): ParticipantResponse[] {
  return (responses ?? []).filter((r) => r.participantId !== participantId);
}

// What this participant said, if anything.
export function responseOf(
  responses: ParticipantResponse[] | undefined,
  participantId: string,
): string | undefined {
  return (responses ?? []).find((r) => r.participantId === participantId)?.value;
}

// Summary of a numeric response set — the temperature check's whole readout
// (spec/124) and the estimate card's spread (spec/123).
//
// Non-numeric answers ('?', 'XL') are counted in `count` but excluded from
// `average` / `min` / `max`: someone who cannot size a story has still
// answered, and folding their '?' in as a zero would be a lie about the room.
export type ResponseStats = {
  count: number;
  // Distinct answers, in ascending numeric order where numeric, then the rest
  // in first-seen order. Used to decide "unanimous".
  distinct: string[];
  numericCount: number;
  average: number | null;
  min: number | null;
  max: number | null;
};

export function responseStats(responses: ParticipantResponse[] | undefined): ResponseStats {
  const list = responses ?? [];
  const numbers: number[] = [];
  const distinct: string[] = [];
  for (const r of list) {
    if (!distinct.includes(r.value)) distinct.push(r.value);
    const n = Number(r.value);
    if (r.value.trim() !== '' && Number.isFinite(n)) numbers.push(n);
  }
  distinct.sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    const aNum = a.trim() !== '' && Number.isFinite(na);
    const bNum = b.trim() !== '' && Number.isFinite(nb);
    // Numbers ascending first, non-numeric answers ('?') after them.
    if (aNum && bNum) return na - nb;
    if (aNum) return -1;
    if (bNum) return 1;
    return 0;
  });
  return {
    count: list.length,
    distinct,
    numericCount: numbers.length,
    average: numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : null,
    min: numbers.length ? Math.min(...numbers) : null,
    max: numbers.length ? Math.max(...numbers) : null,
  };
}

// How many people gave each of `values`, for the temperature check's bars.
export function responseTally(
  responses: ParticipantResponse[] | undefined,
  values: readonly string[],
): number[] {
  return values.map((v) => (responses ?? []).filter((r) => r.value === v).length);
}

// --- Done check (spec/137) -------------------------------------------------
//
// Built on the same per-participant `responses` field as the estimate card and
// the temperature check, with one fixed value: being done is not a scale, it
// is a flag. Pressing again withdraws it (`clearResponse`), so nobody is stuck
// marked finished on a card they misread.

/** The only value a done-check response ever holds. */
export const DONE_VALUE = 'done';

export function isDone(
  responses: ParticipantResponse[] | undefined,
  participantId: string,
): boolean {
  return responseOf(responses, participantId) === DONE_VALUE;
}

/**
 * Split the CURRENT ROOM into who has marked themselves done and who has not.
 *
 * Live by design. The waiting-on list is derived from the people actually in
 * the room, not from everyone who was ever in it, so somebody who closed the
 * tab stops holding the card open — the alternative is a card that never
 * completes because it is waiting on a person who went home.
 *
 * The flip side is that responses from people who have since left are ignored
 * here rather than deleted: they come back if the person rejoins, which is
 * what a reconnect should do.
 */
export function doneSplit(
  responses: ParticipantResponse[] | undefined,
  participantIds: readonly string[],
): { done: string[]; waiting: string[] } {
  const done: string[] = [];
  const waiting: string[] = [];
  for (const id of participantIds) {
    if (isDone(responses, id)) done.push(id);
    else waiting.push(id);
  }
  return { done, waiting };
}

/**
 * Is the whole room done?
 *
 * An EMPTY room is not done: with nobody present there is nothing to have
 * finished, and a card that flashed "everyone is done" at an empty board would
 * be celebrating the absence of people.
 */
export function allDone(
  responses: ParticipantResponse[] | undefined,
  participantIds: readonly string[],
): boolean {
  return participantIds.length > 0 && participantIds.every((id) => isDone(responses, id));
}
