// What this browser remembers of suggestions (liveworkspace/docs/specs/016-notifications/suggestions.md "Once an
// item"): the ones turned off with Don't Suggest This Again, and each item a suggestion was taken or dismissed for,
// newest first, at most SUGGEST_DECIDED_MAX. Storage that throws or is empty only means a suggestion may come again.
import { SUGGEST_DECIDED_MAX, type SuggestionId } from './suggestions';

const KEY = 'liveworkspace:suggestions';

type Memory = { off: SuggestionId[]; decided: string[] };

const empty = (): Memory => ({ off: [], decided: [] });

function read(): Memory {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<Memory>;
    return {
      off: Array.isArray(parsed.off) ? parsed.off.filter((v) => typeof v === 'string') : [],
      decided: Array.isArray(parsed.decided)
        ? parsed.decided.filter((v) => typeof v === 'string')
        : [],
    };
  } catch {
    return empty();
  }
}

function write(memory: Memory): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // Not kept: it may suggest again on another visit, never an error.
  }
}

const decidedKey = (id: SuggestionId, itemId: string) => `${id}:${itemId}`;

/** Whether this suggestion may show for this item: not turned off, never taken or dismissed for it. */
export function maySuggest(id: SuggestionId, itemId: string): boolean {
  const memory = read();
  return !memory.off.includes(id) && !memory.decided.includes(decidedKey(id, itemId));
}

/** Taken or dismissed for this item: it never comes back for it. */
export function decideSuggestion(id: SuggestionId, itemId: string): void {
  const memory = read();
  const key = decidedKey(id, itemId);
  write({
    ...memory,
    decided: [key, ...memory.decided.filter((k) => k !== key)].slice(0, SUGGEST_DECIDED_MAX),
  });
}

/** Don't Suggest This Again: off for every item. */
export function turnOffSuggestion(id: SuggestionId): void {
  const memory = read();
  if (!memory.off.includes(id)) write({ ...memory, off: [...memory.off, id] });
}

/** Forgets everything, for tests. */
export function resetSuggestionMemoryForTests(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing kept.
  }
}
