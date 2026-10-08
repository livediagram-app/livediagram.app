// What every document delete asks (docs/specs/013-workspace/trash.md, "Deleting"):
// short, because the Trash is the way back. The first line is the question;
// a second line appears only when there is something the user would not
// otherwise know: the whole team loses it, its share links stop working, or
// tabs it shares with other documents stay there. The button is the soft
// yellow caution, not red: nothing is lost for 30 days.
import { apiListShareLinks } from '@/lib/api-client';

export const DELETE_CONFIRM_TITLE = 'Confirm';
export const DELETE_CONFIRM_LABEL = 'Delete';
export const DELETE_TEAM_LINE = 'It is deleted for the whole team.';
export const DELETE_SHARE_LINKS_LINE = 'Its share links stop working.';

export type DeleteConfirmationInput = {
  name: string | null | undefined;
  hasShareLinks: boolean;
  // The shared-tabs sentence (lib/shared-tabs-notice.ts), when it applies.
  sharedTabsNotice?: string | null;
  team?: boolean;
};

export function deleteConfirmationMessage(input: DeleteConfirmationInput): string {
  const question = `Delete "${input.name || 'this document'}"?`;
  const details = [
    input.team ? DELETE_TEAM_LINE : null,
    input.hasShareLinks ? DELETE_SHARE_LINKS_LINE : null,
    input.sharedTabsNotice || null,
  ].filter(Boolean);
  return details.length > 0 ? `${question}\n${details.join(' ')}` : question;
}

export function deleteConfirmation(input: DeleteConfirmationInput) {
  return {
    title: DELETE_CONFIRM_TITLE,
    message: deleteConfirmationMessage(input),
    confirmLabel: DELETE_CONFIRM_LABEL,
  };
}

export const SHARE_LINKS_LOOKUP_TIMEOUT_MS = 1500;

// Whether a document has share links, for a document the caller's list does
// not describe (the one open in the editor). Owner-only on the server: when it
// cannot say (a teammate who is not the owner, offline, slow), the line is left
// out rather than guessed.
export async function lookUpShareLinks(ownerId: string, documentId: string): Promise<boolean> {
  try {
    const result = await Promise.race([
      apiListShareLinks(ownerId, documentId),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), SHARE_LINKS_LOOKUP_TIMEOUT_MS),
      ),
    ]);
    return result !== null && result.links.length > 0;
  } catch {
    return false;
  }
}
