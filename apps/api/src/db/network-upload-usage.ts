// Per-network daily image usage (docs/specs/009-elements/images.md "Per-network daily budget";
// blueprint step 7a and 15). Keyed on a hash of the caller's network so the
// address itself is never stored.

import type { Env } from '../types';

export const DAY_MS = 86_400_000;

// Used as the HMAC key when the deployment has no guest-signing secret
// (self-host). The hash then only hides the address from a casual reader of
// the table; rows live at most two days either way.
const FALLBACK_KEY = 'livediagram:network-upload-usage';

export type NetworkUsage = { images: number; bytes: number };

export function utcDay(now: number): number {
  return Math.floor(now / DAY_MS);
}

// Seconds until the next UTC day: when a spent budget opens again.
export function secondsToNextUtcDay(now: number): number {
  return Math.ceil(((utcDay(now) + 1) * DAY_MS - now) / 1000);
}

export async function networkUploadKey(
  env: Pick<Env, 'GUEST_ID_HMAC_SECRET'>,
  network: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.GUEST_ID_HMAC_SECRET || FALLBACK_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(network));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function networkUploadUsage(
  env: Env,
  networkHash: string,
  day: number,
): Promise<NetworkUsage> {
  const row = await env.DB.prepare(
    'SELECT images, bytes FROM network_upload_usage WHERE network_hash = ? AND day = ?',
  )
    .bind(networkHash, day)
    .first<NetworkUsage>();
  return { images: row?.images ?? 0, bytes: row?.bytes ?? 0 };
}

// One stored upload: add it to today's row, and drop rows older than
// yesterday so the table never holds more than two days.
export async function recordNetworkUpload(
  env: Env,
  networkHash: string,
  day: number,
  bytes: number,
): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO network_upload_usage (network_hash, day, images, bytes) VALUES (?, ?, 1, ?)
       ON CONFLICT (network_hash, day) DO UPDATE SET
         images = images + 1,
         bytes = bytes + excluded.bytes`,
    ).bind(networkHash, day, bytes),
    env.DB.prepare('DELETE FROM network_upload_usage WHERE day < ?').bind(day - 1),
  ]);
}
