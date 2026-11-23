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
//     storage bindings (R2, Durable Objects) and outbound `fetch` are
//     TRAPS: touching one records the fact and throws.
//   - Classes: the sweep does not send every such path. It records which path segments a request reads, and
//     sends one path of each class of paths the dispatch tells apart (`sweepDispatch`): a request answers for
//     every path that agrees with it at the positions it read.
//
// Each probe lands in one of three outcomes:
//   - `not-routed`: a clean 404 (`not_found`) / 405 without touching storage. Nothing serves
//     this (method, path). A 404 naming another error (`unknown_template`) is a route that
//     answered about its parameter.
//   - `routed`: answered without touching storage (200, 400, 401, 503, ...).
//     This exact (method, path) is served.
//   - `storage`: a handler reached storage. The PATH is served; the method is
//     indeterminate, because most handlers load and authorise the resource
//     before branching on the verb.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  classOf,
  sampleMembers,
  sweepPaths,
  tracePathReads,
} from '@liveworkspace/vitest-config/route-sweep';
import worker from '../index';
import { setGrantVerifierForTests } from '../index-service';
import { answerDocumentRequest, type RouteIdentity } from '../document-room/document-route';
import type { Env, DocumentEnv } from '../types';

const PROBE_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
export type ProbeMethod = (typeof PROBE_METHODS)[number];

/** Stands in for every path parameter. Matches no literal the dispatch compares against. */
const PARAM = 'probe-param';

// The `error` a JSON answer names; null for any other body. Reads the answer itself: nothing else does, and a
// clone of each of the sweep's answers was a third of its time.
async function errorOf(res: Response): Promise<string | null> {
  try {
    const body: unknown = await res.json();
    const error: unknown =
      typeof body === 'object' && body !== null ? Reflect.get(body, 'error') : null;
    return typeof error === 'string' ? error : null;
  } catch {
    return null;
  }
}

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
type RouteVocabulary = Map<string, Map<number, Set<string>>>;

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
 *  `./<module>` imports, since the document routes are split across files). */
function dispatchSources(): Map<string, string[]> {
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

/** `/documents/{id}/copy` → `['documents', '{id}', 'copy']`. */
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

/** Sends one request through the probe. `settled` is called the moment a trap is touched: the outcome is
 *  `storage` from there on, whatever the Worker does next. */
type Send = (
  method: ProbeMethod,
  path: readonly string[],
  settled?: () => void,
) => Promise<ProbeResult>;

/** Opens the probe (its trapped env, its stand-ins) for `work`, which sends requests through it one at a time. */
async function withProbe<T>(work: (send: Send) => Promise<T>): Promise<T> {
  // Set by any trap; cleared before each request. `settled` is the request's own, told of the first touch.
  const state: { touched: boolean; settled?: (() => void) | undefined } = { touched: false };
  const touch = () => {
    state.touched = true;
    state.settled?.();
  };
  const trap = (binding: string) =>
    new Proxy(
      {},
      {
        get() {
          touch();
          throw new StorageTrap(`probe touched ${binding}`);
        },
      },
    );
  // Feature gates open, so a handler reaches its own routing instead of
  // answering "not configured" for every path: telemetry on, and Community and media keys set.
  // An index configured (its calls are the trapped `fetch`), and every request carrying an edit grant on the
  // placeholder document, so a document route reaches its own routing instead of answering "no access".
  const env = {
    // The Community, which lives in liveworkspace's service (liveworkspace/docs/specs/007-community/community.md);
    // never reached.
    COMMUNITY_URL: 'http://community.invalid/api/community',
    COMMUNITY_KEY: 'probe-key',
    // Images, which live in liveworkspace's media service (liveworkspace/docs/specs/006-media/media.md); never reached.
    MEDIA_URL: 'http://media.invalid/api/media',
    MEDIA_KEY: 'probe-key',
    TELEMETRY_ENABLED: 'true',
    INDEX_ORIGIN: 'https://index.probe',
  } as unknown as Env;
  const now = Math.floor(Date.now() / 1000);
  setGrantVerifierForTests(async () => ({
    iss: 'probe',
    aud: 'livedocuments',
    sub: 'user_probe',
    item: PARAM,
    level: 'edit',
    tab: null,
    team: null,
    iat: now,
    exp: now + 600,
    jti: 'probe',
  }));
  // The worker hands every request about one document to the document's Durable Object (`route`), which answers it with
  // the same handlers against its own store. The probe runs that answer in process, the document's store a trap too,
  // so a path the document does not serve is still a clean 404; any other use of the room is storage.
  // Inside the room, a call back to the document itself (document-room.ts `localNamespace`) reads its store: a trap too.
  const documentEnv = {
    ...env,
    DOCUMENT_DB: trap('DOCUMENT_DB'),
    DOCUMENT_ROOM: { idFromName: (name: string) => name, get: () => trap('DOCUMENT_ROOM (local)') },
  } as unknown as DocumentEnv;
  const room = new Proxy(
    {},
    {
      get(_, method) {
        if (method === 'route') {
          return (_documentId: string, request: Request, identity: RouteIdentity) =>
            answerDocumentRequest(documentEnv, request, identity, (p) => {
              pending.push(p.catch(() => undefined));
            });
        }
        touch();
        throw new StorageTrap(`probe touched DOCUMENT_ROOM.${String(method)}`);
      },
    },
  );
  Reflect.set(env, 'DOCUMENT_ROOM', { idFromName: (name: string) => name, get: () => room });
  const pending: Promise<unknown>[] = [];
  const executionCtx = {
    waitUntil: (p: Promise<unknown>) => pending.push(p.catch(() => undefined)),
    passThroughOnException: () => undefined,
    props: {},
  } as unknown as ExecutionContext;

  const realFetch = globalThis.fetch;
  globalThis.fetch = () => {
    touch();
    return Promise.reject(new StorageTrap('probe touched fetch'));
  };
  const send: Send = async (method, path, settled) => {
    state.touched = false;
    state.settled = settled;
    const res = await worker.fetch(
      new Request(`https://probe.test/api/${path.join('/')}`, {
        method,
        headers: {
          Authorization: 'Bearer probe-token',
          'X-Index-Grant': 'probe-grant',
          'Content-Type': 'application/json',
        },
      }),
      env,
      executionCtx,
    );
    await Promise.all(pending.splice(0));
    const clean =
      res.status === 405 || (res.status === 404 && (await errorOf(res)) === 'not_found');
    const outcome: ProbeOutcome = state.touched ? 'storage' : clean ? 'not-routed' : 'routed';
    return { method, path: [...path], outcome, status: res.status };
  };
  try {
    return await work(send);
  } finally {
    globalThis.fetch = realFetch;
    setGrantVerifierForTests(null);
  }
}

/** Probes the real worker. `candidates` lists the paths to try; every path is
 *  tried with every method in PROBE_METHODS unless `methods` narrows it. */
export async function probeDispatch(
  candidates: readonly (readonly string[])[],
  methods: readonly ProbeMethod[] = PROBE_METHODS,
): Promise<ProbeResult[]> {
  return withProbe(async (send) => {
    const results: ProbeResult[] = [];
    for (const path of candidates) {
      for (const method of methods) results.push(await send(method, path));
    }
    return results;
  });
}

/** One resource segment to sweep: the literals its route code compares each position against, and how deep. */
export interface SweepSpan {
  segment: string;
  vocabulary: Map<number, Set<string>>;
  maxLength: number;
}

export interface DispatchSweep {
  /** One result per class of paths the dispatch tells apart, in every method. */
  results: ProbeResult[];
  /** How many paths, in every method, those classes stand for: the full product of the vocabulary. */
  stoodFor: number;
  /** Members of the classes sent for real, each beside what its class answered. */
  members: { sent: ProbeResult; classed: ProbeResult | undefined }[];
}

/** Sweeps every path built from each span's vocabulary, up to its `maxLength` segments (the resource segment
 *  included), in every method, by sending one path of each class the dispatch tells apart: a request answers
 *  for every path that agrees with it at the positions it read (@liveworkspace/vitest-config/route-sweep).
 *  `sampled` members of those classes, the same ones every run and shared out by how many paths a span holds,
 *  are then sent for real, for the test to hold each against its class. */
export async function sweepDispatch(
  spans: readonly SweepSpan[],
  sampled: number,
): Promise<DispatchSweep> {
  return withProbe(async (send) => {
    const results: ProbeResult[] = [];
    const members: DispatchSweep['members'] = [];
    const sizes = spans.map(
      (span) => candidatePaths(span.segment, span.vocabulary, span.maxLength).length,
    );
    const paths = sizes.reduce((sum, size) => sum + size, 0);
    for (const [at, span] of spans.entries()) {
      // Path index i is segments[i + 1]: `api` is segments[0] and the resource segment is the path's first.
      const vocabulary = new Map(
        [...span.vocabulary].map(([position, literals]) => [position - 1, literals]),
      );
      const { classes, trees } = await sweepPaths({
        root: span.segment,
        vocabulary,
        maxLength: span.maxLength,
        methods: PROBE_METHODS,
        param: PARAM,
        send: async (method, path) => {
          // Once a trap is touched the outcome is settled: what the catch-all reads to word its 500 is not routing.
          const traced = await tracePathReads(`api/${path.join('/')}`, (stop) =>
            send(method as ProbeMethod, path, stop),
          );
          // `api` is index 0 of what was read; the path starts at 1.
          const reads = new Set([...traced.reads].map((index) => index - 1));
          return { result: traced.value, reads, whole: traced.whole };
        },
      });
      for (const c of classes) results.push(c.result);
      const drawn = sampleMembers({
        root: span.segment,
        vocabulary,
        maxLength: span.maxLength,
        param: PARAM,
        count: Math.max(5, Math.round((sampled * sizes[at]!) / paths)),
      });
      for (const [i, path] of drawn.entries()) {
        const method = PROBE_METHODS[i % PROBE_METHODS.length]!;
        members.push({
          sent: await send(method, path),
          classed: classOf(trees, method, path, PARAM)?.result,
        });
      }
    }
    return { results, stoodFor: paths * PROBE_METHODS.length, members };
  });
}

/** Every path under `segment` built from its vocabulary, up to `maxLength`
 *  path segments (the resource segment included). */
function candidatePaths(
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
