// The caps on built-in AI (docs/specs/030-knowledgebase/search-and-ask.md "Built-in AI"): liveknowledge pays for every
// built-in call, so each has a daily bound below a key's. The counts live in the room (a knowledgebase's) and in one
// counting instance per account (a person's, across every knowledgebase: apps/api/src/knowledge/setup-draft-count.ts).

/** Built-in questions one person may ask in a UTC day, across every knowledgebase (Draft a Page is one). */
export const ASK_BUILT_IN_PER_PERSON_PER_DAY = 30;
/** Built-in questions one knowledgebase may answer in a UTC day, whoever asks. */
export const ASK_BUILT_IN_PER_KNOWLEDGEBASE_PER_DAY = 100;
/** Conflict checks a knowledgebase may run on built-in AI in a UTC day (50 on the team's key). */
export const CONFLICT_BUILT_IN_CHECKS_PER_DAY = 20;
