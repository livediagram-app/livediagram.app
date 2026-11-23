// What a host offers (each product's CLI blueprint "Capabilities", CLI8): from GET <host>/api/capabilities, cached
// an hour per profile. An absent field reads as the older worker meant it. The format number's field is the
// product's own (`documentFormat`, `projectFormat`, `designFormat`), named by the binding.

import { CliError } from './cli-error';
import type { DebugLog } from './debug';
import { EXIT } from './exit-codes';
import type { CliIo } from './io';
import { cacheDir } from './paths';
import type { CliProduct } from './product';
import type { Profile } from './profiles';

export const CAPABILITIES_CACHE_TTL_MS = 3_600_000;

/** What the CLI reads of a host's answer. `K` is the field holding the format the host stores; absent from an
 *  older worker. */
export type HostCapabilities<K extends string> = {
  apiBase: string;
  authEnabled: boolean;
  oauthIssuer?: string;
  minVersion?: string;
} & { [P in K]?: number };

// The api's answer (each product's api-schema `CapabilitiesResponse`), as far as the CLI reads it.
type CapabilitiesAnswer = {
  apiBase?: string;
  authEnabled?: boolean;
  oauthIssuer?: string;
  cli?: { minVersion?: string };
} & Record<string, unknown>;

type CacheEntry = { fetchedAt: number; host: string; capabilities: CapabilitiesAnswer };

// The cached entry for this host; null when absent, unreadable or another host's.
function readCache(text: string | null, host: string): CacheEntry | null {
  if (text === null) return null;
  try {
    const entry = JSON.parse(text) as CacheEntry;
    return entry.host === host && typeof entry.fetchedAt === 'number' ? entry : null;
  } catch {
    return null;
  }
}

function of<K extends string>(
  host: string,
  caps: CapabilitiesAnswer,
  formatKey: K,
): HostCapabilities<K> {
  const format = caps[formatKey];
  return {
    apiBase: caps.apiBase ?? `${host}/api`,
    authEnabled: caps.authEnabled ?? false,
    ...(caps.oauthIssuer ? { oauthIssuer: caps.oauthIssuer } : {}),
    ...(caps.cli?.minVersion ? { minVersion: caps.cli.minVersion } : {}),
    ...(typeof format === 'number' ? { [formatKey]: format } : {}),
  } as HostCapabilities<K>;
}

export async function loadCapabilities<K extends string>(
  io: CliIo,
  product: Pick<CliProduct, 'name'>,
  formatKey: K,
  profile: Profile,
  log: DebugLog,
): Promise<HostCapabilities<K>> {
  const dir = `${cacheDir(io, product)}/capabilities`;
  const path = `${dir}/${encodeURIComponent(profile.name)}.json`;
  const cached = readCache(await io.files.read(path), profile.host);
  if (cached && io.now() - cached.fetchedAt < CAPABILITIES_CACHE_TTL_MS) {
    log('capabilities hit');
    return of(profile.host, cached.capabilities, formatKey);
  }
  log(cached ? 'capabilities stale' : 'capabilities miss');
  // Network failures surface through failureOf as exit 7.
  const res = await io.fetch(new Request(`${profile.host}/api/capabilities`));
  if (!res.ok)
    throw new CliError({
      exit: EXIT.failure,
      code: 'server',
      message: `${profile.host} failed (HTTP ${res.status})`,
      hint: 'retry shortly',
    });
  const capabilities: unknown = await res.json().catch(() => null);
  if (typeof capabilities !== 'object' || capabilities === null)
    throw new CliError({
      exit: EXIT.failure,
      code: `not_${product.name}`,
      message: `${profile.host} does not answer as a ${product.name} host`,
      hint: `check the host: --host https://<your ${product.name}>`,
    });
  const entry: CacheEntry = {
    fetchedAt: io.now(),
    host: profile.host,
    capabilities: capabilities as CapabilitiesAnswer,
  };
  // The cache only saves a request: one that cannot be written (a read-only home) never fails the command.
  try {
    await io.files.mkdir(dir, 0o700);
    await io.files.write(path, JSON.stringify(entry));
  } catch (err) {
    log(`capabilities unwritten ${String(err)}`);
  }
  return of(profile.host, entry.capabilities, formatKey);
}
