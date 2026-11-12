// The shapes the global SearchPanel's results are made of (docs/specs/008-canvas/canvas-and-palette.md "Search
// panel"): what each result row is, the groups they sit in and the catalogues the editor passes in. Generic over
// what each editor names for itself (its own kind of file, its element types, what a palette pick adds); each
// editor's lib/search.ts binds them to its own nouns.

import type { App } from '@liveworkspace/index-client';

// `team` set = a file in a team's library (docs/specs/013-workspace/): the panel renders an "in <team>" suffix,
// like team folders. Personal ones leave it unset. Either way picking it opens it by id. `localOnly`: saved only in
// this browser (Offline Mode); the result carries the This Browser pill.
export type LibraryItem<K extends string> = {
  kind: K;
  id: string;
  name: string;
  team?: { id: string; name: string };
  localOnly?: boolean;
};
// `team` set = a team-library folder: the panel renders an "in <team>" suffix and picking it lands on the team page
// with that folder open. Personal folders leave it unset.
export type FolderItem = {
  kind: 'folder';
  id: string;
  name: string;
  team?: { id: string; name: string };
};
// The remaining variants are union members of `EditorSearchItem`. Callers narrow via the `kind` discriminator.
export type SharedItem = { kind: 'shared'; id: string; name: string; shareCode: string };
export type TeamItem = { kind: 'team'; id: string; name: string };
export type TabItem = { kind: 'tab'; id: string; name: string; isCurrent: boolean };
export type ElementItem<T extends string> = {
  kind: 'element';
  tabId: string;
  tabName: string;
  elementId: string;
  label: string;
  // The element's type literal, so callers can show a per-type icon.
  type: T;
};
export type PaletteItem<Add> = { kind: 'palette'; id: string; name: string; add: Add };
// A synthetic command result: performing it changes the open file or a selection rather than navigating
// somewhere. Modelled like a palette item (an intent the panel hands back to the editor): the panel returns the
// `id` and the editor's `useEditorCommands` dispatcher runs the matching handler. The catalogue (which commands
// apply to the current selection) is the editor's concern; this lib only matches, caps and groups what it's handed.
export type CommandItem = { kind: 'command'; id: string; name: string };
// A help-centre article result. Picking it opens the article (in a new tab); `href` is the absolute /help path and
// `leaf` the article's telemetry id (help-registry's articleTelemetryId: unique per article, slash-free).
export type HelpItem = { kind: 'help'; id: string; name: string; href: string; leaf: string };
// A Settings row result. Picking it opens the Settings dialog on that row's category with the row itself
// highlighted: the setting IS the destination, so the search does not just dump you at the dialog's front door.
export type SettingItem = {
  kind: 'setting';
  id: string;
  name: string;
  // Which category pane to open, and which row to ring once it is open.
  categoryId: string;
  rowKey: string;
  // The category's own label, shown as the result's trailing context so two similarly-named settings are
  // distinguishable in the list.
  categoryLabel: string;
};
// A result from every app (Work Tracker #63): an item the index found among everything the person can open, in any
// app, that this panel's own lists do not hold. It carries its app (the row shows the app's logo and name in the
// app's colour) and, reached through a link, its share code; picking it opens it in its own app.
export type WorkspaceItem = {
  kind: 'workspace';
  id: string;
  name: string;
  app: App;
  sharedVia: string | null;
};

// Every row the shared search makes: `K` is the editor's own kind of file, `T` its element types, `Add` what a
// palette pick adds.
export type EditorSearchItem<K extends string, T extends string, Add> =
  | WorkspaceItem
  | LibraryItem<K>
  | SharedItem
  | FolderItem
  | TeamItem
  | TabItem
  | ElementItem<T>
  | PaletteItem<Add>
  | CommandItem
  | HelpItem
  | SettingItem;

// The groups every editor's search has, beside its own files' group (named by the editor).
export type SharedSearchGroupKey =
  | 'shared'
  | 'folders'
  | 'teams'
  | 'workspace'
  | 'tabs'
  | 'elements'
  | 'palette'
  | 'commands'
  | 'help'
  | 'settings';

export type EditorSearchGroup<GK extends string, Item> = {
  key: GK | SharedSearchGroupKey;
  label: string;
  items: Item[];
};

// A searchable command the editor passes in (delete / rotate / share / rename / ...). `keywords` widens matching
// beyond the visible name (so "front" finds "Bring to front"); the editor builds the list contextually
// (selection-aware) and owns the id -> handler dispatch.
export type CommandSearchItem = { id: string; name: string; keywords: string };

// A searchable palette entry the editor passes in (shapes / icons / tiles). `keywords` widens matching beyond the
// visible name (so "database" finds the cylinder). Kept catalogue-agnostic so this lib stays free of the icon data
// and the Explorer (which omits it) pays nothing.
export type PaletteSearchItem<Add> = { id: string; name: string; keywords: string; add: Add };

// A searchable Settings row the editor passes in, built from the settings catalogue (lib/settings-search-items.ts)
// so this lib stays free of the settings data, the same arrangement help and palette use.
export type SettingSearchItem = {
  id: string;
  title: string;
  keywords: string;
  categoryId: string;
  categoryLabel: string;
  rowKey: string;
};

// A searchable help-centre article the editor offers as "Help" results. `keywords` widens matching beyond the title
// (so "shortcut" finds the keyboard-shortcuts article). The catalogue lives in the editor's lib/help-search.ts.
export type HelpSearchItem = {
  id: string;
  title: string;
  keywords: string;
  href: string;
  leaf: string;
};

// What the search walks inside a tab: its elements, each with an id and a type (a label and, for a table, cells
// read when present).
export type SearchableElement = { id: string; type: string };
export type SearchableTab<E extends SearchableElement> = {
  id: string;
  name: string;
  elements: readonly E[];
};
