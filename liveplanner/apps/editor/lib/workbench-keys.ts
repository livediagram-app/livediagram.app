// This editor's own keys for the workbench code it runs (packages/workbench/README.md "Bindings"):
// bound by lib/workbench-bindings.ts, and read as they are by what cannot run the app (the pre-boot
// guard, the e2e fixtures), so this module imports nothing. NEVER change one in place: people's saved
// flags live under them.

/** The browser's debug flag that turns trace lines on in production (docs/specs/003-system-architecture/console-logging.md). */
export const DEBUG_STORAGE_KEY = 'liveplanner:debug';

/** The sessionStorage map of page to the time of its last guarded reload (docs/specs/016-platform/stale-builds.md "One reload guard"). */
export const RELOAD_GUARD_KEY = 'liveplanner:stale-chunk-reloads';

/** Set on window once the running app's chunk recovery is installed: the pre-boot guard then stands down. */
export const APP_RECOVERY_FLAG = '__liveplannerChunkRecovery';

/** The window event that asks the mounted host to open Settings on a category (`requestOpenSettings`). */
export const OPEN_SETTINGS_EVENT = 'liveplanner:open-settings';

/** The window event a floating panel sends as it arrives or leaves with no gesture of its own (docs/specs/008-canvas/quick-style-panel.md "Collisions"). */
export const PANEL_PRESENCE_EVENT = 'liveplanner:panel-presence';

/** The sessionStorage key of the search a `/new?q=` link hands the next start panel. */
export const START_QUERY_KEY = 'liveplanner:v2:start-query';

/** The localStorage prefix of "Not Now" on the move prompt after signing in, one key per account (`<prefix><userId>`). */
export const LOCAL_MOVE_DISMISSED_PREFIX = 'liveplanner:v2:local-move-dismissed:';

/** Test builds only: the localStorage key the e2e specs put a signed-in session under for E2EAuthBridge. */
export const E2E_SESSION_KEY = 'liveplanner:e2e:session';

/** The localStorage key of the Hide Participant Cursors switch (docs/specs/012-collaboration/collaborator-enhancements.md). */
export const HIDE_CURSORS_KEY = 'liveplanner:v2:hide-cursors';
