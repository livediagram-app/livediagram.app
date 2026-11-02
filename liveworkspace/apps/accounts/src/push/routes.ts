// The phone notification routes (liveworkspace/docs/specs/003-accounts/push.md "The API"):
//   - the person's own devices, on both doors (the session on liveworkspace.app, the app's bearer on its address and in
//     the editors): GET /push/devices, POST /push/devices, DELETE /push/devices/<id>;
//   - an app's server asking for notifications to go, by its client credentials: POST /internal/push.
import type { Env } from '../env.ts';
import type { SettingsApp } from '../settings.ts';
import { deliverPush, readNotifications, vapidKeysOf } from './deliver.ts';
import { listDevices, readRegistration, registerDevice, removeDevice } from './devices.ts';

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const error = (status: number, code: string) => json({ error: code }, status);

const DEVICE_ID = /^pd_[0-9a-f]{32}$/;

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => ({}));
  return body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

/** The person's own device routes (`parts` after /api/account), or null for a path that isn't one of them. */
export async function pushDeviceRoutes(
  request: Request,
  env: Env,
  userId: string,
  parts: readonly string[],
): Promise<Response | null> {
  const [section, sub, id, extra] = parts;
  if (section !== 'push' || sub !== 'devices' || extra !== undefined) return null;
  const db = env.AUTH_DB;
  const { method } = request;
  if (!id && method === 'GET') {
    return json({
      publicKey: vapidKeysOf(env)?.publicKey ?? null,
      devices: await listDevices(db, userId),
    });
  }
  if (!id && method === 'POST') {
    if (!vapidKeysOf(env)) return error(503, 'push_not_configured');
    const registration = readRegistration(await readBody(request));
    if ('error' in registration) return error(400, registration.error);
    return json({ device: await registerDevice(db, userId, registration) }, 201);
  }
  if (id && method === 'DELETE') {
    if (!DEVICE_ID.test(id) || !(await removeDevice(db, userId, id)))
      return error(404, 'not_found');
    return json({ id });
  }
  return null;
}

type WaitUntil = (promise: Promise<unknown>) => void;

/**
 * POST /internal/push `{ notifications }`: checked whole, answered 202 at once, and sent after the answer
 * (deliver.ts), so the app's own work never waits on a push service. Only a client that is an app may ask, and only
 * with links on its own addresses.
 */
export async function pushInternal(
  request: Request,
  env: Env,
  app: SettingsApp | null,
  waitUntil: WaitUntil,
): Promise<Response> {
  if (!app) return error(403, 'client_has_no_app');
  const read = readNotifications(await readBody(request), app, env.ENVIRONMENT);
  if (!read.ok) return error(400, read.error);
  waitUntil(deliverPush(env, app, read.notifications));
  return json({ accepted: read.notifications.length }, 202);
}
