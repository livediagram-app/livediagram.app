// The git a sync asks (docs/specs/027-repositories/blueprints/repository-link.md "Paths", "Data and persistence",
// "`link init`"): the work tree's git directory, a move git records, and whether the repository has a remote. Each
// runs `git -C <dir> …` without a shell; a missing git or a refusal answers as if there were no work tree (RL8, RL9,
// RL40).

import type { CliIo } from '../io';

const git = (io: CliIo, dir: string, args: readonly string[]) =>
  io.runTool('git', ['-C', dir, ...args], '');

// `git rev-parse --absolute-git-dir`: each worktree answers its own; null outside a work tree or without git.
export async function gitDirOf(io: CliIo, dir: string): Promise<string | null> {
  const run = await git(io, dir, ['rev-parse', '--absolute-git-dir']);
  return run?.code === 0 && run.stdout.trim() ? run.stdout.trim() : null;
}

// `git mv`, paths relative to `root`; false when git refused (an untracked file, a locked index) or is absent.
export async function gitMove(io: CliIo, root: string, from: string, to: string): Promise<boolean> {
  const run = await git(io, root, ['mv', '--', from, to]);
  return run?.code === 0;
}

// `git remote` with any output: yes; none: no; no git or no work tree: unknown.
export async function gitRemote(io: CliIo, dir: string): Promise<'yes' | 'no' | 'unknown'> {
  const run = await git(io, dir, ['remote']);
  if (run?.code !== 0) return 'unknown';
  return run.stdout.trim() ? 'yes' : 'no';
}
