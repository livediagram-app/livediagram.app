// Who chooses a Poster's picture (docs/specs/009-elements/poster.md "Share roles"): an Editor, while the board takes
// their edits. A Participant swaps an Image element's picture, but a poster is part of the Space's build, so its
// double click, toolbar button and menu section are an Editor's alone; a Participant and a Viewer just see it.
import type { EditorCapabilities } from '@/lib/editor-capabilities';

export function choosesPosterPicture(
  can: Pick<EditorCapabilities, 'level'>,
  readOnly: boolean,
): boolean {
  return can.level === 'edit' && !readOnly;
}
