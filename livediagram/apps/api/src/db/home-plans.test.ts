// Query-plan guards for the reads behind Home and the Inbox (docs/specs/013-workspace/explorer-home.md,
// docs/specs/013-workspace/inbox.md), against the real migrations. Each read starts from the reader's
// own documents; led by a table-wide index instead, it walked rows of every user in the database, so
// it slowed as the database grew rather than as the reader's work did.

import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { THREADS_SQL } from './collab-index';
import { JUMP_BACK_IN_SQL, WHAT_HAPPENED_SQL } from './home';

// The outer query's loops, in order (the subqueries and CTE bodies are left out).
function outerLoops(sql: string, ...args: (string | number)[]): string[] {
  const { sql: db } = sqliteD1();
  return db
    .prepare(`EXPLAIN QUERY PLAN ${sql}`)
    .all(...args)
    .filter((row) => row['parent'] === 0)
    .map((row) => String(row['detail']))
    .filter((detail) => /^(SCAN|SEARCH)\b/.test(detail));
}

describe('reads that start from the reader’s documents', () => {
  it('Inbox threads: the reader’s documents, then those documents’ threads', () => {
    const loops = outerLoops(THREADS_SQL, 'reader', 1, 50);
    expect(loops[0]).toBe('SCAN vi');
    expect(loops.some((d) => /^SEARCH ct .*\(document_id=\?\)/.test(d))).toBe(true);
    expect(loops.filter((d) => /collab_threads_open_idx/.test(d))).toEqual([]);
  });

  it('What happened: each document’s own events, by (scope_type, scope_id)', () => {
    const loops = outerLoops(WHAT_HAPPENED_SQL, 'reader', 2, 1, 50);
    expect(loops[0]).toBe('SCAN vi');
    expect(loops.some((d) => /^SEARCH sc .*\(scope_type=\? AND scope_id=\?\)/.test(d))).toBe(true);
  });

  it('Jump back in: the reader’s candidates, never a walk of every document', () => {
    const loops = outerLoops(JUMP_BACK_IN_SQL, 'reader', 2, 1, 3, 6);
    expect(loops[0]).toBe('SCAN c');
    expect(loops.filter((d) => /^SCAN d\b/.test(d))).toEqual([]);
  });
});
