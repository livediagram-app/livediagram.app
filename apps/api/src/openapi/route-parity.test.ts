import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ROUTE_MANIFEST } from './manifest';
import {
  candidatePaths,
  instantiate,
  matchesTemplate,
  probeDispatch,
  routeSourceFiles,
  routeVocabulary,
  templateSegments,
  type ProbeResult,
} from './dispatch-probe';

// (method, path-template) parity between the published manifest and the real
// dispatch (docs/specs/015-api/api-documentation.md "Drift test"). See dispatch-probe.ts
// for how the worker is probed; what each case below proves is stated on it.

// Probe as a signed-in caller, so the Clerk-only surfaces (teams, tokens,
// OAuth exchange) route instead of answering 401 for every path under them.
vi.mock('../auth/clerk', () => ({
  getClerkIdentity: async () => ({
    userId: 'user_probe',
    email: null,
    sessionId: null,
    firstFactorAgeMinutes: null,
  }),
}));

const vocabulary = routeVocabulary();
const show = (r: Pick<ProbeResult, 'method' | 'path'>) => `${r.method} /${r.path.join('/')}`;

let results: ProbeResult[] = [];

beforeAll(async () => {
  // Trapped requests end in index.ts's catch-all, which logs each one.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  const candidates: string[][] = [];
  for (const [segment, byPosition] of vocabulary) {
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
  results = await probeDispatch(candidates);
  // Over a thousand dispatches: about a second alone, past the 10 s hook default on a runner shared by two
  // packages under coverage.
}, 60_000);

afterAll(() => {
  vi.restoreAllMocks();
});

describe('OpenAPI manifest ↔ dispatch (method, path-template) parity', () => {
  it('probes enough of the dispatch to mean something', () => {
    // Vacuity guard: a broken source walk or an env that routes nothing would
    // pass every case below without checking anything.
    expect(vocabulary.size).toBeGreaterThan(20);
    expect(results.length).toBeGreaterThan(1000);
    expect(results.filter((r) => r.outcome === 'routed').length).toBeGreaterThan(10);
    expect(results.filter((r) => r.outcome === 'storage').length).toBeGreaterThan(40);
  });

  it('serves every documented (method, path)', async () => {
    // A clean 404 / 405 for a documented operation means the manifest
    // publishes an endpoint the worker does not have.
    const probes: ProbeResult[] = [];
    for (const route of ROUTE_MANIFEST) {
      probes.push(...(await probeDispatch([instantiate(route.path)], [route.method])));
    }
    const phantom = probes.filter((r) => r.outcome === 'not-routed').map(show);
    expect(phantom, `documented but not dispatched: ${phantom.join(', ')}`).toEqual([]);
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
      .map(show);
    expect(undocumented, `answered but not documented: ${undocumented.join(', ')}`).toEqual([]);
  });

  it('documents every literal the dispatch discriminates on, at its position', () => {
    // A literal route shadowed by a parameter sibling (`/teams/stats` next to
    // `/teams/{id}`) matches the parameter's template above and would pass.
    // The route code comparing `segments[k] === 'stats'` is what gives it
    // away: every such literal must appear at that position in the manifest.
    const missing: string[] = [];
    for (const [segment, byPosition] of vocabulary) {
      const templates = ROUTE_MANIFEST.filter((r) => r.segment === segment).map((r) =>
        templateSegments(r.path),
      );
      for (const [position, literals] of byPosition) {
        for (const literal of literals) {
          if (!templates.some((t) => t[position - 1] === literal)) {
            missing.push(`${segment}: '${literal}' at segments[${position}]`);
          }
        }
      }
    }
    expect(missing, `discriminated on but not documented: ${missing.join(', ')}`).toEqual([]);
  });
});

describe('route code stays probeable', () => {
  // The vocabulary is read from `segments[k] === '<literal>'` comparisons. A
  // literal reached any other way (an alias compared later, a slice, a join)
  // would be invisible to the probe, so its route could go undocumented.
  const src = fileURLToPath(new URL('..', import.meta.url).href);
  const files = ['index.ts', ...routeSourceFiles()];

  it('reads path segments only by literal index or length', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(`${src}/${file}`, 'utf8');
      for (const m of source.matchAll(/\bsegments(\.(?!length\b)\w+|\[(?!\d+\])|\s*\)?\s*;)/g)) {
        offenders.push(`${file}: segments${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never compares an alias of a path segment against a literal', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(`${src}/${file}`, 'utf8');
      for (const alias of source.matchAll(/const (\w+) = segments\[\d+\]/g)) {
        const compared = new RegExp(`\\b${alias[1]} [!=]== '`);
        if (compared.test(source)) offenders.push(`${file}: ${alias[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
