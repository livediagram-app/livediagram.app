// Reset All Settings for an account (liveworkspace/docs/specs/003-accounts/accounts.md "Resetting every setting"): one
// `DELETE /settings` over the host's door, every scope of every app. On success the host drops its own copy first
// (`apply`, an editor's preferences back to their defaults), the page's kept scopes become the server's answer (each
// app's own empty, `all` what the reset kept), so the panel drawn again reads nothing, and then every panel is told.
// The store is loaded here, on the press, never with the row.
import type { SettingsBlob } from '@liveworkspace/settings';
import type { SettingsApiResult, SettingsRequest } from '../request';
import type { SettingsStore } from '../store';
import { announceSettingsReset } from './reset-signal';

export async function resetAccountSettings(
  source: SettingsStore | SettingsRequest,
  apply: () => void,
): Promise<SettingsApiResult<{ all: SettingsBlob }>> {
  const { storeFor, STORED_APP_IDS } = await import('../store');
  const store = storeFor(source);
  const result = await store.request<{ all: SettingsBlob }>('/settings', 'DELETE');
  if (!result.ok) return result;
  const all = result.data.all ?? {};
  apply();
  for (const app of STORED_APP_IDS) store.remember(app, { all, app: {} });
  announceSettingsReset();
  return { ok: true, data: { all } };
}

/** A guest's, a self-hosted editor's: only the editor's own copy, in this browser. Nothing is sent from here; the
 *  editor's next save sends the cleared keys as it sends any change. */
export async function resetBrowserSettings(
  apply: () => void,
): Promise<SettingsApiResult<{ all: SettingsBlob }>> {
  apply();
  return { ok: true, data: { all: {} } };
}
