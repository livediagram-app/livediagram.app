import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Every request the api client makes goes through `apiFetch` in core.ts, which
// is the one place that sees them all. Today it raises the write signal that
// makes the Timeline notice a change without a refresh; the point is that it is
// the funnel, so anything it grows later applies everywhere at once.
//
// A module calling `fetch` directly still works, which is what makes this worth
// pinning: activity.ts did, and because its call is a GET and the signal only
// fires on writes, nothing behaved differently and nothing failed. It would
// have quietly opted out of whatever came next.

const API_DIR = fileURLToPath(new URL('.', import.meta.url));

// `fetch(` not preceded by a word character or a dot, so `apiFetch(` and
// `window.fetch(` do not count as bare calls. Deliberately NOT a global regex:
// `.test()` on one of those advances `lastIndex` between calls, so reusing it
// across the modules below would start each search part-way through the file
// and miss what it was built to find.
const BARE_FETCH = /(?<![\w.])fetch\(/;

const modules = readdirSync(API_DIR)
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
  // core.ts is where apiFetch lives, so it is the one place that may call fetch.
  .filter((f) => f !== 'core.ts');

describe('the api client fetch funnel', () => {
  it('sees the modules at all (guard against this test going blind)', () => {
    // The modules every editor shares (oauth, tokens) are the workbench's now, checked below.
    expect(modules.length).toBeGreaterThan(10);
    expect(modules).toContain('projects.ts');
  });

  it('routes every request through apiFetch', () => {
    const offenders = modules.filter((f) =>
      BARE_FETCH.test(readFileSync(`${API_DIR}/${f}`, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  // The api modules every editor shares (@liveworkspace/workbench/lib/api) go through the funnel too.
  it('routes the shared api modules through apiFetch too', () => {
    const dir = fileURLToPath(
      new URL('../../../../../packages/workbench/src/lib/api', import.meta.url),
    );
    const shared = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    expect(shared.length).toBeGreaterThan(0);
    expect(shared.filter((f) => BARE_FETCH.test(readFileSync(`${dir}/${f}`, 'utf8')))).toEqual([]);
  });

  it('confirms core.ts is the one module that calls fetch', () => {
    expect(readFileSync(`${API_DIR}/core.ts`, 'utf8')).toMatch(BARE_FETCH);
  });
});
