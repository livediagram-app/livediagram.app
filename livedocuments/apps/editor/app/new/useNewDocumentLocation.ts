import { defaultSaveLocationFor, type SaveLocationId } from '@/lib/save-locations';

// Where /new stores a new plan (docs/specs/006-document/save-locations.md "The default"); nobody is asked. It is
// livedocuments for everyone, a guest included (their guest identity is liveworkspace's), so the create never waits
// on sign-in to decide.
export function useNewDocumentLocation() {
  const resolveSaveLocation = async (): Promise<SaveLocationId> => defaultSaveLocationFor();
  return { resolveSaveLocation };
}
