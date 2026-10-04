import { describe, expect, it } from 'vitest';
import { hooksPathAction } from '../../../scripts/git-hooks/install.mjs';
import { prePushPlan, pushedShas } from '../../../scripts/git-hooks/pre-push.mjs';

// The pre-push hook (docs/specs/003-system-architecture/testing.md "Before a push") runs what CI's
// Checks and Tests would fail on, for what a push changes. It lives with the other repo-wide guards
// because scripts/ belongs to no workspace.
const COVERAGE_FILTERS = ['--filter=!@x/api'];
const labels = (files: string[]) => prePushPlan(files, COVERAGE_FILTERS).map((step) => step.label);

describe('prePushPlan', () => {
  it('plans nothing when nothing changed', () => {
    expect(prePushPlan([], COVERAGE_FILTERS)).toEqual([]);
  });

  it('checks formatting of only the changed files prettier formats', () => {
    const [format] = prePushPlan(
      ['apps/live/a.tsx', 'docs/b.md', '.github/workflows/c.yml', 'apps/live/d.png', 'e.mjs'],
      COVERAGE_FILTERS,
    );
    expect(format!.args).toEqual([
      'exec',
      'prettier',
      '--check',
      'apps/live/a.tsx',
      'docs/b.md',
      '.github/workflows/c.yml',
    ]);
  });

  it('runs lint, typecheck and both test tasks for the affected workspaces, as CI splits them', () => {
    const steps = prePushPlan(['apps/live/a.png'], COVERAGE_FILTERS);
    expect(steps.map((s) => s.args.join(' '))).toEqual([
      'exec turbo run lint typecheck --affected',
      'exec turbo run test --affected --concurrency=2 --filter=!@x/api',
      'exec turbo run test:coverage --affected --concurrency=2',
    ]);
  });

  it('adds the help guards when a file outside apps/ and packages/ changed', () => {
    expect(labels(['docs/specs/003-system-architecture/testing.md'])).toContain(
      'help guards (repo-wide references)',
    );
    expect(labels(['README.md'])).toContain('help guards (repo-wide references)');
    expect(labels(['apps/live/a.ts', 'packages/ui/b.ts'])).not.toContain(
      'help guards (repo-wide references)',
    );
  });

  it('runs the help guards last, after the affected suites', () => {
    const steps = prePushPlan(['docs/x.md'], COVERAGE_FILTERS);
    expect(steps.at(-1)!.args).toEqual([
      'exec',
      'turbo',
      'run',
      'test:coverage',
      '--filter=@livediagram/help',
    ]);
  });
});

describe('pushedShas', () => {
  const ZERO = '0'.repeat(40);

  it('reads the local sha of each pushed branch', () => {
    const input = `refs/heads/a ${'1'.repeat(40)} refs/heads/a ${ZERO}\n`;
    expect(pushedShas(input)).toEqual(['1'.repeat(40)]);
  });

  it('skips deletions and tags', () => {
    const input = [
      `(delete) ${ZERO} refs/heads/gone ${'2'.repeat(40)}`,
      `refs/tags/v1 ${'3'.repeat(40)} refs/tags/v1 ${ZERO}`,
      '',
    ].join('\n');
    expect(pushedShas(input)).toEqual([]);
  });
});

describe('hooksPathAction', () => {
  it('skips on CI and outside a work tree', () => {
    expect(hooksPathAction({ ci: true, insideWorkTree: true, current: '' })).toBe('skip-ci');
    expect(hooksPathAction({ ci: false, insideWorkTree: false, current: '' })).toBe('skip-no-git');
  });

  it('sets the hooks path once, then leaves it', () => {
    expect(hooksPathAction({ ci: false, insideWorkTree: true, current: '' })).toBe('set');
    expect(hooksPathAction({ ci: false, insideWorkTree: true, current: '.husky' })).toBe('set');
    expect(hooksPathAction({ ci: false, insideWorkTree: true, current: '.githooks' })).toBe(
      'unchanged',
    );
  });
});
