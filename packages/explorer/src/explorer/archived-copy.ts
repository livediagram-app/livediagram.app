// What an archived document says when someone tries to open it (one-explorer.md "Archived"): the Explorer's dialog,
// for an account's document and one kept only in this browser alike.

import { quoted } from '../quoted';

export function archivedCopy(
  title: string,
  kind: string,
): { title: string; message: string; confirmLabel: string; cancelLabel: string } {
  return {
    title: `${quoted(title || 'Untitled')} is archived`,
    message: `An archived ${kind} can't be opened or edited. Move it out of Archived with Change Folder to work on it again.`,
    confirmLabel: 'Change Folder',
    cancelLabel: 'Cancel',
  };
}
