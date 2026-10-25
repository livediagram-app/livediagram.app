'use client';

// The Search panel (README.md "Search panel"; liveworkspace/docs/site.md "The Explorer", Search): one field over
// the person's items, folders and teams and the host's own entries (help articles, settings), as livediagram's
// Explorer had it. Its own entry point (`@liveworkspace/explorer/search-panel`), so a host loads it only when it
// first opens. Items come from the index's `search` view once the typing pauses, the request before cancelled;
// folders are read once per opening (the first page); every group shows at most SEARCH_GROUP_MAX.

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import type { App, Folder, IndexClient, Item } from '@liveworkspace/index-client';
import { Dialog } from '../ui/Dialog';
import {
  CloseIcon,
  FolderOutlineIcon,
  HelpMarkIcon,
  ItemIcon,
  SearchIcon,
  SettingsGlyphIcon,
  TeamIcon,
} from '../ui/icons';
import { DEFAULT_BASE_PATH, explorerPath } from '../views';
import type { ItemHref, RenderAppLogo, TeamRef } from '../types';
import { matchAll, queryWords, SEARCH_DEBOUNCE_MS, SEARCH_GROUP_MAX } from './match';

/** A host's own result: a help article or a settings section. */
export type SearchEntry = {
  id: string;
  group: 'help' | 'settings';
  label: string;
  /** Said after the label, quieter (the settings page it is on, say); matched too. */
  hint?: string;
  href: string;
  /** Opens in a new tab (help). */
  newTab?: boolean;
};

export type SearchPanelProps = {
  client: IndexClient;
  /** Only this app's items; every app's when null. */
  app?: App | null;
  itemHref: ItemHref;
  /** The person's teams, found by name. */
  teams?: readonly TeamRef[];
  entries?: readonly SearchEntry[];
  /** Where the Explorer lives, for a folder's or team's address. */
  basePath?: string;
  /** An item's app logo; the item glyph without it. */
  renderAppLogo?: RenderAppLogo;
  /** Go to a result's address (an item in its app, a folder or team in the Explorer, a settings page). */
  onOpen: (href: string) => void;
  onClose: () => void;
};

type Result = {
  key: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  href: string;
  newTab?: boolean;
};
type Group = { key: string; label: string; results: Result[] };

type ItemsState = { q: string; items: Item[]; failed: boolean };

/** The index's search for the words, once they rest, the request before cancelled. */
function useItemSearch(client: IndexClient, app: App | null, q: string): ItemsState | null {
  const [state, setState] = useState<ItemsState | null>(null);
  useEffect(() => {
    if (q === '') return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      client
        .listItems(
          { view: 'search', q, limit: SEARCH_GROUP_MAX, ...(app ? { app } : {}) },
          { signal: abort.signal },
        )
        .then(
          (res) => setState({ q, items: res.items.slice(0, SEARCH_GROUP_MAX), failed: false }),
          () => !abort.signal.aborted && setState({ q, items: [], failed: true }),
        );
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [client, app, q]);
  return state;
}

/** The person's folders, read once as the panel opens: the first page, as many as the index gives one. */
function useFolders(client: IndexClient): readonly Folder[] {
  const [folders, setFolders] = useState<readonly Folder[]>([]);
  useEffect(() => {
    const abort = new AbortController();
    client.listFolders({ limit: 200 }, { signal: abort.signal }).then(
      (res) => setFolders(res.folders),
      () => {},
    );
    return () => abort.abort();
  }, [client]);
  return folders;
}

export function SearchPanel({
  client,
  app = null,
  itemHref,
  teams = [],
  entries = [],
  basePath = DEFAULT_BASE_PATH,
  renderAppLogo,
  onOpen,
  onClose,
}: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const q = query.trim();
  const words = useMemo(() => queryWords(q), [q]);
  const found = useItemSearch(client, app, q);
  const folders = useFolders(client);
  const id = useId();
  const listId = `${id}-results`;
  const optionId = (index: number) => `${id}-${index}`;

  const teamName = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);
  const groups = useMemo<Group[]>(() => {
    if (words.length === 0) return [];
    const items = found && found.q === q ? found.items : [];
    const out: Group[] = [
      {
        key: 'items',
        label: 'Items',
        results: items.map((item) => ({
          key: `item:${item.id}`,
          label: item.title || 'Untitled',
          icon: renderAppLogo ? renderAppLogo(item.app) : <ItemIcon />,
          href: itemHref(item),
        })),
      },
      {
        key: 'folders',
        label: 'Folders',
        results: matchAll(folders, words, (f) => f.name).map((f) => {
          const team = f.teamId ? teamName.get(f.teamId) : undefined;
          return {
            key: `folder:${f.id}`,
            label: f.name,
            ...(team ? { hint: `in ${team}` } : {}),
            icon: <FolderOutlineIcon />,
            href: explorerPath(
              f.teamId
                ? { kind: 'team', id: f.teamId, folderId: f.id }
                : { kind: 'folder', id: f.id },
              basePath,
            ),
          };
        }),
      },
      {
        key: 'teams',
        label: 'Teams',
        results: matchAll(teams, words, (t) => t.name).map((t) => ({
          key: `team:${t.id}`,
          label: t.name,
          icon: <TeamIcon />,
          href: explorerPath({ kind: 'team', id: t.id }, basePath),
        })),
      },
      ...(['help', 'settings'] as const).map((group) => ({
        key: group,
        label: group === 'help' ? 'Help' : 'Settings',
        results: matchAll(
          entries.filter((e) => e.group === group),
          words,
          (e) => `${e.label} ${e.hint ?? ''}`,
        ).map((e) => ({
          key: `${group}:${e.id}`,
          label: e.label,
          ...(e.hint ? { hint: e.hint } : {}),
          icon: group === 'help' ? <HelpMarkIcon /> : <SettingsGlyphIcon />,
          href: e.href,
          ...(e.newTab ? { newTab: true } : {}),
        })),
      })),
    ];
    return out.filter((g) => g.results.length > 0);
  }, [words, found, q, folders, teams, teamName, entries, itemHref, renderAppLogo, basePath]);

  const flat = useMemo(() => groups.flatMap((g) => g.results), [groups]);
  const [active, setActive] = useState(0);
  // A new query highlights its first result again.
  const [activeFor, setActiveFor] = useState(q);
  if (activeFor !== q) {
    setActiveFor(q);
    setActive(0);
  }
  const shown = Math.min(active, Math.max(0, flat.length - 1));
  const searching = q !== '' && (!found || found.q !== q);
  const failed = found?.q === q && found.failed;

  const pick = (result: Result) => {
    onClose();
    if (result.newTab) window.open(result.href, '_blank', 'noopener,noreferrer');
    else onOpen(result.href);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') setActive(Math.min(flat.length - 1, shown + 1));
    else if (e.key === 'ArrowUp') setActive(Math.max(0, shown - 1));
    else if (e.key === 'Enter' && flat[shown]) pick(flat[shown]);
    else return;
    e.preventDefault();
  };

  const scrollTo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollTo.current
      ?.querySelector(`[aria-selected="true"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [shown]);

  let index = -1;
  return (
    <Dialog
      onClose={onClose}
      ariaLabel="Search"
      size="lg"
      className="overflow-hidden max-h-[calc(100dvh-2rem)] sm:mt-[12vh] sm:max-h-[76vh] sm:self-start"
    >
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
        <span aria-hidden className="text-slate-400">
          <SearchIcon />
        </span>
        <input
          type="text"
          role="combobox"
          aria-label="Search"
          aria-autocomplete="list"
          aria-expanded={flat.length > 0}
          aria-controls={listId}
          aria-activedescendant={flat.length > 0 ? optionId(shown) : undefined}
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search items, folders, teams, help…"
          className="h-9 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="relative touch-target -mr-1 flex h-7 min-w-7 shrink-0 items-center justify-center rounded px-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          {/* The key that closes it, on a keyboard's screen; a touch screen has no Esc. */}
          <kbd className="text-[10px] font-medium pointer-coarse:hidden">Esc</kbd>
          <span className="hidden pointer-coarse:block">
            <CloseIcon size={14} />
          </span>
        </button>
      </div>
      <p aria-live="polite" className="sr-only">
        {q && !searching ? `${flat.length} ${flat.length === 1 ? 'result' : 'results'}` : ''}
      </p>
      <div
        ref={scrollTo}
        id={listId}
        role="listbox"
        aria-label="Results"
        className="min-h-0 flex-1 overflow-y-auto py-1"
      >
        {groups.map((group) => (
          <div key={group.key} role="group" aria-label={group.label}>
            <p
              aria-hidden
              className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              {group.label}
            </p>
            {group.results.map((result) => {
              index += 1;
              const at = index;
              const on = at === shown;
              return (
                <div
                  key={result.key}
                  id={optionId(at)}
                  role="option"
                  aria-selected={on}
                  data-search-result={result.key}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(result)}
                  onMouseEnter={() => setActive(at)}
                  className={`flex min-h-8 cursor-pointer items-center gap-2 px-3 py-1.5 text-sm ${
                    on
                      ? 'bg-brand-100 text-brand-900 dark:bg-brand-500/15 dark:text-brand-100'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span
                    aria-hidden
                    className="flex size-4 shrink-0 items-center justify-center text-slate-500 dark:text-slate-400 [&>svg]:max-h-4 [&>svg]:max-w-4"
                  >
                    {result.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{result.label}</span>
                  {result.hint ? (
                    <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                      {result.hint}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
        {groups.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
            {q === ''
              ? 'Start typing to search.'
              : searching
                ? 'Searching…'
                : failed
                  ? 'Search couldn’t reach your items just now. Try again in a moment.'
                  : `Nothing matches “${q}”.`}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
