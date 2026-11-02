'use client';

import {
  ENTITY_BAND_TINT,
  ENTITY_BODY_PAD_PX,
  ENTITY_MONO_FONT,
  ENTITY_ROW_GAP_PX,
  ENTITY_ROW_TEXT_PX,
  ENTITY_STRIPE_TINT,
  ENTITY_TYPE_OPACITY,
  entityFieldView,
  entityHeaderHeight,
  entityKeyGutterPx,
  type EntityField,
  type ShapeElement,
} from '@livehuddle/document';
import { EntityKeyGlyph } from './EntityKeyGlyph';
import dynamic from 'next/dynamic';
import type { EntityCanvasActions } from './entity-actions';

// Only a selected entity in an editing session works in place, so its controls (the field editor, the
// ports) load on that first selection rather than with the editor.
const EntityFieldControls = dynamic(
  () => import('./EntityFieldControls').then((m) => m.EntityFieldControls),
  { ssr: false },
);

// An entity (docs/specs/009-elements/entity.md): a tinted title bar over striped `name: Type` rows with a
// key gutter — a UML class, an ER table, a struct.
//
// The UML class template built this out of "two flush-stacked tables sharing a
// groupId… so the seam between the tables draws the attribute / method
// separator". That is a clever hack around a missing element: two elements
// pretending to be one, held together by a group, with a border seam standing
// in for a divider.
//
// The TITLE is the element's ordinary `label`, so it edits, formats and
// exports like every other label; only the band under it and the rows are bespoke. The geometry is
// entity-geometry.ts's and the look svg-render-entity.ts's, so the export matches what is drawn here.

export function EntityView({
  element,
  textColor,
  fontFamily,
  stroke,
  actions,
}: {
  element: ShapeElement;
  textColor: string;
  fontFamily: string | undefined;
  // The border colour as drawn, which the band is a tint of when no heading colour is set.
  stroke?: string;
  // An Editor's unlocked, selected entity: in-place editing and field ports. Absent, it is inert.
  actions?: EntityCanvasActions;
}) {
  const fields = (element.entityFields ?? []).map(entityFieldView);
  const rule = element.strokeColor ?? '#cbd5e1';
  const headerH = entityHeaderHeight(element.textSize);
  const gutter = entityKeyGutterPx(fields);
  const pitch = ENTITY_ROW_TEXT_PX + ENTITY_ROW_GAP_PX;
  const band = element.headerFill ?? stroke ?? rule;
  return (
    <>
      {/* Inert as a whole: the canvas owns press-drag on an element. The controls layer below takes only
          the double-click (edit a field) and the ports. */}
      <div
        className="pointer-events-none absolute inset-0 flex flex-col overflow-hidden rounded-[inherit]"
        style={{ fontFamily }}
      >
        {/* The title bar: a tint of the border (or the heading colour at full strength), the label over it,
            the rule where the label ends. */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0"
          style={{
            height: headerH,
            background: band,
            opacity: element.headerFill ? 1 : ENTITY_BAND_TINT,
          }}
        />
        {/* Every other row on a faint stripe, each spanning the gaps either side so the stripes tile. */}
        {fields.map((_, i) =>
          i % 2 === 1 ? (
            <div
              key={i}
              aria-hidden
              className="absolute inset-x-0"
              style={{
                top: headerH + ENTITY_BODY_PAD_PX + i * pitch - ENTITY_ROW_GAP_PX / 2,
                height: pitch,
                background: textColor,
                opacity: ENTITY_STRIPE_TINT,
              }}
            />
          ) : null,
        )}
        <div
          className="relative shrink-0"
          style={{ height: headerH, borderBottom: `1px solid ${rule}` }}
        />
        <div
          data-entity-fields=""
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-2"
          style={{ gap: ENTITY_ROW_GAP_PX, paddingTop: ENTITY_BODY_PAD_PX }}
        >
          {fields.length === 0 ? (
            <span className="text-[10px] italic opacity-40" style={{ color: textColor }}>
              No fields yet
            </span>
          ) : (
            fields.map((f, i) => <Row key={i} field={f} gutter={gutter} color={textColor} />)
          )}
        </div>
      </div>
      {actions ? <EntityFieldControls element={element} fields={fields} actions={actions} /> : null}
    </>
  );
}

function Row({ field, gutter, color }: { field: EntityField; gutter: number; color: string }) {
  const primary = field.key === 'pk' || field.key === 'pk-fk';
  return (
    <div
      className="flex min-w-0 shrink-0 items-center gap-1 text-[11px] leading-tight"
      style={{ color, height: ENTITY_ROW_TEXT_PX }}
    >
      {gutter > 0 ? (
        <span className="flex shrink-0 items-center" style={{ width: gutter - 4 }}>
          {field.key ? <EntityKeyGlyph fieldKey={field.key} color={color} /> : null}
        </span>
      ) : null}
      <span className={`min-w-0 truncate ${primary ? 'font-semibold' : ''}`}>{field.name}</span>
      {field.type ? (
        // The type is muted, monospace and pushed right: scanning a class is scanning the NAMES, and a
        // full-strength type column competes with them. It shortens first and never takes more than half
        // the row, so a long type (TIMESTAMP WITH TIME ZONE) cannot squeeze the name to an ellipsis.
        <span
          className="ml-auto min-w-0 max-w-[50%] truncate text-[10px]"
          style={{ fontFamily: ENTITY_MONO_FONT, opacity: ENTITY_TYPE_OPACITY }}
        >
          {field.type}
        </span>
      ) : null}
    </div>
  );
}
