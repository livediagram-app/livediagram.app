import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  buildRelatedEntity,
  cardinalityPatch,
  isEntity,
  withEntityFields,
  ENTITY_MAX_FIELDS,
  type CardinalityPreset,
  type Element,
  type EntityField,
  type FieldRemap,
  type RelatedSide,
  type Tab,
} from '@livehuddle/document';
import type { Selection } from '@liveworkspace/workbench/lib/selection-store';
import { setEntityFieldEdit } from '@/lib/entity-field-edit';
import { track } from '@/lib/telemetry';
import type { EditorDragApi } from './useEditorDrag.types';

// The entity's editor verbs (docs/specs/009-elements/entity.md): saving fields from the canvas, drawing a
// relationship from a field, the ring's Add Field and Add Related Entity, and the Cardinality presets.
// Every write is one `commit`, one undo step; `editsBlocked` (a read-only session, a locked tab) stops
// each before it writes, as the controls that call them are not rendered there either.
export function useEntityActions({
  activeTab,
  readSelection,
  commit,
  styleNewElement,
  setSelectedId,
  setEditingId,
  beginAnchorDrag,
  editsBlocked,
}: {
  activeTab: Tab;
  readSelection: () => Selection;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  styleNewElement: <T extends Element>(el: T) => T;
  setSelectedId: (id: string | null) => void;
  setEditingId: (id: string | null) => void;
  beginAnchorDrag: EditorDragApi['beginAnchorDrag'];
  editsBlocked: boolean;
}) {
  const selectedEntity = () => {
    const { selectedId } = readSelection();
    const el = activeTab.elements.find((e) => e.id === selectedId);
    return isEntity(el) && !el.locked ? el : null;
  };

  const setFields = (entityId: string, fields: EntityField[], remap?: FieldRemap) => {
    if (editsBlocked) return;
    commit((els) => withEntityFields(els, entityId, fields, remap));
  };

  const startFieldArrow = (
    entityId: string,
    side: 'w' | 'e',
    field: number,
    e: ReactPointerEvent,
  ) => {
    if (editsBlocked) return;
    beginAnchorDrag(entityId, side, e, { field });
  };

  // Add Field: the new field after the last, open to type in. Nothing is written until it is saved, so an
  // abandoned one leaves no empty row and no undo step behind.
  const addFieldSelected = () => {
    const el = selectedEntity();
    if (!el || editsBlocked) return;
    const count = el.entityFields?.length ?? 0;
    if (count >= ENTITY_MAX_FIELDS) return;
    setEntityFieldEdit({ entityId: el.id, index: count });
    track('Element', 'Added', 'EntityField');
  };

  const addRelatedSelected = (side: RelatedSide) => {
    const source = selectedEntity();
    if (!source || editsBlocked) return;
    const { entity, arrow } = buildRelatedEntity(source, side, activeTab.elements);
    // Dressed from style memory like any drawn arrow, its ends kept: they are the relationship.
    const placed = {
      ...styleNewElement(arrow),
      arrowEnds: arrow.arrowEnds,
      arrowheadShape: arrow.arrowheadShape,
      arrowheadStartShape: arrow.arrowheadStartShape,
    };
    commit((els) => [...els, entity, placed]);
    setSelectedId(entity.id);
    // Its title first: "Entity" is a placeholder to type over.
    setEditingId(entity.id);
    track('Element', 'Added', 'Entity');
    track('Element', 'Added', 'Arrow');
    track('Element', 'Created', 'RelatedEntity');
  };

  const setCardinalitySelected = (preset: CardinalityPreset) => {
    const { selectedId } = readSelection();
    if (!selectedId || editsBlocked) return;
    const patch = cardinalityPatch(preset);
    commit((els) =>
      els.map((el) => (el.id === selectedId && el.type === 'arrow' ? { ...el, ...patch } : el)),
    );
    track('Element', 'Changed', 'Cardinality');
  };

  return {
    setFields,
    startFieldArrow,
    addFieldSelected,
    addRelatedSelected,
    setCardinalitySelected,
  };
}

export type EntityActions = ReturnType<typeof useEntityActions>;
