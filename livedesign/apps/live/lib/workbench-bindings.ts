// This editor's facts for the workbench code it runs (packages/workbench/README.md "Bindings"), handed
// over once at startup: the root providers and app/global-error.tsx call bindWorkbench at module scope,
// before anything renders.
import { configureWorkbench } from '@liveworkspace/workbench/bindings';
import { apiFetch, apiHeaders, currentBearer, expectOk, expectOkVoid } from './api/core';
import { zoomMax } from './canvas';
import { PANEL_LAYOUT_CHANGED_EVENT } from './panel-layout';
import { runningStaleBuild } from './server-release';
import { track } from './telemetry';
import { readUserPreferences } from './user-preferences';
import {
  APP_RECOVERY_FLAG,
  DEBUG_STORAGE_KEY,
  EMPTY_CARD_DISMISSED_KEY,
  FORMAT_CONFIG_KEY,
  LOCAL_MOVE_DISMISSED_PREFIX,
  OPEN_SETTINGS_EVENT,
  PANEL_PRESENCE_EVENT,
  RELOAD_GUARD_KEY,
  SPOTLIGHT_CONFIG_KEY,
  START_QUERY_KEY,
} from './workbench-keys';

export function bindWorkbench(): void {
  configureWorkbench({
    track,
    debugKey: DEBUG_STORAGE_KEY,
    reloadGuardKey: RELOAD_GUARD_KEY,
    appRecoveryFlag: APP_RECOVERY_FLAG,
    runningStaleBuild,
    readPreferences: readUserPreferences,
    // Raised while a photo page is in focus (docs/specs/031-photo/photo-pages.md "Navigating").
    zoomMax,
    api: { fetch: apiFetch, headers: apiHeaders, expectOk, expectOkVoid, currentBearer },
    formatLogScope: 'design-format',
    panelLayoutEvent: PANEL_LAYOUT_CHANGED_EVENT,
    openSettingsEvent: OPEN_SETTINGS_EVENT,
    panelPresenceEvent: PANEL_PRESENCE_EVENT,
    startQueryKey: START_QUERY_KEY,
    localMoveDismissedPrefix: LOCAL_MOVE_DISMISSED_PREFIX,
    emptyCardDismissedKey: EMPTY_CARD_DISMISSED_KEY,
    formatConfigKey: FORMAT_CONFIG_KEY,
    spotlightConfigKey: SPOTLIGHT_CONFIG_KEY,
  });
}
