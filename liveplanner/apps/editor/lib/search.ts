// Search-result computation for the global SearchPanel (docs/specs/008-canvas/canvas-and-palette.md
// "Search panel"). Pure function so the matcher (case-insensitive
// substring), the cap rules (8 per section, 12 elements total), the
// section ordering (projects, shared, folders, teams, tabs, boards, cards,
// elements), and the label-extraction fallbacks (blank labels,
// table cells) can be reasoned about without rendering React or
// mocking a DOM.
//
// Lives in lib/ rather than next to the component so the test
// suite can import it directly without the 'use client' boundary
// + the dynamic-import wrapping.

// The palette ranking lives with the icon catalogues, so the api's icon search ranks alike.
import { matches, paletteRank } from '@liveworkspace/icons';
import { boardResults, cardResults } from './search-plan';
import type {
  ElementItem,
  FolderItem,
  HelpItem,
  ProjectItem,
  SearchGroup,
  SearchInput,
  SettingItem,
  TeamItem,
  WorkspaceItem,
} from './search-types';

export type {
  CommandSearchItem,
  HelpSearchItem,
  PaletteAdd,
  PaletteSearchItem,
  SearchGroup,
  SearchResultItem,
  SettingSearchItem,
} from './search-types';

// Every word typed is found somewhere in the fields, case ignored: "export png" finds Export… (named Export, its
// keywords saying png), as a start's template search does (docs/specs/008-canvas/canvas-and-palette.md "Search
// panel"). One word reads as `matches` on any field.
function matchesEveryWord(q: string, ...fields: string[]): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return fields.some((f) => matches(q.trim(), f));
  const hay = fields.join(' ').toLowerCase();
  return words.every((w) => hay.includes(w));
}

const PROJECT_LIMIT = 8;
const SHARED_LIMIT = 8;
const FOLDER_LIMIT = 8;
const TEAM_LIMIT = 8;
const TAB_LIMIT = 8;
const ELEMENT_LIMIT = 12;
const PALETTE_LIMIT = 10;
const COMMAND_LIMIT = 10;
const HELP_LIMIT = 6;
const SETTINGS_LIMIT = 6;

export function buildSearchResults(input: SearchInput): SearchGroup[] {
  const {
    query,
    projects: liveDocs,
    folders,
    shared,
    teamFolders,
    teamProjects,
    teams,
    tabs,
    currentTabId,
  } = input;
  const q = query.trim();
  const groups: SearchGroup[] = [];

  const projectMatches = liveDocs
    .filter((d) => matches(q, d.name || 'Untitled plan'))
    .slice(0, PROJECT_LIMIT);
  if (projectMatches.length > 0) {
    groups.push({
      key: 'projects',
      label: 'Plans',
      items: projectMatches.map((d) => ({
        kind: 'project',
        id: d.id,
        name: d.name || 'Untitled plan',
        ...(d.localOnly ? { localOnly: true } : {}),
      })),
    });
  }

  const sharedMatches = (shared ?? [])
    .filter((s) => matches(q, s.name || 'Untitled plan'))
    .slice(0, SHARED_LIMIT);
  if (sharedMatches.length > 0) {
    groups.push({
      key: 'shared',
      label: 'Shared with You',
      items: sharedMatches.map((s) => ({
        kind: 'shared',
        id: s.id,
        name: s.name || 'Untitled plan',
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
      items: folderMatches.map((f): FolderItem => ({
        kind: 'folder',
        id: f.id,
        name: f.name,
      })),
    });
  }

  // "Teams": the teams themselves, then their folders + projects
  // (docs/specs/013-workspace/team-shared-projects.md) — everything team-scoped in one place, each list capped
  // separately so one kind can't crowd out the others.
  const teamMatches = (teams ?? []).filter((t) => matches(q, t.name)).slice(0, TEAM_LIMIT);
  const teamFolderMatches = (teamFolders ?? [])
    .filter((f) => matches(q, f.path) || matches(q, f.teamName))
    .slice(0, FOLDER_LIMIT);
  const teamProjectMatches = (teamProjects ?? [])
    .filter((d) => matches(q, d.name || 'Untitled plan') || matches(q, d.teamName))
    .slice(0, PROJECT_LIMIT);
  if (teamMatches.length + teamFolderMatches.length + teamProjectMatches.length > 0) {
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
        ...teamProjectMatches.map((d): ProjectItem => ({
          kind: 'project',
          id: d.id,
          name: d.name || 'Untitled plan',
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

    // Plan scope: boards by title, then cards by number, title or description (search-plan.ts). Non-empty query only.
    const boards = boardResults(q, tabs);
    if (boards.length > 0) groups.push({ key: 'boards', label: 'Boards', items: boards });
    const cards = input.cards ? cardResults(q, input.cards) : [];
    if (cards.length > 0) groups.push({ key: 'cards', label: 'Cards', items: cards });

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

  // Commands: the contextual action palette (delete / lock / share / rename
  // / ...). Editor-supplied + non-empty query only, placed AFTER the
  // navigation + element groups so picking a tab / element by name keeps the
  // default Enter; the user types a verb to reach a command. Matched on name
  // + keywords.
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

  // Palette: every tile, icon, sticker and tech icon to add. Only on a
  // non-empty query (an empty one would dump the whole catalogue), matched on
  // name + keywords, and ranked so the element you NAMED comes first: exact
  // name, then name prefix, then name substring, then keyword-only. Without
  // it "table" listed Entity (whose keywords say table) and Tablet above Table.
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

  // Help: matching help-centre articles, last so navigation/edit results
  // always win the default Enter. Non-empty query only (an empty one would
  // list the whole catalogue), matched on title + keywords.
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
