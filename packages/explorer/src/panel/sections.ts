// The editor's Explorer panel's sections (liveplanner's explorer-panel/panel-sections.ts and
// useExplorerPanelSection.ts, as they were before the index): every rail entry is a mode of the pane. Pure apart
// from the remembered pick, which is a per-browser convenience: storage that throws or is empty opens on Home.

import { useCallback, useState } from 'react';
import type { App } from '@liveworkspace/index-client';
import type { TeamRef } from '../types';
import { SIDEBAR_LABELS } from '../views';

export type PanelSection =
  | { kind: 'home' }
  | { kind: 'inbox' }
  | { kind: 'timeline' }
  | { kind: 'shared' }
  | { kind: 'mine' }
  | { kind: 'team'; id: string }
  | { kind: 'favourites' }
  | { kind: 'offline' }
  | { kind: 'library' }
  | { kind: 'trash' };

/** The Library section's tabs, each one of its pages. */
export type LibraryTab = 'gallery' | 'shape-libraries';

export type PanelSectionGroup = { id: 'overview' | 'spaces' | 'more'; sections: PanelSection[] };

export const SECTION_GROUP_TITLES = {
  overview: 'Overview',
  spaces: 'Spaces',
  more: 'More',
} as const;

export const sectionKey = (s: PanelSection): string =>
  s.kind === 'team' ? `team:${s.id}` : s.kind;

const SIMPLE = [
  'home',
  'inbox',
  'timeline',
  'shared',
  'mine',
  'favourites',
  'offline',
  'library',
  'trash',
] as const;

export function sectionFromKey(key: string | null | undefined): PanelSection | null {
  if (!key) return null;
  if (key.startsWith('team:')) return key.length > 5 ? { kind: 'team', id: key.slice(5) } : null;
  return (SIMPLE as readonly string[]).includes(key) ? ({ kind: key } as PanelSection) : null;
}

/** The rail's entries: the sidebar's three groups, each team under Spaces, This Browser while this browser keeps
 *  any of the app's items, and the Library while the host keeps one. */
export function panelSectionGroups(
  teams: readonly TeamRef[],
  { library = false, thisBrowser = false }: { library?: boolean; thisBrowser?: boolean } = {},
): PanelSectionGroup[] {
  return [
    {
      id: 'overview',
      sections: [{ kind: 'home' }, { kind: 'inbox' }, { kind: 'timeline' }, { kind: 'shared' }],
    },
    {
      id: 'spaces',
      sections: [{ kind: 'mine' }, ...teams.map((t) => ({ kind: 'team' as const, id: t.id }))],
    },
    {
      id: 'more',
      sections: [
        { kind: 'favourites' },
        ...(thisBrowser ? [{ kind: 'offline' as const }] : []),
        ...(library ? [{ kind: 'library' as const }] : []),
        { kind: 'trash' },
      ],
    },
  ];
}

export function sectionLabel(s: PanelSection, teamName: (id: string) => string | null): string {
  switch (s.kind) {
    case 'home':
      return SIDEBAR_LABELS.home;
    case 'inbox':
      return SIDEBAR_LABELS.inbox;
    case 'timeline':
      return SIDEBAR_LABELS.timeline;
    case 'shared':
      return SIDEBAR_LABELS.shared;
    case 'mine':
      return SIDEBAR_LABELS.myWork;
    case 'team':
      return teamName(s.id) ?? 'Team';
    case 'favourites':
      return 'Favourites';
    case 'offline':
      return SIDEBAR_LABELS.thisBrowser;
    case 'library':
      return SIDEBAR_LABELS.library;
    case 'trash':
      return SIDEBAR_LABELS.trash;
  }
}

/** The remembered section while it still exists (a team left since does not), else Home. */
export function resolveSection(
  remembered: PanelSection | null,
  groups: PanelSectionGroup[],
): PanelSection {
  const keys = new Set(groups.flatMap((g) => g.sections.map(sectionKey)));
  return remembered && keys.has(sectionKey(remembered)) ? remembered : { kind: 'home' };
}

export const panelSectionStorageKey = (app: App) => `${app}:explorer-panel-section:v1`;

function readRemembered(app: App): PanelSection | null {
  try {
    return sectionFromKey(window.localStorage.getItem(panelSectionStorageKey(app)));
  } catch {
    return null;
  }
}

/**
 * The section shown and how to pick one. Remembered in this browser; `homeOnOpen` (a phone's sheet) starts on Home
 * each time `open` turns true and remembers nothing.
 */
export function usePanelSection(
  app: App,
  groups: PanelSectionGroup[],
  { homeOnOpen = false, open = false }: { homeOnOpen?: boolean; open?: boolean } = {},
): [PanelSection, (next: PanelSection) => void] {
  const [picked, setPicked] = useState<PanelSection | null>(() =>
    homeOnOpen ? null : readRemembered(app),
  );
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && homeOnOpen) setPicked(null);
  }
  const pick = useCallback(
    (next: PanelSection) => {
      if (!homeOnOpen) {
        try {
          window.localStorage.setItem(panelSectionStorageKey(app), sectionKey(next));
        } catch {
          // Blocked storage: the panel still works, it just opens on Home next time.
        }
      }
      setPicked(next);
    },
    [app, homeOnOpen],
  );
  return [resolveSection(picked, groups), pick];
}
