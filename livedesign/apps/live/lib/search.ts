// The global SearchPanel's results (docs/specs/008-canvas/canvas-and-palette.md "Search panel"): this editor's
// binding of the shared search (@liveworkspace/workbench/lib/editor-search), with its own nouns
// ("Designs", "Untitled design"), its element types and what a palette pick adds; a table with no label is
// found by the first of its cells that matches. The matcher, caps and section order are the shared module's.
//
// Lives in lib/ rather than next to the component so the test suite can import it directly without the 'use client'
// boundary and the dynamic-import wrapping.
import {
  buildEditorSearchResults,
  type EditorSearchConfig,
  type EditorSearchInput,
} from '@liveworkspace/workbench/lib/editor-search/build-search-results';
import type {
  EditorSearchGroup,
  EditorSearchItem,
  PaletteSearchItem as SharedPaletteSearchItem,
} from '@liveworkspace/workbench/lib/editor-search/types';
import type { ShapeKind, Tab } from '@livedesign/design';

export type {
  CommandSearchItem,
  HelpSearchItem,
  SettingSearchItem,
} from '@liveworkspace/workbench/lib/editor-search/types';

// The element type literal each element result carries, so callers can show a per-type icon.
type ElementType =
  | 'shape'
  | 'text'
  | 'sticky'
  | 'image'
  | 'freehand'
  | 'path'
  | 'table'
  | 'annotation'
  | 'link-card'
  | 'video'
  | 'arrow';

// What a picked palette result should add to the canvas. The panel hands
// this back so the editor routes it to the matching add handler (which arms
// the same tap-to-drop / drag-to-size placement the palette uses).
export type PaletteAdd =
  // `variant` is the creation-time choice for the kinds that have one. The palette offers a tile per
  // choice, so search has to as well: typing "funnel" should place a funnel, not a pyramid.
  | {
      type: 'shape';
      shapeKind: ShapeKind;
      plan?: string;
      variant?: string;
    }
  | { type: 'icon'; iconId: string }
  | { type: 'tech'; iconId: string }
  // A sticker (docs/specs/010-palette/stickers.md) is its own element kind, so it adds through its own
  // handler rather than the icon one.
  | { type: 'sticker'; stickerId: string }
  // Every other palette tile (text, arrow, table, image, embeds, web
  // components, ...): the editor runs the tile's own
  // handler (tileHandler), so a search add behaves exactly like the tile.
  | { type: 'tile'; tileId: string };

export type PaletteSearchItem = SharedPaletteSearchItem<PaletteAdd>;
export type SearchResultItem = EditorSearchItem<'design', ElementType, PaletteAdd>;
export type SearchGroup = EditorSearchGroup<'designs', SearchResultItem>;

const SEARCH: EditorSearchConfig<'design', 'designs'> = {
  library: { kind: 'design', key: 'designs', label: 'Designs', untitled: 'Untitled design' },
  tableCells: true,
};

// `designs` are this editor's own; `teamDesigns` its team-library ones. Everything else is the shared input.
type SearchInput = Omit<
  EditorSearchInput<Tab, PaletteAdd>,
  'library' | 'teamLibrary' | 'tabGroups'
> & {
  designs: EditorSearchInput<Tab, PaletteAdd>['library'];
  teamDesigns?: EditorSearchInput<Tab, PaletteAdd>['teamLibrary'];
};

export function buildSearchResults(input: SearchInput): SearchGroup[] {
  const { designs, teamDesigns, ...rest } = input;
  return buildEditorSearchResults({ ...rest, library: designs, teamLibrary: teamDesigns }, SEARCH);
}
