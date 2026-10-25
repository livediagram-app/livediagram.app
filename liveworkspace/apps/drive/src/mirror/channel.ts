// The push channel (liveworkspace/docs/drive.md "Cadence"): a `changes.watch` on the person's Drive, so Google posts
// to /api/drive/push when it changes and a pass follows. Opened on connect, renewed DRIVE_CHANNEL_RENEW_BEFORE_MS
// before it ends, stopped on disconnect. A channel Google won't open (a local address, an outage) is tried again
// after DRIVE_FALLBACK_CHECK_MS; meanwhile the fallback check runs at its shorter interval.

import {
  DRIVE_CHANNEL_RENEW_BEFORE_MS,
  DRIVE_CHANNEL_TTL_MS,
  DRIVE_FALLBACK_CHECK_MS,
} from '@liveworkspace/drive';
import { channelToken } from '../channel-token';
import { driveLog, driveWarn, errorKind } from '../log';
import type { Runtime } from './context';
import type { Connection } from './store';
import { NeedsReconnect } from './tokens';

/** Whether a channel is open and not about to lapse. */
export const channelLive = (connection: Connection, now: number) =>
  connection.channelId !== null && (connection.channelExpiresAt ?? 0) > now;

/** The page token a channel (and the gate) starts from: the stored one, else Drive's current, stored. */
export async function pageTokenOf(rt: Runtime): Promise<string> {
  const stored = rt.deps.store.connection()?.pageToken;
  if (stored) return stored;
  const start = await rt.drive.getStartPageToken();
  rt.deps.store.updateConnection({ pageToken: start });
  return start;
}

/** Open a channel when there is none or it ends within a day. A refusal is logged, never thrown, unless the grant
 *  itself is gone (or the connection went meanwhile). */
export async function maintainChannel(rt: Runtime): Promise<void> {
  const { store, now: clock } = rt.deps;
  const connection = store.connection();
  if (!connection) return;
  const now = clock();
  if (
    connection.channelId &&
    (connection.channelExpiresAt ?? 0) - now > DRIVE_CHANNEL_RENEW_BEFORE_MS
  )
    return;
  if (
    connection.channelFailedAt !== null &&
    now - connection.channelFailedAt < DRIVE_FALLBACK_CHECK_MS
  )
    return;
  if (connection.channelId) await stopChannel(rt);
  try {
    const channel = await rt.drive.watchChanges({
      pageToken: await pageTokenOf(rt),
      channelId: rt.deps.newId(),
      address: rt.deps.pushAddress,
      token: await channelToken(rt.deps.tokenKey, rt.personId),
      expiration: now + DRIVE_CHANNEL_TTL_MS,
    });
    rt.guard();
    store.updateConnection({
      channelId: channel.id,
      channelResource: channel.resourceId,
      channelExpiresAt: channel.expiration,
      channelFailedAt: null,
    });
    driveLog('channel-open', { person: rt.personId, channel: channel.id });
  } catch (err) {
    rt.guard();
    if (err instanceof NeedsReconnect) throw err;
    driveWarn('channel-failed', { person: rt.personId, error: errorKind(err) });
    store.updateConnection({
      channelId: null,
      channelResource: null,
      channelExpiresAt: null,
      channelFailedAt: now,
    });
  }
}

/** Close the stored channel, best effort (it lapses on its own within a week anyway). */
export async function stopChannel(rt: Runtime): Promise<void> {
  const connection = rt.deps.store.connection();
  if (!connection?.channelId || !connection.channelResource) return;
  try {
    await rt.drive.stopChannel({
      id: connection.channelId,
      resourceId: connection.channelResource,
    });
    driveLog('channel-stopped', { person: rt.personId, channel: connection.channelId });
  } catch (err) {
    driveWarn('channel-stop-failed', { person: rt.personId, error: errorKind(err) });
  }
  rt.deps.store.updateConnection({
    channelId: null,
    channelResource: null,
    channelExpiresAt: null,
  });
}
