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

import type { Tab } from '@livediagram/diagram';

const DIAGRAM_LIMIT = 8;
const SHARED_LIMIT = 8;
const FOLDER_LIMIT = 8;
const TEAM_LIMIT = 8;
const TAB_LIMIT = 8;
const ELEMENT_LIMIT = 12;

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

export type DiagramItem = { kind: 'diagram'; id: string; name: string };
export type FolderItem = { kind: 'folder'; id: string; name: string };
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
  type: 'shape' | 'text' | 'sticky' | 'image' | 'freehand' | 'table' | 'arrow';
};

export type SearchResultItem =
  | DiagramItem
  | SharedItem
  | FolderItem
  | TeamItem
  | TabItem
  | ElementItem;

export type SearchGroup = {
  key: 'diagrams' | 'shared' | 'folders' | 'teams' | 'tabs' | 'elements';
  label: string;
  items: SearchResultItem[];
};

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
  // Teams the signed-in user belongs to (spec/32). Optional: guests
  // have none and surfaces fetch the list lazily.
  teams?: SearchInputTeam[];
  // Tabs scope is optional: the standalone Explorer page passes
  // nothing (no active diagram), the editor passes the current
  // diagram's tabs.
  tabs?: Tab[];
  currentTabId?: string;
};

// Case-insensitive substring match. Empty query matches everything,
// which mirrors the picker's "show me the list first, narrow with
// typing" behaviour.
export function matches(needle: string, hay: string): boolean {
  if (!needle) return true;
  return hay.toLowerCase().includes(needle.toLowerCase());
}

export function buildSearchResults(input: SearchInput): SearchGroup[] {
  const { query, diagrams, folders, shared, teams, tabs, currentTabId } = input;
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

  const folderMatches = folders.filter((f) => matches(q, f.name)).slice(0, FOLDER_LIMIT);
  if (folderMatches.length > 0) {
    groups.push({
      key: 'folders',
      label: 'Folders',
      items: folderMatches.map((f) => ({ kind: 'folder', id: f.id, name: f.name })),
    });
  }

  const teamMatches = (teams ?? []).filter((t) => matches(q, t.name)).slice(0, TEAM_LIMIT);
  if (teamMatches.length > 0) {
    groups.push({
      key: 'teams',
      label: 'Teams',
      items: teamMatches.map((t) => ({ kind: 'team', id: t.id, name: t.name })),
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
  }

  return groups;
}
