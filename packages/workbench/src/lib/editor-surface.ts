// Where the editor runs (docs/specs/013-workspace/blueprints/workbench-embeds.md "The editor in a
// workbench"): the app, a share-code embed (docs/specs/013-workspace/embeds.md), a workbench's frame, or a live
// embed's frame (liveworkspace/docs/specs/004-index/live-embeds.md "The frame"). Constant for the page's life (the
// route that mounted the editor decides it), so every gate may read these flags in derived values.
export type EditorSurface = 'app' | 'embed' | 'workbench' | 'live-embed';

type SurfaceFlags = {
  // The read-only embed's look and reach: a share-code embed, or a live embed's frame.
  embedMode: boolean;
  // Signed in by a workbench session, inside a developer tool's frame or a live embed's.
  workbenchMode: boolean;
  // The app's surroundings: header, Explorer, account, banners.
  appChrome: boolean;
};

export function surfaceFlags(surface: EditorSurface): SurfaceFlags {
  return {
    // A live embed's frame is the workbench session in the share embed's look (Work Tracker 1386).
    embedMode: surface === 'embed' || surface === 'live-embed',
    workbenchMode: surface === 'workbench' || surface === 'live-embed',
    appChrome: surface === 'app',
  };
}

// The live embed frame flag (live-embeds.md "The frame"): the host adds it to the ticket's path, and the target's
// workbench page shows the item only. Presentation alone: the session's level and reach are the embed session's.
export const LIVE_EMBED_FRAME_PARAM = 'live';

/** The frame path a host frames for a live embed: the ticket's path with the flag added. */
export function liveEmbedFramePath(path: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}${LIVE_EMBED_FRAME_PARAM}=1`;
}

/** The surface a workbench page's document scope runs the editor in, from its address's query. */
export function workbenchSurfaceOf(search: string): 'workbench' | 'live-embed' {
  return new URLSearchParams(search).get(LIVE_EMBED_FRAME_PARAM) === '1'
    ? 'live-embed'
    : 'workbench';
}
