// Change-log entries as the editor receives them (docs/specs/006-document/stroke-points.md
// "Migration of stored strokes"): an entry's before and after states hold whole elements as they
// were when it was written, and Revert applies them, so each state runs the stored-element
// migrations first. The same entry back when nothing in it needed migrating.
import type { ChangeLogEntry } from '@livediagram/api-schema';
import { migrateStoredElements, type Element } from '@livediagram/document';

function migrateState(state: Record<string, unknown>): Record<string, unknown> {
  const ids = Object.keys(state).filter(
    (id) => state[id] !== null && typeof state[id] === 'object',
  );
  const before = ids.map((id) => state[id] as Element);
  const after = migrateStoredElements(before);
  if (after === before) return state;
  const out = { ...state };
  ids.forEach((id, i) => (out[id] = after[i]));
  return out;
}

export function migrateChangeLogEntry(entry: ChangeLogEntry): ChangeLogEntry {
  const beforeState = migrateState(entry.beforeState);
  const afterState = migrateState(entry.afterState);
  if (beforeState === entry.beforeState && afterState === entry.afterState) return entry;
  return { ...entry, beforeState, afterState };
}
