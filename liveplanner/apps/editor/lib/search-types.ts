// The shapes the global SearchPanel's results are made of (docs/specs/008-canvas/canvas-and-palette.md "Search
// panel"), bound to this editor's nouns: the shared row and group shapes
// (@liveworkspace/workbench/lib/editor-search/types) with a plan's own kind ('project'), its element types, what a
// palette pick adds, and the Boards and Cards groups (search-plan.ts). search.ts re-exports the public ones.

import type {
  EditorSearchGroup,
  EditorSearchItem,
  PaletteSearchItem as SharedPaletteSearchItem,
} from '@liveworkspace/workbench/lib/editor-search/types';
import type { EditorSearchInput } from '@liveworkspace/workbench/lib/editor-search/build-search-results';
import type { ShapeKind, Tab } from '@liveplanner/project';
import type { BoardResult, CardResult, CardSearchSource } from './search-plan';

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
  // `session` is the creation-time choice for the kind that has one
  // (docs/specs/012-collaboration/session-button.md). The palette offers a tile per choice, so search has to
  // as well: typing "vote" should place a vote, not a timer.
  | {
      type: 'shape';
      shapeKind: ShapeKind;
      session?: import('@liveplanner/project').SessionTool;
      plan?: string;
      variant?: string;
    }
  // Every other palette tile (text, sticky): the editor runs the tile's own handler (tileHandler), so a search add
  // behaves exactly like the tile.
  | { type: 'tile'; tileId: string };

export type PaletteSearchItem = SharedPaletteSearchItem<PaletteAdd>;

// The board and card results sit beside the shared rows.
export type SearchResultItem =
  EditorSearchItem<'project', ElementType, PaletteAdd> | BoardResult | CardResult;

export type SearchGroup = EditorSearchGroup<'projects' | 'boards' | 'cards', SearchResultItem>;

type SharedInput = EditorSearchInput<Tab, PaletteAdd, SearchGroup>;

// `buildSearchResults`' parameter: the shared input, with this editor's own plans (`projects`), its team-library
// ones (`teamProjects`) and the open plan's cards.
export type SearchInput = Omit<SharedInput, 'library' | 'teamLibrary' | 'tabGroups'> & {
  projects: SharedInput['library'];
  teamProjects?: SharedInput['teamLibrary'];
  // The open project's cards (search-plan.ts), matched by number, title or description on a non-empty query. Editor
  // only, like the tabs.
  cards?: CardSearchSource;
};
