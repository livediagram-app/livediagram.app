import type { Element } from '@livedesign/document';
import type { EditorCapabilities } from '@/lib/editor-capabilities';

// Who may edit a Sankey diagram (docs/specs/009-elements/sankey.md "Who may do what"): an Editor, on a diagram
// that is not locked. Editing its flows or looks reshapes the board, which a Participant never does, so this
// reads the session's level rather than `isReadOnly` (true for a Participant too, but for a different reason).
// The double-click, the menu's Sankey section and the Flows dialog all ask this one question.
export function canEditSankey(can: Pick<EditorCapabilities, 'level'>, el: Element): boolean {
  return can.level === 'edit' && (el as { locked?: boolean }).locked !== true;
}
