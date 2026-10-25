// Closing an account disconnects its Google Drive mirror too (liveworkspace/docs/drive.md "Disconnecting and account
// deletion"): the Drive service revokes the grant and forgets the token and every mirror row, and leaves the files in
// Drive. `DELETE /app/people/<id>` with `DRIVE_KEY_ACCOUNTS`, through the DRIVE service binding. Best effort: a
// failure is logged and never keeps the account open, and the service holds nothing it could act on without the
// account (its tokens are sealed to the person and every route verifies a live account token), so nothing is retried.
import type { Env } from './env.ts';

// The service's people route, reached through the binding (the host is never looked up).
const PEOPLE_URL = 'https://drive/app/people/';
// The service revokes at Google before it answers; past this the close carries on without it.
const DISCONNECT_TIMEOUT_MS = 10_000;

export interface DriveDisconnectConfig {
  // The Drive Worker's service binding: absent until liveworkspace-drive is deployed (wrangler.toml).
  driveService?: Fetcher;
  driveKey?: string;
}

export const driveDisconnectConfig = (env: Env): DriveDisconnectConfig => ({
  driveService: env.DRIVE,
  driveKey: env.DRIVE_KEY_ACCOUNTS,
});

export type DriveDisconnectResult = 'done' | 'skipped' | 'failed';

/** Tells the Drive service the account closed. Never throws. */
export async function disconnectDrive(
  config: DriveDisconnectConfig,
  userId: string,
): Promise<DriveDisconnectResult> {
  const key = config.driveKey?.trim();
  if (!config.driveService || !key) return 'skipped';
  try {
    const response = await config.driveService.fetch(`${PEOPLE_URL}${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(DISCONNECT_TIMEOUT_MS),
    });
    await response.body?.cancel();
    // 404: they never connected Drive, which is the usual answer.
    if (response.ok || response.status === 404) return 'done';
    console.warn('[accounts] drive disconnect not taken', { status: response.status });
    return 'failed';
  } catch (error) {
    console.warn('[accounts] drive disconnect failed', {
      error: error instanceof Error ? error.name : 'fetch_failed',
    });
    return 'failed';
  }
}
