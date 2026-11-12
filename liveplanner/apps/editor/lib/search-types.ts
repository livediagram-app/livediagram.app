// The shapes the global SearchPanel's results are made of (docs/specs/008-canvas/canvas-and-palette.md "Search
// panel"): what each result row is, the groups they sit in, the catalogues the editor passes in, and
// buildSearchResults' input. Split out of search.ts, which re-exports the public ones.

import type { App } from '@liveworkspace/index-client';
import type { ShapeKind, Tab } from '@liveplanner/project';
import type { BoardResult, CardResult, CardSearchSource } from './search-plan';

// Internal-only input shapes for the by-name match inputs. Several
// share the same {id, name} shape but stay distinct so a future
// schema change to one doesn't silently propagate to the others.
// `localOnly`: saved only in this browser (Offline Mode); the result carries the This Browser pill
// (docs/specs/006-project/offline-mode.md#this-browser-pill).
type SearchInputProject = { id: string; name: string; localOnly?: boolean };
type SearchInputFolder = { id: string; name: string };
// "Shared with You" rows carry their still-live share code so picking
// one can navigate to the visitor URL (the only path a non-owner can
// open the project on).
type SearchInputShared = { id: string; name: string; shareCode: string };
type SearchInputTeam = { id: string; name: string };

// `team` set = a project in a team's library (docs/specs/013-workspace/team-shared-projects.md): the panel
// renders an "in <team>" suffix, like team folders. Personal projects
// leave it unset. Either way picking it opens the project by id.
export type ProjectItem = {
  kind: 'project';
  id: string;
  name: string;
  team?: { id: string; name: string };
  localOnly?: boolean;
};
// `team` set = a team-library folder (docs/specs/013-workspace/team-shared-projects.md): the panel renders an
// "in <team>" suffix and picking it lands on the team page with that
// folder open. Personal folders leave it unset.
export type FolderItem = {
  kind: 'folder';
  id: string;
  name: string;
  team?: { id: string; name: string };
};
// The remaining variants are union members of the exported
// `SearchResultItem`. Callers narrow via the `kind` discriminator
// rather than importing the individual variants by name, so the
// member types stay package-local.
type SharedItem = { kind: 'shared'; id: string; name: string; shareCode: string };
export type TeamItem = { kind: 'team'; id: string; name: string };
type TabItem = { kind: 'tab'; id: string; name: string; isCurrent: boolean };
export type ElementItem = {
  kind: 'element';
  tabId: string;
  tabName: string;
  elementId: string;
  label: string;
  // Element.type literal so callers can show a per-type icon.
  // 'shape' / 'text' / 'sticky' / 'image' / 'freehand' / 'arrow'
  // line up with the boxed + arrow unions in packages/project.
  type:
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
};

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
type PaletteItem = { kind: 'palette'; id: string; name: string; add: PaletteAdd };
// A synthetic command result: performing it changes the project / a
// selection rather than navigating somewhere. Modelled like a palette item
// (an intent the panel hands back to the editor): the panel returns the
// `id` and the editor's `useEditorCommands` dispatcher runs the matching
// handler. The catalogue (which commands apply to the current selection /
// project) is the editor's concern; this lib only matches + caps + groups
// what it's handed. Replaces the old single-purpose create-tab "action",
// which is now just one command among many.
type CommandItem = { kind: 'command'; id: string; name: string };
// A help-centre article result. Picking it opens the article (in a new tab);
// `href` is the absolute /help path and `leaf` the article's telemetry id
// (help-registry's articleTelemetryId: unique per article, slash-free).
export type HelpItem = { kind: 'help'; id: string; name: string; href: string; leaf: string };

// A Settings row result. Picking it opens the Settings dialog on that row's
// category with the row itself highlighted: the setting IS the destination,
// so the search does not just dump you at the dialog's front door.
export type SettingItem = {
  kind: 'setting';
  id: string;
  name: string;
  // Which category pane to open, and which row to ring once it is open.
  categoryId: string;
  rowKey: string;
  // The category's own label, shown as the result's trailing context so two
  // similarly-named settings are distinguishable in the list.
  categoryLabel: string;
};

// A result from every app (Work Tracker #63): an item the index found among everything the person can open, in any
// app, that this panel's own lists do not hold. It carries its app (the row shows the app's logo and name in the app's
// colour) and, reached through a link, its share code; picking it opens it in its own app.
export type WorkspaceItem = {
  kind: 'workspace';
  id: string;
  name: string;
  app: App;
  sharedVia: string | null;
};

export type SearchResultItem =
  | WorkspaceItem
  | ProjectItem
  | SharedItem
  | FolderItem
  | TeamItem
  | TabItem
  | BoardResult
  | CardResult
  | ElementItem
  | PaletteItem
  | CommandItem
  | HelpItem
  | SettingItem;

export type SearchGroup = {
  key:
    | 'projects'
    | 'shared'
    | 'folders'
    | 'teams'
    | 'workspace'
    | 'tabs'
    | 'boards'
    | 'cards'
    | 'elements'
    | 'palette'
    | 'commands'
    | 'help'
    | 'settings';
  label: string;
  items: SearchResultItem[];
};

// A searchable command the editor passes in (delete / lock / rotate /
// share / rename / ...). `keywords` widens matching beyond the visible
// name (so "front" finds "Bring to front"); the editor builds the list
// contextually (selection-aware) and owns the id -> handler dispatch.
export type CommandSearchItem = { id: string; name: string; keywords: string };

// A searchable palette entry the editor passes in (shapes / icons / tech
// icons). `keywords` widens matching beyond the visible name (so "database"
// finds the cylinder / RDS). Kept catalogue-agnostic so this lib stays free
// of the icon data + the Explorer (which omits it) pays nothing.
export type PaletteSearchItem = { id: string; name: string; keywords: string; add: PaletteAdd };

// A searchable help-centre article the editor offers as "Help" results.
// `keywords` widens matching beyond the title (so "shortcut" finds the
// keyboard-shortcuts article). Catalogue lives in lib/help-search.ts so this
// lib stays free of the help data; surfaces without help omit it.
// A searchable Settings row the editor passes in. Built from the settings
// catalogue in lib/settings-search-items.ts so this lib stays free of the
// settings data, the same arrangement help and palette use.
export type SettingSearchItem = {
  id: string;
  title: string;
  keywords: string;
  categoryId: string;
  categoryLabel: string;
  rowKey: string;
};

export type HelpSearchItem = {
  id: string;
  title: string;
  keywords: string;
  href: string;
  leaf: string;
};

// `buildSearchResults`' parameter type. Local because callers (the
// SearchPanel) pass an object literal; TypeScript infers the shape
// from the function signature without needing the named type.
export type SearchInput = {
  query: string;
  // The index's finds in every app for the query (its `search` view, so only what the person can open), already cut
  // to the ones this panel does not list itself. Matched by the index; listed as they come.
  workspaceItems?: readonly { id: string; title: string; app: App; sharedVia: string | null }[];
  projects: SearchInputProject[];
  folders: SearchInputFolder[];
  // Projects shared with the current owner ("Shared with You").
  // Optional: surfaces without the list omit it.
  shared?: SearchInputShared[];
  // Team-library folders (docs/specs/013-workspace/team-shared-projects.md), breadcrumb-pathed + tagged with
  // their team. Surfaced in the Teams group (not "My Work", which is
  // personal-only), with their own cap. Optional: guests have none.
  teamFolders?: { id: string; path: string; teamId: string; teamName: string }[];
  // Team-library projects (docs/specs/013-workspace/team-shared-projects.md), tagged with their team. Also
  // surfaced in the Teams group. Optional: guests have none.
  teamProjects?: { id: string; name: string; teamId: string; teamName: string }[];
  // Teams the signed-in user belongs to (docs/specs/013-workspace/teams.md). Optional: guests
  // have none and surfaces fetch the list lazily.
  teams?: SearchInputTeam[];
  // Tabs scope is optional: the standalone Explorer page passes
  // nothing (no active project), the editor passes the current
  // project's tabs.
  tabs?: Tab[];
  currentTabId?: string;
  // The open project's cards (search-plan.ts), matched by number, title or description on a non-empty query. Editor
  // only, like the tabs.
  cards?: CardSearchSource;
  // Palette catalogue (shapes / icons / tech icons) the editor offers as
  // "Add to canvas" results. Only the editor passes it; matched only when
  // the query is non-empty (you don't browse the whole palette via search).
  paletteItems?: PaletteSearchItem[];
  // Contextual command catalogue (delete / lock / rotate / share / rename /
  // ...) the editor offers as "Actions" results. Editor-only, selection-aware
  // (the editor decides which commands apply); matched on name + keywords on
  // a non-empty query only (no catalogue dump, and an empty query keeping the
  // browse list free of a destructive command that Enter would run).
  commandItems?: CommandSearchItem[];
  // Help-centre catalogue surfaced as "Help" results. Matched only on a
  // non-empty query (an empty one would dump the whole catalogue). Both the
  // editor and the Explorer pass it, since help is global.
  helpItems?: HelpSearchItem[];
  // The settings catalogue, surfaced as "Settings" results.
  settingItems?: SettingSearchItem[];
};
