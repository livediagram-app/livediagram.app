'use client';

// The editor's floating Explorer panel, drawn as liveplanner's was before it moved onto the index
// (components/panels/Explorer.tsx with its explorer-panel/ and explorer-tree/ parts): the open item's card with the
// host's notice under it, then a rail of sections beside a pane (a row of chips over the pane when stacked). The
// pane names its section in full, offers New Folder (an icon) in a space, and shows Home's Jump Back In, the Inbox, a
// space's folders and items, Favourites, This Browser or the Trash. Only where the data comes from changed: it
// shares the full Explorer's data layer, so a rename or a star shows here at once and every list is one request a
// page, read only while its section is shown.

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { type App, type Folder, type IndexClient, type Item } from '@liveworkspace/index-client';
import { useFolderPreviews } from '../data/useFolderPreviews';
import { useItemList } from '../data/useItemList';
import { isMostUsed, jumpBackInLine, jumpBackInLoader, viewList } from '../data/viewLists';
import type { ShownItem } from '../data/overlay';
import { inboxCount } from '../data/useInbox';
import { ExplorerProvider, useExplorer } from '../explorer/context';
import { ExplorerDialogs } from '../explorer/Dialogs';
import { AppMark, FavouriteMarker, VisibilityBadge } from '../explorer/badges';
import { FolderMenu, ItemMenu, MyWorkMenu } from '../explorer/menus';
import { emptyCopy } from '../explorer/EmptyPane';
import { OtherAppsHere } from '../explorer/OtherAppsHere';
import { elsewhereLabel } from '../explorer/FolderMosaic';
import { useOtherApps } from '../data/useOtherApps';
import { InboxPane } from '../explorer/InboxPane';
import { BrowserIcon, HostExtrasProvider, type ExplorerHostExtras } from '../explorer/host';
import { PeopleProvider } from '../explorer/extras';
import type { ExplorerAccounts } from '../data/accounts';
import {
  LocalPreview,
  mergeOpened,
  ThisBrowserItemMenu,
  ThisBrowserPill,
  useThisBrowserItems,
  type ThisBrowserHost,
} from '../explorer/ThisBrowser';
import type { ThisBrowserItem } from '../this-browser';
import { PanelLocalCard, PanelThisBrowser } from './PanelThisBrowser';
import { BackBar, Button, ConfirmDialog, Tooltip } from '@liveworkspace/ui';
import { daysLeftLabel, trashedOnLabel, trashGroups } from '../explorer/TrashPane';
import {
  TRASH_BIN,
  TRASH_OVER,
  TRASH_WAITING,
  useDropTarget,
  useFolderDrag,
  useItemDrag,
  useTrashTarget,
  type DropPlace,
} from '../drag/drag';
import { InlineRenameInput } from '../ui/InlineRenameInput';
import { EllipsisTriggerButton, useRowMenu } from '../ui/RowMenu';
import { ToastProvider } from '../ui/Toasts';
import { LibraryHostProvider, useLibraryHost } from '../library/context';
import { PanelLibrary, PanelTimeline } from './PanelLibraryTimeline';
import type { LibraryHostProps } from '../library/types';
import { useLatest } from '../ui/useLatest';
import {
  ClockIcon,
  FolderSolidIcon,
  HomeIcon,
  InboxIcon,
  ItemIcon,
  LibraryIcon,
  MyWorkIcon,
  NewFolderIcon,
  PencilIcon,
  PlusIcon,
  RestoreIcon,
  ShareIcon,
  StarIcon,
  TeamIcon,
  TimelineIcon,
  TrashIcon,
} from '../ui/icons';
import { relativeSince, useNow } from '../time';
import { explorerPath, SIDEBAR_LABELS, type ExplorerView } from '../views';
import type { TeamsHost } from '../data/teams';
import { TeamsProvider, useTeams } from '../teams/context';
import { TeamCard, useTeamDetails } from '../teams/TeamCard';
import { NewTeamDialog } from '../teams/NewTeamDialog';
import { Dialog, DialogCloseButton, DialogHeader } from '../ui/Dialog';
import { folderCountLabel, siteOf, type AppFilter } from '../words';

export { folderCountLabel } from '../words';
import type {
  ItemHref,
  LinkComponent,
  Placement,
  RenderAppLogo,
  RenderItemMark,
  RenderThumbnail,
  InboxHost,
  OrganiseTelemetry,
  ShareHost,
  ShareUrl,
  TeamRef,
} from '../types';
import {
  PANE_LINK,
  PANE_PREVIEW_BOX,
  PANE_THUMB_BOX,
  FolderPreview,
  PaneCard,
  PaneEmpty,
  PaneFailed,
  PaneGrid,
  PaneIconButton,
  PaneList,
  PaneRow,
  PaneSection,
  PaneSkeleton,
  PaneTile,
} from './pane-parts';
import {
  SECTION_GROUP_TITLES,
  panelSectionGroups,
  sectionKey,
  sectionLabel,
  type LibraryTab,
  usePanelSection,
  type PanelSection,
  type PanelSectionGroup,
} from './sections';
import { withDriveMarks } from '../drive/DriveMarks';
import { useDriveMarks, type ExplorerDriveHost } from '../drive/useDriveMarks';

/**
 * How the panel lays out: `side`, the rail beside the pane (a desktop popover); `stacked`, a row of section chips
 * over the pane (a phone, or the narrow corner panel); `sheet`, stacked and filling a phone's sheet, the card
 * scrolling with the pane.
 */
export type PanelLayout = 'side' | 'stacked' | 'sheet';

/**
 * The editors' popover (liveworkspace/docs/specs/004-index/one-explorer.md "The editors' panel: its size and the
 * scrim"): up to 64rem wide, so the 13rem rail has room and the pane's compact preview cards run four across, yet a
 * quarter of a 1280px window's canvas stays in sight; and up to 56rem tall. Each editor's MovablePanel takes these,
 * so the size lives once. The host keeps it 1rem inside the window.
 */
export const EXPLORER_POPOVER_WIDTH = 'w-[64rem]';
export const EXPLORER_POPOVER_HEIGHT = '56rem';

/**
 * The rail and pane's box per layout. `side` (a desktop or tablet popover) fills the popover, which the host sizes
 * (EXPLORER_POPOVER_WIDTH by EXPLORER_POPOVER_HEIGHT, kept inside the window), never shorter than 18rem; `sheet` fills a
 * phone's sheet, never shorter than 18rem; `stacked` (a narrow corner panel) is capped to leave the canvas room.
 */
export const PANEL_BODY: Record<PanelLayout, string> = {
  side: 'min-h-[18rem] flex-1',
  stacked: 'max-h-[max(14rem,calc(100dvh-30rem))] flex-col',
  sheet: 'min-h-[18rem] flex-1 flex-col',
};

export type ExplorerPanelProps = {
  app: App;
  client: IndexClient;
  itemHref: ItemHref;
  onCreate: (placement: Placement) => void;
  // The item open in the editor, shown on top and left out of Home's Jump Back In.
  current?: Item | null;
  // The id of the item open in the editor, known before `current` is read.
  currentId?: string | null;
  // Trashes the item open in the editor, from any of the panel's menus: the host stops saving it first, then leaves
  // it (the Explorer offers the Undo). Settles true once it is in the Trash.
  onTrashCurrent?: (item: Item) => Promise<boolean>;
  // The item open in the editor took a new title, from its card or any menu: the editor's title follows.
  onRenameCurrent?: (title: string) => void;
  // Opens the full Explorer at a view (See all, a view only the page shows).
  onOpenExplorer?: (view: ExplorerView) => void;
  renderThumbnail?: RenderThumbnail;
  /** The host's own marks on an item, beside its name (RenderItemMark). */
  renderItemMark?: RenderItemMark;
  /** Google Drive's unseen-folder mark beside a name, as on the Explorer page (ExplorerDriveHost). */
  drive?: ExplorerDriveHost | null;
  /** The filter's logos, as on the Explorer page. */
  renderAppLogo?: RenderAppLogo;
  Link?: LinkComponent;
  onOpenItem?: (href: string, item: Item) => void;
  basePath?: string;
  teams?: TeamRef[];
  /** Making and running teams (createTeamsHost): New Team on the rail and a team's Members dialog. Passed for a
   *  signed-in person only; the panel asks nothing about teams until one of those opens. */
  teamsHost?: TeamsHost | null;
  viewerId?: string | null;
  shareUrl?: ShareUrl;
  // The Share dialog's tabs, embed, live image, help and telemetry.
  share?: ShareHost;
  /** The Inbox's extras: rows from items only this browser holds, card glyphs, a help article and telemetry. */
  inbox?: InboxHost;
  /** The app's items kept only in this browser, as the Explorer page's `thisBrowser`, with the editor's own `open`,
   *  `sync` and `remove`: a This Browser section on the rail (with their count) while there are any. */
  thisBrowser?: ThisBrowserHost | null;
  /** Folders, default folders, the Trash and team libraries changed from the panel, for the host's telemetry
   *  (OrganiseTelemetry); stable. */
  onOrganise?: OrganiseTelemetry;
  filter?: AppFilter;
  layout?: PanelLayout;
  // The panel is showing (a popover opened): a phone's sheet starts on Home each time.
  open?: boolean;
  // Under the current card: the host's onboarding notice (the sign-in bar).
  notice?: ReactNode;
  // Pinned under the rail and pane, outside their scroll (the product's links).
  footer?: ReactNode;
  // Group titles over the rail's groups, or a hairline between them (Minimal chrome).
  divider?: 'titles' | 'lines';
  /** Other people's names and Google pictures, as on the Explorer page (`createExplorerAccounts` over the app's
   *  router with the person's token): the Inbox's and history's avatars then show pictures. Without it, initials. */
  accounts?: ExplorerAccounts | null;
} & LibraryHostProps;

export function ExplorerPanel({
  gallery,
  shapeLibraries,
  imports,
  itemMenu,
  history,
  teamsHost,
  thisBrowser = null,
  accounts = null,
  ...props
}: ExplorerPanelProps) {
  const extras = useMemo<ExplorerHostExtras>(
    () => ({ sidebarLinks: [], allLabel: 'All', showAppFilter: true, thisBrowser }),
    [thisBrowser],
  );
  return (
    <ToastProvider>
      <HostExtrasProvider value={extras}>
        <LibraryHostProvider
          gallery={gallery}
          shapeLibraries={shapeLibraries}
          imports={imports}
          itemMenu={itemMenu}
          history={history}
        >
          <TeamsProvider
            host={teamsHost}
            signedIn={Boolean(teamsHost)}
            tokenTeams={props.teams}
            eager={false}
          >
            <PeopleProvider accounts={accounts}>
              <PanelInner {...props} />
            </PeopleProvider>
          </TeamsProvider>
        </LibraryHostProvider>
      </HostExtrasProvider>
    </ToastProvider>
  );
}

function PanelInner({
  app,
  client,
  itemHref,
  onCreate,
  current = null,
  currentId = null,
  onTrashCurrent,
  onRenameCurrent,
  onOpenExplorer,
  renderThumbnail,
  renderItemMark: hostItemMark,
  drive,
  renderAppLogo,
  Link,
  onOpenItem,
  basePath,
  viewerId,
  shareUrl,
  share,
  inbox: inboxHost,
  onOrganise,
  filter: initialFilter = 'app',
  layout = 'side',
  open = false,
  notice,
  footer,
  divider = 'titles',
}: Omit<ExplorerPanelProps, keyof LibraryHostProps | 'teamsHost' | 'teams' | 'thisBrowser'>) {
  const { teams } = useTeams();
  const driveMarks = useDriveMarks(drive);
  const renderItemMark = useMemo(
    () => withDriveMarks(hostItemMark, driveMarks),
    [hostItemMark, driveMarks],
  );
  const sheet = layout === 'sheet';
  const stacked = layout !== 'side';
  const { gallery, shapeLibraries } = useLibraryHost();
  const library = Boolean(gallery || shapeLibraries);
  const thisBrowserLive = useThisBrowserItems().live;
  const offlineCount = thisBrowserLive.length;
  // The open item when the index has none for it (kept only in this browser): its card comes from This Browser.
  const localCurrent =
    !current && currentId ? (thisBrowserLive.find((i) => i.id === currentId) ?? null) : null;
  const groups = useMemo(
    () => panelSectionGroups(teams, { library, thisBrowser: offlineCount > 0 }),
    [teams, library, offlineCount],
  );
  // The Library's tab, held here so a menu's Shape Libraries opens on it.
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('gallery');
  const [section, pickSection] = usePanelSection(app, groups, { homeOnOpen: sheet, open });
  // The folder open in the pane, for the section it was opened in: another section starts at its root.
  const [openFolder, setOpenFolder] = useState<{ section: string; id: string | null }>({
    section: '',
    id: null,
  });
  const folderId = openFolder.section === sectionKey(section) ? openFolder.id : null;
  const [filter, setFilter] = useState<AppFilter>(initialFilter);

  // The pane's view, which the shared menus read and navigate (a folder's Open).
  const view = paneView(section, folderId);
  const pick = useCallback(
    (next: PanelSection) => {
      pickSection(next);
      setOpenFolder({ section: sectionKey(next), id: null });
    },
    [pickSection],
  );
  const navigate = useCallback(
    (v: ExplorerView) => {
      const at = sectionOfView(v);
      if (!at) {
        onOpenExplorer?.(v);
        return;
      }
      pickSection(at.section);
      setOpenFolder({ section: sectionKey(at.section), id: at.folderId });
      if (at.libraryTab) setLibraryTab(at.libraryTab);
    },
    [pickSection, onOpenExplorer],
  );

  const openId = currentId ?? current?.id ?? null;
  const hostTrash = useCallback(
    (item: Item) => (onTrashCurrent && item.id === openId ? onTrashCurrent(item) : null),
    [onTrashCurrent, openId],
  );

  const renamed = useLatest(onRenameCurrent);
  const onItemRenamed = useCallback(
    (item: Item, title: string) => {
      if (item.id === openId) renamed.current?.(title);
    },
    [openId, renamed],
  );

  return (
    <ExplorerProvider
      hostTrash={hostTrash}
      onItemRenamed={onItemRenamed}
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
      renderItemMark={renderItemMark}
      renderAppLogo={renderAppLogo}
      shareUrl={shareUrl}
      shareHost={share}
      inboxHost={inboxHost}
      onOrganise={onOrganise}
    >
      <div
        data-explorer-panel=""
        className={`flex min-h-0 flex-col ${stacked && !sheet ? '' : 'flex-1'}`}
      >
        {/* On a phone's sheet the card and the rail and pane scroll as one, over the pinned footer. Elsewhere this
            box is `contents`, adding nothing to the layout. */}
        <div
          data-explorer-sheet-scroll={sheet ? '' : undefined}
          className={
            sheet
              ? 'scrollbar-slim flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain'
              : 'contents'
          }
        >
          <div className="flex flex-col gap-2 px-2.5 pb-2.5 pt-1 empty:hidden">
            {current ? (
              <CurrentItem item={current} />
            ) : localCurrent ? (
              <LocalCurrentItem item={localCurrent} onRename={onRenameCurrent} />
            ) : null}
            {notice}
          </div>
          <div
            data-panel-body={layout}
            className={`flex border-t border-slate-200 dark:border-slate-700/70 ${PANEL_BODY[layout]}`}
          >
            <Rail
              groups={groups}
              selected={section}
              onPick={pick}
              phone={stacked}
              divider={divider}
              offlineCount={offlineCount}
            />
            <Pane
              section={section}
              folderId={folderId}
              onOpenFolder={(id) => setOpenFolder({ section: sectionKey(section), id })}
              currentId={current?.id ?? currentId}
              onOpenExplorer={onOpenExplorer}
              libraryTab={libraryTab}
              setLibraryTab={setLibraryTab}
            />
          </div>
        </div>
        {footer}
      </div>
      <ExplorerDialogs />
    </ExplorerProvider>
  );
}

function paneView(section: PanelSection, folderId: string | null): ExplorerView {
  switch (section.kind) {
    case 'mine':
      return folderId ? { kind: 'folder', id: folderId } : { kind: 'all' };
    case 'team':
      return folderId
        ? { kind: 'team', id: section.id, folderId }
        : { kind: 'team', id: section.id };
    case 'library':
      return { kind: 'gallery' };
    default:
      return { kind: section.kind };
  }
}

// Where a view the shared menus ask for sits in the panel, or null for one only the Explorer page shows.
function sectionOfView(
  v: ExplorerView,
): { section: PanelSection; folderId: string | null; libraryTab?: LibraryTab } | null {
  switch (v.kind) {
    case 'gallery':
    case 'shape-libraries':
      return { section: { kind: 'library' }, folderId: null, libraryTab: v.kind };
    case 'home':
    case 'inbox':
    case 'timeline':
    case 'shared':
    case 'favourites':
    case 'offline':
    case 'trash':
      return { section: { kind: v.kind }, folderId: null };
    case 'all':
      return { section: { kind: 'mine' }, folderId: null };
    case 'folder':
      return { section: { kind: 'mine' }, folderId: v.id };
    case 'team':
      return { section: { kind: 'team', id: v.id }, folderId: v.folderId ?? null };
    default:
      return null;
  }
}

// ---- The current item's card ----------------------------------------------------------------------------

// The open item as the index has it: its picture, visibility badge and the Explorer's item menu, renamed through
// the index (the editor's title follows, onItemRenamed).
function CurrentItem({ item: base }: { item: Item }) {
  const { overlay, renderThumbnail, actions, openItem, renamingId, setRenamingId } = useExplorer();
  const item = overlay.apply(base);
  // Its pencil, or Rename on its menu (which names it for renaming, as every row's does).
  const [pencil, setPencil] = useState(false);
  const editing = pencil || renamingId === item.id;
  const setEditing = (on: boolean) => {
    setPencil(on);
    if (!on && renamingId === item.id) setRenamingId(null);
  };
  const menu = useRowMenu({ disabled: editing });
  return (
    <CurrentCard
      title={item.title}
      updatedAt={item.updatedAt}
      canRename={item.access === 'edit'}
      editing={editing}
      setEditing={setEditing}
      onRename={(title) => void actions.rename(item, title)}
      onOpen={() => openItem(item)}
      thumbnail={renderThumbnail ? renderThumbnail(item, 'card') : <ItemIcon size={18} />}
      badge={<VisibilityBadge item={item} />}
      menu={menu}
    >
      {menu.open ? (
        <ItemMenu item={item} anchor={menu.triggerRef.current} onClose={menu.close} />
      ) : null}
    </CurrentCard>
  );
}

// The open item when it lives only in this browser (the index never holds it): drawn from This Browser's list, with
// the app's picture of a local item, the This Browser pill and This Browser's own menu (Open, Sync, Delete). Renaming
// it is the editor's own rename (`onRenameCurrent`), which writes this browser's store; nothing goes to the index.
function LocalCurrentItem({
  item,
  onRename,
}: {
  item: ThisBrowserItem;
  onRename?: (title: string) => void;
}) {
  const { app } = useExplorer();
  const [editing, setEditing] = useState(false);
  const menu = useRowMenu({ disabled: editing });
  return (
    <CurrentCard
      local
      title={item.title}
      updatedAt={item.updatedAt}
      canRename={Boolean(onRename)}
      editing={editing}
      setEditing={setEditing}
      onRename={(title) => onRename?.(title)}
      thumbnail={<LocalPreview app={app} iconSize={18} className="h-14 w-20 shrink-0" />}
      badge={<ThisBrowserPill />}
      menu={menu}
    >
      {menu.open ? (
        <ThisBrowserItemMenu item={item} anchor={menu.triggerRef.current} onClose={menu.close} />
      ) : null}
    </CurrentCard>
  );
}

// The card both draw: the picture, the label "Current <Kind>" with the place's badge, the name (click to rename, for
// someone who may), "Updated <relative time>" and the ⋯ menu.
function CurrentCard({
  local = false,
  title,
  updatedAt,
  canRename,
  editing,
  setEditing,
  onRename,
  onOpen,
  thumbnail,
  badge,
  menu,
  children,
}: {
  local?: boolean;
  title: string;
  updatedAt: number;
  canRename: boolean;
  editing: boolean;
  setEditing: (on: boolean) => void;
  onRename: (title: string) => void;
  onOpen?: () => void;
  thumbnail: ReactNode;
  badge: ReactNode;
  menu: ReturnType<typeof useRowMenu>;
  children?: ReactNode;
}) {
  const { kind } = useExplorer();
  const now = useNow();
  const name = title || `Untitled ${kind.lowerOne}`;
  const commit = (next: string) => {
    const trimmed = next.trim();
    if (trimmed && trimmed !== title) onRename(trimmed);
    setEditing(false);
  };
  return (
    <section
      aria-label={`Current ${kind.lowerOne}`}
      data-current-item={local ? 'this-browser' : 'index'}
      onContextMenu={menu.onContextMenu}
      className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-200/70 dark:bg-slate-800/50 dark:ring-slate-700/60"
    >
      <span className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-300 dark:border-slate-700 dark:bg-slate-900 [&>*]:!h-14 [&>*]:!w-20">
        {thumbnail}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-h-5 items-center justify-between gap-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Current {kind.one}
          </span>
          {badge}
        </span>
        {editing ? (
          <InlineRenameInput
            initial={title}
            ariaLabel={`Rename ${name}`}
            onCommit={commit}
            onCancel={() => setEditing(false)}
            className="w-full rounded border border-brand-300 bg-white px-1.5 py-0.5 text-sm font-semibold text-slate-900 dark:border-brand-400 dark:bg-slate-800 dark:text-slate-50"
          />
        ) : canRename ? (
          // Fitted to the name: hovering underlines it and shows the pencil, never a block of fill.
          <button
            type="button"
            aria-label={`Rename ${name}`}
            onClick={() => setEditing(true)}
            className="group/name flex max-w-full cursor-pointer items-center gap-1.5 self-start rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <span className="min-w-0 truncate text-[15px] font-semibold text-slate-900 decoration-slate-400 decoration-dotted underline-offset-4 group-hover/name:underline dark:text-slate-50 dark:decoration-slate-500">
              {name}
            </span>
            <span
              aria-hidden
              className="shrink-0 text-slate-400 opacity-0 transition group-hover/name:opacity-100 group-focus-visible/name:opacity-100 dark:text-slate-400"
            >
              <PencilIcon size={12} />
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpen}
            aria-current="true"
            className="min-w-0 self-start truncate text-left text-[15px] font-semibold text-slate-900 dark:text-slate-50"
          >
            {name}
          </button>
        )}
        <span className="flex min-h-5 items-center justify-between gap-2">
          <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
            Updated {relativeSince(updatedAt, now || Date.now())}
          </span>
          {!editing ? (
            <EllipsisTriggerButton
              {...menu.triggerProps}
              size="md"
              className="-my-1 shrink-0"
              label={`${kind.one} menu`}
            />
          ) : null}
        </span>
      </span>
      {children}
    </section>
  );
}

// ---- The rail -------------------------------------------------------------------------------------------

// The New button's sizes: in the rail, the panel's control height (h-9, 36 px; 44 px on a touch screen), full width;
// on a phone's chip row, a chip's (36 px to the eye, its tap reaching 44 px).
export const NEW_BUTTON_RAIL = 'mb-3 h-9 min-h-9 w-full px-3 pointer-coarse:h-11';
export const NEW_BUTTON_CHIP = 'relative h-9 min-h-9 touch-target-y px-3';

function SectionIcon({ kind }: { kind: PanelSection['kind'] }) {
  switch (kind) {
    case 'home':
      return <HomeIcon />;
    case 'inbox':
      return <InboxIcon />;
    case 'shared':
      return <ShareIcon />;
    case 'mine':
      return <MyWorkIcon />;
    case 'team':
      return <TeamIcon />;
    case 'favourites':
      return <StarIcon />;
    case 'offline':
      return <BrowserIcon />;
    case 'timeline':
      return <TimelineIcon />;
    case 'library':
      return <LibraryIcon />;
    case 'trash':
      return <TrashIcon />;
  }
}

function Rail({
  groups,
  selected,
  onPick,
  phone,
  divider,
  offlineCount,
}: {
  groups: PanelSectionGroup[];
  selected: PanelSection;
  onPick: (s: PanelSection) => void;
  phone: boolean;
  divider: 'titles' | 'lines';
  // How many items this browser keeps only for itself: This Browser's count.
  offlineCount: number;
}) {
  const { onCreate, kind, inbox, viewerId, teamName } = useExplorer();
  const canRunTeams = useTeams().canRun;
  const navRef = useRef<HTMLElement>(null);
  const selectedKey = sectionKey(selected);
  const name = (id: string) => teamName(id);
  const badges: Record<string, number | undefined> = {
    inbox: inboxCount(inbox.data, viewerId) || undefined,
    offline: offlineCount || undefined,
  };
  // On a phone the picked chip may sit past the row's edge: bring it into view.
  useEffect(() => {
    if (!phone) return;
    const chip = navRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    chip?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [phone, selectedKey]);
  // Up and Down (Left and Right on a phone) move between entries; Enter or Space picks one.
  const onKeyDown = (e: KeyboardEvent) => {
    const keys = phone ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
    if (!keys.includes(e.key)) return;
    const entries = [
      ...(navRef.current?.querySelectorAll<HTMLButtonElement>('[data-rail-entry]') ?? []),
    ];
    const at = entries.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    e.preventDefault();
    entries[(at + (e.key === keys[1] ? 1 : -1) + entries.length) % entries.length]?.focus();
  };
  // New, first in the rail: never squeezed by the rail's column (shrink-0), 36 px under a mouse and 44 px on touch;
  // on a phone's chip row 36 px to the eye with a 44 px tap, as the chips are. The words sit on the cap height's
  // centre, so they line up with the plus.
  const newItem = (
    <button
      type="button"
      data-panel-new=""
      onClick={() => onCreate({ folderId: null, teamId: null })}
      className={`flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-700 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:bg-brand-600 dark:hover:bg-brand-500 ${
        phone ? NEW_BUTTON_CHIP : NEW_BUTTON_RAIL
      }`}
    >
      <PlusIcon size={14} />
      <span className="text-optical-centre">{phone ? 'New' : `New ${kind.one}`}</span>
    </button>
  );
  const newTeamEntry = canRunTeams ? (
    <NewTeamEntry key="new-team" phone={phone} onMade={(id) => onPick({ kind: 'team', id })} />
  ) : null;
  const entry = (s: PanelSection) => {
    const key = sectionKey(s);
    return (
      <RailEntry
        key={key}
        section={s}
        on={key === selectedKey}
        label={sectionLabel(s, name)}
        badge={badges[key]}
        phone={phone}
        onPick={onPick}
      />
    );
  };
  return (
    <nav
      ref={navRef}
      aria-label="Explorer sections"
      onKeyDown={onKeyDown}
      className={
        phone
          ? 'shrink-0 overflow-x-auto px-2.5 py-1 [scrollbar-width:none]'
          : 'scrollbar-slim flex w-52 shrink-0 flex-col overflow-y-auto border-r border-slate-200 px-2.5 py-3 dark:border-slate-700/70'
      }
    >
      {phone ? (
        <ul className="flex gap-1.5">
          <li className="shrink-0">{newItem}</li>
          {groups.flatMap((g) => [
            ...g.sections.map(entry),
            ...(g.id === 'spaces' && newTeamEntry ? [newTeamEntry] : []),
          ])}
        </ul>
      ) : (
        <>
          {newItem}
          {groups.map((g, i) =>
            g.sections.length ? (
              <section key={g.id} aria-label={SECTION_GROUP_TITLES[g.id]}>
                {divider === 'titles' ? (
                  <h3
                    className={`px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${i ? 'mt-4' : ''}`}
                  >
                    {SECTION_GROUP_TITLES[g.id]}
                  </h3>
                ) : i ? (
                  <span
                    aria-hidden
                    className="mx-2 my-2.5 block h-px bg-slate-200 dark:bg-slate-700"
                  />
                ) : null}
                <ul className="flex flex-col gap-0.5">
                  {g.sections.map(entry)}
                  {g.id === 'spaces' ? newTeamEntry : null}
                </ul>
              </section>
            ) : null,
          )}
        </>
      )}
    </nav>
  );
}

// New Team, last under Spaces (signed in): the team dialog, and the team made opens in the pane.
function NewTeamEntry({ phone, onMade }: { phone: boolean; onMade: (teamId: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={phone ? 'shrink-0' : ''}>
      <button
        type="button"
        data-rail-entry=""
        onClick={() => setOpen(true)}
        className={`flex cursor-pointer items-center gap-2 border border-transparent text-left text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${
          phone
            ? 'relative h-9 touch-target-y whitespace-nowrap rounded-lg px-2.5 text-[13px] ring-1 ring-slate-200 dark:ring-slate-700'
            : 'h-8 w-full rounded-md px-2'
        }`}
      >
        <span aria-hidden className="flex shrink-0 items-center opacity-80">
          <PlusIcon />
        </span>
        <span className={phone ? 'text-optical-centre' : 'min-w-0 flex-1 truncate'}>
          {SIDEBAR_LABELS.newTeam}
        </span>
      </button>
      {open ? (
        <NewTeamDialog onClose={() => setOpen(false)} onMade={(team) => onMade(team.id)} />
      ) : null}
    </li>
  );
}

// Where an item dropped on a rail entry lands: My Work's root, or a team's.
function railDropPlace(s: PanelSection): DropPlace | null {
  if (s.kind === 'mine') return { teamId: null, folderId: null };
  if (s.kind === 'team') return { teamId: s.id, folderId: null };
  return null;
}

/**
 * One rail entry. My Work and each team take a dragged item (a resting drag opens the section under it), and the
 * Trash wakes while anything drags, as the Explorer page's sidebar does.
 */
function RailEntry({
  section: s,
  on,
  label,
  badge,
  phone,
  onPick,
}: {
  section: PanelSection;
  on: boolean;
  label: string;
  badge: number | undefined;
  phone: boolean;
  onPick: (s: PanelSection) => void;
}) {
  const drop = useDropTarget(railDropPlace(s), { onLongHover: on ? undefined : () => onPick(s) });
  const trash = useTrashTarget();
  const isTrash = s.kind === 'trash';
  const trashState = isTrash ? trash.state : 'rest';
  const shown = isTrash && trash.words ? trash.words : label;
  // My Work's entry carries its menu on a right-click, as the sidebar's My Work row does.
  const { setRenamingId } = useExplorer();
  const menu = useRowMenu({ disabled: s.kind !== 'mine' });
  const entryRef = useRef<HTMLButtonElement>(null);
  return (
    <li className={phone ? 'shrink-0' : ''}>
      {menu.open ? (
        <MyWorkMenu
          anchor={entryRef.current}
          onClose={menu.close}
          onOpen={() => onPick(s)}
          onRename={(id) => {
            onPick(s);
            setRenamingId(id);
          }}
        />
      ) : null}
      <button
        ref={entryRef}
        type="button"
        onContextMenu={menu.onContextMenu}
        data-rail-entry=""
        data-drop-over={drop.over || undefined}
        aria-current={on ? 'true' : undefined}
        aria-label={badge ? `${label} (${badge})` : label}
        onClick={() => onPick(s)}
        {...(isTrash ? trash.handlers : drop.handlers)}
        className={`flex cursor-pointer items-center gap-2 border border-transparent text-left text-xs transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 ${
          phone
            ? 'relative h-9 touch-target-y whitespace-nowrap rounded-lg px-2.5 text-[13px]'
            : 'h-8 w-full rounded-md px-2'
        } ${
          trashState === 'over'
            ? `${TRASH_OVER} font-semibold text-white`
            : trashState === 'waiting'
              ? `${TRASH_WAITING} text-brand-800 dark:text-brand-200`
              : on
                ? 'bg-brand-100 font-semibold text-brand-800 dark:bg-brand-500/20 dark:text-brand-100'
                : phone
                  ? 'text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
        } ${drop.over ? 'ring-2 ring-brand-400' : ''}`}
      >
        <span
          aria-hidden
          data-trash-bin={isTrash ? trashState : undefined}
          className={`flex shrink-0 items-center opacity-80 transition-transform duration-short ease-out ${TRASH_BIN[trashState]}`}
        >
          <SectionIcon kind={s.kind} />
        </span>
        <span className={phone ? 'text-optical-centre' : 'min-w-0 flex-1 truncate'}>{shown}</span>
        {isTrash ? (
          <span role="status" aria-live="polite" className="sr-only">
            {trash.words ?? ''}
          </span>
        ) : null}
        {badge ? (
          <span
            aria-hidden
            className="rounded-full bg-slate-200/70 px-1.5 text-[10px] font-semibold leading-4 text-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            {badge}
          </span>
        ) : null}
      </button>
    </li>
  );
}

// ---- The pane -------------------------------------------------------------------------------------------

// The header's quiet actions: a glyph named by its label and tooltip, a wash on hover, no frame. Words would crowd
// the section's name out of a narrow pane.
const HEADER_ICON_BUTTON =
  'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-500 pointer-coarse:size-11 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white [&_svg]:size-4';

function HeaderIconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button type="button" aria-label={label} onClick={onClick} className={HEADER_ICON_BUTTON}>
        {children}
      </button>
    </Tooltip>
  );
}

function Pane({
  section,
  folderId,
  onOpenFolder,
  currentId,
  onOpenExplorer,
  libraryTab,
  setLibraryTab,
}: {
  section: PanelSection;
  folderId: string | null;
  onOpenFolder: (id: string | null) => void;
  currentId: string | null;
  onOpenExplorer?: (view: ExplorerView) => void;
  libraryTab: LibraryTab;
  setLibraryTab: (tab: LibraryTab) => void;
}) {
  const { teamName, folders } = useExplorer();
  const canRunTeams = useTeams().canRun;
  const [members, setMembers] = useState(false);
  const title = sectionLabel(section, (id) => teamName(id));
  const space = section.kind === 'mine' || section.kind === 'team';
  // The folder open, while it is still one of the space's (a folder deleted or moved away goes back to the root).
  const here =
    folderId && folders.byId.get(folderId)?.teamId === (section.kind === 'team' ? section.id : null)
      ? folderId
      : null;
  const pendingRename = useRef<((id: string) => void) | null>(null);
  const newFolder = space
    ? () =>
        void folders
          .create({
            name: 'New Folder',
            parentId: here,
            teamId: section.kind === 'team' ? section.id : null,
          })
          .then((f) => f && pendingRename.current?.(f.id))
    : undefined;
  const body =
    section.kind === 'home' ? (
      <HomeSection currentId={currentId} onOpenExplorer={onOpenExplorer} />
    ) : section.kind === 'inbox' ? (
      <InboxPane compact />
    ) : section.kind === 'timeline' ? (
      <PanelTimeline />
    ) : section.kind === 'library' ? (
      <PanelLibrary tab={libraryTab} setTab={setLibraryTab} />
    ) : section.kind === 'trash' ? (
      <TrashSection />
    ) : section.kind === 'offline' ? (
      <PanelThisBrowser />
    ) : (
      <PlaceSection
        section={section}
        folderId={here}
        onOpenFolder={onOpenFolder}
        currentId={currentId}
        rootLabel={title}
        pendingRename={pendingRename}
      />
    );
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* The section's name always shows in full: it takes the room, and wraps rather than truncates (a long team
          name); the actions are glyphs that never shrink. */}
      <div className="flex items-center gap-1 px-5 pb-3 pt-4 max-sm:px-4 max-sm:pb-1.5 max-sm:pt-2.5">
        <h3 className="mr-1 min-w-0 flex-1 text-[15px] font-semibold leading-5 text-balance break-words text-slate-900 dark:text-slate-50">
          {title}
        </h3>
        {newFolder ? (
          <HeaderIconButton label={here ? 'New Subfolder' : 'New Folder'} onClick={newFolder}>
            <NewFolderIcon />
          </HeaderIconButton>
        ) : null}
        {section.kind === 'mine' ? (
          <MyWorkHeaderMenu onOpenRoot={() => onOpenFolder(null)} />
        ) : null}
        {section.kind === 'team' && canRunTeams ? (
          <HeaderIconButton label="Members" onClick={() => setMembers(true)}>
            <TeamIcon size={16} />
          </HeaderIconButton>
        ) : null}
        {/* This Browser holds only this app's items, and the Library is the app's own. */}
        {section.kind === 'library' || section.kind === 'offline' ? null : (
          <span className="ml-1 shrink-0">
            <FilterToggle />
          </span>
        )}
      </div>
      <div
        data-explorer-pane=""
        className="scrollbar-slim @container min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-5 pt-1 @2xl:px-4"
      >
        {/* Keyed by section: a pick slides the new section in (a fade alone under reduced motion). */}
        <div key={sectionKey(section)} className="animate-view-forward">
          {body}
        </div>
      </div>
      {members && section.kind === 'team' ? (
        <TeamMembersDialog teamId={section.id} teamName={title} onClose={() => setMembers(false)} />
      ) : null}
    </div>
  );
}

// My Work's menu in its pane's header: the sidebar's own (Open, New Folder, Use as Default for…), with Open and a new
// folder showing My Work's root here rather than leaving for the Explorer page.
function MyWorkHeaderMenu({ onOpenRoot }: { onOpenRoot: () => void }) {
  const { setRenamingId } = useExplorer();
  const menu = useRowMenu();
  return (
    <>
      <EllipsisTriggerButton {...menu.triggerProps} size="lg" label="Menu for My Work" />
      {menu.open ? (
        <MyWorkMenu
          anchor={menu.triggerRef.current}
          onClose={menu.close}
          onOpen={onOpenRoot}
          onRename={(id) => {
            onOpenRoot();
            setRenamingId(id);
          }}
        />
      ) : null}
    </>
  );
}

// This app's items, or every app's: the Explorer page's own filter, as two quiet words.
function FilterToggle() {
  const { app, filter, setFilter, renderAppLogo } = useExplorer();
  const option = (value: AppFilter, label: string) => {
    const logo = renderAppLogo?.(value === 'app' ? app : 'all');
    return (
      <button
        type="button"
        aria-pressed={filter === value}
        onClick={() => setFilter(value)}
        className={`flex h-6 cursor-pointer items-center rounded px-1.5 text-[11px] font-medium transition focus-visible:outline-2 focus-visible:outline-brand-500 ${
          filter === value
            ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-200'
            : // slate-600, not 500: the group's slate-100 ground left slate-500 at 4.3:1, under AA for this 11px text.
              'text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
        }`}
      >
        {logo ? (
          <span aria-hidden className="mr-1 inline-flex shrink-0 [&_svg]:size-3.5">
            {logo}
          </span>
        ) : null}
        {label}
      </button>
    );
  };
  return (
    <div
      role="group"
      aria-label="Show"
      className="flex shrink-0 items-center rounded-md bg-slate-100 p-0.5 dark:bg-slate-800"
    >
      {option('app', siteOf(app).name)}
      {option('all', 'All')}
    </div>
  );
}

// ---- Home -----------------------------------------------------------------------------------------------

// How many items Home's Jump Back In lists in the pane (two full rows of four in a desktop popover), from this many of
// each group (fewer than Home's page).
const JUMP_BACK_IN_ROWS = 8;
const PANEL_PER_GROUP = 4;
// The recent ones asked past PANEL_PER_GROUP: JUMP_BACK_IN_ROWS of them and one for the open item.
const PANEL_RECENT_EXTRA = JUMP_BACK_IN_ROWS + 1 - PANEL_PER_GROUP;
const live = (i: ShownItem) => i.trashedAt === null;
const notHidden = (i: ShownItem) => live(i) && !i.hiddenFromRecent;
// The index's item, or one kept only in this browser (which has no app: it is the host's).
const isIndexed = (i: ShownItem | ThisBrowserItem): i is ShownItem => 'app' in i;

function HomeSection({
  currentId,
  onOpenExplorer,
}: {
  currentId: string | null;
  onOpenExplorer?: (view: ExplorerView) => void;
}) {
  const { client, app, filter, overlay, epoch, words } = useExplorer();
  // Most used then recent (one request): enough recent ones to fill the pane alone, plus one, so a person with no most
  // used yet, or leaving out the open item, still sees two full rows.
  const load = useMemo(
    () => jumpBackInLoader(client, app, filter, PANEL_PER_GROUP, PANEL_RECENT_EXTRA),
    [client, app, filter],
  );
  const list = useItemList({
    key: `panel-home:${filter}`,
    load,
    overlay,
    belongs: notHidden,
    epoch,
  });
  // What this browser keeps of the app's, opened here: Jump Back In's by the page's rule.
  const { live: local } = useThisBrowserItems();
  const localOpened = useMemo(() => local.filter((i) => i.lastOpenedAt !== null), [local]);
  if (list.error)
    return (
      <PaneFailed
        message="Home could not load. Check your connection and try again."
        onRetry={list.retry}
      />
    );
  if (list.loading) return <PaneSkeleton rows={6} />;
  // The index's most used first, then its recent with this browser's opened ones merged in by last open, as the
  // page's Home does (mergeOpened); the open item left out of both.
  const others = list.items.filter((i) => i.id !== currentId);
  const recent = [
    ...others.filter(isMostUsed),
    ...mergeOpened(
      others.filter((i) => !isMostUsed(i)),
      localOpened.filter((i) => i.id !== currentId),
      JUMP_BACK_IN_ROWS,
    ),
  ].slice(0, JUMP_BACK_IN_ROWS);
  // Empty only because the open item is left out: there is one, just no other.
  const onlyOpen =
    recent.length === 0 &&
    (list.items.some((i) => i.id === currentId) || localOpened.some((i) => i.id === currentId));
  return (
    <div className="flex flex-col gap-6">
      <PaneSection
        title="Jump Back In"
        action={
          <a
            href={explorerPath({ kind: 'recent' })}
            onClick={
              onOpenExplorer
                ? (e) => {
                    e.preventDefault();
                    onOpenExplorer({ kind: 'recent' });
                  }
                : undefined
            }
            className={PANE_LINK}
          >
            See all
          </a>
        }
      >
        {recent.length ? (
          <PaneGrid label="Jump Back In">
            {recent.map((item) =>
              isIndexed(item) ? (
                <JumpBackInCard key={item.id} item={item} />
              ) : (
                <PanelLocalCard key={item.id} item={item} />
              ),
            )}
          </PaneGrid>
        ) : (
          <PaneEmpty
            icon={<ClockIcon />}
            title={onlyOpen ? 'Nothing else yet' : `No ${words.lowerMany} yet`}
            description={
              onlyOpen
                ? `The other ${words.lowerMany} you use most and last will gather here.`
                : `The ${words.lowerMany} you use most and last will gather here.`
            }
          />
        )}
      </PaneSection>
    </div>
  );
}

function Preview({ item, size }: { item: ShownItem; size: 'row' | 'card' }) {
  const { renderThumbnail } = useExplorer();
  const thumb = renderThumbnail?.(item, size);
  if (thumb)
    return (
      <span className={`block ${size === 'card' ? PANE_PREVIEW_BOX : PANE_THUMB_BOX}`}>
        {thumb}
      </span>
    );
  return (
    <span
      className={`flex items-center justify-center text-slate-300 dark:text-slate-600 ${
        size === 'card' ? `${PANE_PREVIEW_BOX} [&_svg]:h-7 [&_svg]:w-7` : PANE_THUMB_BOX
      }`}
    >
      <ItemIcon size={size === 'card' ? 28 : 16} />
    </span>
  );
}

function usePaneItemMenu(item: ShownItem) {
  const menu = useRowMenu();
  const name = item.title || 'Untitled';
  return {
    onContextMenu: menu.onContextMenu,
    trailing: (
      <>
        <EllipsisTriggerButton {...menu.triggerProps} size="md" reveal label={`Menu for ${name}`} />
        {menu.open ? (
          <ItemMenu item={item} anchor={menu.triggerRef.current} onClose={menu.close} />
        ) : null}
      </>
    ),
  };
}

const JumpBackInCard = memo(function JumpBackInCard({ item }: { item: ShownItem }) {
  const { openItem, filter, kind, actions, renamingId, setRenamingId } = useExplorer();
  const menu = usePaneItemMenu(item);
  const editing = renamingId === item.id;
  const drag = useItemDrag(item, editing);
  const now = useNow();
  const name = item.title || `Untitled ${kind.lowerOne}`;
  const commit = (next: string) => {
    setRenamingId(null);
    void actions.rename(item, next);
  };
  return (
    <PaneCard
      preview={<Preview item={item} size="card" />}
      title={
        editing ? (
          <InlineRenameInput
            initial={item.title}
            ariaLabel={`Rename ${name}`}
            onCommit={commit}
            onCancel={() => setRenamingId(null)}
            className="w-full rounded border border-brand-300 bg-white px-1.5 py-0.5 text-[13px] dark:border-brand-500/50 dark:bg-slate-900 dark:text-slate-100"
          />
        ) : (
          name
        )
      }
      label={name}
      meta={
        <span className="flex items-center gap-1.5">
          {filter === 'all' ? <AppMark app={item.app} size={12} /> : null}
          <span className="truncate">{jumpBackInLine(item, now || Date.now())}</span>
        </span>
      }
      onActivate={editing ? undefined : () => openItem(item)}
      rowProps={{ onContextMenu: menu.onContextMenu, ...drag }}
      trailing={editing ? null : menu.trailing}
    />
  );
});

// ---- A place: Shared With Me, My Work, a team, Favourites -------------------------------------------------

function PlaceSection({
  section,
  folderId,
  onOpenFolder,
  currentId,
  rootLabel,
  pendingRename,
}: {
  section: Exclude<PanelSection, { kind: 'home' } | { kind: 'inbox' } | { kind: 'trash' }>;
  folderId: string | null;
  onOpenFolder: (id: string | null) => void;
  currentId: string | null;
  rootLabel: string;
  pendingRename: React.MutableRefObject<((id: string) => void) | null>;
}) {
  const { client, app, filter, overlay, epoch, placedEpoch, folders, words, setRenamingId } =
    useExplorer();
  const sharedMeta = useRef(new Map());
  const view = paneView(section, folderId);
  const list = useMemo(
    () => viewList(client, view, app, filter, sharedMeta.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, app, filter, view.kind, 'id' in view ? view.id : null, folderId],
  );
  const state = useItemList({
    key: list?.key ?? 'none',
    load: list?.load ?? (async () => ({ items: [], nextCursor: null })),
    overlay,
    belongs: list?.belongs,
    cap: list?.cap,
    epoch,
    enabled: Boolean(list?.enabled),
  });
  // A folder just made opens renaming.
  useEffect(() => {
    pendingRename.current = (id) => setRenamingId(id);
    return () => {
      pendingRename.current = null;
    };
  }, [pendingRename, setRenamingId]);

  const teamId = section.kind === 'team' ? section.id : null;
  const space = section.kind === 'mine' || section.kind === 'team';
  const folderRows = space ? folders.childrenOf(folderId, teamId) : [];
  // What is inside each folder card, for its count: one request for the cards shown.
  const previews = useFolderPreviews({
    client,
    folderIds: folderRows.map((f) => f.id),
    app: filter === 'all' ? null : app,
    epoch,
    placedEpoch,
  });
  const trail: Folder[] = [];
  for (
    let f = folderId ? folders.byId.get(folderId) : undefined;
    f;
    f = f.parentId ? folders.byId.get(f.parentId) : undefined
  )
    trail.unshift(f);
  const here = trail.at(-1)?.name ?? rootLabel;

  // Empty in this app, a folder may still hold other apps' items: the pane says so (useOtherApps).
  const emptyView: ExplorerView = folderId ? { kind: 'folder', id: folderId } : view;
  const others = useOtherApps({
    client,
    view: emptyView,
    app,
    enabled:
      space &&
      filter === 'app' &&
      !state.loading &&
      !state.error &&
      !folders.loading &&
      folderRows.length + state.items.length === 0,
    epoch,
  });

  let content: ReactNode;
  if (state.error) {
    content = <PaneFailed message="This list could not load." onRetry={state.retry} />;
  } else if (state.loading || (space && folders.loading)) {
    content = <PaneSkeleton />;
  } else if (folderRows.length + state.items.length === 0 && others) {
    content = <OtherAppsHere view={emptyView} others={others} compact />;
  } else if (folderRows.length + state.items.length === 0) {
    const copy = emptyCopy(emptyView, words);
    content = <PaneEmpty icon={copy.icon} title={copy.title} description={copy.description} />;
  } else {
    content = (
      // Keyed by the folder open, so opening one slides its contents in.
      <div key={folderId ?? 'root'} className="flex animate-view-forward flex-col gap-3">
        {folderRows.length ? (
          <PaneGrid label={`Folders in ${here}`}>
            {folderRows.map((f) => (
              <FolderCard
                key={f.id}
                folder={f}
                itemCount={previews.get(f.id)?.itemCount}
                elsewhere={previews.get(f.id)?.elsewhere?.itemCount}
                onOpen={() => onOpenFolder(f.id)}
              />
            ))}
          </PaneGrid>
        ) : null}
        {state.items.length ? (
          <PaneList label={here}>
            {state.items.map((item) => (
              <ItemRow key={item.id} item={item} current={item.id === currentId} />
            ))}
          </PaneList>
        ) : null}
        {state.hasMore ? (
          <Button
            variant="none"
            busy={state.loadingMore}
            onClick={state.moreFailed ? state.retryMore : state.loadMore}
            className={`${PANE_LINK} self-center py-1`}
          >
            {state.loadingMore
              ? 'Loading…'
              : state.moreFailed
                ? 'Couldn’t load more. Try again'
                : 'Show more'}
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      {trail.length ? (
        <BackBar
          gap="tight"
          label={trail.at(-2)?.name ?? rootLabel}
          current={trail.at(-1)!.name}
          onClick={() => onOpenFolder(trail.at(-2)?.id ?? null)}
        />
      ) : null}
      {content}
    </div>
  );
}

const FolderCard = memo(function FolderCard({
  folder,
  itemCount,
  elsewhere,
  onOpen,
}: {
  folder: Folder;
  // How many items it holds, once the index has said.
  itemCount?: number;
  // With none of this app's, how many other apps' items it holds (useFolderPreviews).
  elsewhere?: number;
  onOpen: () => void;
}) {
  const { folders, renamingId, setRenamingId, words } = useExplorer();
  const editing = renamingId === folder.id;
  const menu = useRowMenu({ disabled: editing });
  const drop = useDropTarget({ teamId: folder.teamId, folderId: folder.id });
  const drag = useFolderDrag(folder, editing);
  const own = folderCountLabel(
    folders.childrenOf(folder.id, folder.teamId).length,
    elsewhere ? undefined : itemCount,
    words,
  );
  // "2 folders · 3 in other apps": a folder of another app's items never reads as empty.
  const count = elsewhere
    ? own === 'Folder'
      ? elsewhereLabel(elsewhere)
      : `${own} · ${elsewhereLabel(elsewhere)}`
    : own;
  const commit = (name: string) => {
    const next = name.trim();
    if (next && next !== folder.name) void folders.rename(folder.id, next);
    setRenamingId(null);
  };
  return (
    <PaneCard
      preview={<FolderPreview icon={<FolderSolidIcon />} count={count} />}
      title={
        editing ? (
          <InlineRenameInput
            initial={folder.name}
            ariaLabel={`Rename ${folder.name}`}
            onCommit={commit}
            onCancel={() => setRenamingId(null)}
            className="w-full rounded border border-brand-300 bg-white px-1.5 py-0.5 text-[13px] dark:border-brand-500/50 dark:bg-slate-900 dark:text-slate-100"
          />
        ) : (
          folder.name
        )
      }
      label={folder.name}
      onActivate={editing ? undefined : onOpen}
      rowProps={{ onContextMenu: menu.onContextMenu, ...drop.handlers, ...drag }}
      highlighted={drop.over}
      trailing={
        editing ? null : (
          <>
            <EllipsisTriggerButton
              {...menu.triggerProps}
              size="md"
              reveal
              label={`Menu for ${folder.name}`}
            />
            {menu.open ? (
              <FolderMenu folder={folder} anchor={menu.triggerRef.current} onClose={menu.close} />
            ) : null}
          </>
        )
      }
    />
  );
});

const ItemRow = memo(function ItemRow({ item, current }: { item: ShownItem; current: boolean }) {
  const { openItem, filter, kind, actions, renamingId, setRenamingId, renderItemMark } =
    useExplorer();
  const menu = usePaneItemMenu(item);
  const now = useNow();
  const name = item.title || `Untitled ${kind.lowerOne}`;
  // The open item renames on its card on top, never twice.
  const editing = renamingId === item.id && !current;
  const drag = useItemDrag(item, editing);
  const commit = (next: string) => {
    const trimmed = next.trim();
    if (trimmed && trimmed !== item.title) void actions.rename(item, trimmed);
    setRenamingId(null);
  };
  return (
    <PaneRow
      leading={<Preview item={item} size="row" />}
      title={
        editing ? (
          <InlineRenameInput
            initial={item.title}
            ariaLabel={`Rename ${name}`}
            onCommit={commit}
            onCancel={() => setRenamingId(null)}
            className="w-full rounded border border-brand-300 bg-white px-1.5 py-0.5 text-[13px] dark:border-brand-500/50 dark:bg-slate-900 dark:text-slate-100"
          />
        ) : (
          <span className="flex min-w-0 items-center gap-1">
            {filter === 'all' ? <AppMark app={item.app} size={12} /> : null}
            {item.favourite ? <FavouriteMarker /> : null}
            {renderItemMark?.(item, 'title')}
            <span className="min-w-0 truncate">{name}</span>
          </span>
        )
      }
      label={name}
      meta={`Updated ${relativeSince(item.updatedAt, now || Date.now())}`}
      current={current}
      onActivate={editing ? undefined : () => openItem(item)}
      rowProps={{ onContextMenu: menu.onContextMenu, ...drag }}
      trailing={editing ? null : menu.trailing}
    />
  );
});

// ---- The Trash ------------------------------------------------------------------------------------------

function TrashSection() {
  const { client, app, filter, overlay, epoch, actions, teamName, words, kind } = useExplorer();
  const list = useMemo(
    () => viewList(client, { kind: 'trash' }, app, filter),
    [client, app, filter],
  );
  const state = useItemList({
    key: list?.key ?? 'trash',
    load: list!.load,
    overlay,
    belongs: list?.belongs,
    epoch,
  });
  const now = useNow();
  const [confirming, setConfirming] = useState<ShownItem | null>(null);
  if (state.error) return <PaneFailed message="The Trash could not load." onRetry={state.retry} />;
  if (state.loading) return <PaneSkeleton rows={4} />;
  const groups = trashGroups(state.items, teamName, words);
  if (!groups.length) {
    const copy = emptyCopy({ kind: 'trash' }, words);
    return <PaneEmpty icon={copy.icon} title={copy.title} description={copy.description} />;
  }
  return (
    <div className="flex flex-col gap-5">
      <p className="px-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
        Deleted {words.lowerMany} wait here for 30 days. Restoring one puts it back where it was.
      </p>
      {groups.map((group) => (
        <PaneSection key={group.key} title={group.title}>
          <PaneList label={group.title}>
            {group.rows.map((row) => (
              <PaneRow
                key={row.id}
                leading={
                  <PaneTile tone="rose">
                    <ItemIcon />
                  </PaneTile>
                }
                title={row.title || `Untitled ${kind.lowerOne}`}
                meta={`${trashedOnLabel(row)} · ${daysLeftLabel(row.trashedAt ?? 0, now || Date.now())}`}
                trailing={
                  <>
                    <PaneIconButton label="Restore" onClick={() => void actions.restore(row)}>
                      <RestoreIcon />
                    </PaneIconButton>
                    <PaneIconButton
                      label="Delete Forever"
                      tone="danger"
                      onClick={() => setConfirming(row)}
                    >
                      <TrashIcon />
                    </PaneIconButton>
                  </>
                }
              />
            ))}
          </PaneList>
        </PaneSection>
      ))}
      {state.hasMore ? (
        <Button
          variant="none"
          busy={state.loadingMore}
          onClick={state.moreFailed ? state.retryMore : state.loadMore}
          className={`${PANE_LINK} self-center py-1`}
        >
          {state.loadingMore
            ? 'Loading…'
            : state.moreFailed
              ? 'Couldn’t load more. Try again'
              : 'Show more'}
        </Button>
      ) : null}
      {confirming ? (
        <ConfirmDialog
          open
          // The Explorer page's own confirmation (TrashPane), word for word.
          title={`Delete “${confirming.title || 'Untitled'}” for good?`}
          message="This cannot be undone."
          confirmLabel="Delete permanently"
          onConfirm={() => {
            void actions.purge(confirming);
            setConfirming(null);
          }}
          onCancel={() => setConfirming(null)}
        />
      ) : null}
    </div>
  );
}

// ---- A team's Members dialog ---------------------------------------------------------------------------

// The team card, as the page shows it over the team's library: read when the dialog opens. Leaving or deleting the
// team closes it and goes Home.
function TeamMembersDialog({
  teamId,
  teamName,
  onClose,
}: {
  teamId: string;
  teamName: string;
  onClose: () => void;
}) {
  const { viewerId, helpHref, navigate } = useExplorer();
  const [load, reload] = useTeamDetails(teamId);
  return (
    <Dialog onClose={onClose} ariaLabel={`${teamName} members`} size="lg">
      <DialogHeader title={teamName} subtitle="Members">
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="px-5 py-4" data-team-members-dialog={teamId}>
        {load.state === 'found' ? (
          <TeamCard
            details={load.details}
            reload={reload}
            viewerId={viewerId}
            helpHref={helpHref?.({ kind: 'team', id: teamId })}
            onGone={() => {
              onClose();
              navigate({ kind: 'home' });
            }}
          />
        ) : load.state === 'loading' ? (
          <PaneSkeleton rows={3} />
        ) : (
          <PaneEmpty
            icon={<TeamIcon size={22} />}
            title={load.state === 'gone' ? 'Team not found' : 'The team could not load'}
            description={
              load.state === 'gone'
                ? 'This team doesn’t exist, or you’re not a member of it.'
                : 'Check your connection and try again.'
            }
          />
        )}
      </div>
    </Dialog>
  );
}
