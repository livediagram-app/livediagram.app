import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { withoutGitRepoEnv } from '@liveworkspace/cli-kit/git-env';
import { nodeIo } from '../node-io';
import { gitDirOf, gitMove, gitRemote } from './git';
import { linkStateDir } from './local-state';
import { parseLinkFile } from './link-file';

// The git a sync asks, against a real git in a temporary directory (docs/specs/027-repositories/blueprints/
// repository-link.md "Testing"); skipped where git is absent.

const hasGit = spawnSync('git', ['--version']).status === 0;
const base = realpathSync(mkdtempSync(join(tmpdir(), 'livediagram-git-')));
// A git hook exports GIT_DIR, GIT_INDEX_FILE and GIT_WORK_TREE; a temporary repository must never inherit them, and
// git must never walk up out of the temporary parent into the repository being pushed.
const sh = (cwd: string, ...args: string[]) => {
  const env = withoutGitRepoEnv(process.env, { GIT_CEILING_DIRECTORIES: dirname(base) });
  const run = spawnSync('git', args, { cwd, encoding: 'utf8', env });
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

describe.skipIf(!hasGit)('git inside a hook environment', () => {
  const identity = (dir: string) => {
    sh(dir, 'config', 'user.email', 'agent@example.org');
    sh(dir, 'config', 'user.name', 'Agent');
  };
  const decoyState = (decoy: string) => ({
    log: sh(decoy, 'log', '--format=%H'),
    status: sh(decoy, 'status', '--porcelain'),
    index: readFileSync(join(decoy, '.git/index')).toString('hex'),
    config: readFileSync(join(decoy, '.git/config'), 'utf8'),
  });

  it('never touches the repository GIT_DIR, GIT_INDEX_FILE and GIT_WORK_TREE name', async () => {
    const decoy = join(base, 'decoy');
    mkdirSync(decoy);
    sh(decoy, 'init', '-q', '-b', 'main');
    identity(decoy);
    writeFileSync(join(decoy, 'a.json'), '{}');
    sh(decoy, 'add', 'a.json');
    sh(decoy, 'commit', '-q', '-m', 'decoy first');
    const before = decoyState(decoy);
    const saved = { ...process.env };
    Object.assign(process.env, {
      GIT_DIR: join(decoy, '.git'),
      GIT_INDEX_FILE: join(decoy, '.git/index'),
      GIT_WORK_TREE: decoy,
    });
    try {
      const temp = join(base, 'hooked');
      mkdirSync(temp);
      sh(temp, 'init', '-q', '-b', 'main');
      identity(temp);
      writeFileSync(join(temp, 'b.json'), '{}');
      sh(temp, 'add', 'b.json');
      sh(temp, 'commit', '-q', '-m', 'hooked first');
      mkdirSync(join(temp, 'sub'));
      // The code under test runs git through the real runTool, which inherits the same environment.
      expect(await gitMove(nodeIo(), temp, 'b.json', 'sub/moved.json')).toBe(true);
      expect(await gitDirOf(nodeIo(), temp)).toBe(join(temp, '.git'));
      expect(sh(temp, 'log', '--format=%s').trim()).toBe('hooked first');
    } finally {
      for (const name of ['GIT_DIR', 'GIT_INDEX_FILE', 'GIT_WORK_TREE']) {
        if (saved[name] === undefined) delete process.env[name];
        else process.env[name] = saved[name];
      }
    }
    expect(decoyState(decoy)).toEqual(before);
    expect(sh(decoy, 'config', '--get', 'core.bare').trim()).toBe('false');
  });
});
