// Connecting, switching Google account and disconnecting (liveworkspace/docs/specs/005-drive/drive.md "Connecting", "Tokens",
// "Disconnecting and account deletion"), carried over from livediagram's api (routes/drive.ts, account-switch.ts,
// disconnect.ts) into the person's object.
//
// A consent by another Google account than the one connected changes nothing until the person confirms the switch
// (within DRIVE_ACCOUNT_SWITCH_TTL_MS) or cancels it: the new account must not inherit the first one's root, page
// token and rows. Each answer revokes the grant it leaves behind, best effort; a pending account always differs from
// the connected one, so the revoked grant is never the one in use.

import { DRIVE_ACCOUNT_SWITCH_TTL_MS, NO_BACKOFF } from '@liveworkspace/drive';
import {
  exchangeCode,
  fetchGoogleAccountId,
  importDriveKey,
  sealRefreshToken,
} from '@liveworkspace/drive/server';
import { driveLog, driveWarn, errorKind } from '../log';
import { maintainChannel, stopChannel } from './channel';
import type { Runtime } from './context';

export type ConnectOutcome =
  | { outcome: 'connected' }
  | { outcome: 'switch_pending'; until: number }
  | { outcome: 'no_refresh_token' }
  | { outcome: 'google_failed' };

export async function connect(
  rt: Runtime,
  code: string,
  redirectUri: string,
): Promise<ConnectOutcome> {
  const { deps, personId, tokens } = rt;
  const { store, google } = deps;
  const now = deps.now();
  let exchange: Awaited<ReturnType<typeof exchangeCode>>;
  let account: string;
  try {
    exchange = await exchangeCode(google, code, redirectUri, now);
    // Which Google account consented: another one than before must not inherit this one's mirror.
    account = await fetchGoogleAccountId(google, exchange.accessToken);
  } catch (err) {
    driveWarn('connect exchange-failed', { person: personId, error: errorKind(err) });
    return { outcome: 'google_failed' };
  }
  const connection = store.connection();
  const otherAccount = connection !== null && connection.googleAccount !== account;
  if (!exchange.refreshToken) {
    // Google sends a refresh token only with prompt=consent. Without one, a connection would be hollow, and a stored
    // one from another account would act for the wrong account.
    if (!connection || otherAccount) {
      driveLog('connect', { person: personId, outcome: 'no_refresh_token' });
      return { outcome: 'no_refresh_token' };
    }
  }
  const key = (await importDriveKey(deps.tokenKey))!;
  if (otherAccount) {
    if (connection.pendingSealed) await tokens.revokeSealed(personId, connection.pendingSealed);
    const until = now + DRIVE_ACCOUNT_SWITCH_TTL_MS;
    store.updateConnection({
      pendingSealed: await sealRefreshToken(key, personId, exchange.refreshToken!),
      pendingAccount: account,
      pendingUntil: until,
    });
    driveLog('connect', { person: personId, outcome: 'switch_pending' });
    return { outcome: 'switch_pending', until };
  }
  const sealed = exchange.refreshToken
    ? await sealRefreshToken(key, personId, exchange.refreshToken)
    : null;
  if (connection) {
    // The same account again (a reconnect after a revoked grant): a pending switch is dropped, the mirror kept.
    if (connection.pendingSealed) await tokens.revokeSealed(personId, connection.pendingSealed);
    store.updateConnection({
      ...(sealed ? { sealedRefresh: sealed } : {}),
      status: 'ok',
      pendingSealed: null,
      pendingAccount: null,
      pendingUntil: null,
    });
  } else {
    store.createConnection({
      personId,
      sealedRefresh: sealed!,
      googleAccount: account,
      connectedAt: now,
    });
  }
  tokens.prime(exchange.accessToken, exchange.expiresAt);
  await started(rt);
  driveLog('connect', { person: personId, outcome: connection ? 'reconnected' : 'connected' });
  return { outcome: 'connected' };
}

// A connection that is (again) live: the index's flag, so it signals the person's changes; the push channel; and the
// first pass now.
async function started(rt: Runtime): Promise<void> {
  try {
    await rt.deps.index.setMirrored(rt.personId, true);
  } catch (err) {
    // The fallback check covers a person the index doesn't signal for.
    driveWarn('flag-failed', { person: rt.personId, error: errorKind(err) });
  }
  await maintainChannel(rt);
  await rt.deps.scheduler.setAlarm(rt.deps.now());
}

/** Whether a live switch was confirmed. False: none, or it had expired (and is now dropped). */
export async function confirmSwitch(rt: Runtime): Promise<boolean> {
  const { deps, personId, tokens } = rt;
  const { store } = deps;
  const connection = store.connection();
  if (!connection?.pendingSealed || !connection.pendingAccount) return false;
  if ((connection.pendingUntil ?? 0) < deps.now()) {
    await cancelSwitch(rt);
    driveLog('account-switch', { person: personId, outcome: 'expired' });
    return false;
  }
  // The old account's channel goes with its own token, then its grant.
  await stopChannel(rt).catch(() => undefined);
  await tokens.revokeSealed(personId, connection.sealedRefresh);
  tokens.reset();
  store.clearRows();
  store.updateConnection({
    sealedRefresh: connection.pendingSealed,
    googleAccount: connection.pendingAccount,
    pendingSealed: null,
    pendingAccount: null,
    pendingUntil: null,
    status: 'ok',
    rootId: null,
    rootName: null,
    pageToken: null,
    channelId: null,
    channelResource: null,
    channelExpiresAt: null,
    channelFailedAt: null,
    backoff: NO_BACKOFF,
    progress: null,
    syncing: false,
  });
  await started(rt);
  driveLog('account-switch', { person: personId, outcome: 'confirmed' });
  return true;
}

/** Whether there was a pending switch to drop. */
export async function cancelSwitch(rt: Runtime): Promise<boolean> {
  const { store } = rt.deps;
  const connection = store.connection();
  if (!connection?.pendingSealed) return false;
  store.updateConnection({ pendingSealed: null, pendingAccount: null, pendingUntil: null });
  await rt.tokens.revokeSealed(rt.personId, connection.pendingSealed);
  return true;
}

/** Revoke the grant (and a pending switch's), close the channel, forget the token and every row, and clear the
 *  index's flag. Drive's files stay: they are the person's. Whether there was a connection. */
export async function disconnect(rt: Runtime): Promise<boolean> {
  const { deps, personId, tokens } = rt;
  const connection = deps.store.connection();
  if (!connection) return false;
  await stopChannel(rt).catch(() => undefined);
  const revoked = await tokens.revokeSealed(personId, connection.sealedRefresh);
  if (connection.pendingSealed) await tokens.revokeSealed(personId, connection.pendingSealed);
  tokens.reset();
  deps.store.clearAll();
  await deps.scheduler.deleteAlarm();
  try {
    await deps.index.setMirrored(personId, false);
  } catch (err) {
    driveWarn('flag-failed', { person: personId, error: errorKind(err) });
  }
  driveLog('disconnect', { person: personId, revoked });
  return true;
}
