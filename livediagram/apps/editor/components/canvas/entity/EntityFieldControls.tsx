'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ENTITY_BODY_PAD_PX,
  ENTITY_MAX_FIELDS,
  ENTITY_ROW_GAP_PX,
  ENTITY_ROW_TEXT_PX,
  entityHeaderHeight,
  entityPartAt,
  removedFieldRemap,
  type EntityField,
  type ShapeElement,
} from '@livediagram/document';
import {
  getEntityFieldEdit,
  setEntityFieldEdit,
  useEntityFieldEdit,
} from '@/lib/entity-field-edit';
import { track } from '@/lib/telemetry';
import { EntityFieldEditor, type FieldEditExit } from './EntityFieldEditor';
import type { EntityCanvasActions } from './entity-actions';

const PITCH = ENTITY_ROW_TEXT_PX + ENTITY_ROW_GAP_PX;
// A port's drawn size in canvas px.
const PORT_PX = 9;
// How far a port sits out from the edge: clear of the side resize handle on the edge itself.
const PORT_OUT_PX = 14;

const sameField = (a: EntityField | undefined, b: EntityField) =>
  !!a && a.name === b.name && (a.type ?? '') === (b.type ?? '') && a.key === b.key;

const isBlank = (f: EntityField) => !f.name.trim() && !f.type?.trim();

// The selected entity's working layer (docs/specs/009-elements/entity.md "Editing on the canvas", "Field to
// field"), over its fields only, so the title still edits and the box still drags as any element's does:
// it lights the field under the pointer, shows a port beside it on each side to draw a relationship
// from, and holds the field being edited in place (the double-click that opens one is routed by the
// element, openEntityFieldAt).
export function EntityFieldControls({
  element,
  fields,
  actions,
}: {
  element: ShapeElement;
  // The fields as they read (legacy keys parsed): what is edited, and what a save writes back.
  fields: EntityField[];
  actions: EntityCanvasActions;
}) {
  const editing = useEntityFieldEdit(element.id);
  const [hover, setHover] = useState<number | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const headerH = entityHeaderHeight(element.textSize);
  const { id } = element;

  // An edit belongs to this entity while it is selected: deselecting it ends one left open.
  useEffect(
    () => () => {
      if (getEntityFieldEdit()?.entityId === id) setEntityFieldEdit(null);
    },
    [id],
  );

  // The part of the box under a pointer, from the layer's on-screen box (which carries the zoom).
  const partAt = (clientY: number) => {
    const rect = layerRef.current?.getBoundingClientRect();
    if (!rect || rect.height <= 0) return null;
    const scale = (element.height - headerH) / rect.height;
    const y = element.y + headerH + (clientY - rect.top) * scale;
    return entityPartAt(element, fields.length, { x: element.x + 1, y });
  };

  const save = (index: number, draft: EntityField, exit: FieldEditExit) => {
    let count = fields.length;
    let removed = false;
    if (index >= fields.length) {
      if (!isBlank(draft)) {
        actions.setFields(id, [...fields, draft]);
        count += 1;
        track('Element', 'Changed', 'Entity');
      }
    } else if (isBlank(draft)) {
      // A field emptied of both name and type goes, letting go of any end on it.
      actions.setFields(
        id,
        fields.filter((_, j) => j !== index),
        removedFieldRemap(index),
      );
      count -= 1;
      removed = true;
      track('Element', 'Changed', 'Entity');
    } else if (!sameField(fields[index], draft)) {
      actions.setFields(
        id,
        fields.map((f, j) => (j === index ? draft : f)),
      );
      track('Element', 'Changed', 'Entity');
    }
    const blankNew = index >= fields.length && isBlank(draft);
    const next =
      exit === 'next' && !blankNew
        ? removed
          ? index
          : index + 1
        : exit === 'prev' && index > 0
          ? index - 1
          : null;
    setEntityFieldEdit(
      next !== null && next <= count && next < ENTITY_MAX_FIELDS
        ? { entityId: id, index: next }
        : null,
    );
  };

  const startArrow = (side: 'w' | 'e', index: number) => (e: ReactPointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    actions.startFieldArrow(id, side, index, e);
  };

  const rowTop = (i: number) => ENTITY_BODY_PAD_PX + i * PITCH;
  const ported = editing === null ? hover : null;

  return (
    <div
      ref={layerRef}
      data-entity-field-controls=""
      className="absolute inset-x-0 bottom-0"
      style={{ top: headerH }}
      onPointerMove={(e) => {
        const part = partAt(e.clientY);
        const next = part?.kind === 'field' ? part.index : null;
        if (next !== hover) setHover(next);
      }}
      onPointerLeave={() => setHover(null)}
    >
      {ported !== null ? (
        <>
          {/* The field under the pointer, lit, so a double-click's target is plain before it lands. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bg-brand-500/10"
            style={{ top: rowTop(ported) - ENTITY_ROW_GAP_PX / 2, height: PITCH }}
          />
          {(['w', 'e'] as const).map((side) => (
            <button
              key={side}
              type="button"
              aria-label={`Draw a relationship from ${fields[ported]?.name || 'this field'}`}
              data-entity-port={side}
              onPointerDown={startArrow(side, ported)}
              // The button spans from the edge out to the dot, so the pointer crossing to it never leaves
              // the field and drops the ports.
              className={`group absolute flex cursor-crosshair items-center ${side === 'w' ? 'justify-start' : 'justify-end'}`}
              style={{
                width: PORT_OUT_PX + PORT_PX / 2,
                height: PITCH,
                top: rowTop(ported) - ENTITY_ROW_GAP_PX / 2,
                ...(side === 'w'
                  ? { left: -PORT_OUT_PX - PORT_PX / 2 }
                  : { right: -PORT_OUT_PX - PORT_PX / 2 }),
              }}
            >
              <span
                aria-hidden
                className="block rounded-full border-[1.5px] border-brand-500 bg-white shadow-sm transition-transform group-hover:scale-125 dark:bg-slate-900"
                style={{ width: PORT_PX, height: PORT_PX }}
              />
            </button>
          ))}
        </>
      ) : null}
      {editing !== null ? (
        <EntityFieldEditor
          key={`${editing}:${fields.length}`}
          field={fields[editing]}
          top={rowTop(editing)}
          onSave={(draft, exit) => save(editing, draft, exit)}
          onCancel={() => setEntityFieldEdit(null)}
        />
      ) : null}
    </div>
  );
}
