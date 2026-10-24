'use client';

// The Explorer's shared state, made once per <Explorer>: the client, the optimistic overlay, the folder tree,
// the item actions, the Inbox, and the host's routing callbacks. Lists, rows, the sidebar and the
// dialogs read it, so nothing is fetched twice and every surface shows a change at once.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { App, IndexClient, Item } from '@liveworkspace/index-client';
import { createItemOverlay, type ItemOverlay } from '../data/overlay';
import { useFolderStore, type FolderStore } from '../data/useFolders';
import { DragProvider } from '../drag/store';
import { useItemActions, type HostTrash, type ItemActions } from '../data/useItemActions';
import { useInbox, type InboxState } from '../data/useInbox';
import { defaultEntries, type DefaultEntry, type DefaultFolderOption } from '../defaults/entries';
import {
  usePlacementDefaults,
  type PlacementDefaultsStore,
} from '../defaults/usePlacementDefaults';
import { useToast, type ToastApi } from '../ui/Toasts';
import { createExpansion, type Expansion } from './sidebar/expansion';
import type { LensOption, LensSubject, LensTelemetryType } from '../lens';
import {
  explorerPath,
  lensViewOf,
  SIDEBAR_LABELS,
  viewLens,
  withLens,
  type ExplorerView,
} from '../views';
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
  RenderItemMark,
  RenderThumbnail,
  InboxHost,
  ShareHost,
  ShareUrl,
  TeamRef,
  TimelineTelemetry,
  HomeTelemetry,
  OrganiseTelemetry,
} from '../types';

export type DialogTarget =
  | { kind: 'move-item'; item: Item }
  | { kind: 'move-folder'; folderId: string }
  | { kind: 'share'; item: Item }
  | { kind: 'delete-folder'; folderId: string }
  // Delete Forever from an item's menu in the Trash: always confirmed.
  | { kind: 'purge-item'; item: Item }
  // Use as Default for…: the entries this folder is the reader's default for, each a checkbox.
  // A folder, or null for the root of My Work (where a create lands without a default).
  | { kind: 'use-as-default'; folderId: string | null }
  // Default Folders: every entry, where its new items go, Change and Clear.
  | { kind: 'default-folders' }
  // A Trash group's: the person's own (teamId null) or a team's, named for the confirmation.
  | { kind: 'empty-trash'; teamId: string | null; title: string }
  // History: the item's own Timeline.
  | { kind: 'history'; item: Item }
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
  // The reader's default folders (where New files an item made without a place), and the entries they key.
  defaults: PlacementDefaultsStore;
  defaultEntries: readonly DefaultEntry[];
  actions: ItemActions;
  inbox: InboxState;
  toast: ToastApi;
  teams: TeamRef[];
  teamName: (id: string | null) => string | null;
  viewerId: string | null;
  view: ExplorerView;
  // Goes to a view; from one aggregate list to another the lens comes along. `replace`: no new history entry
  // (the lens field's writes).
  navigate: (view: ExplorerView, options?: NavigateOptions) => void;
  viewHref: (view: ExplorerView) => string;
  itemHref: ItemHref;
  // Opens an item from a menu (rows and cards are links): the host's onOpenItem, or a page load.
  openItem: (item: Item) => void;
  Link: LinkComponent;
  renderThumbnail?: RenderThumbnail;
  renderItemMark?: RenderItemMark;
  shareUrl?: ShareUrl;
  shareHost?: ShareHost;
  inboxHost?: InboxHost;
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
  // The Timeline's reports, for the host's telemetry.
  onTimeline?: TimelineTelemetry;
  // Home's What Happened reports, for the host's telemetry.
  onHome?: HomeTelemetry;
  // The lens's Template values: the host's template families (none: no Template filter).
  lensTemplates: readonly LensOption[];
  // A facet of the lens gained a value (`Explorer / Selected / <Facet>`).
  onLensSelected?: (type: LensTelemetryType) => void;
  // The rows the list on screen holds, as the lens reads them, when it is loaded whole (null while pages
  // remain): the field marks a suggestion that would match none. Written by the list, read by the field.
  lensSubjects: { current: readonly LensSubject[] | null };
  // Which sidebar rows are open: shared by every sidebar on the page and opened by what makes a folder.
  expansion: Expansion;
  // The folder on screen, once its list is in (FolderShown), for the host.
  onFolderShown?: (shown: FolderShown) => void;
};

/** The folder a view shows, once its list is in: its name (null while the folders load), and how many of the host's
 *  items sit directly in it (`itemCount`, counted from the pages read so far; null while a lens is set, as the list
 *  then reaches its subfolders). A workbench's place says it (livediagram's `livediagram:place`). */
export type FolderShown = { folderId: string; name: string | null; itemCount: number | null };

export type NavigateOptions = { replace?: boolean };

/** Where a move lands: from one aggregate list to another (Recent to Favourites) the lens comes along. */
export function carryLens(from: ExplorerView, to: ExplorerView): ExplorerView {
  if (from.kind === to.kind) return to;
  if (lensViewOf(from.kind) !== 'aggregate' || lensViewOf(to.kind) !== 'aggregate') return to;
  if (to.kind === 'search' || viewLens(to) !== '') return to;
  return withLens(to, viewLens(from));
}

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
  onNavigate: (view: ExplorerView, href: string, options?: NavigateOptions) => void;
  itemHref: ItemHref;
  onCreate: (placement: Placement) => void;
  onOpenItem?: (href: string, item: Item) => void;
  Link?: LinkComponent;
  basePath?: string;
  teams?: TeamRef[];
  viewerId?: string | null;
  renderThumbnail?: RenderThumbnail;
  renderItemMark?: RenderItemMark;
  shareUrl?: ShareUrl;
  shareHost?: ShareHost;
  inboxHost?: InboxHost;
  manageTeamsUrl?: string;
  openNav?: () => void;
  helpHref?: HelpHref;
  heroWords?: HeroWords;
  onTimeline?: TimelineTelemetry;
  onHome?: HomeTelemetry;
  lensTemplates?: readonly LensOption[];
  // Default Folders' entries for what the host's items open in and their kinds (DefaultFolderOption), between the
  // app's own and its templates'; none by default.
  defaultFolderOptions?: readonly DefaultFolderOption[];
  onLensSelected?: (type: LensTelemetryType) => void;
  // Folders, default folders, the Trash and team libraries (OrganiseTelemetry), for the host's telemetry; stable.
  onOrganise?: OrganiseTelemetry;
  // Trashes an item the host handles itself (see HostTrash); stable, or the actions are rebuilt.
  hostTrash?: HostTrash;
  // After an item took a new title (the host follows it for the item it has open); stable.
  onItemRenamed?: (item: Item, title: string) => void;
  onFolderShown?: (shown: FolderShown) => void;
  children: ReactNode;
};

const NO_NAV = () => {};

const NO_TEAMS: TeamRef[] = [];
const NO_TEMPLATES: readonly LensOption[] = [];
const NO_DEFAULT_OPTIONS: readonly DefaultFolderOption[] = [];

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
  renderItemMark,
  shareUrl,
  shareHost,
  inboxHost,
  manageTeamsUrl,
  openNav = NO_NAV,
  helpHref,
  heroWords,
  onTimeline,
  onHome,
  lensTemplates = NO_TEMPLATES,
  defaultFolderOptions = NO_DEFAULT_OPTIONS,
  onLensSelected,
  onOrganise,
  hostTrash,
  onItemRenamed,
  onFolderShown,
  children,
}: ExplorerProviderProps) {
  const toast = useToast();
  const [overlay] = useState(createItemOverlay);
  const [epoch, setEpoch] = useState(0);
  const reloadLists = useCallback(() => setEpoch((n) => n + 1), []);
  const folders = useFolderStore(client, toast.error, reloadLists, onOrganise);
  const defaults = usePlacementDefaults(client, toast.error, onOrganise);
  const entries = useMemo(
    () => defaultEntries(app, kindWords(app), lensTemplates, defaultFolderOptions),
    [app, lensTemplates, defaultFolderOptions],
  );
  const [placedEpoch, setPlacedEpoch] = useState(0);
  const onPlaced = useCallback(() => setPlacedEpoch((n) => n + 1), []);
  // Where a move went, in words: a folder's name, a team's, or My Work.
  const placeName = useCallback(
    (to: { folderId: string | null; teamId: string | null }) => {
      const folder = to.folderId ? folders.byId.get(to.folderId) : undefined;
      if (folder) return folder.name;
      if (to.teamId) return teams.find((t) => t.id === to.teamId)?.name ?? 'the team';
      return SIDEBAR_LABELS.myWork;
    },
    [folders.byId, teams],
  );
  const actions = useItemActions({
    client,
    overlay,
    toast,
    reloadLists,
    hostTrash,
    onPlaced,
    onRenamed: onItemRenamed,
    placeName,
    onOrganise,
  });
  const inbox = useInbox(client, app, filter, inboxHost);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [dialog, openDialog] = useState<DialogTarget>(null);
  const [expansion] = useState(createExpansion);

  const viewHref = useCallback((v: ExplorerView) => explorerPath(v, basePath), [basePath]);
  // Read when moving, so `navigate` stays the same function across lens writes.
  const viewRef = useRef(view);
  viewRef.current = view;
  const lensSubjects = useRef<readonly LensSubject[] | null>(null);
  const navigate = useCallback(
    (v: ExplorerView, options?: NavigateOptions) => {
      const to = carryLens(viewRef.current, v);
      const href = explorerPath(to, basePath);
      if (options) onNavigate(to, href, options);
      else onNavigate(to, href);
    },
    [onNavigate, basePath],
  );
  // A team's folder lives on its team's page: a folder view on one (a link to it, a workbench frame started on it)
  // moves there in place, its lens with it, once the folders say whose it is.
  const folderId = view.kind === 'folder' ? view.id : null;
  const folderLens = view.kind === 'folder' ? viewLens(view) : '';
  const folderTeam = folderId ? (folders.byId.get(folderId)?.teamId ?? null) : null;
  useEffect(() => {
    if (!folderId || !folderTeam) return;
    const to = withLens({ kind: 'team', id: folderTeam, folderId }, folderLens);
    onNavigate(to, explorerPath(to, basePath), { replace: true });
  }, [folderId, folderTeam, folderLens, onNavigate, basePath]);
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
      defaults,
      defaultEntries: entries,
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
      renderItemMark,
      shareUrl,
      shareHost,
      inboxHost,
      manageTeamsUrl,
      onCreate,
      renamingId,
      setRenamingId,
      dialog,
      openDialog,
      openNav,
      helpHref,
      heroWords: heroWords ?? heroWordsFor(app),
      onTimeline,
      onHome,
      lensTemplates,
      onLensSelected,
      lensSubjects,
      expansion,
      onFolderShown,
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
      defaults,
      entries,
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
      renderItemMark,
      shareUrl,
      shareHost,
      inboxHost,
      manageTeamsUrl,
      onCreate,
      renamingId,
      dialog,
      openNav,
      helpHref,
      heroWords,
      onTimeline,
      onHome,
      lensTemplates,
      onLensSelected,
      expansion,
      onFolderShown,
    ],
  );
  return (
    <Ctx.Provider value={value}>
      <DragProvider>{children}</DragProvider>
    </Ctx.Provider>
  );
}
