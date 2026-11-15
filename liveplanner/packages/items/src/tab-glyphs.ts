// The icons a card type's panel tabs and Details wear (docs/specs/026-plan/item-types.md "Tab icons"): a Plan glyph
// each, the type's choice or its default. Pure; depends on glyphs.ts and item-types.ts alone, so the catalogue's
// reader, the editor and the agents all ask here.
import { isPlanGlyphId, type PlanGlyphId } from './glyphs';
import type { ItemTypeDef, ItemTypeTab } from './item-types';

// The one tab a type without its own shows (type-catalogue.ts' OVERVIEW_TAB_ID, repeated so this stays a leaf).
const OVERVIEW_TAB = 't-overview';

export const OVERVIEW_TAB_GLYPH: PlanGlyphId = 'page';
export const TAB_GLYPH_DEFAULT: PlanGlyphId = 'kanban';
export const DETAILS_GLYPH_DEFAULT: PlanGlyphId = 'checklist';
// The panel's own tabs, never saved into a type.
export const LINKED_TAB_GLYPH: PlanGlyphId = 'link';
export const ACTIVITY_TAB_GLYPH: PlanGlyphId = 'clock';
export const HIDDEN_TAB_GLYPH: PlanGlyphId = 'eye-off';

// A tab's icon when it has chosen none: Overview's page, any other tab the kanban.
export function defaultTabGlyph(tab: Pick<ItemTypeTab, 'id'>): PlanGlyphId {
  return tab.id === OVERVIEW_TAB ? OVERVIEW_TAB_GLYPH : TAB_GLYPH_DEFAULT;
}

// The icon a tab wears: its own (one this build knows), else its default.
export function tabGlyphOf(tab: Pick<ItemTypeTab, 'id' | 'glyph'>): PlanGlyphId {
  return isPlanGlyphId(tab.glyph) ? tab.glyph : defaultTabGlyph(tab);
}

// The icon Details wears: the type's own, else the checklist.
export function detailsGlyphOf(type: Pick<ItemTypeDef, 'detailsGlyph'>): PlanGlyphId {
  return isPlanGlyphId(type.detailsGlyph) ? type.detailsGlyph : DETAILS_GLYPH_DEFAULT;
}

// A glyph as stored: kept only when it is one this build knows and not the default (`fallback`), so Reset To Default
// and choosing the default both store nothing.
export function storedGlyph(glyph: unknown, fallback: PlanGlyphId): PlanGlyphId | undefined {
  return isPlanGlyphId(glyph) && glyph !== fallback ? glyph : undefined;
}

// `tab` with `glyph` (undefined: the default), stored as storedGlyph keeps it.
export function withTabGlyph<T extends ItemTypeTab>(tab: T, glyph: PlanGlyphId | undefined): T {
  const { glyph: _was, ...rest } = tab;
  const kept = storedGlyph(glyph, defaultTabGlyph(tab));
  return (kept ? { ...rest, glyph: kept } : rest) as T;
}

// `type` with `glyph` as Details' icon (undefined: the default).
export function withDetailsGlyph<T extends Pick<ItemTypeDef, 'detailsGlyph'>>(
  type: T,
  glyph: PlanGlyphId | undefined,
): T {
  const { detailsGlyph: _was, ...rest } = type;
  const kept = storedGlyph(glyph, DETAILS_GLYPH_DEFAULT);
  return (kept ? { ...rest, detailsGlyph: kept } : rest) as T;
}
