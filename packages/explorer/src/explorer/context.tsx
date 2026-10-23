'use client';

// The Explorer's shared state, made once per <Explorer>: the client, the optimistic overlay, the folder tree,
// the item actions, the Inbox, and the host's routing callbacks. Lists, rows, the sidebar and the
// dialogs read it, so nothing is fetched twice and every surface shows a change at once.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { App, IndexClient, Item } from '@liveworkspace/index-client';
import { createItemOverlay, type ItemOverlay } from '../data/overlay';
import { useFolderStore, type FolderStore } from '../data/useFolders';
import { DragProvider } from '../drag/store';
import { useItemActions, type HostTrash, type ItemActions } from '../data/useItemActions';
import { useInbox, type InboxState } from '../data/useInbox';
import { useToast, type ToastApi } from '../ui/Toasts';
import { explorerPath, type ExplorerView } from '../views';
import {
  heroWords as heroWordsFor,
  kindWords,
  listWords,
  type AppFilter,
  type HeroWords,
  type Words,
} from '../words';
import type {
  ItemHref,
  LinkComponent,
  LinkProps,
  Placement,
  RenderThumbnail,
  ShareUrl,
  TeamRef,
} from '../types';

export type DialogTarget =
  | { kind: 'move-item'; item: Item }
  | { kind: 'move-folder'; folderId: string }
  | { kind: 'share'; item: Item }
  | { kind: 'delete-folder'; folderId: string }
  | { kind: 'empty-trash' }
  | null;

export type ExplorerContextValue = {
  app: App;
  client: IndexClient;
  filter: AppFilter;
  setFilter: (filter: AppFilter) => void;
  // "Plan" for the host's own kind (New makes it); the list's words follow the filter.
  kind: Words;
  words: Words;
  overlay: ItemOverlay;
  epoch: number;
  // Bumped when an item changes place, so what folder cards show of their insides is read again.
  placedEpoch: number;
  reloadLists: () => void;
  folders: FolderStore;
  actions: ItemActions;
  inbox: InboxState;
  toast: ToastApi;
  teams: TeamRef[];
  teamName: (id: string | null) => string | null;
  viewerId: string | null;
  view: ExplorerView;
  navigate: (view: ExplorerView) => void;
  viewHref: (view: ExplorerView) => string;
  itemHref: ItemHref;
  // Opens an item from a menu (rows and cards are links): the host's onOpenItem, or a page load.
  openItem: (item: Item) => void;
  Link: LinkComponent;
  renderThumbnail?: RenderThumbnail;
  shareUrl?: ShareUrl;
  manageTeamsUrl?: string;
  onCreate: (placement: Placement) => void;
  // Inline rename: one row at a time, by id (item or folder).
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
  dialog: DialogTarget;
  openDialog: (target: DialogTarget) => void;
  // Opens the sections drawer on a phone (a no-op where there is none, the editor's panel).
  openNav: () => void;
  // A view's help article, when the host has one; the pane header and Home's hero draw a Help button.
  helpHref?: HelpHref;
  // Home's hero: the question after the greeting, and the lead.
  heroWords: HeroWords;
};

export type HelpHref = (view: ExplorerView) => string | undefined;

const Ctx = createContext<ExplorerContextValue | null>(null);

export function useExplorer(): ExplorerContextValue {
  const value = useContext(Ctx);
  if (!value) throw new Error('useExplorer outside <Explorer>');
  return value;
}

export function useOptionalExplorer(): ExplorerContextValue | null {
  return useContext(Ctx);
}

export function DefaultLink({
  href,
  className,
  children,
  onClick,
  title,
  'aria-label': ariaLabel,
}: LinkProps) {
  return (
    <a href={href} className={className} onClick={onClick} title={title} aria-label={ariaLabel}>
      {children}
    </a>
  );
}

export type ExplorerProviderProps = {
  app: App;
  client: IndexClient;
  view: ExplorerView;
  filter: AppFilter;
  setFilter: (filter: AppFilter) => void;
  onNavigate: (view: ExplorerView, href: string) => void;
  itemHref: ItemHref;
  onCreate: (placement: Placement) => void;
  onOpenItem?: (href: string, item: Item) => void;
  Link?: LinkComponent;
  basePath?: string;
  teams?: TeamRef[];
  viewerId?: string | null;
  renderThumbnail?: RenderThumbnail;
  shareUrl?: ShareUrl;
  manageTeamsUrl?: string;
  openNav?: () => void;
  helpHref?: HelpHref;
  heroWords?: HeroWords;
  // Trashes an item the host handles itself (see HostTrash); stable, or the actions are rebuilt.
  hostTrash?: HostTrash;
  children: ReactNode;
};

const NO_NAV = () => {};

const NO_TEAMS: TeamRef[] = [];

export function ExplorerProvider({
  app,
  client,
  view,
  filter,
  setFilter,
  onNavigate,
  itemHref,
  onCreate,
  onOpenItem,
  Link = DefaultLink,
  basePath,
  teams = NO_TEAMS,
  viewerId = null,
  renderThumbnail,
  shareUrl,
  manageTeamsUrl,
  openNav = NO_NAV,
  helpHref,
  heroWords,
  hostTrash,
  children,
}: ExplorerProviderProps) {
  const toast = useToast();
  const [overlay] = useState(createItemOverlay);
  const [epoch, setEpoch] = useState(0);
  const reloadLists = useCallback(() => setEpoch((n) => n + 1), []);
  const folders = useFolderStore(client, toast.error, reloadLists);
  const [placedEpoch, setPlacedEpoch] = useState(0);
  const onPlaced = useCallback(() => setPlacedEpoch((n) => n + 1), []);
  const actions = useItemActions({ client, overlay, toast, reloadLists, hostTrash, onPlaced });
  const inbox = useInbox(client, app, filter);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [dialog, openDialog] = useState<DialogTarget>(null);

  const viewHref = useCallback((v: ExplorerView) => explorerPath(v, basePath), [basePath]);
  const navigate = useCallback(
    (v: ExplorerView) => onNavigate(v, explorerPath(v, basePath)),
    [onNavigate, basePath],
  );
  const openItem = useCallback(
    (item: Item) => {
      const href = itemHref(item);
      if (onOpenItem) onOpenItem(href, item);
      else window.location.assign(href);
    },
    [itemHref, onOpenItem],
  );
  const teamNames = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);
  const teamName = useCallback(
    (id: string | null) => (id ? (teamNames.get(id) ?? 'Team') : null),
    [teamNames],
  );

  const value = useMemo<ExplorerContextValue>(
    () => ({
      app,
      client,
      filter,
      setFilter,
      kind: kindWords(app),
      words: listWords(app, filter),
      overlay,
      epoch,
      placedEpoch,
      reloadLists,
      folders,
      actions,
      inbox,
      toast,
      teams,
      teamName,
      viewerId,
      view,
      navigate,
      viewHref,
      itemHref,
      openItem,
      Link,
      renderThumbnail,
      shareUrl,
      manageTeamsUrl,
      onCreate,
      renamingId,
      setRenamingId,
      dialog,
      openDialog,
      openNav,
      helpHref,
      heroWords: heroWords ?? heroWordsFor(app),
    }),
    [
      app,
      client,
      filter,
      setFilter,
      overlay,
      epoch,
      placedEpoch,
      reloadLists,
      folders,
      actions,
      inbox,
      toast,
      teams,
      teamName,
      viewerId,
      view,
      navigate,
      viewHref,
      itemHref,
      openItem,
      Link,
      renderThumbnail,
      shareUrl,
      manageTeamsUrl,
      onCreate,
      renamingId,
      dialog,
      openNav,
      helpHref,
      heroWords,
    ],
  );
  return (
    <Ctx.Provider value={value}>
      <DragProvider>{children}</DragProvider>
    </Ctx.Provider>
  );
}
