// A Worker's local `.dev.vars`, made from its `.dev.vars.example` when there is none
// (liveworkspace/docs/specs/003-accounts/sign-in.md "Local clients"), so a fresh checkout or worktree runs with no manual
// steps. An existing `.dev.vars` is never changed: it may hold secrets nobody can get back, so the copy is an exclusive
// create, which can't overwrite one even when two dev servers start at once. Run from a Worker's `dev` script:
//
//   node ../../../packages/api-kit/scripts/dev-vars.ts                       # copy when missing
//   node ../../../packages/api-kit/scripts/dev-vars.ts --after <file>        # ...but only once <file> exists
//
// `--after` holds an app's api back until the checkout's accounts Worker has its own `.dev.vars`: an api that names an
// accounts Worker sends every guest there, so it waits for the liveworkspace stack rather than break the editor run alone.
import { constants, copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type DevVarsOutcome = 'created' | 'kept' | 'no-example' | 'waiting';

export function ensureDevVars(dir: string, after?: string): DevVarsOutcome {
  const target = path.join(dir, '.dev.vars');
  const example = path.join(dir, '.dev.vars.example');
  if (existsSync(target)) return 'kept';
  if (!existsSync(example)) return 'no-example';
  if (after && !existsSync(path.resolve(dir, after))) return 'waiting';
  try {
    copyFileSync(example, target, constants.COPYFILE_EXCL);
    return 'created';
  } catch (error) {
    // Another process made it between the check and the copy: theirs stands.
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return 'kept';
    throw error;
  }
}

// What a dev server's log says, or nothing when there is nothing to say.
export function describe(outcome: DevVarsOutcome, after?: string): string | null {
  if (outcome === 'created')
    return '[dev-vars] made .dev.vars from .dev.vars.example (local values only)';
  if (outcome === 'waiting') {
    return `[dev-vars] no .dev.vars yet: running without the local accounts Worker. Start \`corepack pnpm dev:workspace\` (it makes ${after}), then restart this to sign in.`;
  }
  return null;
}

export function main(argv: string[], cwd: string, log: (line: string) => void): void {
  const at = argv.indexOf('--after');
  const after = at === -1 ? undefined : argv[at + 1];
  const line = describe(ensureDevVars(cwd, after), after);
  if (line) log(line);
}

// Typed here: this package's types are the Workers', whose `process` is not node's.
const { argv, cwd } = (globalThis as unknown as { process: { argv: string[]; cwd: () => string } })
  .process;
if (argv[1] && path.resolve(argv[1]) === fileURLToPath(import.meta.url)) {
  main(argv.slice(2), cwd(), console.log);
}
