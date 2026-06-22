'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Tab } from '@livediagram/diagram';
import {
  buildSearchResults,
  type CommandSearchItem,
  type HelpSearchItem,
  type PaletteAdd,
  type PaletteSearchItem,
  type SearchGroup,
  type SearchResultItem,
} from '@/lib/search';
import { titleCaseType, track } from '@/lib/telemetry';
import { useEscape } from '@/hooks/useEscape';

// Global search panel: triggered from a footer button, blurs the
// canvas behind it, pops up near the top-centre. The scope is
// contextual (spec/09 "Search panel"):
//   - Always: diagrams (user's list) + folders.
//   - When supplied: "Shared with you" diagrams + teams (spec/32).
//   - When inside a diagram: also tabs + elements on the current
//     diagram (table text matches by cell).
// Selection navigates to the right surface (open the diagram /
// switch tabs / select the element / jump to the team). Esc +
// outside-click close; Enter on the first match picks it.

type SearchPanelDiagram = { id: string; name: string };
type SearchPanelFolder = { id: string; name: string };
type SearchPanelShared = { id: string; name: string; shareCode: string };
type SearchPanelTeam = { id: string; name: string };
type SearchPanelTeamFolder = { id: string; path: string; teamId: string; teamName: string };
type SearchPanelTeamDiagram = { id: string; name: string; teamId: string; teamName: string };

type SearchPanelProps = {
  diagrams: SearchPanelDiagram[];
  folders: SearchPanelFolder[];
  // Diagrams shared with the current owner. Optional so surfaces
  // without the list (or guests with an empty one) can omit it.
  shared?: SearchPanelShared[];
  // Teams the signed-in user belongs to (spec/32). Optional: guests
  // have none.
  teams?: SearchPanelTeam[];
  // Team-library folders (spec/35), rendered in the Teams group with
  // an "in <team>" suffix. Optional: guests have none.
  teamFolders?: SearchPanelTeamFolder[];
  // Team-library diagrams (spec/35), also in the Teams group with an
  // "in <team>" suffix. Optional: guests have none.
  teamDiagrams?: SearchPanelTeamDiagram[];
  // When the user is inside a diagram editor these provide the
  // tab + element scope. Omitted on routes (e.g. the dashboard)
  // where only diagrams + folders should match.
  tabs?: Tab[];
  // Tab id where the element matches' active state should apply
  // (the current tab — so the user knows whether a hit is on
  // their current view).
  currentTabId?: string;
  onSelectDiagram: (id: string) => void;
  // Receives the diagram id AND its share code: a non-owner can only
  // open the diagram on the visitor URL the code builds.
  onSelectShared?: (id: string, shareCode: string) => void;
  onSelectFolder?: (id: string) => void;
  onSelectTeam?: (id: string) => void;
  // A team-library folder pick: receives the team AND folder ids so
  // the host can land on the team page with that folder open.
  onSelectTeamFolder?: (teamId: string, folderId: string) => void;
  onSelectTab?: (tabId: string) => void;
  // Receives the tab id AND element id when the user picks an
  // element match. The host route is responsible for switching
  // tabs + selecting the element.
  onSelectElement?: (tabId: string, elementId: string) => void;
  // Editor-only: the palette catalogue to surface as "Add to canvas"
  // results, plus the handler that adds the picked one (it arms the same
  // placement gesture the palette uses, then the panel closes).
  paletteItems?: PaletteSearchItem[];
  onAddPaletteItem?: (add: PaletteAdd) => void;
  // The help-centre catalogue surfaced as "Help" results. Passed by both the
  // editor and the Explorer (help is global); picking one opens the article
  // in a new tab.
  helpItems?: HelpSearchItem[];
  // Editor-only: the contextual command catalogue (delete / lock / rotate /
  // share / rename / ...) surfaced as "Actions" results, plus the dispatcher
  // that runs the picked command's id. The editor builds the list selection-
  // aware (useEditorCommands) and withholds it from view-only sessions.
  commandItems?: CommandSearchItem[];
  onRunCommand?: (id: string) => void;
  onClose: () => void;
};

// Result-grouping logic (matching, capping, fallbacks) lives in
// `lib/search.ts`; the panel just renders.

export function SearchPanel({
  diagrams,
  folders,
  shared,
  teams,
  teamFolders,
  teamDiagrams,
  tabs,
  currentTabId,
  onSelectDiagram,
  onSelectShared,
  onSelectFolder,
  onSelectTeam,
  onSelectTeamFolder,
  onSelectTab,
  onSelectElement,
  paletteItems,
  onAddPaletteItem,
  helpItems,
  commandItems,
  onRunCommand,
  onClose,
}: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const searchedRef = useRef(false);
  const openedRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    // Guard so React strict mode's dev-only effect double-invoke
    // doesn't double-emit Search / Opened. Focus is idempotent so
    // it stays outside the guard.
    if (openedRef.current) return;
    openedRef.current = true;
    track('Search', 'Opened');
  }, []);

  // Esc closes. Capture phase + stopPropagation so the modal owns
  // the key even when the editor's global shortcuts are listening.
  useEscape(onClose, { capture: true, stopPropagation: true });

  const groups = useMemo<SearchGroup[]>(
    () =>
      buildSearchResults({
        query,
        diagrams,
        folders,
        shared,
        teams,
        teamFolders,
        teamDiagrams,
        tabs,
        currentTabId,
        paletteItems,
        commandItems,
        helpItems,
      }),
    [
      query,
      diagrams,
      folders,
      shared,
      teams,
      teamFolders,
      teamDiagrams,
      tabs,
      currentTabId,
      paletteItems,
      commandItems,
      helpItems,
    ],
  );

  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const [activeIndex, setActiveIndex] = useState(0);

  // Reset highlight when the result set changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleSelect = (item: SearchResultItem) => {
    // Help opens the article in a new tab and records the SAME per-article
    // UI/Opened telemetry every other help link fires (keyed by the article
    // leaf), so help analytics are unified regardless of entry point.
    if (item.kind === 'help') {
      window.open(item.href, '_blank', 'noopener,noreferrer');
      track('UI', 'Opened', item.leaf);
      onClose();
      return;
    }
    if (item.kind === 'diagram') onSelectDiagram(item.id);
    else if (item.kind === 'shared' && onSelectShared) onSelectShared(item.id, item.shareCode);
    else if (item.kind === 'folder' && item.team && onSelectTeamFolder)
      onSelectTeamFolder(item.team.id, item.id);
    else if (item.kind === 'folder' && !item.team && onSelectFolder) onSelectFolder(item.id);
    else if (item.kind === 'team' && onSelectTeam) onSelectTeam(item.id);
    else if (item.kind === 'tab' && onSelectTab) onSelectTab(item.id);
    else if (item.kind === 'element' && onSelectElement)
      onSelectElement(item.tabId, item.elementId);
    else if (item.kind === 'palette' && onAddPaletteItem) onAddPaletteItem(item.add);
    else if (item.kind === 'command' && onRunCommand) onRunCommand(item.id);
    track('Search', 'Selected', titleCaseType(item.kind));
    onClose();
  };

  const handleInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(flatItems.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      const item = flatItems[activeIndex];
      if (item) {
        e.preventDefault();
        handleSelect(item);
      }
    }
  };

  return (
    <div
      onPointerDown={(e) => {
        // Outside-click closes (any click on the backdrop, not
        // inside the panel itself).
        if (e.target === e.currentTarget) onClose();
      }}
      className="absolute inset-0 z-50 flex items-start justify-center bg-slate-900/30 px-4 pt-[12vh] backdrop-blur-sm dark:bg-slate-950/50"
    >
      <div className="flex w-[34rem] max-w-full animate-fly-up-in flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
          <span className="text-slate-400 dark:text-slate-400" aria-hidden>
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              const next = e.target.value;
              setQuery(next);
              if (!searchedRef.current && next.trim()) {
                searchedRef.current = true;
                track('Search', 'Searched');
              }
            }}
            onKeyDown={handleInputKey}
            placeholder={
              tabs
                ? 'Search diagrams, folders, teams, tabs, elements, help...'
                : 'Search diagrams, folders, teams, help...'
            }
            className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <kbd className="text-[10px] font-medium">Esc</kbd>
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto py-1">
          {groups.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
              {query ? 'No matches.' : 'Start typing to search.'}
            </p>
          ) : (
            groups.map((group) => {
              const baseIndex = flatItems.findIndex((f) => f === group.items[0]);
              return (
                <div key={group.key}>
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {group.label}
                  </p>
                  {group.items.map((item, i) => {
                    const idx = baseIndex + i;
                    const active = idx === activeIndex;
                    return (
                      <button
                        key={item.kind === 'element' ? `${item.tabId}:${item.elementId}` : item.id}
                        type="button"
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={
                          active
                            ? 'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs bg-brand-100 text-brand-800 dark:bg-brand-500/15 dark:text-brand-100'
                            : 'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                        }
                      >
                        <SearchResultIcon item={item} />
                        <span className="min-w-0 flex-1 truncate">
                          {item.kind === 'element' ? item.label : item.name}
                        </span>
                        {item.kind === 'element' ? (
                          <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-400">
                            on {item.tabName}
                          </span>
                        ) : null}
                        {(item.kind === 'folder' || item.kind === 'diagram') && item.team ? (
                          <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-400">
                            in {item.team.name}
                          </span>
                        ) : null}
                        {item.kind === 'tab' && item.isCurrent ? (
                          <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-400">
                            current
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function SearchResultIcon({ item }: { item: SearchResultItem }) {
  // Compact glyph per result kind so users can scan the list by
  // shape without reading labels.
  const stroke = 'currentColor';
  if (item.kind === 'shared') {
    // Diagram rect + an inbound arrow: someone else's diagram that
    // was shared into this account.
    return (
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        aria-hidden
      >
        <rect x="5" y="5" width="8" height="8" rx="1.5" />
        <path d="M2 2l4 4M6 3v3h-3" />
      </svg>
    );
  }
  if (item.kind === 'team') {
    // Two heads: a team.
    return (
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinecap="round"
        aria-hidden
      >
        <circle cx="6" cy="6" r="2.2" />
        <path d="M2.5 13c.5-2.3 1.7-3.5 3.5-3.5s3 1.2 3.5 3.5" />
        <circle cx="11.5" cy="6.5" r="1.8" />
        <path d="M11 9.6c1.6.1 2.6 1.2 3 3" />
      </svg>
    );
  }
  if (item.kind === 'diagram') {
    return (
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        aria-hidden
      >
        <rect x="3" y="3" width="10" height="10" rx="1.5" />
      </svg>
    );
  }
  if (item.kind === 'folder') {
    return (
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        aria-hidden
      >
        <path d="M2.5 4.5h4l1.5 1.5h5.5v6.5a1 1 0 0 1 -1 1h-10a1 1 0 0 1 -1 -1z" />
      </svg>
    );
  }
  if (item.kind === 'tab') {
    return (
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        aria-hidden
      >
        <path d="M2.5 6.5h4l1-2h6v9h-11z" />
      </svg>
    );
  }
  if (item.kind === 'palette') {
    // Plus-in-a-box: this result ADDS an element rather than navigating.
    return (
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinecap="round"
        aria-hidden
      >
        <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
        <path d="M8 5.5v5M5.5 8h5" />
      </svg>
    );
  }
  if (item.kind === 'command') {
    // Lightning bolt: a do-something command (delete / lock / rotate / share
    // / rename / ...) rather than navigation, distinct from the palette's
    // plus-in-a-box add glyph.
    return (
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M8.5 1.5 3 9h4l-.5 5.5L13 7H9z" />
      </svg>
    );
  }
  if (item.kind === 'help') {
    // A "?" in a circle: a help-centre article (opens in a new tab).
    return (
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="8" cy="8" r="6" />
        <path d="M6.3 6.2a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.5-.7 1v.3" />
        <path d="M8 11.4h.01" />
      </svg>
    );
  }
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke={stroke}
      strokeWidth="1.4"
      aria-hidden
    >
      <circle cx="8" cy="8" r="4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="7" cy="7" r="4" />
      <path d="M10 10l3.5 3.5" />
    </svg>
  );
}
