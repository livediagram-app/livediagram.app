import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { API_ROUTE_RESOURCES } from '@livediagram/api-schema';

// A server crash reports `Error·Api·Internal.<Method>.<Route>` (docs/specs/017-telemetry/telemetry.md), and
// the route part only names a resource that is in API_ROUTE_RESOURCES:
// anything else reads `Unknown`. So a resource added to the dispatch switch
// but not to that list would crash as `Unknown` and nobody would notice
// which endpoint broke. Keep the two identical.

const INDEX = readFileSync(fileURLToPath(new URL('./index.ts', import.meta.url).href), 'utf8');

describe('error route labels', () => {
  it('know every resource the worker dispatches on', () => {
    const dispatch = INDEX.slice(INDEX.indexOf('switch (segments[1])'));
    const cases = [...dispatch.slice(0, dispatch.indexOf('} catch')).matchAll(/case '([^']+)':/g)]
      .map((m) => m[1])
      .sort();
    expect(cases.length).toBeGreaterThan(15);
    expect(cases).toEqual([...API_ROUTE_RESOURCES].sort());
  });
});
