// A Sprint Planning session's tally (docs/specs/026-plan/session-tabs.md "Sprint Planning", blueprint session-tabs.md
// "Behaviour and state"): the committed cards' estimates added up against the set-up's capacity. A card with no
// estimate is counted apart, never as zero, so a missing estimate never quietly makes a sprint look lighter. Pure.
import type { Item } from './item';
import type { SessionOutcome } from './session-queue';

// The tally turns amber from this share of the capacity.
export const CAPACITY_NEAR = 0.85;

export type SessionTally = {
  // The committed cards' estimates, added up.
  points: number;
  // Committed cards with an estimate.
  counted: number;
  // Committed cards with none: shown apart, never counted as zero.
  unestimated: number;
};

// A card's estimate: a finite number of 0 or more, else none.
export function estimateOf(item: Pick<Item, 'fields'>): number | null {
  const v = item.fields['estimate'];
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

// The tally over `cards` the session decided `committed`.
export function sessionTally(
  cards: Iterable<Pick<Item, 'id' | 'fields'>>,
  decided: Readonly<Record<string, { outcome: SessionOutcome }>> | undefined,
): SessionTally {
  const out: SessionTally = { points: 0, counted: 0, unestimated: 0 };
  if (!decided) return out;
  for (const card of cards) {
    if (decided[card.id]?.outcome !== 'committed') continue;
    const points = estimateOf(card);
    if (points === null) out.unestimated++;
    else {
      out.points += points;
      out.counted++;
    }
  }
  return out;
}

export type CapacityState = 'none' | 'under' | 'near' | 'over';

// Where `points` stand against `capacity`: none without one, over past it, near from CAPACITY_NEAR of it up to it.
export function capacityState(points: number, capacity: number | undefined): CapacityState {
  if (!capacity || capacity <= 0) return 'none';
  if (points > capacity) return 'over';
  return points >= capacity * CAPACITY_NEAR ? 'near' : 'under';
}
