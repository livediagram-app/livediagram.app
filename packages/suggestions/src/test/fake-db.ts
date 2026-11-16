// A canvas_suggestions table in memory, behind the D1 surface the store uses, recording each statement.
import type { SuggestionDb } from '../store';

type Row = { id: string; tab_id: string; created_at: number; body: string };

export function fakeSuggestionDb() {
  const rows = new Map<string, Row>();
  const statements: { sql: string; values: unknown[] }[] = [];
  const db: SuggestionDb = {
    prepare(sql) {
      return {
        bind(...values: unknown[]) {
          statements.push({ sql, values });
          return {
            async run() {
              if (sql.startsWith('INSERT')) {
                const [id, tab_id, created_at, body] = values as [string, string, number, string];
                rows.set(id, { id, tab_id, created_at, body });
              } else if (sql.startsWith('DELETE')) {
                for (const id of values as string[]) rows.delete(id);
              }
              return {};
            },
            async all<T>() {
              const [tabId, limit] = values as [string, number];
              const results = [...rows.values()]
                .filter((r) => r.tab_id === tabId)
                .sort((a, b) => a.created_at - b.created_at || (a.id < b.id ? -1 : 1))
                .slice(0, limit)
                .map((r) => ({ body: r.body }));
              return { results: results as T[] };
            },
          };
        },
      };
    },
  };
  return { db, rows, statements };
}
