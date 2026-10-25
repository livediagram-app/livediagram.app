// The routes no browser calls (liveworkspace/docs/drive.md "The service"):
//   POST   /api/drive/push        Google's change notifications: the channel token names the person
//   POST   /app/changes           the index's change signal, `{ personId, at }`, with DRIVE_KEY_INDEX
//   DELETE /app/people/<id>       accounts' account deletion, with DRIVE_KEY_ACCOUNTS
// The /app routes are reached over service bindings only; the gateway and the routers forward /api/drive alone.

import { isDriveId } from '@liveworkspace/drive';
import { carriesKey } from './auth';
import { channelPerson } from './channel-token';
import { driveConfigured, type Env } from './env';
import { fail, noContent, notFound, readObject } from './http';
import { driveLog, driveWarn, errorKind } from './log';
import type { RouteDeps } from './routes';

const isPersonId = (value: unknown): value is string =>
  typeof value === 'string' && isDriveId(value) && !value.startsWith('guest_');

/** Google's notification: always 200 at once (Google backs off a slow or failing address), the signal after it. */
export async function handlePush(request: Request, env: Env, deps: RouteDeps): Promise<Response> {
  if (request.method !== 'POST') return notFound();
  if (!driveConfigured(env)) return fail('drive_not_configured');
  await request.body?.cancel();
  // `sync` opens every channel: nothing has changed yet.
  if (request.headers.get('X-Goog-Resource-State') === 'sync')
    return new Response(null, { status: 200 });
  const person = await channelPerson(
    env.DRIVE_TOKEN_KEY!,
    request.headers.get('X-Goog-Channel-Token'),
  );
  if (!person) {
    driveWarn('push-refused', { channel: request.headers.get('X-Goog-Channel-ID') });
    return new Response(null, { status: 200 });
  }
  deps.waitUntil(
    deps
      .mirrors(person)
      .signal(person)
      .catch((err: unknown) => driveWarn('push-signal-failed', { person, error: errorKind(err) })),
  );
  return new Response(null, { status: 200 });
}

/** `/app/…`: server to server. */
export async function handleApp(
  request: Request,
  env: Env,
  segments: string[],
  deps: RouteDeps,
): Promise<Response> {
  if (segments[1] === 'changes' && segments.length === 2 && request.method === 'POST') {
    if (!driveConfigured(env)) return fail('drive_not_configured');
    if (!(await carriesKey(request, env.DRIVE_KEY_INDEX))) return fail('unauthorised');
    const body = await readObject(request);
    if (!body || !isPersonId(body.personId)) return fail('invalid_request');
    await deps.mirrors(body.personId).signal(body.personId);
    return noContent();
  }
  if (segments[1] === 'people' && segments.length === 3 && request.method === 'DELETE') {
    if (!driveConfigured(env)) return fail('drive_not_configured');
    if (!(await carriesKey(request, env.DRIVE_KEY_ACCOUNTS))) return fail('unauthorised');
    const personId = segments[2];
    if (!isPersonId(personId)) return fail('invalid_request');
    const had = await deps.mirrors(personId).disconnect(personId);
    driveLog('account-deleted', { person: personId, connected: had });
    // 404: they never connected, which accounts takes as done.
    return had ? noContent() : notFound();
  }
  return notFound();
}
