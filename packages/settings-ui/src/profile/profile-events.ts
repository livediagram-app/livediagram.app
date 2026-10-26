// A profile just saved in the Settings panel's Profile (liveworkspace/docs/specs/010-site/site.md "Settings", "Profile"), told to
// whatever on the page shows the person: an editor's own presence (its cursor, name tag and avatar in the room), the
// Explorer's header avatar on an app's address. Its own module, with no React, so a page that only listens carries
// nothing of the panel.

/** What was saved (the fields the patch named) and the profile as the accounts API now answers it. */
export type SavedProfile = {
  patch: { name?: string | null; color?: string | null; showPicture?: boolean };
  // The display name collaborators see (its own, else the account's), and the colour, null for Automatic.
  name: string | null;
  color: string | null;
  // Show My Google Picture as it now is: an editor's own presence stops or starts sending its picture.
  showPicture?: boolean;
};

const listeners = new Set<(saved: SavedProfile) => void>();

/** Tells every listener on the page. */
export function announceProfileSaved(saved: SavedProfile): void {
  for (const listener of listeners) {
    try {
      listener(saved);
    } catch (error) {
      console.error('[settings] profile listener failed', error);
    }
  }
}

/** A participant (an editor's own presence) with a saved profile's name and colour, or null when nothing it shows
 *  changed. A field the patch didn't name is kept; so is the colour when Automatic was picked (the app's own pick
 *  stands until the next open) and the name when the profile answered none. */
export function participantWithProfile<P extends { name: string; color: string }>(
  participant: P,
  saved: SavedProfile,
): P | null {
  const name = saved.patch.name !== undefined && saved.name ? saved.name : participant.name;
  const color = saved.patch.color !== undefined && saved.color ? saved.color : participant.color;
  if (name === participant.name && color === participant.color) return null;
  return { ...participant, name, color };
}

/** Listens for a saved profile; answers the way to stop. */
export function onProfileSaved(listener: (saved: SavedProfile) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
