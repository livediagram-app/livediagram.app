// What the search panel searches across, shaped by the workbench's search-panel-sources around this editor's rule
// for a canvas kept only in this browser. Kept apart from SearchPanel.tsx, which both hosts load lazily: importing
// this costs no first-load JS.
import { createSearchPanelSources } from '@liveworkspace/workbench/components/panels/search-panel-sources';
import { isInThisBrowser } from '@/lib/document-space';

export type {
  SearchPanelDocument,
  SearchPanelFolder,
  SearchPanelShared,
  SearchPanelTeam,
  SearchPanelTeamFolder,
  SearchPanelTeamDocument,
} from '@liveworkspace/workbench/components/panels/search-panel-sources';

export const searchPanelSources = createSearchPanelSources(isInThisBrowser);
