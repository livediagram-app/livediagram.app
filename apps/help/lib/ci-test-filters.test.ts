import { describe, expect, it } from 'vitest';
import { plainTestFilters, workspaceManifests } from '../../../scripts/ci-test-filters.mjs';

// scripts/ci-test-filters.mjs decides which workspaces CI runs plain `test` for:
// every workspace EXCEPT those with `test:coverage`, whose coverage run already
// runs their whole suite (docs/specs/016-platform/deployment.md). It lives here
// with the other repo-wide guards because scripts/ belongs to no workspace.
describe('plainTestFilters', () => {
  it('excludes each workspace that defines test:coverage', () => {
    const filters = plainTestFilters([
      { name: '@x/a', scripts: { test: 'vitest run', 'test:coverage': 'vitest run --coverage' } },
      { name: '@x/b', scripts: { test: 'vitest run' } },
      { name: '@x/c', scripts: { 'test:coverage': 'vitest run --coverage' } },
      { name: '@x/d' },
    ]);
    expect(filters).toEqual(['--filter=!@x/a', '--filter=!@x/c']);
  });

  it('excludes nothing when no workspace measures coverage', () => {
    expect(plainTestFilters([{ name: '@x/a', scripts: { test: 'vitest run' } }])).toEqual([]);
  });
});

describe('workspaceManifests', () => {
  it('reads every app and package in the repo', () => {
    const names = workspaceManifests().map((m) => m.name);
    expect(names).toContain('@livediagram/live');
    expect(names).toContain('@livediagram/diagram');
    // Guard against the glob going blind and the filter list collapsing to empty.
    expect(names.length).toBeGreaterThan(15);
  });

  it('gives every coverage workspace a plain test script too, so nothing runs twice or never', () => {
    for (const m of workspaceManifests()) {
      if (m.scripts?.['test:coverage']) expect(m.scripts.test, m.name).toBeDefined();
    }
  });
});
