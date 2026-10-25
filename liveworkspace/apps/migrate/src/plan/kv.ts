// The old MCP server's dynamic client registrations (docs/migration.md, step 1.5: "Connected AI tools"): every
// `client:<id>` of its OAUTH_KV, the same key and value the new MCP reads (packages/mcp-kit/src/oauth-clients.ts),
// with its remaining time to live kept as the same absolute expiry. The dump is read from a file, never from the
// account: a JSON array of `{ name | key, value, expiration? }` (wrangler's bulk format, or `kv key list` rows with
// their values filled in).
import { readFileSync } from 'node:fs';
import type { Report } from './report.ts';

export type KvPut = { key: string; value: string; expiration?: number };

/** Wrangler refuses a put expiring sooner than this (seconds). */
export const KV_MIN_TTL_SECONDS = 60;

export function readOauthKvDump(path: string, now: number, report: Report): KvPut[] {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (!Array.isArray(parsed)) throw new Error(`${path}: expected a JSON array of KV entries`);
  const out: KvPut[] = [];
  const nowSeconds = Math.floor(now / 1000);
  for (const raw of parsed as Record<string, unknown>[]) {
    const key =
      typeof raw.key === 'string' ? raw.key : typeof raw.name === 'string' ? raw.name : null;
    if (!key || !key.startsWith('client:')) {
      report.add('kv.notAClient');
      continue;
    }
    const value =
      typeof raw.value === 'string'
        ? raw.value
        : raw.value === undefined
          ? null
          : JSON.stringify(raw.value);
    if (value === null) {
      report.skip('kv', key, 'no value in the dump');
      continue;
    }
    const expiration = typeof raw.expiration === 'number' ? raw.expiration : undefined;
    if (expiration !== undefined && expiration - nowSeconds < KV_MIN_TTL_SECONDS) {
      report.add('kv.expired');
      continue;
    }
    out.push(expiration === undefined ? { key, value } : { key, value, expiration });
  }
  out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  report.add('kv.clients', out.length);
  return out;
}
