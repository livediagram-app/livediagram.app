'use client';

import {
  bearerSettingsRequest,
  createCloudSyncHost,
  settingsPanelApp,
  type SettingsAppId,
} from '@liveworkspace/settings-ui';
import { BrandMark } from '@livehuddle/ui';
import { APP_SITES, PLATFORM_SITE, siteOfApp, workspaceOriginFor } from '@liveworkspace/sites';
import { currentBearer } from '@/lib/api/core';

// What this editor hands the shared Settings panel (@liveworkspace/settings-ui SettingsPanel;
// docs/specs/007-editor/user-preferences.md "This app or All"): which app it is, the logos, and the way to the
// account's other settings. The other apps' settings are read and written over liveworkspace's account API through
// this app's router (`/api/workspace/account`), with the person's access token, as the Explorer panel's teams are;
// nothing is asked (or loaded) until All is first chosen, and what is read is kept for the page's lifetime.
export const SETTINGS_APP = settingsPanelApp({
  ...siteOfApp('livehuddle'),
  // The Settings panel holds livehuddle out until launch, so the fork borrows livediagram's catalogue and scope
  // until livehuddle has a held catalogue of its own.
  id: 'livediagram.app',
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
