import type { Element } from '@livehuddle/document';
import type { EditorCapabilities } from '@/lib/editor-capabilities';
import { canEditSankey } from '@/lib/sankey-edit';

// Who may edit a sequence diagram (docs/specs/009-elements/sequence-diagram.md "Share roles"): an Editor, on a diagram
// that is not locked, the Sankey's rule: its rows reshape the board, which a Participant never does. The double-click,
// the menu's Edit Sequence and the dialog all ask this one question.
export function canEditSequence(can: Pick<EditorCapabilities, 'level'>, el: Element): boolean {
  return canEditSankey(can, el);
}
