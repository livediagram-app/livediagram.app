import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COMPONENT_SCHEMAS } from './schemas.generated';
import { ROUTE_MANIFEST } from './manifest';
import { buildOpenApiDocument } from './document';
import type { JsonSchema } from './types';

// Drift guards for the OpenAPI surface (spec/37). The worker dispatch is
// segment-based and imperative, so the manifest is the declaration of the
// surface and these tests pin it to reality: a route segment added to the
// dispatch without a manifest entry, a schema reference that doesn't exist, or
// a DTO change that wasn't regenerated all turn CI red.

// The set of top-level resource segments the worker actually dispatches, read
// straight from index.ts's `case '<segment>':` labels. Reading the source
// keeps this honest without a parallel hand-list that could itself drift.
function dispatchedSegments(): Set<string> {
  const source = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
  const segments = new Set<string>();
  for (const m of source.matchAll(/case '([^']+)':/g)) if (m[1]) segments.add(m[1]);
  return segments;
}

// Every HTTP verb each dispatched segment actually handles, read from the
// route modules the same way dispatchedSegments() reads index.ts: from the
// source, so there is no hand-list to drift.
function handledMethodsBySegment(): Map<string, Set<string>> {
  const index = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
  const handlerFile = new Map<string, string>();
  for (const m of index.matchAll(/import \{([^}]*)\} from '\.\/routes\/([\w-]+)'/g)) {
    for (const name of m[1]!.split(',')) {
      if (name.trim()) handlerFile.set(name.trim(), `${m[2]}.ts`);
    }
  }
  const read = (file: string): string | null => {
    try {
      return readFileSync(new URL(`../routes/${file}`, import.meta.url), 'utf8');
    } catch {
      return null;
    }
  };
  const out = new Map<string, Set<string>>();
  for (const m of index.matchAll(/case '([^']+)':\s*\n\s*return await (\w+)\(/g)) {
    const file = handlerFile.get(m[2]!);
    const source = file ? read(file) : null;
    if (!source) continue;
    // A handler may delegate to sibling route modules (the diagram routes are
    // split across several); follow those too or their verbs go unseen.
    const sources = [source];
    for (const rel of source.matchAll(/from '\.\/([\w-]+)'/g)) {
      const sibling = read(`${rel[1]}.ts`);
      if (sibling) sources.push(sibling);
    }
    const methods = new Set<string>();
    for (const s of sources) {
      for (const v of s.matchAll(/method (?:===|!==) '([A-Z]+)'/g)) methods.add(v[1]!);
    }
    out.set(m[1]!, methods);
  }
  return out;
}

describe('OpenAPI manifest ↔ dispatch parity', () => {
  it('documents exactly the segments the worker dispatches', () => {
    const dispatched = dispatchedSegments();
    const documented = new Set(ROUTE_MANIFEST.map((r) => r.segment));

    // Every dispatched segment has at least one documented endpoint.
    const undocumented = [...dispatched].filter((s) => !documented.has(s));
    expect(
      undocumented,
      `dispatched but missing from the manifest: ${undocumented.join(', ')}`,
    ).toEqual([]);

    // Every documented segment is really dispatched (no stale entries).
    const phantom = [...documented].filter((s) => !dispatched.has(s));
    expect(phantom, `in the manifest but not dispatched: ${phantom.join(', ')}`).toEqual([]);
  });

  it('documents every HTTP method a dispatched segment handles', () => {
    // The check above is per SEGMENT, so it stays green when an existing
    // segment grows a verb: adding PATCH to /diagrams passes, because
    // 'diagrams' is already documented. The published description is what
    // external callers build against (spec/37, spec/61), and an endpoint
    // missing from it is one nobody can discover.
    //
    // Route handlers spell the check two ways: `method === 'PUT'` to select a
    // branch, and `method !== 'POST'` as a single-verb guard clause. Both are
    // read, and the walk follows each handler's sibling route modules so the
    // split diagram routes are not missed.
    const handled = handledMethodsBySegment();
    const documented = new Map<string, Set<string>>();
    for (const route of ROUTE_MANIFEST) {
      const set = documented.get(route.segment) ?? new Set<string>();
      set.add(route.method.toUpperCase());
      documented.set(route.segment, set);
    }

    // Vacuity guard: if the source walk stops finding verbs, every assertion
    // below passes without checking anything.
    expect(handled.size).toBeGreaterThan(15);
    for (const [segment, methods] of handled) {
      expect(methods.size, `${segment}: no HTTP method found in its handler`).toBeGreaterThan(0);
    }

    const missing: string[] = [];
    for (const [segment, methods] of handled) {
      for (const method of methods) {
        if (!documented.get(segment)?.has(method)) missing.push(`${method} /${segment}`);
      }
    }
    expect(missing, `handled but absent from the manifest: ${missing.join(', ')}`).toEqual([]);
  });

  it("each entry's path starts with its declared segment", () => {
    for (const route of ROUTE_MANIFEST) {
      expect(route.path.startsWith(`/${route.segment}`), `${route.method} ${route.path}`).toBe(
        true,
      );
    }
  });

  it('has no duplicate (method, path) pairs', () => {
    const seen = new Set<string>();
    for (const route of ROUTE_MANIFEST) {
      const key = `${route.method} ${route.path}`;
      expect(seen.has(key), `duplicate ${key}`).toBe(false);
      seen.add(key);
    }
  });
});

describe('rate-limited operations declare 429', () => {
  // index.ts throttles before dispatch, so no manifest entry declares 429 and
  // document.ts derives it. That derivation mirrors a rule living in another
  // file, which is exactly the kind of pair that drifts: these pin the shape
  // of the answer rather than a count that would need editing per route.
  const doc = buildOpenApiDocument() as {
    paths: Record<string, Record<string, { responses?: Record<string, unknown> }>>;
  };
  const responsesFor = (route: (typeof ROUTE_MANIFEST)[number]) =>
    // Paths are keyed unprefixed; `/api` lives on the servers entry.
    doc.paths[route.path]?.[route.method.toLowerCase()]?.responses ?? {};

  it('covers every write except the telemetry ingest', () => {
    const writes = ROUTE_MANIFEST.filter((r) => r.method !== 'GET');
    expect(writes.length).toBeGreaterThan(40);
    for (const route of writes) {
      const expected = route.path !== '/events';
      expect(Boolean(responsesFor(route)['429']), `${route.method} ${route.path}`).toBe(expected);
    }
  });

  it('covers a read only when a token or an IP budget can reach it', () => {
    // A read no token can reach is never throttled, and documenting a 429
    // there would send an integrator writing retry logic for a status that
    // cannot occur. `/unfurl` declares its own (per-IP, SSRF guard).
    for (const route of ROUTE_MANIFEST.filter((r) => r.method === 'GET')) {
      const expected =
        route.tokenUsable === true ||
        route.path === '/share/{code}' ||
        route.statuses.includes(429);
      expect(Boolean(responsesFor(route)['429']), `GET ${route.path}`).toBe(expected);
    }
  });

  it('describes the 429 as retryable rather than as a bare error', () => {
    const write = ROUTE_MANIFEST.find((r) => r.method === 'PUT')!;
    const res = responsesFor(write)['429'] as { description: string };
    expect(res.description).toMatch(/retry/i);
  });
});

describe('OpenAPI schema references', () => {
  const known = new Set([...Object.keys(COMPONENT_SCHEMAS), 'Error']);

  // Collect every `#/components/schemas/<Name>` referenced anywhere in the
  // manifest's inline bodies + string schema names.
  function refsIn(value: unknown, out: Set<string>): void {
    if (Array.isArray(value)) {
      for (const v of value) refsIn(v, out);
    } else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        if (k === '$ref' && typeof v === 'string') {
          const name = v.replace('#/components/schemas/', '');
          out.add(name);
        } else {
          refsIn(v, out);
        }
      }
    }
  }

  it('every referenced component schema exists', () => {
    const refs = new Set<string>();
    for (const route of ROUTE_MANIFEST) {
      if (typeof route.requestSchema === 'string') refs.add(route.requestSchema);
      else if (route.requestSchema) refsIn(route.requestSchema, refs);
      if (typeof route.responseSchema === 'string') refs.add(route.responseSchema);
      else if (route.responseSchema) refsIn(route.responseSchema, refs);
    }
    const missing = [...refs].filter((r) => !known.has(r));
    expect(missing, `referenced but not generated: ${missing.join(', ')}`).toEqual([]);
  });

  it('the assembled document references only known schemas', () => {
    const doc = buildOpenApiDocument();
    const refs = new Set<string>();
    refsIn(doc.paths, refs);
    const missing = [...refs].filter((r) => !known.has(r));
    expect(missing, `document refs missing from components: ${missing.join(', ')}`).toEqual([]);
  });
});

describe('generated component schemas are up to date', () => {
  it('match a fresh generation from @livediagram/api-schema', async () => {
    // Computed URL so tsc doesn't try to resolve the JS build script (it has no
    // types); the script imports the heavy generator, kept out of the worker
    // bundle. Regenerate with `pnpm --filter @livediagram/api gen:openapi`.
    const url = new URL('../../scripts/gen-openapi-schemas.mjs', import.meta.url).href;
    const mod = (await import(url)) as {
      generateComponentSchemas: () => Record<string, JsonSchema>;
    };
    const fresh = mod.generateComponentSchemas();
    expect(
      fresh,
      'schemas.generated.ts is stale — run: pnpm --filter @livediagram/api gen:openapi',
    ).toEqual(COMPONENT_SCHEMAS);
    // Generous timeout: this dynamically imports the heavy schema generator
    // (kept out of the worker bundle), which is cold-loaded here and overran
    // vitest's 5s default on CI.
  }, 30_000);
});

describe('buildOpenApiDocument', () => {
  it('assembles a well-formed document for every manifest entry', () => {
    const doc = buildOpenApiDocument();
    expect(doc.openapi).toBe('3.1.0');
    for (const route of ROUTE_MANIFEST) {
      const op = doc.paths[route.path]?.[route.method.toLowerCase()];
      expect(op, `${route.method} ${route.path} missing from document`).toBeDefined();
    }
    // Error envelope is always present for handlers to reference.
    expect(doc.components.schemas.Error).toBeDefined();
  });
});
