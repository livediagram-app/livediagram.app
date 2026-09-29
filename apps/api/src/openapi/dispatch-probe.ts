// Test support for the OpenAPI drift test (docs/specs/015-api/api-documentation.md "Drift test").
// Never imported by the worker bundle.
//
// The dispatch is imperative (index.ts switches on the resource segment, each
// route module matches `segments.length` / `segments[k] === '<literal>'` and
// `request.method`), so there is no route table to diff the manifest against.
// Instead this module ENUMERATES candidate requests and asks the real worker
// which of them it routes:
//
//   - Vocabulary: the literals each segment's route code compares a path
//     position against, read from the source, plus a placeholder standing in
//     for every path parameter.
//   - Probe: every (method, path) built from that vocabulary, one level deeper
//     than anything known, is sent through `worker.fetch` against an env whose
//     storage bindings (D1, R2, Durable Objects) and outbound `fetch` are
//     TRAPS: touching one records the fact and throws.
//
// Each probe lands in one of three outcomes:
//   - `not-routed`: a clean 404 / 405 without touching storage. Nothing serves
//     this (method, path).
//   - `routed`: answered without touching storage (200, 400, 401, 503, ...).
//     This exact (method, path) is served.
//   - `storage`: a handler reached storage. The PATH is served; the method is
//     indeterminate, because most handlers load and authorise the resource
//     before branching on the verb.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import worker from '../index';
import type { Env } from '../types';

export const PROBE_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
export type ProbeMethod = (typeof PROBE_METHODS)[number];

/** Stands in for every path parameter. Matches no literal the dispatch compares against. */
export const PARAM = 'probe-param';

export type ProbeOutcome = 'not-routed' | 'routed' | 'storage';

export interface ProbeResult {
  method: ProbeMethod;
  /** Path segments under `/api`, e.g. `['diagrams', PARAM, 'copy']`. */
  path: string[];
  outcome: ProbeOutcome;
  status: number;
}

/** Literals compared per path position, keyed by top-level segment. Positions
 *  index `url.pathname.split('/')` minus the leading empty part, so `api` is 0
 *  and the resource segment is 1. */
export type RouteVocabulary = Map<string, Map<number, Set<string>>>;

const SRC = fileURLToPath(new URL('..', import.meta.url).href);

function readSource(rel: string): string | null {
  try {
    return readFileSync(`${SRC}/${rel}`, 'utf8');
  } catch {
    return null;
  }
}

/** Every non-test route module, relative to `src/`. */
export function routeSourceFiles(): string[] {
  return readdirSync(`${SRC}/routes`)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => `routes/${f}`);
}

/** The `case '<segment>':` blocks of index.ts's dispatch switch, with the source
 *  of every route module each block reaches (transitively through sibling
 *  `./<module>` imports, since the diagram routes are split across files). */
export function dispatchSources(): Map<string, string[]> {
  const index = readSource('index.ts')!;
  const handlerFile = new Map<string, string>();
  for (const m of index.matchAll(/import \{([^}]*)\} from '\.\/routes\/([\w-]+)'/g)) {
    for (const name of m[1]!.split(',')) {
      if (name.trim()) handlerFile.set(name.trim(), `routes/${m[2]}.ts`);
    }
  }
  const switchBody = index.slice(index.indexOf('switch (segments[1])'));
  const out = new Map<string, string[]>();
  for (const m of switchBody.matchAll(/case '([^']+)':([\s\S]*?)(?=\n\s*case '|\n\s*\}\n)/g)) {
    const block = m[2]!;
    const sources = [block];
    const queue = [...block.matchAll(/(handle\w+)\(/g)].map((h) => handlerFile.get(h[1]!));
    const seen = new Set<string>();
    while (queue.length > 0) {
      const file = queue.pop();
      if (!file || seen.has(file)) continue;
      seen.add(file);
      const source = readSource(file);
      if (!source) continue;
      sources.push(source);
      for (const rel of source.matchAll(/from '\.\/([\w-]+)'/g)) queue.push(`routes/${rel[1]}.ts`);
    }
    out.set(m[1]!, sources);
  }
  return out;
}

export function routeVocabulary(): RouteVocabulary {
  const out: RouteVocabulary = new Map();
  for (const [segment, sources] of dispatchSources()) {
    const byPosition = new Map<number, Set<string>>();
    for (const source of sources) {
      for (const m of source.matchAll(/segments\[(\d+)\] [!=]== '([^']+)'/g)) {
        const position = Number(m[1]);
        if (position < 2) continue;
        const set = byPosition.get(position) ?? new Set<string>();
        set.add(m[2]!);
        byPosition.set(position, set);
      }
    }
    out.set(segment, byPosition);
  }
  return out;
}

/** `/diagrams/{id}/copy` → `['diagrams', '{id}', 'copy']`. */
export function templateSegments(template: string): string[] {
  return template.replace(/^\//, '').split('/');
}

const isParam = (segment: string) => /^\{\w+\}$/.test(segment);

/** Whether a probed path is an instance of a manifest path template. */
export function matchesTemplate(path: readonly string[], template: string): boolean {
  const parts = templateSegments(template);
  return (
    parts.length === path.length &&
    parts.every((part, i) => (isParam(part) ? true : part === path[i]))
  );
}

/** A manifest template with every parameter replaced by the placeholder. */
export function instantiate(template: string): string[] {
  return templateSegments(template).map((part) => (isParam(part) ? PARAM : part));
}

class StorageTrap extends Error {}

/** Probes the real worker. `candidates` lists the paths to try; every path is
 *  tried with every method in PROBE_METHODS unless `methods` narrows it. */
export async function probeDispatch(
  candidates: readonly (readonly string[])[],
  methods: readonly ProbeMethod[] = PROBE_METHODS,
): Promise<ProbeResult[]> {
  // Set by any trap; cleared before each request.
  const state = { touched: false };
  const trap = (binding: string) =>
    new Proxy(
      {},
      {
        get() {
          state.touched = true;
          throw new StorageTrap(`probe touched ${binding}`);
        },
      },
    );
  // Feature gates open, so a handler reaches its own routing instead of
  // answering "not configured" for every path: telemetry on, a model key set.
  const env = {
    DB: trap('DB'),
    IMAGES: trap('IMAGES'),
    DOCUMENT_ROOM: trap('DOCUMENT_ROOM'),
    TELEMETRY_ENABLED: 'true',
    OPENAI_API_KEY: 'probe-key',
  } as unknown as Env;
  const pending: Promise<unknown>[] = [];
  const executionCtx = {
    waitUntil: (p: Promise<unknown>) => pending.push(p.catch(() => undefined)),
    passThroughOnException: () => undefined,
    props: {},
  } as unknown as ExecutionContext;

  const realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    state.touched = true;
    return Promise.reject(new StorageTrap('probe touched fetch'));
  }) as typeof fetch;
  const results: ProbeResult[] = [];
  try {
    for (const path of candidates) {
      for (const method of methods) {
        state.touched = false;
        const res = await worker.fetch(
          new Request(`https://probe.test/api/${path.join('/')}`, {
            method,
            headers: { 'X-Owner-Id': 'probe-owner', 'Content-Type': 'application/json' },
          }),
          env,
          executionCtx,
        );
        await Promise.all(pending.splice(0));
        const outcome: ProbeOutcome = state.touched
          ? 'storage'
          : res.status === 404 || res.status === 405
            ? 'not-routed'
            : 'routed';
        results.push({ method, path: [...path], outcome, status: res.status });
      }
    }
  } finally {
    globalThis.fetch = realFetch;
  }
  return results;
}

/** Every path under `segment` built from its vocabulary, up to `maxLength`
 *  path segments (the resource segment included). */
export function candidatePaths(
  segment: string,
  vocabulary: Map<number, Set<string>>,
  maxLength: number,
): string[][] {
  const out: string[][] = [[segment]];
  let frontier: string[][] = [[segment]];
  for (let length = 2; length <= maxLength; length++) {
    // Path position `length - 1` is segments[length] (segments[0] is `api`).
    const options = [PARAM, ...(vocabulary.get(length) ?? [])];
    frontier = frontier.flatMap((prefix) => options.map((option) => [...prefix, option]));
    out.push(...frontier);
  }
  return out;
}
