// A scripted git for the `link review` suites (docs/specs/027-repositories/blueprints/link-review.md "Testing"):
// named commits holding files, refs naming them, and the merge base, answered as `runTool('git', …)` would.

import type { ToolRun } from '../io';

export type FakeRepo = {
  // Commit id to its files.
  commits: Record<string, Record<string, string>>;
  // Ref to commit id.
  refs: Record<string, string>;
  // The merge base `merge-base` answers; null for none.
  mergeBase: string | null;
  // False answers as outside a work tree.
  inside?: boolean;
  // Whether `diff` fails.
  diffFails?: boolean;
};

export function fakeGit(repo: FakeRepo) {
  const calls: string[][] = [];
  const tool = (command: string, args: readonly string[]): ToolRun | null => {
    if (command !== 'git') return null;
    const [, , verb, ...rest] = args;
    calls.push([verb!, ...rest]);
    const ok = (stdout: string) => ({ code: 0, stdout });
    const fail = { code: 128, stdout: '' };
    if (verb === 'rev-parse' && rest[0] === '--is-inside-work-tree')
      return repo.inside === false ? fail : ok('true\n');
    if (verb === 'rev-parse') {
      const ref = rest.at(-1)!.replace(/\^\{commit\}$/, '');
      const commit = repo.refs[ref];
      return commit ? ok(`${commit}\n`) : { code: 1, stdout: '' };
    }
    if (verb === 'merge-base')
      return repo.mergeBase ? ok(`${repo.mergeBase}\n`) : { code: 1, stdout: '' };
    if (verb === 'diff') {
      if (repo.diffFails) return fail;
      const [from, to] = rest.filter((a) => repo.commits[a] !== undefined);
      const a = repo.commits[from!]!;
      const b = repo.commits[to!]!;
      const paths = [...new Set([...Object.keys(a), ...Object.keys(b)])]
        .filter((p) => a[p] !== b[p])
        .sort();
      return ok(paths.map((p) => `${p}\0`).join(''));
    }
    if (verb === 'show') {
      const spec = rest[0]!;
      const at = spec.indexOf(':');
      const text = repo.commits[spec.slice(0, at)]?.[spec.slice(at + 1)];
      return text === undefined ? fail : ok(text);
    }
    return fail;
  };
  return { tool, calls };
}
