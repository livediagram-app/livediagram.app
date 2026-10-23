'use client';

// The editor's floating Explorer panel (liveplanner's components/panels/Explorer.tsx, its content only:
// the host wraps it in its own movable panel). The current item on top, a rail of sections (Home, Inbox,
// Shared With Me, My Work, each team, Favourites, Trash), and the chosen section as compact rows, paged
// like the full Explorer. It shares the full Explorer's data layer, so a rename or a star shows here at
// once and every list is one request a page.

import { memo, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import type { App, IndexClient, Item } from '@liveworkspace/index-client';
import { useItemList } from '../data/useItemList';
import { recentLoader, viewList } from '../data/viewLists';
import type { ShownItem } from '../data/overlay';
import { inboxCount } from '../data/useInbox';
import { ExplorerProvider, useExplorer } from '../explorer/context';
import { ExplorerDialogs } from '../explorer/Dialogs';
import { AppMark, FavouriteMarker, VisibilityBadge } from '../explorer/badges';
import { ItemMenu } from '../explorer/menus';
import { RelativeTimeChip } from '../ui/RelativeTimeChip';
import { EllipsisTriggerButton, useRowMenu } from '../ui/RowMenu';
import { ToastProvider } from '../ui/Toasts';
import {
  ClockIcon,
  FolderSolidIcon,
  HomeIcon,
  InboxIcon,
  ItemIcon,
  MyWorkIcon,
  PlusIcon,
  ShareIcon,
  StarIcon,
  TeamIcon,
  TrashIcon,
} from '../ui/icons';
import { SIDEBAR_LABELS, type ExplorerView } from '../views';
import type { AppFilter } from '../words';
import type {
  ItemHref,
  LinkComponent,
  Placement,
  RenderThumbnail,
  ShareUrl,
  TeamRef,
} from '../types';

export type ExplorerPanelProps = {
  app: App;
  client: IndexClient;
  itemHref: ItemHref;
  onCreate: (placement: Placement) => void;
  // The item open in the editor, shown on top.
  current?: Item | null;
  // Opens the full Explorer at a view (the panel's "Open Explorer").
  onOpenExplorer?: (view: ExplorerView) => void;
  renderThumbnail?: RenderThumbnail;
  Link?: LinkComponent;
  onOpenItem?: (href: string, item: Item) => void;
  basePath?: string;
  teams?: TeamRef[];
  viewerId?: string | null;
  shareUrl?: ShareUrl;
  filter?: AppFilter;
};

export function ExplorerPanel(props: ExplorerPanelProps) {
  return (
    <ToastProvider>
      <PanelInner {...props} />
    </ToastProvider>
  );
}

function PanelInner({
  app,
  client,
  itemHref,
  onCreate,
  current = null,
  onOpenExplorer,
  renderThumbnail,
  Link,
  onOpenItem,
  basePath,
  teams,
  viewerId,
  shareUrl,
  filter: initialFilter = 'app',
}: ExplorerPanelProps) {
  const [view, setView] = useState<ExplorerView>({ kind: 'home' });
  const [filter, setFilter] = useState<AppFilter>(initialFilter);
  const navigate = useCallback((v: ExplorerView) => setView(v), []);
  return (
    <ExplorerProvider
      app={app}
      client={client}
      view={view}
      filter={filter}
      setFilter={setFilter}
      onNavigate={navigate}
      itemHref={itemHref}
      onCreate={onCreate}
      onOpenItem={onOpenItem}
      Link={Link}
      basePath={basePath}
      teams={teams}
      viewerId={viewerId}
      renderThumbnail={renderThumbnail}
      shareUrl={shareUrl}
    >
      <div data-explorer-panel="" className="flex h-full min-h-0 flex-col gap-3 text-sm">
        {current ? <CurrentItem item={current} /> : null}
        <div className="flex min-h-0 flex-1 gap-3">
          <Rail onOpenExplorer={onOpenExplorer} />
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <PanelSection />
          </div>
        </div>
      </div>
      <ExplorerDialogs />
    </ExplorerProvider>
  );
}

function CurrentItem({ item: base }: { item: Item }) {
  const { overlay, kind, renderThumbnail, actions } = useExplorer();
  const item = overlay.apply(base);
  const [editing, setEditing] = useState(false);
  const menu = useRowMenu({ disabled: editing });
  const title = item.title || 'Untitled';
  return (
    <section
      aria-label={`Current ${kind.one}`}
      onContextMenu={menu.onContextMenu}
      className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-200/70 dark:bg-slate-800/50 dark:ring-slate-700/60"
    >
      <span className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-white text-slate-300 dark:border-slate-700 dark:bg-slate-900">
        {renderThumbnail ? renderThumbnail(item, 'card') : <ItemIcon />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-h-5 items-center justify-between gap-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Current {kind.one}
          </span>
          <VisibilityBadge item={item} />
        </span>
        {editing ? (
          <input
            autoFocus
            defaultValue={item.title}
            aria-label={`Rename ${title}`}
            onBlur={(e) => {
              setEditing(false);
              void actions.rename(item, e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="w-full rounded border border-brand-300 bg-white px-1.5 py-0.5 text-sm font-semibold text-slate-900 dark:border-brand-400 dark:bg-slate-800 dark:text-slate-50"
          />
        ) : (
          <button
            type="button"
            disabled={item.access !== 'edit'}
            onClick={() => setEditing(true)}
            aria-label={`Rename ${title}`}
            className="truncate text-left text-sm font-semibold text-slate-900 dark:text-slate-50"
          >
            {title}
          </button>
        )}
        <span className="flex items-center justify-between gap-2">
          <RelativeTimeChip at={item.updatedAt} />
          <EllipsisTriggerButton {...menu.triggerProps} size="md" label={`Menu for ${title}`} />
        </span>
      </span>
      {menu.open ? (
        <ItemMenu item={item} anchor={menu.triggerRef.current} onClose={menu.close} />
      ) : null}
    </section>
  );
}

function Rail({ onOpenExplorer }: { onOpenExplorer?: (view: ExplorerView) => void }) {
  const { view, navigate, teams, inbox, viewerId, onCreate, kind, filter, setFilter } =
    useExplorer();
  const entry = (v: ExplorerView, label: string, icon: ReactNode, badge?: number) => {
    const on =
      view.kind === v.kind && (v.kind !== 'team' || (view.kind === 'team' && view.id === v.id));
    return (
      <button
        key={label + (v.kind === 'team' ? v.id : '')}
        type="button"
        aria-current={on ? 'page' : undefined}
        onClick={() => navigate(v)}
        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium transition ${
          on
            ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        }`}
      >
        <span className="shrink-0 text-slate-400">{icon}</span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {badge ? <span className="text-[10px] tabular-nums text-slate-500">{badge}</span> : null}
      </button>
    );
  };
  return (
    <nav aria-label="Sections" className="flex w-36 shrink-0 flex-col gap-0.5">
      <button
        type="button"
        onClick={() => onCreate({ folderId: null, teamId: null })}
        className="mb-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-brand-700 text-xs font-semibold text-white shadow-sm hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-500"
      >
        <PlusIcon size={13} />
        New {kind.one}
      </button>
      {entry({ kind: 'home' }, SIDEBAR_LABELS.home, <HomeIcon />)}
      {entry(
        { kind: 'inbox' },
        SIDEBAR_LABELS.inbox,
        <InboxIcon />,
        inboxCount(inbox.data, viewerId),
      )}
      {entry({ kind: 'shared' }, SIDEBAR_LABELS.shared, <ShareIcon />)}
      {entry({ kind: 'all' }, SIDEBAR_LABELS.myWork, <MyWorkIcon />)}
      {teams.map((t) => entry({ kind: 'team', id: t.id }, t.name, <TeamIcon />))}
      {entry({ kind: 'favourites' }, 'Favourites', <StarIcon />)}
      {entry({ kind: 'trash' }, SIDEBAR_LABELS.trash, <TrashIcon />)}
      <span className="flex-1" />
      <label className="mt-2 flex items-center gap-1.5 px-2 text-[11px] text-slate-500">
        <input
          type="checkbox"
          checked={filter === 'all'}
          onChange={(e) => setFilter(e.target.checked ? 'all' : 'app')}
        />
        Every app
      </label>
      {onOpenExplorer ? (
        <button
          type="button"
          onClick={() => onOpenExplorer(view)}
          className="mt-1 rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
        >
          Open Explorer
        </button>
      ) : null}
    </nav>
  );
}

const PANEL_HOME = 20;

function PanelSection() {
  const { client, view, app, filter, overlay, epoch, folders, navigate, inbox } = useExplorer();
  const sharedMeta = useRef(new Map());
  const list = useMemo(() => {
    if (view.kind === 'home') {
      return {
        key: `panel-home:${filter}`,
        load: recentLoader(client, app, filter, PANEL_HOME),
        belongs: (i: ShownItem) => i.trashedAt === null,
        enabled: true,
      };
    }
    return viewList(client, view, app, filter, sharedMeta.current);
  }, [client, view, app, filter]);
  const state = useItemList({
    key: list?.key ?? 'none',
    load: list?.load ?? (async () => ({ items: [], nextCursor: null })),
    overlay,
    belongs: list?.belongs,
    epoch,
    enabled: Boolean(list?.enabled),
  });
  const folderRows =
    view.kind === 'all'
      ? folders.childrenOf(null, null)
      : view.kind === 'folder'
        ? folders.childrenOf(view.id, folders.byId.get(view.id)?.teamId ?? null)
        : view.kind === 'team'
          ? folders.childrenOf(view.folderId ?? null, view.id)
          : [];

  if (view.kind === 'inbox') {
    const rows = inbox.data ? inbox.data.actions.length + inbox.data.threads.length : 0;
    return (
      <p className="px-2 py-3 text-xs text-slate-500 dark:text-slate-400">
        {inbox.loading
          ? 'Loading…'
          : rows === 0
            ? 'You’re all caught up.'
            : `${rows} waiting in your Inbox.`}
      </p>
    );
  }
  return (
    <ul className="flex flex-col">
      {folderRows.map((f) => (
        <li key={f.id}>
          <button
            type="button"
            onClick={() =>
              navigate(
                f.teamId
                  ? { kind: 'team', id: f.teamId, folderId: f.id }
                  : { kind: 'folder', id: f.id },
              )
            }
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <span className="text-amber-500">
              <FolderSolidIcon />
            </span>
            <span className="truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">
              {f.name}
            </span>
          </button>
        </li>
      ))}
      {state.loading ? (
        <li className="px-2 py-3 text-xs text-slate-500">Loading…</li>
      ) : state.items.length === 0 && folderRows.length === 0 ? (
        <li className="px-2 py-3 text-xs text-slate-500 dark:text-slate-400">
          {view.kind === 'home' ? (
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon /> Nothing opened yet.
            </span>
          ) : (
            'Nothing here yet.'
          )}
        </li>
      ) : (
        state.items.map((item) => <PanelRow key={item.id} item={item} showApp={filter === 'all'} />)
      )}
      {state.hasMore ? (
        <li>
          <button
            type="button"
            disabled={state.loadingMore}
            onClick={state.loadMore}
            className="w-full rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
          >
            {state.loadingMore ? 'Loading…' : 'Show more'}
          </button>
        </li>
      ) : null}
    </ul>
  );
}

const PanelRow = memo(function PanelRow({ item, showApp }: { item: ShownItem; showApp: boolean }) {
  const { Link, itemHref } = useExplorer();
  const menu = useRowMenu();
  const title = item.title || 'Untitled';
  return (
    <li
      data-item-row={item.id}
      onContextMenu={menu.onContextMenu}
      className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
    >
      {showApp ? <AppMark app={item.app} size={14} /> : null}
      {item.favourite ? <FavouriteMarker /> : null}
      <Link
        href={itemHref(item)}
        className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800 hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-300"
      >
        {title}
      </Link>
      <span className="shrink-0">
        <RelativeTimeChip at={item.lastOpenedAt ?? item.updatedAt} />
      </span>
      <EllipsisTriggerButton {...menu.triggerProps} reveal size="sm" label={`Menu for ${title}`} />
      {menu.open ? (
        <ItemMenu item={item} anchor={menu.triggerRef.current} onClose={menu.close} />
      ) : null}
    </li>
  );
});
