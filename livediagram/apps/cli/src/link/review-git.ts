// The git `link review` asks (docs/specs/027-repositories/blueprints/link-review.md "`link review`" steps 1 to 3):
// the range from the merge base, the mirror files git says changed, and a file at one commit. Each runs
// `git -C <dir> …` without a shell, refs after `--end-of-options` so none is read as an option.

import { EXIT } from '@liveworkspace/cli-kit/exit-codes';
import type { CliIo } from '../io';
import { CliError } from '../output/cli-error';
import { PULL_FILE_SUFFIX } from '../sync/pull-file';

export type ReviewRange = { base: string; head: string };

const git = (io: CliIo, args: readonly string[]) => io.runTool('git', ['-C', io.cwd, ...args], '');

const HINT = 'livediagram link review --help';

// The full commit id a ref names, or null when git cannot resolve it.
async function commitOf(io: CliIo, ref: string): Promise<string | null> {
  const run = await git(io, [
    'rev-parse',
    '--verify',
    '--quiet',
    '--end-of-options',
    `${ref}^{commit}`,
  ]);
  return run?.code === 0 && run.stdout.trim() ? run.stdout.trim() : null;
}

// The merge base of `base` and `head`, and `head`, as full commit ids; refused when there is no work tree, a ref
// does not resolve, or a shallow clone lacks the merge base.
export async function reviewRange(io: CliIo, base: string, head: string): Promise<ReviewRange> {
  const inside = await git(io, ['rev-parse', '--is-inside-work-tree']);
  if (inside?.code !== 0 || inside.stdout.trim() !== 'true')
    throw new CliError({
      exit: EXIT.usage,
      code: 'not_a_repository',
      message: `${io.cwd} is not inside a git work tree`,
      hint: 'run livediagram link review inside the repository',
    });
  const commits: string[] = [];
  for (const ref of [base, head]) {
    const commit = await commitOf(io, ref);
    if (commit === null)
      throw new CliError({
        exit: EXIT.usage,
        code: 'bad_revision',
        message: `git cannot find the commit ${JSON.stringify(ref)}`,
        hint: HINT,
      });
    commits.push(commit);
  }
  const [baseCommit, headCommit] = commits as [string, string];
  const merged = await git(io, ['merge-base', '--end-of-options', baseCommit, headCommit]);
  const mergeBase = merged?.code === 0 ? merged.stdout.trim() : '';
  if (!mergeBase)
    throw new CliError({
      exit: EXIT.usage,
      code: 'no_merge_base',
      message: `${base} and ${head} share no history here`,
      hint: 'fetch the full history (actions/checkout fetch-depth: 0)',
    });
  return { base: mergeBase, head: headCommit };
}

// The mirror files changed between the two commits, at or below the working directory, relative to the repository
// root, in git's order.
export async function changedMirrorPaths(io: CliIo, range: ReviewRange): Promise<string[]> {
  const run = await git(io, [
    'diff',
    '--name-only',
    '-z',
    '--no-renames',
    range.base,
    range.head,
    '--',
    `*${PULL_FILE_SUFFIX}`,
  ]);
  if (run?.code !== 0)
    throw new CliError({
      exit: EXIT.failure,
      code: 'git_failed',
      message: 'git could not compare the two commits',
      hint: HINT,
    });
  return run.stdout.split('\0').filter((path) => path.endsWith(PULL_FILE_SUFFIX));
}

// A file's text at a commit, or null when the file is not there.
export async function fileAt(io: CliIo, commit: string, path: string): Promise<string | null> {
  const run = await git(io, ['show', `${commit}:${path}`]);
  return run?.code === 0 ? run.stdout : null;
}
