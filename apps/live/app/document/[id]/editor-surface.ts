// Where the editor runs (docs/specs/013-workspace/blueprints/workbench-embeds.md "The editor in a
// workbench"): the app, a share-code embed (docs/specs/013-workspace/embeds.md), or a workbench's frame.
// Constant for the page's life (the route that mounted the editor decides it), so every gate may read
// these flags in derived values.
export type EditorSurface = 'app' | 'embed' | 'workbench';

export type SurfaceFlags = {
  // The read-only share-code embed.
  embedMode: boolean;
  // Signed in by a workbench session, inside a developer tool's frame.
  workbenchMode: boolean;
  // The app's surroundings: header, Explorer, account, banners.
  appChrome: boolean;
};

export function surfaceFlags(surface: EditorSurface): SurfaceFlags {
  return {
    embedMode: surface === 'embed',
    workbenchMode: surface === 'workbench',
    appChrome: surface === 'app',
  };
}
