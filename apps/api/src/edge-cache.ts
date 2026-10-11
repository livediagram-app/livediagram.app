// A public, identity-free GET answered from Cloudflare's edge cache (the Cache API) for a short while.
// A Worker's own responses never enter the CDN cache by their Cache-Control alone, so without this every
// visitor's request ran the query, however public the answer. The telemetry summary
// (routes/telemetry.ts) caches the same way.
//
// Only for answers that are the same for every caller: nothing personal may pass through here. Skipped on
// localhost (a developer would not see their own changes for `maxAgeSeconds`) and where the runtime has no
// Cache API (tests). Only a 200 is kept.

import { isLoopbackHostname } from '@livediagram/api-schema';

export async function edgeCached(
  url: URL,
  maxAgeSeconds: number,
  produce: () => Promise<Response>,
): Promise<Response> {
  const cache =
    typeof caches === 'undefined' || isLoopbackHostname(url.hostname) ? null : caches.default;
  const key = new Request(url.toString());
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return hit;
  }
  const res = await produce();
  if (res.status !== 200) return res;
  res.headers.set('Cache-Control', `public, max-age=${maxAgeSeconds}`);
  // Awaited (the worker's fetch signature has no ctx.waitUntil) so the put completes.
  if (cache) await cache.put(key, res.clone());
  return res;
}
