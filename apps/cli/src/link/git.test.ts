import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { nodeIo } from '../node-io';
import { gitDirOf, gitMove, gitRemote } from './git';
import { linkStateDir } from './local-state';
import { parseLinkFile } from './link-file';

// The git a sync asks, against a real git in a temporary directory (docs/specs/027-repositories/blueprints/
// repository-link.md "Testing"); skipped where git is absent.

const hasGit = spawnSync('git', ['--version']).status === 0;
const base = realpathSync(mkdtempSync(join(tmpdir(), 'livediagram-git-')));
const sh = (cwd: string, ...args: string[]) => {
  const run = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (run.status !== 0) throw new Error(run.stderr);
  return run.stdout;
};

afterAll(() => rmSync(base, { recursive: true, force: true }));

describe.skipIf(!hasGit)('git', () => {
  const io = nodeIo();
  const repo = join(base, 'repo');
  mkdirSync(repo);
  sh(repo, 'init', '-q', '-b', 'main');
  sh(repo, 'config', 'user.email', 'agent@example.org');
  sh(repo, 'config', 'user.name', 'Agent');
  writeFileSync(join(repo, 'tracked.json'), '{}');
  writeFileSync(join(repo, 'untracked.json'), '{}');
  sh(repo, 'add', 'tracked.json');
  sh(repo, 'commit', '-q', '-m', 'first');

  it('names each worktree’s own git directory, and none outside a work tree', async () => {
    const worktree = join(base, 'worktree');
    sh(repo, 'worktree', 'add', '-q', worktree);
    expect(await gitDirOf(io, repo)).toBe(join(repo, '.git'));
    expect(await gitDirOf(io, worktree)).toBe(join(repo, '.git/worktrees/worktree'));
    expect(await gitDirOf(io, base)).toBeNull();
    const link = (root: string) =>
      parseLinkFile('[covers]\nfolder = "f"\n', join(root, 'livediagram.toml'));
    const [main, other] = [
      await linkStateDir(io, link(repo)),
      await linkStateDir(io, link(worktree)),
    ];
    expect(main).toMatch(new RegExp(`^${join(repo, '.git/livediagram/')}[0-9a-f]{16}$`));
    expect(other).toMatch(
      new RegExp(`^${join(repo, '.git/worktrees/worktree/livediagram/')}[0-9a-f]{16}$`),
    );
  });

  it('moves a tracked file through git, and refuses an untracked one', async () => {
    mkdirSync(join(repo, 'sub'));
    expect(await gitMove(io, repo, 'tracked.json', 'sub/moved.json')).toBe(true);
    expect(sh(repo, 'status', '--porcelain')).toContain('R  tracked.json -> sub/moved.json');
    expect(await gitMove(io, repo, 'untracked.json', 'sub/u.json')).toBe(false);
    expect(existsSync(join(repo, 'untracked.json'))).toBe(true);
  });

  it('knows whether the repository has a remote', async () => {
    expect(await gitRemote(io, repo)).toBe('no');
    sh(repo, 'remote', 'add', 'origin', 'https://example.org/repo.git');
    expect(await gitRemote(io, repo)).toBe('yes');
    expect(await gitRemote(io, base)).toBe('unknown');
  });
});
