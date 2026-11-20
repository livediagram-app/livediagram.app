// Pages that disagree (docs/specs/030-knowledgebase/ai-knowledge.md): which of a saved page's passages to look up
// on other pages, which pairs to put to the model, the limits of a check, and when a stored conflict closes.
import { stableHash } from './hash';
import type { Passage } from './passages';
import { contentWords } from './questions';
import { searchByTerms, type FoundPassage } from './sql/search';
import type { SqlStatement } from './sql/statement';

export const CONFLICT_CHECKS_PER_DAY = 50;
/** The most pairs of passages one check puts to the model. */
export const CONFLICT_MAX_CANDIDATES = 5;
/** A page is checked at most once in this long. */
export const CONFLICT_PAGE_INTERVAL_MS = 10 * 60 * 1000;
/** The most of a page's passages one check looks up on other pages. */
export const CONFLICT_MAX_PROBES = 5;
/** The words of a passage a lookup searches by. */
const PROBE_TERMS = 8;
/** A passage shorter than this states too little to disagree with. */
const MIN_PROBE_CHARS = 40;

export type ConflictSide = { passage: string; tab: string; textHash: string };

export type Conflict = {
  /** The same for a pair whichever passage comes first. */
  id: string;
  /** The question both passages answer, differently. */
  question: string;
  a: ConflictSide;
  b: ConflictSide;
};

/** A pair's id: its two passage ids, in order. */
export function conflictId(passageA: string, passageB: string): string {
  const [first, second] = passageA < passageB ? [passageA, passageB] : [passageB, passageA];
  return stableHash('conflict', first, second);
}

export type ConflictCheckRefusal = 'no-key' | 'checked-recently' | 'daily-limit';

/** Why a page is not checked now, or undefined when it may be. */
export function conflictCheckRefusal(check: {
  hasKey: boolean;
  /** Checks already counted in the knowledgebase's day. */
  checksToday: number;
  /** When this page was last checked (epoch ms), if it was. */
  lastCheckedAt?: number;
  now: number;
}): ConflictCheckRefusal | undefined {
  if (!check.hasKey) return 'no-key';
  if (
    check.lastCheckedAt !== undefined &&
    check.now - check.lastCheckedAt < CONFLICT_PAGE_INTERVAL_MS
  ) {
    return 'checked-recently';
  }
  if (check.checksToday >= CONFLICT_CHECKS_PER_DAY) return 'daily-limit';
  return undefined;
}

/** The passages of a save that read differently from what was indexed before it (`before`: the page's rows as
 *  `{ id, textHash }`), longest first, at most CONFLICT_MAX_PROBES: the ones worth looking up. A verified page
 *  with nothing new passes every passage as changed by handing an empty `before`. */
export function conflictProbes(
  before: readonly { id: string; textHash: string }[],
  after: readonly Passage[],
): Passage[] {
  const was = new Map(before.map((p) => [p.id, p.textHash]));
  return after
    .filter((p) => p.text.length >= MIN_PROBE_CHARS && was.get(p.id) !== p.textHash)
    .sort((a, b) => b.text.length - a.text.length || a.ordinal - b.ordinal)
    .slice(0, CONFLICT_MAX_PROBES);
}

/** The lookup of one probe on other pages: any of its most telling words (the longest, each once). Undefined for
 *  a passage with no words. */
export function probeSearch(probe: Passage, now: number): SqlStatement | undefined {
  const words = [...new Set(contentWords(probe.text))]
    .sort((a, b) => b.length - a.length || (a < b ? -1 : 1))
    .slice(0, PROBE_TERMS);
  return searchByTerms(words, {
    now,
    mode: 'any',
    passagesOnly: true,
    exceptTab: probe.tab,
    limit: CONFLICT_MAX_CANDIDATES,
  });
}

/** A pair put to the model: `number` is what its verdict names it by, 1 first. */
export type ConflictCandidate = { number: number; changed: Passage; other: FoundPassage };

/** The pairs to put to the model: each probe with what its lookup found on other pages, best matches first, each
 *  pair once, at most CONFLICT_MAX_CANDIDATES. `known` are the ids of pairs already stored, open or dismissed
 *  (sql/conflicts.ts `knownConflictIds`): they are not asked about again. */
export function chooseConflictCandidates(
  lookups: readonly { probe: Passage; found: readonly FoundPassage[] }[],
  known: ReadonlySet<string> = new Set(),
): ConflictCandidate[] {
  const seen = new Set(known);
  const pairs: { changed: Passage; other: FoundPassage }[] = [];
  for (const { probe, found } of lookups) {
    for (const other of found) {
      if (other.isTitle || other.tab === probe.tab) continue;
      const id = conflictId(probe.id, other.id);
      if (seen.has(id)) continue;
      seen.add(id);
      pairs.push({ changed: probe, other });
    }
  }
  return pairs
    .sort((a, b) => a.other.rank - b.other.rank)
    .slice(0, CONFLICT_MAX_CANDIDATES)
    .map((pair, at) => ({ number: at + 1, ...pair }));
}

/** Whether a stored conflict is over: either passage is gone or reads differently now. `textHashOf` answers a
 *  passage's current hash by its id, or undefined when the passage is no longer there. The room does the same in
 *  SQL on every save (sql/page-index.ts `closeChangedConflicts`). */
export function conflictClosed(
  conflict: Conflict,
  textHashOf: (passage: string) => string | undefined,
): boolean {
  return (
    textHashOf(conflict.a.passage) !== conflict.a.textHash ||
    textHashOf(conflict.b.passage) !== conflict.b.textHash
  );
}
