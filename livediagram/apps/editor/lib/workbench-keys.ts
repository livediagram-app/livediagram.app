// This editor's own keys for the workbench code it runs (packages/workbench/README.md "Bindings"):
// bound by lib/workbench-bindings.ts, and read as they are by what cannot run the app (the pre-boot
// guard, the e2e fixtures), so this module imports nothing. NEVER change one in place: people's saved
// flags live under them.

/** The browser's debug flag that turns trace lines on in production (docs/specs/003-system-architecture/console-logging.md). */
export const DEBUG_STORAGE_KEY = 'livediagram:debug';
