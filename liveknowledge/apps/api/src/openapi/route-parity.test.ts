import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ROUTE_MANIFEST } from './manifest';
import {
  instantiate,
  probeDispatch,
  routeSourceFiles,
  routeVocabulary,
  templateSegments,
  type ProbeResult,
} from './dispatch-probe';
import { SWEEP_SHARDS, showProbe, shardCandidates, sweepCandidates } from './dispatch-sweep';

// (method, path-template) parity between the published manifest and the real
// dispatch (docs/specs/015-api/api-documentation.md "Drift test"). See dispatch-probe.ts
// for how the worker is probed; what each case below proves is stated on it. The sweep of every
// candidate path, and the cases that read it, run in the route-sweep-<n>.test.ts files (dispatch-sweep.ts).

// Probe as a signed-in caller (probe-caller.ts).
vi.mock('../auth/accounts', () => import('./probe-caller').then((m) => m.probeAccounts()));
vi.mock('../person/profiles', () => import('./probe-caller').then((m) => m.probeProfiles()));

const vocabulary = routeVocabulary();

beforeAll(() => {
  // Trapped requests end in index.ts's catch-all, which logs each one.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('OpenAPI manifest ↔ dispatch (method, path-template) parity', () => {
  it('reads enough of the route code to mean something', () => {
    // Vacuity guard: a broken source walk would pass every case here and in the sweep without checking anything.
    expect(vocabulary.size).toBeGreaterThan(15);
  });

  it('sweeps every candidate path exactly once, a share per test file', () => {
    const candidates = sweepCandidates();
    const shares = Array.from({ length: SWEEP_SHARDS }, (_, shard) =>
      shardCandidates(candidates, shard),
    );
    expect(shares.flat().length).toBe(candidates.length);
    expect(new Set(shares.flat().map((path) => path.join('/'))).size).toBe(candidates.length);
    const files = readdirSync(fileURLToPath(new URL('.', import.meta.url).href))
      .filter((f) => /^route-sweep-\d+\.test\.ts$/.test(f))
      .sort();
    expect(files).toEqual(shares.map((_, shard) => `route-sweep-${shard + 1}.test.ts`));
  });

  it('serves every documented (method, path)', async () => {
    // A clean 404 / 405 for a documented operation means the manifest
    // publishes an endpoint the worker does not have.
    const probes: ProbeResult[] = [];
    for (const route of ROUTE_MANIFEST) {
      probes.push(...(await probeDispatch([instantiate(route.path)], [route.method])));
    }
    const phantom = probes.filter((r) => r.outcome === 'not-routed').map(showProbe);
    expect(phantom, `documented but not dispatched: ${phantom.join(', ')}`).toEqual([]);
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
