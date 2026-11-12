// The reverse index a delivery needs (docs/specs/026-plan/github-pull-requests.md "Storage"; blueprint "Part 2"), in
// the GITHUB_LINKS KV namespace: one empty key per pair, `repo:{repository id}:{plan id}` for each chosen repository
// and `installation:{installation id}:{plan id}` for the installation, so two plans connecting at once never
// overwrite each other. The plan's object is the truth and writes these from its own connection; a delivery lists
// them by prefix, and each plan checks the delivery against its connection before it acts.

/** What a plan's connection puts in the index: its installation and its chosen repositories. */
export type LinkSet = { installationId: number | null; repositoryIds: readonly number[] };

export const NO_LINKS: LinkSet = { installationId: null, repositoryIds: [] };

const repoPrefix = (repoId: number) => `repo:${repoId}:`;
const installationPrefix = (installationId: number) => `installation:${installationId}:`;
export const repoKey = (repoId: number, planId: string) => `${repoPrefix(repoId)}${planId}`;
const installationKey = (installationId: number, planId: string) =>
  `${installationPrefix(installationId)}${planId}`;

function keysOf(planId: string, links: LinkSet): Set<string> {
  const keys = new Set(links.repositoryIds.map((id) => repoKey(id, planId)));
  if (links.installationId !== null) keys.add(installationKey(links.installationId, planId));
  return keys;
}

/** The plans listed under a prefix, at most `limit`. */
async function plansUnder(kv: KVNamespace, prefix: string, limit: number): Promise<string[]> {
  const listed = await kv.list({ prefix, limit });
  return listed.keys.map((k) => k.name.slice(prefix.length)).filter((id) => id !== '');
}

export const plansOfRepository = (kv: KVNamespace, repoId: number, limit: number) =>
  plansUnder(kv, repoPrefix(repoId), limit);

export const plansOfInstallation = (kv: KVNamespace, installationId: number, limit: number) =>
  plansUnder(kv, installationPrefix(installationId), limit);

/** The keys `after` has and `before` lacks are put, the ones `before` alone has deleted, all at once. */
export async function rewriteLinks(
  kv: KVNamespace,
  planId: string,
  before: LinkSet,
  after: LinkSet,
): Promise<void> {
  const was = keysOf(planId, before);
  const now = keysOf(planId, after);
  await Promise.all([
    ...[...now].filter((k) => !was.has(k)).map((k) => kv.put(k, '')),
    ...[...was].filter((k) => !now.has(k)).map((k) => kv.delete(k)),
  ]);
}
