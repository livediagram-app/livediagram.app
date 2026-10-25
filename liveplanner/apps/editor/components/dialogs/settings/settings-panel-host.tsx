'use client';

import {
  bearerSettingsRequest,
  settingsPanelApp,
  type SettingsAppId,
} from '@liveworkspace/settings-ui';
import { BrandMark } from '@liveplanner/ui';
import { APP_SITES, PLATFORM_SITE, siteOfApp } from '@liveworkspace/sites';
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
