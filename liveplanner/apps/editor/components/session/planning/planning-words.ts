// Sprint Planning's wording (docs/specs/026-plan/session-tabs.md "Sprint Planning"): the tally, what Commit would
// make it, where it stands against capacity, the committed cards with no estimate, and which picked types have no
// Estimate field. Pure.
import { measureNumber, type CapacityState, type ItemTypeDef } from '@liveplanner/items';

export const pointsWord = (n: number) => `${measureNumber(n)} ${n === 1 ? 'point' : 'points'}`;

// "13 of 30 points", or "13 points" with no capacity.
export const tallyWords = (points: number, capacity: number | undefined) =>
  capacity ? `${measureNumber(points)} of ${pointsWord(capacity)}` : pointsWord(points);

// What the tally adds beside its number: "Near capacity", "Over capacity by 4 points", else nothing.
export function capacityWords(
  state: CapacityState,
  points: number,
  capacity: number | undefined,
): string {
  if (state === 'near') return 'Near capacity';
  if (state === 'over' && capacity) return `Over capacity by ${pointsWord(points - capacity)}`;
  return '';
}

// The committed cards with no estimate, counted apart: never silently as zero.
export const unestimatedWords = (n: number) =>
  n === 1
    ? '1 committed card has no estimate, not counted'
    : `${n} committed cards have no estimate, not counted`;

// What Commit would make the tally: "16 of 30", "16 points" with no capacity.
export const commitMakes = (points: number, adding: number, capacity: number | undefined) =>
  capacity
    ? `${measureNumber(points + adding)} of ${measureNumber(capacity)}`
    : pointsWord(points + adding);

// The picked types with no Estimate field, whose cards always count as no estimate.
export const typesWithoutEstimate = (types: readonly ItemTypeDef[]) =>
  types.filter((t) => !t.fields.includes('estimate'));

// The set-up's note for them: "Bug has no Estimate field: its cards count as no estimate".
export function noEstimateNote(types: readonly ItemTypeDef[]): string {
  const names = types.map((t) => t.label);
  if (names.length === 0) return '';
  const list =
    names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names.at(-1)!}`;
  return names.length === 1
    ? `${list} has no Estimate field: its cards count as no estimate.`
    : `${list} have no Estimate field: their cards count as no estimate.`;
}
