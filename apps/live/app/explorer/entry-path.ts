// Where this page load STARTED, captured at module evaluation, before any client-side navigation
// can rewrite the URL. Each Explorer section's landing telemetry ("Landing" or "Nav") reads it:
// a "first mount wins" flag would call a deliberate visit to a section a landing whenever the
// load started elsewhere. Imported by the eager Explorer chunk (useTimelineFeed), so a lazily
// loaded pane reading it still sees the load's own path.
export const ENTRY_PATH = typeof window === 'undefined' ? '' : window.location.pathname;

/** The page load started on `/explorer` or on Home (docs/specs/013-workspace/explorer-home.md). */
export const ARRIVED_ON_HOME = /^\/explorer(\/home)?\/?$/.test(ENTRY_PATH);

/** The page load started on All activity, the Timeline feed (docs/specs/013-workspace/timeline.md §8.1). */
export const ARRIVED_ON_TIMELINE = /^\/explorer\/timeline\/?$/.test(ENTRY_PATH);
