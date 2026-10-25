// This editor's facts for the workbench code it runs (packages/workbench/README.md "Bindings"), handed
// over once at startup: the root providers and app/global-error.tsx call bindWorkbench at module scope,
// before anything renders.
import { configureWorkbench } from '@liveworkspace/workbench/bindings';
import { apiFetch, apiHeaders, currentBearer, expectOk, expectOkVoid } from './api/core';
import { ZOOM_MAX } from '@liveworkspace/workbench/lib/zoom-range';
import { runningStaleBuild } from './server-release';
import { track } from './telemetry';
import { readUserPreferences } from './user-preferences';
import { APP_RECOVERY_FLAG, DEBUG_STORAGE_KEY, RELOAD_GUARD_KEY } from './workbench-keys';

export function bindWorkbench(): void {
  configureWorkbench({
    track,
    debugKey: DEBUG_STORAGE_KEY,
    reloadGuardKey: RELOAD_GUARD_KEY,
    appRecoveryFlag: APP_RECOVERY_FLAG,
    runningStaleBuild,
    readPreferences: readUserPreferences,
    zoomMax: () => ZOOM_MAX,
    api: { fetch: apiFetch, headers: apiHeaders, expectOk, expectOkVoid, currentBearer },
    formatLogScope: 'project-format',
  });
}
