// Deletes the Actions caches a newer save has replaced (docs/ci.md "Cache pruning"). Each cache saved
// on main is keyed by its family and then the commit (turbo-v1-checks-livediagram-<lock>-<sha>,
// next-v2-liveplanner-sites-<lock>-<sha>), and a restore takes the newest of its family, so only the
// newest copy is ever read again. The older ones still count against the repository's 10 GB, and
// GitHub evicts the least recently used caches past it, whichever family they belong to.

const COMMIT = /-[0-9a-f]{40}$/;

// The ids to delete: every cache whose key ends in a commit, except the newest of its family on its
// ref. A key without a commit (setup-node's pnpm store) is never touched.
export function superseded(caches) {
  const newest = new Map();
  for (const cache of caches) {
    if (!COMMIT.test(cache.key)) continue;
    const family = `${cache.ref} ${cache.key.replace(COMMIT, '')}`;
    const kept = newest.get(family);
    if (!kept || Date.parse(cache.created_at) > Date.parse(kept.created_at)) {
      newest.set(family, cache);
    }
  }
  const keep = new Set([...newest.values()].map((cache) => cache.id));
  return caches
    .filter((cache) => COMMIT.test(cache.key) && !keep.has(cache.id))
    .map((cache) => cache.id);
}

async function main() {
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo } = process.env;
  const api = (path, init = {}) =>
    fetch(`https://api.github.com/repos/${repo}/actions/caches${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' },
    });

  const caches = [];
  for (let page = 1; ; page++) {
    const response = await api(`?per_page=100&page=${page}`);
    if (!response.ok)
      throw new Error(`listing caches: ${response.status} ${await response.text()}`);
    const { actions_caches: batch } = await response.json();
    caches.push(...batch);
    if (batch.length < 100) break;
  }

  const ids = superseded(caches);
  const bytes = caches
    .filter((c) => ids.includes(c.id))
    .reduce((sum, c) => sum + c.size_in_bytes, 0);
  let failed = 0;
  for (const id of ids) {
    // A 404 is a cache another run already deleted, or GitHub already evicted.
    const response = await api(`/${id}`, { method: 'DELETE' });
    if (!response.ok && response.status !== 404) {
      failed++;
      console.error(`[cache-prune] ${id}: ${response.status}`);
    }
  }
  console.log(
    `[cache-prune] ${caches.length} caches, ${ids.length} superseded (${(bytes / 1e9).toFixed(2)} GB) deleted, ${failed} failed`,
  );
  if (failed) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
