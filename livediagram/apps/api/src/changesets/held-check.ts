import type { HeldElement } from '@livediagram/api-schema';
import type { RoomSelection } from '../room-client';

// Which of an agent changeset's targets a person holds (docs/specs/024-agents/agent-changesets.md
// "Held elements"): every element of anybody's selection, whatever their role, except the agent's
// owner's own sessions, whose selection is what the agent reads. Each held element once, with the
// first person holding it. Pure; a room that could not answer (`null`) holds nothing.
export function heldTargets(
  targets: readonly string[],
  selections: readonly RoomSelection[] | null,
): HeldElement[] {
  if (!selections) return [];
  const holder = new Map<string, { name: string; color: string }>();
  for (const s of selections) {
    if (s.mine) continue;
    for (const id of s.elementIds) {
      if (!holder.has(id)) holder.set(id, { name: s.name, color: s.color });
    }
  }
  const held: HeldElement[] = [];
  for (const id of new Set(targets)) {
    const by = holder.get(id);
    if (by) held.push({ id, by });
  }
  return held;
}
