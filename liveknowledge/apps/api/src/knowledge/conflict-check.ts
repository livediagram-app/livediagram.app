// "Pages that disagree" (docs/specs/030-knowledgebase/ai-knowledge.md): after a page's writing is saved or the page
// is verified, its changed passages are looked up on other pages and the model is asked whether any pair states
// opposite facts. Never in the save: the save owes the check (`knowledge_work`), and the room's alarm runs it here,
// outside any transaction, on the team's own key or, with none, on built-in AI (search-and-ask.md "Built-in AI").
// Bounds (the package's, checked by `conflictCheckRefusal`): once a page per 10 minutes, 50 a knowledgebase a day on
// a key and 20 on built-in AI, 5 passages looked up, 5 pairs asked about, one call.
import type { ItemSql } from '@liveworkspace/index-app';
import {
  CONFLICT_BUILT_IN_CHECKS_PER_DAY,
  CONFLICT_CHECK_SCOPE,
  CONFLICT_PAGE_INTERVAL_MS,
  ModelCallError,
  bumpCounter,
  callModel,
  chooseConflictCandidates,
  closeChangedConflicts,
  conflictCheckRefusal,
  conflictProbes,
  conflictRequest,
  dayOf,
  foundPassage,
  insertConflict,
  knownConflictIds,
  lastConflictCheck,
  noteConflictCheck,
  parseConflictVerdicts,
  probeSearch,
  readCounter,
  type ModelCaller,
  type Passage,
  type SearchRow,
} from '@liveknowledge/knowledge';
import type { DocumentEnv } from '../types';
import { readDocumentMeta } from '../document-room/document-content';
import { openAi } from './ai-settings';
import { modelDoorFor } from './model-door';
import { builtInAi } from './setup-built-in-ai';
import type { IndexedPage } from './knowledge-index';
import { rowsOf, runAll, sqlOf } from './knowledge-db';
import { oweWork, type Work } from './knowledge-work';
import { queueDisagreements } from '../document-room/automations/knowledge-events';

/** How long after a save its check runs: long enough for a burst of autosaves to settle into one check. */
export const CONFLICT_CHECK_DELAY_MS = 60_000;

/** Owe a check of each page whose writing was just indexed (a save), or that was just verified (`before` empty:
 *  its longest passages are looked up). Whether any AI can check is decided when the check runs. */
export function oweConflictChecks(
  sql: ItemSql,
  pages: readonly IndexedPage[],
  now: number,
): number {
  let owed = 0;
  for (const { tab, before } of pages) {
    if (before === null) continue;
    oweWork(sql, {
      kind: 'conflict',
      key: tab,
      dueAt: now + CONFLICT_CHECK_DELAY_MS,
      payload: JSON.stringify(before),
    });
    owed++;
  }
  return owed;
}

type StoredPassage = Omit<Passage, 'headings'> & { headings: string };

const beforeOf = (payload: string): { id: string; textHash: string }[] => {
  try {
    const read: unknown = JSON.parse(payload);
    return Array.isArray(read) ? (read as { id: string; textHash: string }[]) : [];
  } catch {
    return [];
  }
};

const headingsOf = (stored: string): string[] => {
  try {
    const read: unknown = JSON.parse(stored);
    return Array.isArray(read) ? read.filter((h): h is string => typeof h === 'string') : [];
  } catch {
    return [];
  }
};

/** One owed check. Answers when to try again (the page was checked under 10 minutes ago), or null when done. */
export async function runConflictCheck(
  env: DocumentEnv,
  documentId: string,
  work: Work,
  now: number,
): Promise<number | null> {
  const tab = work.key;
  const opened = await openAi(env, documentId);
  // The team's key when it opens; with none, built-in AI. A key that does not open is never swapped for it.
  const builtIn = typeof opened === 'string' && opened !== 'unreadable' ? builtInAi(env) : null;
  const caller: ModelCaller | null =
    typeof opened !== 'string'
      ? {
          provider: opened.provider,
          fetch: modelDoorFor(env, opened.provider),
          apiKey: opened.apiKey,
          model: opened.model,
        }
      : builtIn
        ? { provider: 'built-in', ai: builtIn }
        : null;
  const [last] = await rowsOf<{ checkedAt: number }>(env, lastConflictCheck(tab));
  const [counter] = await rowsOf<{ used: number }>(
    env,
    readCounter(CONFLICT_CHECK_SCOPE, dayOf(now)),
  );
  const refusal = conflictCheckRefusal({
    hasAi: caller !== null,
    checksToday: counter?.used ?? 0,
    ...(caller?.provider === 'built-in' ? { perDay: CONFLICT_BUILT_IN_CHECKS_PER_DAY } : {}),
    ...(last ? { lastCheckedAt: last.checkedAt } : {}),
    now,
  });
  if (refusal === 'checked-recently' && last) return last.checkedAt + CONFLICT_PAGE_INTERVAL_MS;
  if (refusal || !caller) {
    console.info('[knowledge] conflict check skipped', { documentId, tab, reason: refusal });
    return null;
  }
  const stored = await rowsOf<StoredPassage>(
    env,
    sqlOf(
      `SELECT id, tab, ordinal, headings, text, text_hash AS textHash, first_block AS firstBlock,
              last_block AS lastBlock FROM passages WHERE tab = ? AND ordinal >= 0 ORDER BY ordinal`,
      tab,
    ),
  );
  const after: Passage[] = stored.map((p) => ({ ...p, headings: headingsOf(p.headings) }));
  const probes = conflictProbes(beforeOf(work.payload), after);
  if (probes.length === 0) return null;
  await runAll(env, [noteConflictCheck(tab, now), bumpCounter(CONFLICT_CHECK_SCOPE, dayOf(now))]);
  // The Review Period, read once a check: which of the pages found count as verified.
  const every = (await readDocumentMeta(env, documentId))?.knowledgeSettings.reviewEvery;
  if (every === undefined) return null;
  const lookups = [];
  for (const probe of probes) {
    const search = probeSearch(probe, every, now);
    const found = search ? (await rowsOf<SearchRow>(env, search)).map(foundPassage) : [];
    lookups.push({ probe, found });
  }
  const known = new Set(
    (await rowsOf<{ id: string }>(env, knownConflictIds(tab))).map((r) => r.id),
  );
  const candidates = chooseConflictCandidates(lookups, known);
  if (candidates.length === 0) return null;
  try {
    const reply = await callModel({ ...caller, request: conflictRequest({ candidates }) });
    const conflicts = parseConflictVerdicts(reply.text, candidates);
    // A passage that changed while the model read it is no longer the one judged: the pair closes at once.
    await runAll(env, [
      ...conflicts.map((c) => insertConflict(c, now)),
      closeChangedConflicts(tab),
    ]);
    // Pages Disagree (docs/specs/013-workspace/automations.md): each new pair, about the page checked.
    queueDisagreements(env, tab, conflicts);
    console.info('[knowledge] conflict check', {
      documentId,
      tab,
      provider: caller.provider,
      pairs: candidates.length,
      found: conflicts.length,
    });
  } catch (error) {
    // The kind only: never the upstream's message, the request or the key. Not retried: the next save owes another.
    const kind = error instanceof ModelCallError ? error.kind : 'other';
    console.warn('[knowledge] conflict check failed', {
      documentId,
      tab,
      provider: caller.provider,
      kind,
    });
  }
  return null;
}
