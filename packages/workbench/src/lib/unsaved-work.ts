// Who on this page holds unsaved work (docs/specs/016-platform/stale-builds.md): the editor
// registers its autosave's `hasUnsavedChanges`, so a full page load the app starts on its own (a
// stale build, a chunk recovery) waits until that work is saved.
const sources = new Set<() => boolean>();

export function registerUnsavedWork(hasUnsavedChanges: () => boolean): () => void {
  sources.add(hasUnsavedChanges);
  return () => {
    sources.delete(hasUnsavedChanges);
  };
}

export function hasUnsavedWork(): boolean {
  for (const source of sources) if (source()) return true;
  return false;
}
