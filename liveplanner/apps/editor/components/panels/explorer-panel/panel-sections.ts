// The editor's Explorer sections (docs/specs/013-workspace/explorer-structure.md "The editor's Explorer"): every rail
// entry is a mode of the pane. Pure: which sections there are, their names, the one to open first, and reading back a
// remembered one that may no longer exist (a team left since).
import { SIDEBAR_LABELS } from '@/app/explorer/sidebar/sidebar-structure';
import type { SelectedNode } from '@/app/explorer/views';
import type { SidebarTelemetryRow } from '@/app/explorer/sidebar/sidebar-telemetry';

export type PanelSection =
  | { kind: 'home' }
  | { kind: 'inbox' }
  | { kind: 'shared' }
  | { kind: 'mine' }
  | { kind: 'team'; id: string }
  | { kind: 'browser' }
  | { kind: 'tags' }
  | { kind: 'library' }
  | { kind: 'trash' };

export type PanelSectionGroup = { id: 'overview' | 'spaces' | 'more'; sections: PanelSection[] };

export const sectionKey = (s: PanelSection): string =>
  s.kind === 'team' ? `team:${s.id}` : s.kind;

export function sectionFromKey(key: string | null | undefined): PanelSection | null {
  if (!key) return null;
  if (key.startsWith('team:')) return key.length > 5 ? { kind: 'team', id: key.slice(5) } : null;
  const simple = ['home', 'inbox', 'shared', 'mine', 'browser', 'tags', 'library', 'trash'];
  return simple.includes(key) ? ({ kind: key } as PanelSection) : null;
}

// The rail's entries: the sidebar's three groups, without Invites, New Team or the sign-in nudge. This Browser only
// while it holds a project.
export function panelSectionGroups({
  teams,
  hasBrowserProjects,
}: {
  teams: readonly { id: string }[];
  hasBrowserProjects: boolean;
}): PanelSectionGroup[] {
  return [
    {
      id: 'overview',
      sections: [{ kind: 'home' }, { kind: 'inbox' }, { kind: 'shared' }],
    },
    {
      id: 'spaces',
      sections: [{ kind: 'mine' }, ...teams.map((t) => ({ kind: 'team' as const, id: t.id }))],
    },
    {
      id: 'more',
      sections: [
        ...(hasBrowserProjects ? [{ kind: 'browser' as const }] : []),
        // The reader's tags (docs/specs/013-workspace/tags.md "The editor's Explorer panel").
        { kind: 'tags' },
        { kind: 'library' },
        { kind: 'trash' },
      ],
    },
  ];
}

export function sectionLabel(
  s: PanelSection,
  teamName?: (id: string) => string | undefined,
): string {
  switch (s.kind) {
    case 'home':
      return SIDEBAR_LABELS.home;
    case 'inbox':
      return SIDEBAR_LABELS.inbox;
    case 'shared':
      return SIDEBAR_LABELS.shared;
    case 'mine':
      return SIDEBAR_LABELS.myProjects;
    case 'team':
      return teamName?.(s.id) ?? 'Team';
    case 'browser':
      return SIDEBAR_LABELS.thisBrowser;
    case 'tags':
      return SIDEBAR_LABELS.tags;
    case 'library':
      return SIDEBAR_LABELS.library;
    case 'trash':
      return SIDEBAR_LABELS.trash;
  }
}

// The Explorer page a section's Open Page goes to.
export function sectionPage(s: PanelSection): SelectedNode {
  switch (s.kind) {
    case 'mine':
      return { kind: 'all' };
    case 'team':
      return { kind: 'team', id: s.id };
    case 'browser':
      return { kind: 'offline' };
    case 'library':
      return { kind: 'themes' };
    default:
      return { kind: s.kind };
  }
}

// The closed telemetry row a pick reports (sidebar-telemetry), never a name or id.
export function sectionTelemetryRow(s: PanelSection): SidebarTelemetryRow {
  const rows: Record<PanelSection['kind'], SidebarTelemetryRow> = {
    home: 'Home',
    inbox: 'Inbox',
    shared: 'SharedWithMe',
    mine: 'MyProjects',
    team: 'Team',
    browser: 'ThisBrowser',
    tags: 'Tags',
    library: 'Library',
    trash: 'Trash',
  };
  return rows[s.kind];
}

// The section to show: the remembered one while it still exists (a team left since is not), else Home.
export function resolveSection({
  remembered,
  groups,
}: {
  remembered: PanelSection | null;
  groups: PanelSectionGroup[];
}): PanelSection {
  const keys = new Set(groups.flatMap((g) => g.sections.map(sectionKey)));
  if (remembered && keys.has(sectionKey(remembered))) return remembered;
  return { kind: 'home' };
}
