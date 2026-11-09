// The All view and the catalogue-driven app view's code: their own chunk, fetched the first time either is shown
// (or the host prefetches it as Settings is pointed at), never for an editor showing its own settings. Kept apart
// from SettingsPanel.tsx so a host that only prefetches (the site's Explorer) does not put the whole panel in its
// first load: a one-symbol import of the panel's module once did, about 17 KiB gzipped.
export const loadCatalogueView = () => import('./CatalogueSettingsView');

/** Fetches the All view's code ahead of time (a pointer heading for Settings, say). */
export function preloadSettingsPanel(): void {
  void loadCatalogueView();
}
