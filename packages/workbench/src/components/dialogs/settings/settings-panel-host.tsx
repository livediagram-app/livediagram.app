'use client';

import {
  accountPanels,
  bearerAccountSecurity,
  bearerSettingsRequest,
  createCloudSyncHost,
  settingsPanelApp,
  type SettingsAppId,
} from '@liveworkspace/settings-ui';
import { BrandMark } from '@liveworkspace/brand';
import {
  APP_SITES,
  PLATFORM_SITE,
  siteOfApp,
  workspaceOriginFor,
  type AppName,
} from '@liveworkspace/sites';
import { workbench } from '../../../bindings';

// What an editor hands the shared Settings panel (@liveworkspace/settings-ui SettingsPanel; each app's
// docs/specs/007-editor/user-preferences.md "This app or All"), one copy for every editor: which app it is, the logos,
// and the way to the account's other settings. The other apps' settings are read and written over liveworkspace's
// account API through the app's router (`/api/workspace/account`), with the person's access token (the workbench's
// `api.currentBearer` binding, read when a request goes out), as the Explorer panel's teams are; nothing is asked (or
// loaded) until All is first chosen, and what is read is kept for the page's lifetime. Each editor's
// components/dialogs/settings/settings-panel-host.tsx binds it once with its app name.

/** The account's Account > Profile, where Google's way back and Cloud Sync's return land. */
export const ACCOUNT_SETTINGS_PARAM = 'account:account';

export function createSettingsPanelHost(app: AppName) {
  const token = () => workbench.api.currentBearer();
  const appId = `${app}.app` satisfies SettingsAppId;

  const SETTINGS_APP = settingsPanelApp({ ...siteOfApp(app), id: appId });

  // Settings' Cloud Sync (liveworkspace/docs/specs/005-drive/drive.md "Connecting"): the Drive service through the
  // app's router (`/api/drive`), with the person's token, and the way back to Account > Profile once Google has
  // answered. Made for an account only; its section shows once the service says the deployment offers Drive.
  const cloudSyncHost = () =>
    createCloudSyncHost({
      getToken: token,
      workspaceOrigin: workspaceOriginFor(window.location.host),
      settingsParam: ACCOUNT_SETTINGS_PARAM,
    });

  const settingsRequest = bearerSettingsRequest({ baseUrl: '/api/workspace/account', token });

  // The Account section's own panels, edited in place (liveworkspace/docs/specs/010-site/site.md "Settings"): sign-in
  // and devices over the account API's bearer door (Google's way back reopens Account > Profile), and the API tokens
  // and Download Your Data, each fetched when its category is first shown.
  const ACCOUNT_SETTINGS = {
    security: bearerAccountSecurity(settingsRequest, { settingsParam: ACCOUNT_SETTINGS_PARAM }),
    ...accountPanels({ request: settingsRequest }),
  };

  // Each app's prism in its accent (this app's own, as its Explorer filter shows it), and liveworkspace's for All.
  const renderSettingsLogo = (id: SettingsAppId | 'all') =>
    id === SETTINGS_APP.id ? (
      <BrandMark app={app} />
    ) : (
      <BrandMark
        app={app}
        accentColor={
          id === 'all' ? PLATFORM_SITE.accent : (APP_SITES.find((s) => s.id === id)?.accent ?? '')
        }
      />
    );

  return { SETTINGS_APP, cloudSyncHost, settingsRequest, ACCOUNT_SETTINGS, renderSettingsLogo };
}
