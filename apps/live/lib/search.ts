// Search-result computation for the global SearchPanel (spec/09
// "Search panel"). Pure function so the matcher (case-insensitive
// substring), the cap rules (8 per section, 12 elements total), the
// section ordering (diagrams, shared, folders, teams, tabs,
// elements), and the label-extraction fallbacks (blank labels,
// table cells) can be reasoned about without rendering React or
// mocking a DOM.
//
// Lives in lib/ rather than next to the component so the test
// suite can import it directly without the 'use client' boundary
// + the dynamic-import wrapping.

import type { ShapeKind, Tab } from '@livediagram/diagram';

const DIAGRAM_LIMIT = 8;
const SHARED_LIMIT = 8;
const FOLDER_LIMIT = 8;
const TEAM_LIMIT = 8;
const TAB_LIMIT = 8;
const ELEMENT_LIMIT = 12;
const PALETTE_LIMIT = 10;

// Internal-only input shapes for the by-name match inputs. Several
// share the same {id, name} shape but stay distinct so a future
// schema change to one doesn't silently propagate to the others.
type SearchInputDiagram = { id: string; name: string };
type SearchInputFolder = { id: string; name: string };
// "Shared with you" rows carry their still-live share code so picking
// one can navigate to the visitor URL (the only path a non-owner can
// open the diagram on).
type SearchInputShared = { id: string; name: string; shareCode: string };
type SearchInputTeam = { id: string; name: string };

// `team` set = a diagram in a team's library (spec/35): the panel
// renders an "in <team>" suffix, like team folders. Personal diagrams
// leave it unset. Either way picking it opens the diagram by id.
type DiagramItem = {
  kind: 'diagram';
  id: string;
  name: string;
  team?: { id: string; name: string };
};
// `team` set = a team-library folder (spec/35): the panel renders an
// "in <team>" suffix and picking it lands on the team page with that
// folder open. Personal folders leave it unset.
type FolderItem = {
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
type TeamItem = { kind: 'team'; id: string; name: string };
type TabItem = { kind: 'tab'; id: string; name: string; isCurrent: boolean };
type ElementItem = {
  kind: 'element';
  tabId: string;
  tabName: string;
  elementId: string;
  label: string;
  // Element.type literal so callers can show a per-type icon.
  // 'shape' / 'text' / 'sticky' / 'image' / 'freehand' / 'arrow'
  // line up with the boxed + arrow unions in packages/diagram.
  type:
    | 'shape'
    | 'text'
    | 'sticky'
    | 'image'
    | 'freehand'
    | 'table'
    | 'annotation'
    | 'link-card'
    | 'arrow';
};

// What a picked palette result should add to the canvas. The panel hands
// this back so the editor routes it to the matching add handler (which arms
// the same tap-to-drop / drag-to-size placement the palette uses).
export type PaletteAdd =
  | { type: 'shape'; shapeKind: ShapeKind }
  | { type: 'icon'; iconId: string }
  | { type: 'tech'; iconId: string };
type PaletteItem = { kind: 'palette'; id: string; name: string; add: PaletteAdd };
// A synthetic action result — performing it changes the diagram rather
// than navigating somewhere. Modelled like a palette item (an intent the
// panel hands back to the editor) but for whole-diagram actions. Today
// the only action is creating a new tab, offered inside a diagram when
// the query looks like "tab" / "new"; the union + `action` discriminator
// leave room for more without reshaping callers.
type ActionItem = { kind: 'action'; id: string; name: string; action: 'create-tab' };

export type SearchResultItem =
  | DiagramItem
  | SharedItem
  | FolderItem
  | TeamItem
  | TabItem
  | ElementItem
  | PaletteItem
  | ActionItem;

export type SearchGroup = {
  key: 'diagrams' | 'shared' | 'folders' | 'teams' | 'tabs' | 'elements' | 'palette' | 'actions';
  label: string;
  items: SearchResultItem[];
};

// Keywords that surface the "Create new tab" action. The user told us
// they'd reach for "tab" or "new"; the rest are near-synonyms so the
// action is forgiving to find without polluting unrelated queries (a
// search for "database" matches none of these).
const CREATE_TAB_KEYWORDS = 'new tab create add page sheet board';

// A searchable palette entry the editor passes in (shapes / icons / tech
// icons). `keywords` widens matching beyond the visible name (so "database"
// finds the cylinder / RDS). Kept catalogue-agnostic so this lib stays free
// of the icon data + the Explorer (which omits it) pays nothing.
export type PaletteSearchItem = { id: string; name: string; keywords: string; add: PaletteAdd };

// `buildSearchResults`' parameter type. Local because callers (the
// SearchPanel) pass an object literal; TypeScript infers the shape
// from the function signature without needing the named type.
type SearchInput = {
  query: string;
  diagrams: SearchInputDiagram[];
  folders: SearchInputFolder[];
  // Diagrams shared with the current owner ("Shared with you").
  // Optional: surfaces without the list omit it.
  shared?: SearchInputShared[];
  // Team-library folders (spec/35), breadcrumb-pathed + tagged with
  // their team. Surfaced in the Teams group (not "My Work", which is
  // personal-only), with their own cap. Optional: guests have none.
  teamFolders?: { id: string; path: string; teamId: string; teamName: string }[];
  // Team-library diagrams (spec/35), tagged with their team. Also
  // surfaced in the Teams group. Optional: guests have none.
  teamDiagrams?: { id: string; name: string; teamId: string; teamName: string }[];
  // Teams the signed-in user belongs to (spec/32). Optional: guests
  // have none and surfaces fetch the list lazily.
  teams?: SearchInputTeam[];
  // Tabs scope is optional: the standalone Explorer page passes
  // nothing (no active diagram), the editor passes the current
  // diagram's tabs.
  tabs?: Tab[];
  currentTabId?: string;
  // Palette catalogue (shapes / icons / tech icons) the editor offers as
  // "Add to canvas" results. Only the editor passes it; matched only when
  // the query is non-empty (you don't browse the whole palette via search).
  paletteItems?: PaletteSearchItem[];
};

// Case-insensitive substring match. Empty query matches everything,
// which mirrors the picker's "show me the list first, narrow with
// typing" behaviour.
export function matches(needle: string, hay: string): boolean {
  if (!needle) return true;
  return hay.toLowerCase().includes(needle.toLowerCase());
}

export function buildSearchResults(input: SearchInput): SearchGroup[] {
  const { query, diagrams, folders, shared, teamFolders, teamDiagrams, teams, tabs, currentTabId } =
    input;
  const q = query.trim();
  const groups: SearchGroup[] = [];

  const diagramMatches = diagrams
    .filter((d) => matches(q, d.name || 'Untitled diagram'))
    .slice(0, DIAGRAM_LIMIT);
  if (diagramMatches.length > 0) {
    groups.push({
      key: 'diagrams',
      label: 'Diagrams',
      items: diagramMatches.map((d) => ({
        kind: 'diagram',
        id: d.id,
        name: d.name || 'Untitled diagram',
      })),
    });
  }

  const sharedMatches = (shared ?? [])
    .filter((s) => matches(q, s.name || 'Untitled diagram'))
    .slice(0, SHARED_LIMIT);
  if (sharedMatches.length > 0) {
    groups.push({
      key: 'shared',
      label: 'Shared with you',
      items: sharedMatches.map((s) => ({
        kind: 'shared',
        id: s.id,
        name: s.name || 'Untitled diagram',
        shareCode: s.shareCode,
      })),
    });
  }

  // "My Work": the personal folder tree only (team folders live under
  // Teams below, so this group's label honestly means "yours").
  const folderMatches = folders.filter((f) => matches(q, f.name)).slice(0, FOLDER_LIMIT);
  if (folderMatches.length > 0) {
    groups.push({
      key: 'folders',
      label: 'My Work',
      items: folderMatches.map(
        (f): FolderItem => ({
          kind: 'folder',
          id: f.id,
          name: f.name,
        }),
      ),
    });
  }

  // "Teams": the teams themselves, then their folders + diagrams
  // (spec/35) — everything team-scoped in one place, each list capped
  // separately so one kind can't crowd out the others.
  const teamMatches = (teams ?? []).filter((t) => matches(q, t.name)).slice(0, TEAM_LIMIT);
  const teamFolderMatches = (teamFolders ?? [])
    .filter((f) => matches(q, f.path) || matches(q, f.teamName))
    .slice(0, FOLDER_LIMIT);
  const teamDiagramMatches = (teamDiagrams ?? [])
    .filter((d) => matches(q, d.name || 'Untitled diagram') || matches(q, d.teamName))
    .slice(0, DIAGRAM_LIMIT);
  if (teamMatches.length + teamFolderMatches.length + teamDiagramMatches.length > 0) {
    groups.push({
      key: 'teams',
      label: 'Teams',
      items: [
        ...teamMatches.map((t): TeamItem => ({ kind: 'team', id: t.id, name: t.name })),
        ...teamFolderMatches.map(
          (f): FolderItem => ({
            kind: 'folder',
            id: f.id,
            name: f.path,
            team: { id: f.teamId, name: f.teamName },
          }),
        ),
        ...teamDiagramMatches.map(
          (d): DiagramItem => ({
            kind: 'diagram',
            id: d.id,
            name: d.name || 'Untitled diagram',
            team: { id: d.teamId, name: d.teamName },
          }),
        ),
      ],
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

    // Element scope: walk every tab's elements, match on label.
    // Elements without a label get filtered out (the user typed
    // SOMETHING, so blanks aren't matchable). Cap at ELEMENT_LIMIT
    // hits so a runaway match doesn't blow up the modal height.
    const elementMatches: ElementItem[] = [];
    outer: for (const t of tabs) {
      for (const el of t.elements) {
        const rawLabel = ('label' in el && typeof el.label === 'string' && el.label.trim()) || '';
        // Tables have no single label (cells carry the text), so they
        // surface via the first non-empty cell that matches the query.
        // The matching cell becomes the row's label, so the user sees
        // the text they searched for rather than an opaque "Table".
        const label =
          rawLabel ||
          (el.type === 'table'
            ? (el.cells
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

    // "Create new tab" action. Only inside a diagram (we're in the
    // `tabs` branch) and only on a query that looks like it (so it never
    // steals the empty-query "show everything" list). Last group + last
    // match priority, so navigating to an existing tab by name still
    // wins the default Enter; the user arrows down to create.
    if (q && matches(q, CREATE_TAB_KEYWORDS)) {
      groups.push({
        key: 'actions',
        label: 'Actions',
        items: [{ kind: 'action', id: 'create-tab', name: 'Create new tab', action: 'create-tab' }],
      });
    }
  }

  // Palette: shapes / icons / tech icons to add. Only on a non-empty query
  // (an empty one would dump the whole catalogue), matched on name + keywords.
  if (q && input.paletteItems && input.paletteItems.length > 0) {
    const paletteMatches = input.paletteItems
      .filter((p) => matches(q, p.name) || matches(q, p.keywords))
      .slice(0, PALETTE_LIMIT);
    if (paletteMatches.length > 0) {
      groups.push({
        key: 'palette',
        label: 'Add to canvas',
        items: paletteMatches.map((p) => ({ kind: 'palette', id: p.id, name: p.name, add: p.add })),
      });
    }
  }

  return groups;
}
