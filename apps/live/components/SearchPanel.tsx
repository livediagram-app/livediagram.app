'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Element, Tab } from '@livediagram/diagram';

// Global search panel: triggered from a footer button, blurs the
// canvas behind it, pops up near the top-centre. The scope is
// contextual:
//   - Always: diagrams (user's list) + folders.
//   - When inside a diagram: also tabs + elements on the current
//     diagram.
// Selection navigates to the right surface (open the diagram /
// switch tabs / select the element). Esc + outside-click close;
// Enter on the first match picks it.

type SearchPanelDiagram = { id: string; name: string };
type SearchPanelFolder = { id: string; name: string };

type SearchPanelProps = {
  diagrams: SearchPanelDiagram[];
  folders: SearchPanelFolder[];
  // When the user is inside a diagram editor these provide the
  // tab + element scope. Omitted on routes (e.g. the dashboard)
  // where only diagrams + folders should match.
  tabs?: Tab[];
  // Tab id where the element matches' active state should apply
  // (the current tab — so the user knows whether a hit is on
  // their current view).
  currentTabId?: string;
  onSelectDiagram: (id: string) => void;
  onSelectFolder?: (id: string) => void;
  onSelectTab?: (tabId: string) => void;
  // Receives the tab id AND element id when the user picks an
  // element match. The host route is responsible for switching
  // tabs + selecting the element.
  onSelectElement?: (tabId: string, elementId: string) => void;
  onClose: () => void;
};

type ElementHit = {
  kind: 'element';
  tabId: string;
  tabName: string;
  elementId: string;
  label: string;
  type: Element['type'];
};

// Single-section grouping for the rendered list.
type Group = {
  key: 'diagrams' | 'folders' | 'tabs' | 'elements';
  label: string;
  items: ResultItem[];
};

type ResultItem =
  | { kind: 'diagram'; id: string; name: string }
  | { kind: 'folder'; id: string; name: string }
  | { kind: 'tab'; id: string; name: string; isCurrent: boolean }
  | ElementHit;

// Case-insensitive substring match. Stand-in for a fuzzier matcher;
// the dataset sizes here (typical user has dozens of diagrams,
// dozens of elements per tab) don't warrant a fuzzy index.
function matches(needle: string, hay: string): boolean {
  if (!needle) return true;
  return hay.toLowerCase().includes(needle.toLowerCase());
}

export function SearchPanel({
  diagrams,
  folders,
  tabs,
  currentTabId,
  onSelectDiagram,
  onSelectFolder,
  onSelectTab,
  onSelectElement,
  onClose,
}: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Esc closes. Capture phase so the modal owns the key even when
  // the editor's global shortcuts are listening.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const groups = useMemo<Group[]>(() => {
    const q = query.trim();
    const groups: Group[] = [];

    const diagramMatches = diagrams
      .filter((d) => matches(q, d.name || 'Untitled diagram'))
      .slice(0, 8);
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

    const folderMatches = folders.filter((f) => matches(q, f.name)).slice(0, 8);
    if (folderMatches.length > 0) {
      groups.push({
        key: 'folders',
        label: 'Folders',
        items: folderMatches.map((f) => ({ kind: 'folder', id: f.id, name: f.name })),
      });
    }

    if (tabs && tabs.length > 0) {
      const tabMatches = tabs.filter((t) => matches(q, t.name)).slice(0, 8);
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
      // SOMETHING, so blanks aren't matchable). Cap at 12 hits so
      // a runaway match doesn't blow up the modal height.
      const elementMatches: ElementHit[] = [];
      for (const t of tabs) {
        for (const el of t.elements) {
          const label = ('label' in el && typeof el.label === 'string' && el.label.trim()) || '';
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
          if (elementMatches.length >= 12) break;
        }
        if (elementMatches.length >= 12) break;
      }
      if (elementMatches.length > 0) {
        groups.push({ key: 'elements', label: 'Elements', items: elementMatches });
      }
    }

    return groups;
  }, [query, diagrams, folders, tabs, currentTabId]);

  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const [activeIndex, setActiveIndex] = useState(0);

  // Reset highlight when the result set changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleSelect = (item: ResultItem) => {
    if (item.kind === 'diagram') onSelectDiagram(item.id);
    else if (item.kind === 'folder' && onSelectFolder) onSelectFolder(item.id);
    else if (item.kind === 'tab' && onSelectTab) onSelectTab(item.id);
    else if (item.kind === 'element' && onSelectElement)
      onSelectElement(item.tabId, item.elementId);
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
      className="absolute inset-0 z-40 flex items-start justify-center bg-slate-900/30 px-4 pt-[12vh] backdrop-blur-sm dark:bg-slate-950/50"
    >
      <div className="flex w-[34rem] max-w-full animate-fly-up-in flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
          <span className="text-slate-400 dark:text-slate-500" aria-hidden>
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKey}
            placeholder={
              tabs ? 'Search diagrams, folders, tabs, elements...' : 'Search diagrams, folders...'
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
                          <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
                            on {item.tabName}
                          </span>
                        ) : null}
                        {item.kind === 'tab' && item.isCurrent ? (
                          <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
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

function SearchResultIcon({ item }: { item: ResultItem }) {
  // Compact glyph per result kind so users can scan the list by
  // shape without reading labels.
  const stroke = 'currentColor';
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
