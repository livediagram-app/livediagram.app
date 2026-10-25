// This editor's own keys for the workbench code it runs (packages/workbench/README.md "Bindings"):
// bound by lib/workbench-bindings.ts, and read as they are by what cannot run the app (the pre-boot
// guard, the e2e fixtures), so this module imports nothing. NEVER change one in place: people's saved
// flags live under them.

/** The browser's debug flag that turns trace lines on in production (docs/specs/003-system-architecture/console-logging.md). */
export const DEBUG_STORAGE_KEY = 'livedesign:debug';

/** The sessionStorage map of page to the time of its last guarded reload (docs/specs/016-platform/stale-builds.md "One reload guard"). */
export const RELOAD_GUARD_KEY = 'livedesign:stale-chunk-reloads';

/** Set on window once the running app's chunk recovery is installed: the pre-boot guard then stands down. */
export const APP_RECOVERY_FLAG = '__livedesignChunkRecovery';
