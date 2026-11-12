// Search-result computation for the global SearchPanel (docs/specs/008-canvas/canvas-and-palette.md
// "Search panel"): this editor's binding of the shared search
// (@liveworkspace/workbench/lib/editor-search/build-search-results), which holds the matcher, the caps and the
// section order. A plan adds its own: its boards by title and its cards by number, title or description
// (search-plan.ts), after Tabs and before Elements.
//
// Lives in lib/ rather than next to the component so the test
// suite can import it directly without the 'use client' boundary
// + the dynamic-import wrapping.

import {
  buildEditorSearchResults,
  type EditorSearchConfig,
} from '@liveworkspace/workbench/lib/editor-search/build-search-results';
import { boardResults, cardResults } from './search-plan';
import type { SearchGroup, SearchInput } from './search-types';

export type {
  CommandSearchItem,
  HelpSearchItem,
  PaletteAdd,
  PaletteSearchItem,
  SearchGroup,
  SearchResultItem,
  SettingSearchItem,
} from './search-types';

const SEARCH: EditorSearchConfig<'project', 'projects'> = {
  library: { kind: 'project', key: 'projects', label: 'Plans', untitled: 'Untitled plan' },
  tableCells: true,
};

export function buildSearchResults(input: SearchInput): SearchGroup[] {
  const { projects, teamProjects, cards, ...rest } = input;
  return buildEditorSearchResults(
    {
      ...rest,
      library: projects,
      teamLibrary: teamProjects,
      // Plan scope: boards by title, then cards by number, title or description (search-plan.ts). Non-empty query
      // only.
      tabGroups: (q, tabs) => {
        const groups: SearchGroup[] = [];
        const boards = boardResults(q, tabs);
        if (boards.length > 0) groups.push({ key: 'boards', label: 'Boards', items: boards });
        const found = cards ? cardResults(q, cards) : [];
        if (found.length > 0) groups.push({ key: 'cards', label: 'Cards', items: found });
        return groups;
      },
    },
    SEARCH,
  );
}
