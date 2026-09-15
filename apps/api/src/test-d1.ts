import type { Env } from './types';

// A recording D1 stub for the db/ modules and the routes that drive them.
//
// Three test files had already grown their own copy of this (notification
// prefs, api-tokens, timeline-unseen), each stubbing the subset of the
// prepare().bind().first()/.all()/.run() chain its own module happened to
// call — so a module that reached for `.all()` next to a `.first()` needed a
// fourth copy. This one answers the whole chain and records every statement,
// which is what the assertions actually want to look at: not "did D1 work",
// but WHICH SQL ran with WHICH values bound.
//
// Not a `.test.ts` file, so vitest doesn't collect it as a suite — the same
// convention as routes/test-route-context.ts.

export type D1Call = {
  sql: string;
  bindings: unknown[];
  // Which terminal the caller used; lets a test tell a read apart from a
  // write that happen to share a table.
  method: 'first' | 'all' | 'run';
};

// What a test hands back for a given statement. `first` and `all` default to
// "no rows" — the shape a fresh database has, and the branch most callers
// forget to cover.
export type D1Response = {
  first?: unknown;
  // Present-but-undefined is meaningful: it stands for a D1 answer with no
  // `results` key, which is not the same as an empty result set.
  all?: unknown[];
  // Rows the write touched, for callers that read `meta.changes` to tell "I
  // updated it" from "no row matched" (a scoped UPDATE is how the api
  // enforces ownership without a prior SELECT). Defaults to 0.
  changes?: number;
};

// Decides the response for one statement. A test usually matches on a
// fragment of the SQL, which keeps it readable and independent of formatting
// elsewhere in the query.
export type D1Responder = (call: Omit<D1Call, 'method'>) => D1Response | undefined;

export type FakeD1 = {
  env: Env;
  calls: D1Call[];
  // Every statement that reached a terminal, filtered by an SQL fragment.
  matching: (fragment: string) => D1Call[];
  // The single statement matching a fragment; throws when the count isn't one,
  // so a test asserting on "the INSERT" can't silently read the wrong row.
  one: (fragment: string) => D1Call;
};

export function fakeD1(respond: D1Responder = () => undefined, base: Partial<Env> = {}): FakeD1 {
  const calls: D1Call[] = [];

  function statement(sql: string, bindings: unknown[]) {
    const answer = () => respond({ sql, bindings }) ?? {};
    const record = (method: D1Call['method']) => {
      calls.push({ sql, bindings, method });
    };
    return {
      // Carried so `batch()` can record a statement it never terminates.
      __sql: sql,
      __bindings: bindings,
      bind: (...next: unknown[]) => statement(sql, next),
      first: async () => {
        record('first');
        return answer().first ?? null;
      },
      all: async () => {
        record('all');
        // `all: undefined` passes through rather than defaulting, so a test can
        // reproduce D1 answering with no `results` array at all — the branch
        // every `res.results ?? []` in db/ exists for.
        const answered = answer();
        return { results: 'all' in answered ? answered.all : [], success: true, meta: {} };
      },
      run: async () => {
        record('run');
        // Reported only when the test says so: an answer with no change count
        // is a real shape, and callers reading it must fail closed.
        const answered = answer();
        return {
          success: true,
          meta: 'changes' in answered ? { changes: answered.changes } : {},
        };
      },
    };
  }

  const db = {
    prepare: (sql: string) => statement(sql, []),
    batch: async (statements: { __sql: string; __bindings: unknown[] }[]) => {
      // D1 runs a batch as writes; recording them as such keeps `matching()`
      // honest for a module that mixes batch and run.
      for (const s of statements)
        calls.push({ sql: s.__sql, bindings: s.__bindings, method: 'run' });
      return statements.map(() => ({ success: true, meta: {}, results: [] }));
    },
  };

  const matching = (fragment: string) => calls.filter((c) => c.sql.includes(fragment));

  return {
    env: { ...base, DB: db } as unknown as Env,
    calls,
    matching,
    one: (fragment: string) => {
      const found = matching(fragment);
      if (found.length !== 1) {
        throw new Error(
          `expected exactly one statement matching ${JSON.stringify(fragment)}, found ${found.length}:\n` +
            calls
              .map((c) => `  [${c.method}] ${c.sql.replace(/\s+/g, ' ').slice(0, 90)}`)
              .join('\n'),
        );
      }
      return found[0]!;
    },
  };
}
