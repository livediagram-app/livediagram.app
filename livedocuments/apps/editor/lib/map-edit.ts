import type { Element } from '@livedocuments/document';
import type { EditorCapabilities } from '@/lib/editor-capabilities';

// Who may edit a map (docs/specs/009-elements/map.md "Who may do what"): an Editor, on a map that is not
// locked. A map is board structure, like a Sankey, so a Participant's own-content rights do not reach
// it; this reads the session's level rather than `isReadOnly`. The double-click, the menu's Map section
// and the Map dialog all ask this one question.
export function canEditMap(can: Pick<EditorCapabilities, 'level'>, el: Element): boolean {
  return (
    el.type === 'shape' &&
    el.shape === 'map' &&
    can.level === 'edit' &&
    (el as { locked?: boolean }).locked !== true
  );
}
