// Where a canvas's suggestions wait (liveworkspace/docs/specs/015-suggestions/canvas-suggestions.md "Stored on the
// item"): one row each in the item's own SQLite (its Durable Object), beside its tabs and never inside them, so an
// export, a thumbnail, a copy, a version, the Community and every agent read leave them out without knowing they
// exist. Reached through the D1-shaped surface every room hands its content code (the product's `*_DB` binding).
import {
  parseStoredSuggestion,
  SUGGESTIONS_MAX_PER_TAB,
  type CanvasSuggestion,
  type SuggestionElement,
} from './suggestion';

/** The table, made by each product's schema step (IF NOT EXISTS, so a step may run it again safely). */
export const CANVAS_SUGGESTIONS_SCHEMA = `
CREATE TABLE IF NOT EXISTS canvas_suggestions (
  id         TEXT PRIMARY KEY,
  tab_id     TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  body       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS canvas_suggestions_tab ON canvas_suggestions (tab_id, created_at);
`;

/** The least of D1 the store uses: a prepared statement, bound, run or read. */
export type SuggestionDb = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
    };
  };
};

export type SuggestionStore<E extends SuggestionElement> = {
  list(tabId: string): Promise<CanvasSuggestion<E>[]>;
  put(suggestion: CanvasSuggestion<E>): Promise<void>;
  remove(ids: readonly string[]): Promise<void>;
};

const REMOVE_CHUNK = 50;

export function suggestionStore<E extends SuggestionElement>(db: SuggestionDb): SuggestionStore<E> {
  return {
    async list(tabId) {
      const { results } = await db
        .prepare(
          'SELECT body FROM canvas_suggestions WHERE tab_id = ? ORDER BY created_at, id LIMIT ?',
        )
        .bind(tabId, SUGGESTIONS_MAX_PER_TAB)
        .all<{ body: string }>();
      return results.flatMap((row) => {
        const s = parseStoredSuggestion<E>(row.body);
        return s ? [s] : [];
      });
    },
    async put(s) {
      await db
        .prepare(
          'INSERT INTO canvas_suggestions (id, tab_id, created_at, body) VALUES (?, ?, ?, ?) ' +
            'ON CONFLICT(id) DO UPDATE SET body = excluded.body',
        )
        .bind(s.id, s.tabId, s.createdAt, JSON.stringify(s))
        .run();
    },
    async remove(ids) {
      // In chunks, under D1's 100 bound parameters a statement.
      for (let i = 0; i < ids.length; i += REMOVE_CHUNK) {
        const chunk = ids.slice(i, i + REMOVE_CHUNK);
        await db
          .prepare(
            `DELETE FROM canvas_suggestions WHERE id IN (${chunk.map(() => '?').join(', ')})`,
          )
          .bind(...chunk)
          .run();
      }
    },
  };
}
