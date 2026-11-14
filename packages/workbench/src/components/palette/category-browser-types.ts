import type { ReactNode } from 'react';
import type { ToolsCategory } from './palette-tools-nav';

// The drill-in browse every catalogue tab of the palette uses (docs/specs/010-palette/palette-category-browse.md),
// as the shared tabs see it. Each editor keeps its own `PaletteCategoryBrowser` (it sends the editor's telemetry
// and lays out its own rail) and hands it to the tabs it binds, so these are the props the tabs pass it.

/** One group of the browse: a category tile and the items it opens to. */
export type BrowserCategory<T> = ToolsCategory & { items: T[] };

export type CategoryBrowserProps<T> = {
  root: string;
  categories: BrowserCategory<T>[];
  search: (query: string) => T[];
  renderItems: (items: T[]) => ReactNode;
  query: string;
  onQueryChange: (query: string) => void;
  searchInput: {
    placeholder: string;
    ariaLabel: string;
    clearAriaLabel: string;
    clearDescription: string;
  };
  telemetry: { openedType: string; searchedType: string };
  things: string;
  loading?: boolean;
  loadingMessage?: string;
};

/** The editor's browse component, generic over what its groups hold. */
export type CategoryBrowser = <T>(props: CategoryBrowserProps<T>) => ReactNode;

/** The props the shared tabs pass the editor's palette `IconButton`. */
export type PaletteIconButtonProps = {
  label: string;
  description: string;
  onClick: () => void;
  children: ReactNode;
  hint?: 'tooltip' | 'hover-card';
  hideCaption?: boolean;
  caption?: string;
  noTint?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
};
