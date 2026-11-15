// The variables git exports to a hook (and reads to pick its repository). A `git` run from a CLI, or from a test's
// temporary repository, inside a hook such as pre-push must not inherit them: they would make git act on the
// repository being pushed instead of the directory it was asked about.
export const gitRepoVars = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_PREFIX',
  'GIT_COMMON_DIR',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_QUARANTINE_PATH',
  'GIT_NAMESPACE',
  'GIT_CEILING_DIRECTORIES',
  'GIT_DISCOVERY_ACROSS_FILESYSTEM',
] as const;

// A copy of `env` without the repository variables, with any `extra` entries added after.
export function withoutGitRepoEnv(
  env: NodeJS.ProcessEnv,
  extra: Record<string, string> = {},
): NodeJS.ProcessEnv {
  const clean = { ...env };
  for (const name of gitRepoVars) delete clean[name];
  return { ...clean, ...extra };
}
