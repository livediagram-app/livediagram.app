// What a host offers (blueprint "Capabilities", CLI8): from GET <host>/api/capabilities, cached an hour per
// profile. An absent field reads as the older worker meant it.

import type { CapabilitiesResponse } from '@livediagram/api-schema';
import type { DebugLog } from '../debug';
import type { CliIo } from '../io';
import { CliError } from '../output/cli-error';
import { EXIT } from '../output/exit-codes';
import { cacheDir } from './paths';
import type { Profile } from './profiles';

export const CAPABILITIES_CACHE_TTL_MS = 3_600_000;

export type HostCapabilities = {
  apiBase: string;
  authEnabled: boolean;
  oauthIssuer?: string;
  minVersion?: string;
};

type CacheEntry = { fetchedAt: number; host: string; capabilities: CapabilitiesResponse };

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

const cachePath = (io: CliIo, profile: Profile) =>
  `${cacheDir(io)}/capabilities/${encodeURIComponent(profile.name)}.json`;

function of(host: string, caps: CapabilitiesResponse): HostCapabilities {
  return {
    apiBase: caps.apiBase ?? `${host}/api`,
    authEnabled: caps.authEnabled ?? false,
    ...(caps.oauthIssuer ? { oauthIssuer: caps.oauthIssuer } : {}),
    ...(caps.cli?.minVersion ? { minVersion: caps.cli.minVersion } : {}),
  };
}

export async function loadCapabilities(
  io: CliIo,
  profile: Profile,
  log: DebugLog,
): Promise<HostCapabilities> {
  const path = cachePath(io, profile);
  const cached = readCache(await io.files.read(path), profile.host);
  if (cached && io.now() - cached.fetchedAt < CAPABILITIES_CACHE_TTL_MS) {
    log('capabilities hit');
    return of(profile.host, cached.capabilities);
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
      code: 'not_livediagram',
      message: `${profile.host} does not answer as a livediagram host`,
      hint: 'check the host: --host https://<your livediagram>',
    });
  await io.files.mkdir(`${cacheDir(io)}/capabilities`, 0o700);
  const entry: CacheEntry = {
    fetchedAt: io.now(),
    host: profile.host,
    capabilities: capabilities as CapabilitiesResponse,
  };
  await io.files.write(path, JSON.stringify(entry));
  return of(profile.host, entry.capabilities);
}
