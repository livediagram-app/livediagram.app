// Test support for the OpenAPI drift test (docs/specs/015-api/api-documentation.md "Drift test"): the sweep of
// every candidate (method, path) through the real dispatch, and the cases that read what it found. Never
// imported by the worker bundle.
//
// The sweep is every path the vocabulary builds, in five methods each: about 91,000 paths and 455,000
// dispatches (2026-11-23), nearly all of them under `documents`, whose literals multiply by position. One test
// file ran it on one core in 21 s on a developer's machine and 35 s under coverage, and CI's shared runners,
// under coverage beside the rest of the suite, took 65 to 120 s, which is where its 120 s timeout sat. So the
// sweep is split into SWEEP_SHARDS equal shares, one test file each (`route-sweep-<n>.test.ts`), which vitest
// runs on separate cores: the same dispatches, a quarter of them per file.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ROUTE_MANIFEST } from './manifest';
import {
  candidatePaths,
  matchesTemplate,
  probeDispatch,
  routeVocabulary,
  templateSegments,
  type ProbeResult,
} from './dispatch-probe';

/** How many test files share the sweep. route-parity.test.ts checks each has its file. */
export const SWEEP_SHARDS = 4;

// A share is about 114,000 dispatches: 5 s on a developer's machine, 9 s under coverage, and at the slowest
// rate CI has shown for the whole sweep (120 s) about 30 s. A wall-clock timeout, not a CPU budget
// (testing.md), so a fixed 120 s: four times that.
const SHARD_TIMEOUT_MS = 120_000;

export const showProbe = (r: Pick<ProbeResult, 'method' | 'path'>) =>
  `${r.method} /${r.path.join('/')}`;

/** Every path the sweep tries, in a fixed order. */
export function sweepCandidates(): string[][] {
  const candidates: string[][] = [];
  for (const [segment, byPosition] of routeVocabulary()) {
    // One level deeper than the deepest literal or documented template, so a
    // handler that serves an extension of a known path is caught too.
    const documentedDepth = Math.max(
      0,
      ...ROUTE_MANIFEST.filter((r) => r.segment === segment).map(
        (r) => templateSegments(r.path).length,
      ),
    );
    const maxLength = Math.max(documentedDepth, ...byPosition.keys()) + 1;
    candidates.push(...candidatePaths(segment, byPosition, maxLength));
  }
  return candidates;
}

/** One share of the sweep: every SWEEP_SHARDS-th candidate from `shard`, so the shares are equal, each holds
 *  paths of every resource and depth, and together they are the whole sweep exactly once. */
export function shardCandidates(candidates: readonly string[][], shard: number): string[][] {
  return candidates.filter((_, i) => i % SWEEP_SHARDS === shard);
}

/** The sweep's cases over one share (`shard` counts from 0). The calling test file mocks the signed-in caller
 *  (probe-caller.ts), since a mock belongs to the file that declares it. */
export function describeDispatchSweep(shard: number): void {
  if (!Number.isInteger(shard) || shard < 0 || shard >= SWEEP_SHARDS) {
    throw new Error(`no sweep shard ${shard}: there are ${SWEEP_SHARDS}`);
  }
  describe(`OpenAPI manifest ↔ dispatch sweep, share ${shard + 1} of ${SWEEP_SHARDS}`, () => {
    let results: ProbeResult[] = [];

    beforeAll(async () => {
      // Trapped requests end in index.ts's catch-all, which logs each one.
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      vi.spyOn(console, 'info').mockImplementation(() => undefined);
      results = await probeDispatch(shardCandidates(sweepCandidates(), shard));
    }, SHARD_TIMEOUT_MS);

    afterAll(() => {
      vi.restoreAllMocks();
    });

    it('probes enough of the dispatch to mean something', () => {
      // Vacuity guard: a broken source walk or an env that routes nothing would
      // pass every case below without checking anything.
      expect(results.length).toBeGreaterThan(1000);
      expect(results.filter((r) => r.outcome === 'routed').length).toBeGreaterThan(5);
      expect(results.filter((r) => r.outcome === 'storage').length).toBeGreaterThan(30);
    });

    it('documents every path the dispatch serves', () => {
      const undocumented = [
        ...new Set(
          results
            .filter((r) => r.outcome !== 'not-routed')
            .filter((r) => !ROUTE_MANIFEST.some((route) => matchesTemplate(r.path, route.path)))
            .map((r) => `/${r.path.join('/')}`),
        ),
      ];
      expect(undocumented, `dispatched but not documented: ${undocumented.join(', ')}`).toEqual([]);
    });

    it('documents every method a handler answers before touching storage', () => {
      // A `routed` outcome is definitive about the method as well as the path.
      // A `storage` outcome is not (the handler loaded something before
      // branching on the verb), which is what the per-segment verb check in
      // manifest.test.ts covers.
      const undocumented = results
        .filter((r) => r.outcome === 'routed')
        .filter(
          (r) =>
            !ROUTE_MANIFEST.some(
              (route) => route.method === r.method && matchesTemplate(r.path, route.path),
            ),
        )
        .map(showProbe);
      expect(undocumented, `answered but not documented: ${undocumented.join(', ')}`).toEqual([]);
    });
  });
}
