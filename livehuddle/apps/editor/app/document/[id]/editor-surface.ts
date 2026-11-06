// Where the editor runs: the app, or a share-code embed (docs/specs/013-workspace/embeds.md).
// Constant for the page's life (the route that mounted the editor decides it), so every gate may read
// these flags in derived values.
export type EditorSurface = 'app' | 'embed';

type SurfaceFlags = {
  // The read-only share-code embed.
  embedMode: boolean;
  // The app's surroundings: header, Explorer, account, banners.
  appChrome: boolean;
};

export function surfaceFlags(surface: EditorSurface): SurfaceFlags {
  return {
    embedMode: surface === 'embed',
    appChrome: surface === 'app',
  };
}
