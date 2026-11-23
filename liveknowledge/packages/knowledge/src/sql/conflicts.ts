// Pages that disagree, as stored (docs/specs/030-knowledgebase/insights.md "Pages that disagree"). A conflict
// closes by itself when either passage changes: sql/page-index.ts `closeChangedConflicts`, run with every save.
import type { Conflict } from '../conflicts';
import type { SqlStatement } from './statement';

/** How many open conflicts the Insights tab lists. */
export const CONFLICTS_LISTED = 50;

/** Stores a found conflict. A pair already there, open or dismissed, is left as it is. */
export const insertConflict = (conflict: Conflict, now: number): SqlStatement => ({
  sql: `INSERT OR IGNORE INTO conflicts
    (id, question, a_passage, a_tab, a_hash, b_passage, b_tab, b_hash, state, found_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
  params: [
    conflict.id,
    conflict.question,
    conflict.a.passage,
    conflict.a.tab,
    conflict.a.textHash,
    conflict.b.passage,
    conflict.b.tab,
    conflict.b.textHash,
    now,
  ],
});

/** "Not a Conflict": the pair is dismissed for good. */
export const dismissConflict = (id: string): SqlStatement => ({
  sql: `UPDATE conflicts SET state = 'dismissed' WHERE id = ?`,
  params: [id],
});

export type ConflictRow = {
  id: string;
  question: string;
  aPassage: string;
  aTab: string;
  aHash: string;
  bPassage: string;
  bTab: string;
  bHash: string;
  foundAt: number;
};

/** The open conflicts, newest first. */
export const listConflicts = (limit = CONFLICTS_LISTED): SqlStatement => ({
  sql: `SELECT id, question, a_passage AS aPassage, a_tab AS aTab, a_hash AS aHash,
      b_passage AS bPassage, b_tab AS bTab, b_hash AS bHash, found_at AS foundAt
    FROM conflicts WHERE state = 'open' ORDER BY found_at DESC, id LIMIT ?`,
  params: [Math.min(CONFLICTS_LISTED, Math.max(1, Math.floor(limit)))],
});

/** The ids of every pair a page is part of, open or dismissed: pairs the check does not raise again. */
export const knownConflictIds = (tab: string): SqlStatement => ({
  sql: 'SELECT id FROM conflicts WHERE a_tab = ? OR b_tab = ?',
  params: [tab, tab],
});

/** A stored row as a conflict. */
export const conflictOfRow = (row: ConflictRow): Conflict => ({
  id: row.id,
  question: row.question,
  a: { passage: row.aPassage, tab: row.aTab, textHash: row.aHash },
  b: { passage: row.bPassage, tab: row.bTab, textHash: row.bHash },
});

/** When a page was last checked for conflicts, a row `{ checkedAt }` or none. */
export const lastConflictCheck = (tab: string): SqlStatement => ({
  sql: 'SELECT checked_at AS checkedAt FROM conflict_checks WHERE tab = ?',
  params: [tab],
});

/** Notes that a page was checked at `now`. */
export const noteConflictCheck = (tab: string, now: number): SqlStatement => ({
  sql: `INSERT INTO conflict_checks (tab, checked_at) VALUES (?, ?)
    ON CONFLICT (tab) DO UPDATE SET checked_at = excluded.checked_at`,
  params: [tab, now],
});
