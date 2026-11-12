// Search-result computation for the global SearchPanel (docs/specs/008-canvas/canvas-and-palette.md "Search
// panel"). Pure function so the matcher (case-insensitive substring), the cap rules (8 per section, 12 elements
// total), the section ordering (the editor's own files, shared, folders, teams, every app, tabs, the editor's own
// tab groups, elements, actions, palette, settings, help), and the label extraction (blank labels skipped, a table
// found by its cells where the editor asks) can be reasoned about without rendering React or mocking a DOM.
//
// Each editor binds it in its lib/search.ts with its own nouns (EditorSearchConfig) and input names, so its callers
// and tests keep their imports. It runs on every keystroke: each list is walked once, and the element walk
// stops at its cap.

// The palette ranking lives with the icon catalogues, so the api's icon search ranks alike.
import { matches, paletteRank } from '@liveworkspace/icons';
import type { App } from '@liveworkspace/index-client';
import type {
  CommandSearchItem,
  EditorSearchGroup,
  EditorSearchItem,
  ElementItem,
  FolderItem,
  HelpItem,
  HelpSearchItem,
  LibraryItem,
  PaletteSearchItem,
  SearchableElement,
  SearchableTab,
  SettingItem,
  SettingSearchItem,
  TeamItem,
  WorkspaceItem,
} from './types';

// Every word typed is found somewhere in the fields, case ignored: "export png" finds Export… (named Export, its
// keywords saying png), as a start's template search does (docs/specs/008-canvas/canvas-and-palette.md "Search
// panel"). One word reads as `matches` on any field.
function matchesEveryWord(q: string, ...fields: string[]): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return fields.some((f) => matches(q.trim(), f));
  const hay = fields.join(' ').toLowerCase();
  return words.every((w) => hay.includes(w));
}

const LIBRARY_LIMIT = 8;
const SHARED_LIMIT = 8;
const FOLDER_LIMIT = 8;
const TEAM_LIMIT = 8;
const TAB_LIMIT = 8;
const ELEMENT_LIMIT = 12;
const PALETTE_LIMIT = 10;
const COMMAND_LIMIT = 10;
const HELP_LIMIT = 6;
const SETTINGS_LIMIT = 6;

// What differs per editor: the name of its own kind of file.
export type EditorSearchConfig<K extends string, GK extends string> = {
  // The result kind and group key of the editor's own files, the group's label, and the name a blank one shows.
  library: { kind: K; key: GK; label: string; untitled: string };
  // Whether a table with no label is found by the first of its cells that matches.
  tableCells: boolean;
};

export type EditorSearchInput<T extends SearchableTab<SearchableElement>, Add, X = never> = {
  query: string;
  // The index's finds in every app for the query (its `search` view, so only what the person can open), already cut
  // to the ones this panel does not list itself. Matched by the index; listed as they come.
  workspaceItems?:
    readonly { id: string; title: string; app: App; sharedVia: string | null }[] | undefined;
  // The editor's own files.
  library: readonly { id: string; name: string; localOnly?: boolean }[];
  folders: readonly { id: string; name: string }[];
  // Files shared with the current owner ("Shared with You"). Optional: surfaces without the list omit it.
  shared?: readonly { id: string; name: string; shareCode: string }[] | undefined;
  // Team-library folders, breadcrumb-pathed and tagged with their team. Surfaced in the Teams group (not "My Work",
  // which is personal-only), with their own cap. Optional: guests have none.
  teamFolders?:
    readonly { id: string; path: string; teamId: string; teamName: string }[] | undefined;
  // Team-library files, tagged with their team. Also surfaced in the Teams group. Optional: guests have none.
  teamLibrary?:
    readonly { id: string; name: string; teamId: string; teamName: string }[] | undefined;
  // Teams the signed-in user belongs to. Optional: guests have none and surfaces fetch the list lazily.
  teams?: readonly { id: string; name: string }[] | undefined;
  // Tabs scope is optional: the standalone Explorer page passes nothing, the editor passes the open file's tabs.
  tabs?: readonly T[] | undefined;
  currentTabId?: string | undefined;
  // The editor's own groups, after Tabs and before Elements, when there are tabs (the trimmed query handed in).
  tabGroups?: ((q: string, tabs: readonly T[]) => readonly X[]) | undefined;
  // Palette catalogue the editor offers as "Add to canvas" results. Only the editor passes it; matched only when
  // the query is non-empty (you don't browse the whole palette via search).
  paletteItems?: readonly PaletteSearchItem<Add>[] | undefined;
  // Contextual command catalogue the editor offers as "Actions" results. Editor-only, selection-aware; matched on
  // name and keywords on a non-empty query only (no catalogue dump, and an empty query keeping the browse list free
  // of a destructive command that Enter would run).
  commandItems?: readonly CommandSearchItem[] | undefined;
  // Help-centre catalogue surfaced as "Help" results. Matched only on a non-empty query. Both the editor and the
  // Explorer pass it, since help is global.
  helpItems?: readonly HelpSearchItem[] | undefined;
  // The settings catalogue, surfaced as "Settings" results.
  settingItems?: readonly SettingSearchItem[] | undefined;
};

// A table's cells, read only where the editor asks (EditorSearchConfig.tableCells).
type MaybeLabelled = { label?: unknown; cells?: readonly (readonly string[])[] };

export function buildEditorSearchResults<
  K extends string,
  GK extends string,
  T extends SearchableTab<SearchableElement>,
  Add,
  X = never,
>(
  input: EditorSearchInput<T, Add, X>,
  config: EditorSearchConfig<K, GK>,
): (EditorSearchGroup<GK, EditorSearchItem<K, T['elements'][number]['type'], Add>> | X)[] {
  type E = T['elements'][number];
  type Item = EditorSearchItem<K, E['type'], Add>;
  const { query, library, folders, shared, teamFolders, teamLibrary, teams, tabs, currentTabId } =
    input;
  const { kind, key, label: libraryLabel, untitled } = config.library;
  const q = query.trim();
  const groups: (EditorSearchGroup<GK, Item> | X)[] = [];

  const libraryMatches = library
    .filter((d) => matches(q, d.name || untitled))
    .slice(0, LIBRARY_LIMIT);
  if (libraryMatches.length > 0) {
    groups.push({
      key,
      label: libraryLabel,
      items: libraryMatches.map((d): LibraryItem<K> => ({
        kind,
        id: d.id,
        name: d.name || untitled,
        ...(d.localOnly ? { localOnly: true } : {}),
      })),
    });
  }

  const sharedMatches = (shared ?? [])
    .filter((s) => matches(q, s.name || untitled))
    .slice(0, SHARED_LIMIT);
  if (sharedMatches.length > 0) {
    groups.push({
      key: 'shared',
      label: 'Shared with You',
      items: sharedMatches.map((s) => ({
        kind: 'shared',
        id: s.id,
        name: s.name || untitled,
        shareCode: s.shareCode,
      })),
    });
  }

  // "My Work": the personal folder tree only (team folders live under Teams below, so this group's label honestly
  // means "yours").
  const folderMatches = folders.filter((f) => matches(q, f.name)).slice(0, FOLDER_LIMIT);
  if (folderMatches.length > 0) {
    groups.push({
      key: 'folders',
      label: 'My Work',
      items: folderMatches.map((f): FolderItem => ({
        kind: 'folder',
        id: f.id,
        name: f.name,
      })),
    });
  }

  // "Teams": the teams themselves, then their folders and files: everything team-scoped in one place, each list
  // capped separately so one kind can't crowd out the others.
  const teamMatches = (teams ?? []).filter((t) => matches(q, t.name)).slice(0, TEAM_LIMIT);
  const teamFolderMatches = (teamFolders ?? [])
    .filter((f) => matches(q, f.path) || matches(q, f.teamName))
    .slice(0, FOLDER_LIMIT);
  const teamLibraryMatches = (teamLibrary ?? [])
    .filter((d) => matches(q, d.name || untitled) || matches(q, d.teamName))
    .slice(0, LIBRARY_LIMIT);
  if (teamMatches.length + teamFolderMatches.length + teamLibraryMatches.length > 0) {
    groups.push({
      key: 'teams',
      label: 'Teams',
      items: [
        ...teamMatches.map((t): TeamItem => ({ kind: 'team', id: t.id, name: t.name })),
        ...teamFolderMatches.map((f): FolderItem => ({
          kind: 'folder',
          id: f.id,
          name: f.path,
          team: { id: f.teamId, name: f.teamName },
        })),
        ...teamLibraryMatches.map((d): LibraryItem<K> => ({
          kind,
          id: d.id,
          name: d.name || untitled,
          team: { id: d.teamId, name: d.teamName },
        })),
      ],
    });
  }

  // "Every App": what the index found everywhere the person can reach, after this app's own groups, each row marked
  // with its app. A non-empty query only (the index is asked for nothing else).
  if (q && input.workspaceItems && input.workspaceItems.length > 0) {
    groups.push({
      key: 'workspace',
      label: 'Every App',
      items: input.workspaceItems.map((i): WorkspaceItem => ({
        kind: 'workspace',
        id: i.id,
        name: i.title || 'Untitled',
        app: i.app,
        sharedVia: i.sharedVia,
      })),
    });
  }

  if (tabs && tabs.length > 0) {
    const tabMatches = tabs.filter((t) => matches(q, t.name)).slice(0, TAB_LIMIT);
    if (tabMatches.length > 0) {
      groups.push({
        key: 'tabs',
        label: 'Tabs',
        items: tabMatches.map((t) => ({
          kind: 'tab',
          id: t.id,
          name: t.name,
          isCurrent: t.id === currentTabId,
        })),
      });
    }

    // The editor's own groups over its tabs (a planner's boards and cards).
    if (input.tabGroups) groups.push(...input.tabGroups(q, tabs));

    // Element scope: walk every tab's elements, match on label. Elements without a label get filtered out (the user
    // typed SOMETHING, so blanks aren't matchable). Cap at ELEMENT_LIMIT hits so a runaway match doesn't blow up the
    // modal height.
    const elementMatches: ElementItem<E['type']>[] = [];
    outer: for (const t of tabs) {
      for (const el of t.elements) {
        const rec = el as E & MaybeLabelled;
        const rawLabel =
          ('label' in rec && typeof rec.label === 'string' && rec.label.trim()) || '';
        // Tables have no single label (cells carry the text), so they surface via the first non-empty cell that
        // matches the query. The matching cell becomes the row's label, so the user sees the text they searched for
        // rather than an opaque "Table".
        const label =
          rawLabel ||
          (config.tableCells && el.type === 'table'
            ? ((rec.cells as readonly (readonly string[])[])
                .flat()
                .find((c) => c.trim() && matches(q, c.trim()))
                ?.trim() ?? '')
            : '');
        if (!label) continue;
        if (!matches(q, label)) continue;
        elementMatches.push({
          kind: 'element',
          tabId: t.id,
          tabName: t.name,
          elementId: el.id,
          label,
          type: el.type,
        });
        if (elementMatches.length >= ELEMENT_LIMIT) break outer;
      }
    }
    if (elementMatches.length > 0) {
      groups.push({ key: 'elements', label: 'Elements', items: elementMatches });
    }
  }

  // Commands: the contextual action palette (delete / share / rename / ...). Editor-supplied and non-empty query
  // only, placed AFTER the navigation and element groups so picking a tab or element by name keeps the default
  // Enter; the user types a verb to reach a command. Matched on name and keywords.
  if (q && input.commandItems && input.commandItems.length > 0) {
    const commandMatches = input.commandItems
      .filter((c) => matchesEveryWord(q, c.name, c.keywords))
      .slice(0, COMMAND_LIMIT);
    if (commandMatches.length > 0) {
      groups.push({
        key: 'commands',
        label: 'Actions',
        items: commandMatches.map((c) => ({ kind: 'command', id: c.id, name: c.name })),
      });
    }
  }

  // Palette: every tile, icon and sticker to add. Only on a non-empty query (an empty one would dump the whole
  // catalogue), matched on name and keywords, and ranked so the element you NAMED comes first: exact name, then name
  // prefix, then name substring, then keyword-only. Without it a keyword-only match could list above the tile it
  // names ("table" listed Entity, whose keywords say table, and Tablet above Table).
  if (q && input.paletteItems && input.paletteItems.length > 0) {
    const paletteMatches = input.paletteItems
      // Keyword-only when the words are found across name and keywords but not as one phrase in either.
      .map((p, i) => {
        const rank = paletteRank(q, p);
        return { p, i, rank: rank === 4 && matchesEveryWord(q, p.name, p.keywords) ? 3 : rank };
      })
      .filter((m) => m.rank < 4)
      .sort((a, b) => a.rank - b.rank || a.i - b.i)
      .slice(0, PALETTE_LIMIT)
      .map((m) => m.p);
    if (paletteMatches.length > 0) {
      groups.push({
        key: 'palette',
        label: 'Add to canvas',
        items: paletteMatches.map((p) => ({ kind: 'palette', id: p.id, name: p.name, add: p.add })),
      });
    }
  }

  // Settings, then Help: last so navigation and edit results always win the default Enter. Non-empty query only
  // (an empty one would list the whole catalogue), matched on title and keywords.
  if (q && input.settingItems && input.settingItems.length > 0) {
    const settingMatches = input.settingItems
      .filter((s) => matchesEveryWord(q, s.title, s.keywords))
      .slice(0, SETTINGS_LIMIT);
    if (settingMatches.length > 0) {
      groups.push({
        key: 'settings',
        label: 'Settings',
        items: settingMatches.map((s): SettingItem => ({
          kind: 'setting',
          id: s.id,
          name: s.title,
          categoryId: s.categoryId,
          categoryLabel: s.categoryLabel,
          rowKey: s.rowKey,
        })),
      });
    }
  }

  if (q && input.helpItems && input.helpItems.length > 0) {
    const helpMatches = input.helpItems
      .filter((h) => matchesEveryWord(q, h.title, h.keywords))
      .slice(0, HELP_LIMIT);
    if (helpMatches.length > 0) {
      groups.push({
        key: 'help',
        label: 'Help',
        items: helpMatches.map((h): HelpItem => ({
          kind: 'help',
          id: h.id,
          name: h.title,
          href: h.href,
          leaf: h.leaf,
        })),
      });
    }
  }

  return groups;
}
