// A per-address counter in KV over a fixed window (registration's 20 an hour, the device grant's starts and
// lookups). The window is in the key, so a caller that keeps coming back gets a fresh count when the window turns:
// a count kept under one key would have its expiry pushed back by every write and never reset while the caller
// stayed busy. Read then write, so two calls at once may both pass: a soft cap, enough for abuse.

// KV refuses an expiry under a minute.
const KV_MIN_TTL_S = 60;

export type RateWindow = { max: number; windowS: number };

/** Counts one call from `ip` under `name`; true when the caller was already at `limit.max` in this window. */
export async function overWindowLimit(
  kv: KVNamespace,
  name: string,
  ip: string,
  limit: RateWindow,
  now = Date.now(),
): Promise<boolean> {
  const nowS = Math.floor(now / 1000);
  const window = Math.floor(nowS / limit.windowS);
  const key = `${name}:${ip}:${window}`;
  const count = Number((await kv.get(key)) ?? '0');
  if (count >= limit.max) return true;
  const left = (window + 1) * limit.windowS - nowS;
  await kv.put(key, String(count + 1), { expirationTtl: Math.max(KV_MIN_TTL_S, left) });
  return false;
}
