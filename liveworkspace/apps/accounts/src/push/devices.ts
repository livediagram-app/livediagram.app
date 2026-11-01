// The devices an account gets phone notifications on (liveworkspace/docs/specs/003-accounts/push.md "Devices"):
// `push_device`, migrations/0017_push_devices.sql. One registration serves every app, so a row names no app.
import { MAX_PUSH_DEVICES, PUSH_LABEL_MAX } from '@liveworkspace/settings/push';
import { cleanText } from '../text.ts';
import { fromBase64Url } from './web-push.ts';

export interface PushDevice {
  id: string;
  label: string;
  createdAt: number;
  lastSentAt: number | null;
}

export interface DeviceTarget {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// The push services browsers subscribe through. A registration naming any other host is refused, so the Worker never
// posts to an address a page chose.
const PUSH_SERVICE_HOSTS = [
  'fcm.googleapis.com',
  'android.googleapis.com',
  'updates.push.services.mozilla.com',
  'push.services.mozilla.com',
  'web.push.apple.com',
  'push.apple.com',
  'notify.windows.com',
];

export function isPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 12 || value.length > 1024) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
  return PUSH_SERVICE_HOSTS.some(
    (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
  );
}

export type Registration = { endpoint: string; p256dh: string; auth: string; label: string };

/** A registration from a request body (`{ endpoint, keys: { p256dh, auth }, label }`), or the error it answers. */
export function readRegistration(body: Record<string, unknown>): Registration | { error: string } {
  if (!isPushEndpoint(body.endpoint)) return { error: 'invalid_endpoint' };
  const keys = body.keys as Record<string, unknown> | null | undefined;
  const p256dh = typeof keys?.p256dh === 'string' ? keys.p256dh.replace(/=+$/, '') : '';
  const auth = typeof keys?.auth === 'string' ? keys.auth.replace(/=+$/, '') : '';
  const point = fromBase64Url(p256dh);
  const secret = fromBase64Url(auth);
  if (!point || point.length !== 65 || point[0] !== 4) return { error: 'invalid_keys' };
  if (!secret || secret.length !== 16) return { error: 'invalid_keys' };
  const label = cleanText(typeof body.label === 'string' ? body.label : '', PUSH_LABEL_MAX);
  return { endpoint: body.endpoint, p256dh, auth, label: label || 'A device' };
}

const LIST_COLUMNS = 'id, label, created_at AS createdAt, last_sent_at AS lastSentAt';

/** The account's devices, newest first. */
export async function listDevices(db: D1Database, userId: string): Promise<PushDevice[]> {
  const { results } = await db
    .prepare(`SELECT ${LIST_COLUMNS} FROM push_device WHERE user_id = ? ORDER BY created_at DESC`)
    .bind(userId)
    .all<PushDevice>();
  return results;
}

/**
 * Registers this browser's subscription for the account: one row per endpoint, so registering again (new keys, or
 * another account signing in on the same browser) updates the row in place and moves it to this account. Past
 * MAX_PUSH_DEVICES, the oldest of the account's other devices go. One batch.
 */
export async function registerDevice(
  db: D1Database,
  userId: string,
  registration: Registration,
  now = Date.now(),
): Promise<PushDevice> {
  const id = `pd_${crypto.randomUUID().replaceAll('-', '')}`;
  const [inserted] = await db.batch<PushDevice>([
    db
      .prepare(
        `INSERT INTO push_device (id, user_id, endpoint, p256dh, auth, label, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT (endpoint) DO UPDATE SET
           user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
           label = excluded.label, created_at = excluded.created_at
         RETURNING ${LIST_COLUMNS}`,
      )
      .bind(
        id,
        userId,
        registration.endpoint,
        registration.p256dh,
        registration.auth,
        registration.label,
        now,
      ),
    db
      .prepare(
        `DELETE FROM push_device WHERE user_id = ?1 AND id NOT IN (
           SELECT id FROM push_device WHERE user_id = ?1 ORDER BY created_at DESC, id LIMIT ?2)`,
      )
      .bind(userId, MAX_PUSH_DEVICES),
  ]);
  return inserted!.results[0]!;
}

/** Removes one of the account's devices; false when it has no such device. */
export async function removeDevice(db: D1Database, userId: string, id: string): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM push_device WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/** Every device of these accounts, in one query (at most MAX_PUSH_DEVICES each). */
export async function devicesOf(
  db: D1Database,
  userIds: readonly string[],
): Promise<DeviceTarget[]> {
  if (userIds.length === 0) return [];
  const { results } = await db
    .prepare(
      `SELECT id, user_id AS userId, endpoint, p256dh, auth FROM push_device
       WHERE user_id IN (SELECT value FROM json_each(?))`,
    )
    .bind(JSON.stringify([...new Set(userIds)]))
    .all<DeviceTarget>();
  return results;
}

/** After a send: devices whose service said the subscription is gone are removed, the rest stamped. One batch. */
export async function settleDevices(
  db: D1Database,
  outcome: { sent: readonly string[]; gone: readonly string[] },
  now = Date.now(),
): Promise<void> {
  const statements: D1PreparedStatement[] = [];
  if (outcome.gone.length > 0)
    statements.push(
      db
        .prepare('DELETE FROM push_device WHERE id IN (SELECT value FROM json_each(?))')
        .bind(JSON.stringify(outcome.gone)),
    );
  if (outcome.sent.length > 0)
    statements.push(
      db
        .prepare(
          'UPDATE push_device SET last_sent_at = ? WHERE id IN (SELECT value FROM json_each(?))',
        )
        .bind(now, JSON.stringify(outcome.sent)),
    );
  if (statements.length > 0) await db.batch(statements);
}
