// The type-level parts a card type change sets: its colour, glyph, built-in fields, card face and panel, Show on Card
// placement and the Assignee's Notifies switch, and the name lookups every change makes (type-changes.ts).
import { Refused, invalid } from './type-change-refused';
import { HEX_COLOUR } from './validate';
import { PLAN_GLYPH_IDS, isPlanGlyphId, type PlanGlyphId } from './glyphs';
import type { ItemTypeDef } from './item-types';
import { fieldKeyOf, type NameRefusal } from './plan-names';
import { PLAN_TYPE_COLOURS } from './type-catalogue';
import type { CardField } from './board';
import type { CardLayout } from './card-display';
import { detailsLabelFrom, displayFrom, tabsFrom, type FaceRead } from './type-change-face';
import type { FaceInput } from './type-change-inputs';

function face<T>(read: FaceRead<T>, code: 'type_change_invalid' | 'display_invalid'): T {
  if (!read.ok) throw new Refused({ code, message: read.message });
  return read.value;
}

// The face and panel `c` gives, on `type` as it stands after the change's fields.
export function withFace(type: ItemTypeDef, c: FaceInput): ItemTypeDef {
  let next = type;
  if (c.display) {
    const display = face(displayFrom(c.display, next), 'display_invalid');
    const { display: _old, ...rest } = next;
    next = display ? { ...rest, display } : rest;
  }
  if (c.tabs) next = { ...next, tabs: face(tabsFrom(c.tabs, next), 'type_change_invalid') };
  if (c.detailsLabel !== undefined) {
    const label = face(detailsLabelFrom(c.detailsLabel), 'type_change_invalid');
    const { detailsLabel: _old, ...rest } = next;
    next = label ? { ...rest, detailsLabel: label } : rest;
  }
  return next;
}

// A custom field ticked Show on Card shows on a Detailed card. Without a Display of its own the type's default layout
// already puts it Under the Title (typeCardLayout); with one, the tick must place it there too, at the end of the body,
// or it would not show at all.
export function withOnCardShown(type: ItemTypeDef, ids: readonly string[]): ItemTypeDef {
  const own = type.display?.detailed;
  if (!own || ids.length === 0) return type;
  const placed = new Set(Object.values(own).flat());
  // Still the type's (one removed later in the same change is not placed) and not placed already.
  const added = ids.filter(
    (id) => (type.custom ?? []).some((f) => f.id === id) && !placed.has(id as CardField),
  ) as CardField[];
  if (added.length === 0) return type;
  return {
    ...type,
    display: { ...type.display, detailed: { ...own, body: [...(own.body ?? []), ...added] } },
  };
}

export function withoutOnDetailed(type: ItemTypeDef, id: string): ItemTypeDef {
  const own = type.display?.detailed;
  if (!own) return type;
  const detailed = Object.fromEntries(
    Object.entries(own).map(([slot, fields]) => [slot, fields.filter((f) => f !== id)]),
  ) as CardLayout;
  return { ...type, display: { ...type.display, detailed } };
}

export function must<T extends object>(
  named: ({ ok: true } & T) | ({ ok: false } & NameRefusal),
): T {
  if (!named.ok) throw new Refused({ code: named.code, message: named.message });
  return named;
}

export function colourOf(input: string): string {
  const hex = input.trim().toLowerCase();
  if (HEX_COLOUR.test(hex)) return hex;
  throw invalid(
    `"${input}" is not a colour. Give a #rrggbb colour, for example ${PLAN_TYPE_COLOURS.join(', ')}.`,
  );
}

export function glyphOf(input: string): PlanGlyphId {
  const id = input.trim().toLowerCase();
  if (isPlanGlyphId(id)) return id;
  throw invalid(`"${input}" is not a Plan glyph. Glyphs: ${PLAN_GLYPH_IDS.join(', ')}.`);
}

// A built-in field by id or interface name: with the custom fields set aside, fieldKeyOf can answer nothing else.
export function builtInFieldOf(name: string, type: ItemTypeDef): string {
  return must(fieldKeyOf(name, { ...type, custom: [] })).key;
}

// The Assignee's Notifies switch: kept only as false, so a type that tells its assignee is stored as before.
export function withAssigneeNotifies(type: ItemTypeDef, on: boolean | undefined): ItemTypeDef {
  if (on === undefined) return type;
  const { assigneeNotifies: _was, ...rest } = type;
  return on ? rest : { ...rest, assigneeNotifies: false };
}
