// Sending phone notifications (liveworkspace/docs/specs/003-accounts/push.md "Sending"): an app has decided who hears
// of what (POST /api/account/internal/push); this checks each person's switch, finds their devices and posts one
// encrypted message to each device's push service. It runs after the app's request has been answered (waitUntil),
// so neither the app's write nor its call here waits on a push service.
import { appOfSite, appOrigins, siteOfApp } from '@liveworkspace/sites';
import {
  isPushKind,
  MAX_PUSH_NOTIFICATIONS,
  PUSH_SETTING_KEYS,
  PUSH_TAG_MAX,
  PUSH_TITLE_MAX,
  type PushMessage,
  type PushNotification,
} from '@liveworkspace/settings/push';
import type { Env } from '../env.ts';
import { USER_ID } from '../ids.ts';
import { readNotifySettings, type NotifySettings } from '../notify.ts';
import type { SettingsApp } from '../settings.ts';
import { cleanText } from '@liveworkspace/api-kit/typed-text';
import { devicesOf, settleDevices, type DeviceTarget } from './devices.ts';
import { encryptPayload, vapidAuthorization, vapidSigningKey, type VapidKeys } from './web-push.ts';

// The most pushes one request sends, across all its people and their devices: 50 notifications to people with ten
// devices each would be 500 posts, far past any real comment; the rest are dropped and logged.
export const MAX_PUSH_SENDS_PER_CALL = 200;
// How many posts are in flight at once.
export const PUSH_SEND_CONCURRENCY = 8;
// Each post's own limit, so one slow push service can't hold the rest.
export const PUSH_SEND_TIMEOUT_MS = 10_000;
// How long a push service keeps a message for a phone that is off: a mention a day late is noise.
export const PUSH_TTL_SECONDS = 4 * 60 * 60;

const TAG = /^[A-Za-z0-9:_-]+$/;

/** The deployment's VAPID pair, or null when its secrets are not set (phone notifications are then off). */
export function vapidKeysOf(
  env: Pick<Env, 'VAPID_PUBLIC_KEY' | 'VAPID_PRIVATE_KEY'>,
): VapidKeys | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  return publicKey && privateKey ? { publicKey, privateKey } : null;
}

/** Whether a link is on one of the calling app's own addresses in this deployment: the only links an app may send. */
export function isAppLink(url: string, app: SettingsApp, environment: Env['ENVIRONMENT']): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return appOrigins(app, environment).includes(parsed.origin);
}

export type ReadNotifications =
  { ok: true; notifications: PushNotification[] } | { ok: false; error: string };

/** The notifications a request body carries (`{ notifications }`), checked whole: one bad entry refuses them all. */
export function readNotifications(
  body: Record<string, unknown>,
  app: SettingsApp,
  environment: Env['ENVIRONMENT'],
): ReadNotifications {
  const list = body.notifications;
  if (!Array.isArray(list) || list.length === 0)
    return { ok: false, error: 'notifications_required' };
  if (list.length > MAX_PUSH_NOTIFICATIONS) return { ok: false, error: 'too_many_notifications' };
  const out: PushNotification[] = [];
  for (const entry of list as unknown[]) {
    const n = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
    if (typeof n.userId !== 'string' || !USER_ID.test(n.userId))
      return { ok: false, error: 'invalid_user' };
    if (!isPushKind(n.kind)) return { ok: false, error: 'invalid_kind' };
    const title = typeof n.title === 'string' ? cleanText(n.title, PUSH_TITLE_MAX) : '';
    if (!title) return { ok: false, error: 'invalid_title' };
    if (typeof n.url !== 'string' || !isAppLink(n.url, app, environment))
      return { ok: false, error: 'invalid_url' };
    if (
      n.tag !== undefined &&
      (typeof n.tag !== 'string' || n.tag.length > PUSH_TAG_MAX || !TAG.test(n.tag))
    )
      return { ok: false, error: 'invalid_tag' };
    out.push({
      userId: n.userId,
      kind: n.kind,
      title,
      url: n.url,
      ...(typeof n.tag === 'string' ? { tag: n.tag } : {}),
    });
  }
  return { ok: true, notifications: out };
}

/**
 * Where the queued quiet-hours card hooks in (Work Tracker, "quiet hours"): whether this person's notifications are
 * held right now. Nothing holds them yet, so every notification goes; when quiet hours land, this reads the person's
 * hours and zone (user.timeZone) and answers true inside them.
 */
export function heldForQuietHours(_userId: string, _now: number): boolean {
  return false;
}

export type DeliverySummary = { sent: number; gone: number; failed: number; skipped: number };

type Post = { device: DeviceTarget; message: PushMessage };

/** Runs `work` over `items`, at most `limit` at a time. */
async function pool<T>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await work(items[next++]!);
  });
  await Promise.all(lanes);
}

/**
 * Sends these notifications from `app`: each to every device of its person whose switch for its kind is on (a switch
 * read that fails counts as on, as a missing one does), never more than MAX_PUSH_SENDS_PER_CALL posts. A service that
 * answers 404 or 410 has dropped the subscription, so its device is removed. Never throws.
 */
export async function deliverPush(
  env: Env,
  app: SettingsApp,
  notifications: readonly PushNotification[],
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<DeliverySummary> {
  const summary: DeliverySummary = { sent: 0, gone: 0, failed: 0, skipped: 0 };
  try {
    const keys = vapidKeysOf(env);
    const signingKey = keys ? await vapidSigningKey(keys) : null;
    if (!keys || !signingKey) {
      console.warn('[push] not_configured', { count: notifications.length });
      summary.skipped = notifications.length;
      return summary;
    }
    const wanted = notifications.filter((n) => !heldForQuietHours(n.userId, now));
    const people = [...new Set(wanted.map((n) => n.userId))];
    const [settings, devices] = await Promise.all([
      readNotifySettings(env.AUTH_DB, people, app, Object.values(PUSH_SETTING_KEYS)).catch(
        (error: unknown): NotifySettings => {
          console.warn('[push] settings_failed', { error: String(error) });
          return {};
        },
      ),
      devicesOf(env.AUTH_DB, people),
    ]);
    const byPerson = new Map<string, DeviceTarget[]>();
    for (const d of devices) byPerson.set(d.userId, [...(byPerson.get(d.userId) ?? []), d]);

    const body = siteOfApp(appOfSite(app)!).name;
    const posts: Post[] = [];
    for (const n of wanted) {
      if (settings[n.userId]?.all[PUSH_SETTING_KEYS[n.kind]] === false) continue;
      const message: PushMessage = {
        title: n.title,
        body,
        url: n.url,
        ...(n.tag ? { tag: n.tag } : {}),
      };
      for (const device of byPerson.get(n.userId) ?? []) posts.push({ device, message });
    }
    if (posts.length > MAX_PUSH_SENDS_PER_CALL) {
      console.warn('[push] over_cap', { posts: posts.length, cap: MAX_PUSH_SENDS_PER_CALL });
      summary.skipped += posts.length - MAX_PUSH_SENDS_PER_CALL;
      posts.length = MAX_PUSH_SENDS_PER_CALL;
    }

    const sent = new Set<string>();
    const gone = new Set<string>();
    const encoder = new TextEncoder();
    // One VAPID token per push service a run reaches, not one per post.
    const tokens = new Map<string, Promise<string>>();
    await pool(posts, PUSH_SEND_CONCURRENCY, async ({ device, message }) => {
      const record = await encryptPayload(device, encoder.encode(JSON.stringify(message)));
      if (!record) {
        gone.add(device.id);
        return;
      }
      const audience = new URL(device.endpoint).origin;
      let token = tokens.get(audience);
      if (!token) {
        token = vapidAuthorization(
          device.endpoint,
          keys,
          signingKey,
          env.BASE_URL,
          Math.floor(now / 1000),
        );
        tokens.set(audience, token);
      }
      try {
        const response = await fetcher(device.endpoint, {
          method: 'POST',
          headers: {
            authorization: await token,
            'content-encoding': 'aes128gcm',
            'content-type': 'application/octet-stream',
            ttl: String(PUSH_TTL_SECONDS),
            urgency: 'normal',
          },
          body: record,
          signal: AbortSignal.timeout(PUSH_SEND_TIMEOUT_MS),
        });
        if (response.status === 404 || response.status === 410) gone.add(device.id);
        else if (response.ok) sent.add(device.id);
        else {
          summary.failed += 1;
          console.warn('[push] refused', {
            status: response.status,
            host: new URL(device.endpoint).host,
          });
        }
      } catch (error) {
        summary.failed += 1;
        console.warn('[push] post_failed', {
          host: new URL(device.endpoint).host,
          error: String(error),
        });
      }
    });
    for (const id of gone) sent.delete(id);
    summary.sent = sent.size;
    summary.gone = gone.size;
    await settleDevices(env.AUTH_DB, { sent: [...sent], gone: [...gone] }, now);
    return summary;
  } catch (error) {
    console.error('[push] deliver_failed', { error: String(error) });
    return summary;
  }
}
