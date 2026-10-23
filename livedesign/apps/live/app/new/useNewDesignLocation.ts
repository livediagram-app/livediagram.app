import { defaultSaveLocationFor, type SaveLocationId } from '@/lib/save-locations';

// Where /new stores a new design (docs/specs/006-design/save-locations.md "The default"); nobody is asked. It is
// livedesign for everyone, a guest included (their guest identity is liveworkspace's), so the create never waits
// on sign-in to decide.
export function useNewDesignLocation() {
  const resolveSaveLocation = async (): Promise<SaveLocationId> => defaultSaveLocationFor();
  return { resolveSaveLocation };
}
