import type { PointerEvent as ReactPointerEvent } from 'react';
import type { EntityField, FieldRemap } from '@livediagram/document';

// What a selected, editable entity can do from the canvas (docs/specs/009-elements/entity.md): save its
// fields (refitting the box and keeping field-pinned ends on their fields) and start a relationship from
// one of its fields. Handed down only to an Editor's unlocked entity; absent, the view is inert.
export type EntityCanvasActions = {
  setFields: (entityId: string, fields: EntityField[], remap?: FieldRemap) => void;
  startFieldArrow: (entityId: string, side: 'w' | 'e', field: number, e: ReactPointerEvent) => void;
};
