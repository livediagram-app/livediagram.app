// The GitHub Action's cleanup on close (docs/specs/027-repositories/blueprints/link-review.md "The Action"): review.sh
// run against real git, a bare origin holding the previews branch and a checkout beside it.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ACTION = join(import.meta.dirname, '../../github-action');
const HELP = join(import.meta.dirname, '../../../help/app/developers/repositories/page.mdx');
const BRANCH = 'livediagram-previews';

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

let dir: string;
let origin: string;
let checkout: string;

// A previews branch holding a folder per pull request, each with one picture.
function seedPreviews(prs: string[]) {
  const seed = join(dir, 'seed');
  git(dir, 'init', '--quiet', '--initial-branch', BRANCH, seed);
  for (const pr of prs) {
    mkdirSync(join(seed, `pr-${pr}`), { recursive: true });
    writeFileSync(join(seed, `pr-${pr}`, 'a.png'), pr);
  }
  git(seed, 'add', '-A');
  git(seed, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--quiet', '-m', 'seed');
  git(seed, 'push', '--quiet', origin, `HEAD:refs/heads/${BRANCH}`);
}

function run(env: Record<string, string>) {
  return spawnSync('bash', [join(ACTION, 'review.sh')], {
    cwd: checkout,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH ?? '',
      HOME: dir,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GITHUB_REPOSITORY: 'o/r',
      REVIEW_BASE: 'base',
      REVIEW_HEAD: 'head',
      REVIEW_EVENT_ACTION: 'closed',
      RUNNER_TEMP: dir,
      ...env,
    },
  });
}

const files = () => git(origin, 'ls-tree', '-r', '--name-only', BRANCH).split('\n').filter(Boolean);
const commits = () => Number(git(origin, 'rev-list', '--count', BRANCH));

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'review-action-'));
  origin = join(dir, 'origin.git');
  git(dir, 'init', '--quiet', '--bare', origin);
  checkout = join(dir, 'checkout');
  git(dir, 'init', '--quiet', checkout);
  git(
    checkout,
    '-c',
    'user.name=t',
    '-c',
    'user.email=t@t',
    'commit',
    '--quiet',
    '--allow-empty',
    '-m',
    'c',
  );
  git(checkout, 'remote', 'add', 'origin', origin);
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('review.sh on a closed pull request', () => {
  it('removes that pull request folder and no other, in one commit', () => {
    seedPreviews(['1', '12', '123']);
    const result = run({ REVIEW_PR: '12' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Removed the pictures for #12.');
    expect(files()).toEqual(['pr-1/a.png', 'pr-123/a.png']);
    expect(commits()).toBe(2);
    expect(git(origin, 'log', '-1', '--format=%s', BRANCH)).toBe(
      'livediagram: remove pictures for #12',
    );
    expect(git(origin, 'log', '-1', '--format=%an', BRANCH)).toBe('github-actions[bot]');
  });

  it('does not touch pr-1 when pr-12 closes, nor pr-12 when pr-1 closes', () => {
    seedPreviews(['1', '12']);
    expect(run({ REVIEW_PR: '1' }).status).toBe(0);
    expect(files()).toEqual(['pr-12/a.png']);
  });

  it('does nothing when the pull request has no folder', () => {
    seedPreviews(['1']);
    const result = run({ REVIEW_PR: '2' });
    expect(result.status).toBe(0);
    expect(files()).toEqual(['pr-1/a.png']);
    expect(commits()).toBe(1);
  });

  it('does nothing when the previews branch does not exist', () => {
    const result = run({ REVIEW_PR: '2' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('No pictures to remove for #2.');
  });

  it('does nothing for a pull request from a fork, whose token is read-only', () => {
    seedPreviews(['3']);
    expect(run({ REVIEW_PR: '3', REVIEW_FORK: 'true' }).status).toBe(0);
    expect(files()).toEqual(['pr-3/a.png']);
  });

  it('refuses a pull request number that is not digits, before anything is removed', () => {
    seedPreviews(['1', '12']);
    for (const bad of ['1/../12', '*', '', '1 2', '../x']) {
      const result = run({ REVIEW_PR: bad });
      expect(result.status).not.toBe(0);
    }
    expect(files()).toEqual(['pr-1/a.png', 'pr-12/a.png']);
  });

  it('fails the step after the attempts when the push is never accepted', () => {
    seedPreviews(['4']);
    // A hook on the origin that always refuses the push.
    writeFileSync(join(origin, 'hooks', 'pre-receive'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    const result = run({ REVIEW_PR: '4' });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('could not remove the pictures');
    expect(files()).toEqual(['pr-4/a.png']);
  });
});

describe('the example workflow', () => {
  it('is the workflow the help article shows, and lists closed so the cleanup runs', () => {
    const example = readFileSync(join(ACTION, 'workflow.example.yml'), 'utf8');
    const article = readFileSync(HELP, 'utf8');
    const shown = /```yaml\n# \.github\/workflows\/diagram-changes\.yml\n([\s\S]*?)```/.exec(
      article,
    )?.[1];
    const body = example.slice(example.indexOf('name: Diagram changes'));
    expect(shown?.trim()).toBe(body.trim());
    expect(body).toContain('closed');
  });
});
