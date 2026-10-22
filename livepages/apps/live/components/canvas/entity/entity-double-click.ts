import { ENTITY_MAX_FIELDS, entityPartAt, type ShapeElement } from '@livepages/document';
import { setEntityFieldEdit } from '@/lib/entity-field-edit';

/**
 * A double-click on an entity's fields (docs/specs/009-elements/entity.md "Editing on the canvas"): opens the
 * field under the pointer in place, or a new field below the last, and says so; false leaves the
 * double-click to the element (the title bar edits the title). Read from the element's on-screen box, as
 * the first click of the pair may have deselected it and taken its controls layer away.
 */
export function openEntityFieldAt(element: ShapeElement, rect: DOMRect, clientY: number): boolean {
  if (rect.height <= 0) return false;
  const y = element.y + (clientY - rect.top) * (element.height / rect.height);
  const count = element.entityFields?.length ?? 0;
  const part = entityPartAt(element, count, { x: element.x + 1, y });
  if (!part || part.kind === 'title') return false;
  if (part.kind === 'field') setEntityFieldEdit({ entityId: element.id, index: part.index });
  else if (count < ENTITY_MAX_FIELDS) setEntityFieldEdit({ entityId: element.id, index: count });
  return true;
}
