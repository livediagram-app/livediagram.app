'use client';

import {
  accountPanels,
  bearerAccountSecurity,
  bearerSettingsRequest,
  createCloudSyncHost,
  settingsPanelApp,
  type SettingsAppId,
} from '@liveworkspace/settings-ui';
import { BrandMark } from '@liveplanner/ui';
import { APP_SITES, PLATFORM_SITE, siteOfApp, workspaceOriginFor } from '@liveworkspace/sites';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { currentBearer } from '@/lib/api/core';

// What this editor hands the shared Settings panel (@liveworkspace/settings-ui SettingsPanel;
// docs/specs/007-editor/user-preferences.md "This app or All"): which app it is, the logos, and the way to the
// account's other settings. The other apps' settings are read and written over liveworkspace's account API through
// this app's router (`/api/workspace/account`), with the person's access token, as the Explorer panel's teams are;
// nothing is asked (or loaded) until All is first chosen, and what is read is kept for the page's lifetime.
export const SETTINGS_APP = settingsPanelApp({
  ...siteOfApp('liveplanner'),
  id: 'liveplanner.app',
});

// Settings' Cloud Sync (liveworkspace/docs/specs/005-drive/drive.md "Connecting"): the Drive service through this app's router
// (`/api/drive`), with the person's token, and the way back to Account > Profile (`?settings=account:account`) once
// Google has answered. Made for an account only; its section shows once the service says the deployment offers Drive.
export const cloudSyncHost = () =>
  createCloudSyncHost({
    getToken: currentBearer,
    workspaceOrigin: workspaceOriginFor(window.location.host),
    settingsParam: 'account:account',
  });

export const settingsRequest = bearerSettingsRequest({
  baseUrl: '/api/workspace/account',
  token: currentBearer,
});

// The Account section's own panels, edited in place (liveworkspace/docs/specs/010-site/site.md "Settings"): sign-in and
// devices over the account API's bearer door (Google's way back reopens Account > Profile), and the API tokens,
// webhooks (the index, through this router) and Download Your Data, each fetched when its category is first shown.
export const ACCOUNT_SETTINGS = {
  security: bearerAccountSecurity(settingsRequest, { settingsParam: 'account:account' }),
  ...accountPanels({ request: settingsRequest, index: indexClient }),
};

// Each app's prism in its accent (this app's own, as its Explorer filter shows it), and liveworkspace's for All.
export const renderSettingsLogo = (id: SettingsAppId | 'all') =>
  id === SETTINGS_APP.id ? (
    <BrandMark />
  ) : (
    <BrandMark
      accentColor={
        id === 'all' ? PLATFORM_SITE.accent : (APP_SITES.find((s) => s.id === id)?.accent ?? '')
      }
    />
  );
