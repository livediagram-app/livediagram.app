// Counts inside a window of time, for the limits the room checks before a model call
// (docs/specs/030-knowledgebase/search-and-ask.md "Ask" bounds, ai-knowledge.md "Pages that disagree"). A scope
// names who or what is counted; a period is an hour or a day (days.ts).
import { dayOf, daysBefore, hourOf } from '../days';
import type { SqlStatement } from './statement';

/** The scope of one person's questions. The id is kept only until the hour's rows are pruned. */
export const askPersonScope = (person: string): string => `ask:person:${person}`;
/** The scope of every question asked of the knowledgebase. */
export const ASK_KNOWLEDGEBASE_SCOPE = 'ask:knowledgebase';
/** The scope of one person's Describe to Set Up suggestions, and of the knowledgebase's (setup-limits.ts). */
export const setupPersonScope = (person: string): string => `setup:person:${person}`;
export const SETUP_KNOWLEDGEBASE_SCOPE = 'setup:knowledgebase';
/** The scope of one person's Describe Structure drafts, and of the knowledgebase's (page-structure.ts). */
export const structurePersonScope = (person: string): string => `structure:person:${person}`;
export const STRUCTURE_KNOWLEDGEBASE_SCOPE = 'structure:knowledgebase';
/** The scope of the knowledgebase's questions answered on built-in AI (built-in-limits.ts), beside its every-AI one. */
export const ASK_BUILT_IN_SCOPE = 'ask:built-in';
/** The scope of the knowledgebase's conflict checks. */
export const CONFLICT_CHECK_SCOPE = 'conflicts:check';

/** How much of a scope's limit is used in a period: a row `{ used }` or none. */
export const readCounter = (scope: string, period: string): SqlStatement => ({
  sql: 'SELECT used FROM usage_counters WHERE scope = ? AND period = ?',
  params: [scope, period],
});

/** Counts one more use. */
export const bumpCounter = (scope: string, period: string): SqlStatement => ({
  sql: `INSERT INTO usage_counters (scope, period, used) VALUES (?, ?, 1)
    ON CONFLICT (scope, period) DO UPDATE SET used = used + 1`,
  params: [scope, period],
});

/** Drops the windows that are over: every hour and day before yesterday (an hour's period sorts with its day's).
 *  The room runs it at most once a day. */
export const pruneCounters = (now: number): SqlStatement => ({
  sql: 'DELETE FROM usage_counters WHERE period < ?',
  params: [daysBefore(now, 1)],
});

// The reads and the writes one model call costs against a person's hour and the knowledgebase's day.
function hourAndDayCounters(personScope: string, knowledgebaseScope: string, now: number) {
  const hour = hourOf(now);
  const day = dayOf(now);
  return {
    readPerson: readCounter(personScope, hour),
    readKnowledgebase: readCounter(knowledgebaseScope, day),
    bump: [bumpCounter(personScope, hour), bumpCounter(knowledgebaseScope, day)],
  };
}

/** The reads and the writes one question costs: its person's hour and the knowledgebase's day. */
export const askCounters = (person: string, now: number) =>
  hourAndDayCounters(askPersonScope(person), ASK_KNOWLEDGEBASE_SCOPE, now);

/** The same for one Describe to Set Up suggestion, counted apart from Ask's questions. */
export const setupCounters = (person: string, now: number) =>
  hourAndDayCounters(setupPersonScope(person), SETUP_KNOWLEDGEBASE_SCOPE, now);

/** The same for one Describe Structure draft, counted apart from both. */
export const structureCounters = (person: string, now: number) =>
  hourAndDayCounters(structurePersonScope(person), STRUCTURE_KNOWLEDGEBASE_SCOPE, now);
