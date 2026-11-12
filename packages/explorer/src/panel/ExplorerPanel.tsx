'use client';

// The editor's floating Explorer panel, drawn as liveplanner's was before it moved onto the index
// (components/panels/Explorer.tsx with its explorer-panel/ and explorer-tree/ parts): the open item's card with the
// host's notice under it, then a rail of sections beside a pane (a row of chips over the pane when stacked). The
// pane names its section in full, offers New Folder (an icon) in a space, and shows Home's Most Used and Recent, the Inbox, a
// space's folders and items, Favourites, This Browser or the Trash. Only where the data comes from changed: it
// shares the full Explorer's data layer, so a rename or a star shows here at once and every list is one request a
// page, read only while its section is shown.

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { type App, type IndexClient, type Item } from '@liveworkspace/index-client';
import { ExplorerProvider } from '../explorer/context';
import { appHasInbox } from '../inbox-apps';
import { ExplorerDialogs } from '../explorer/Dialogs';
import { HostExtrasProvider, type ExplorerHostExtras } from '../explorer/host';
import { PeopleProvider } from '../explorer/extras';
import type { ExplorerAccounts } from '../data/accounts';
import {
  useThisBrowserFolders,
  useThisBrowserItems,
  type ThisBrowserHost,
} from '../explorer/ThisBrowser';
import { ToastProvider } from '../ui/Toasts';
import { LibraryHostProvider, useLibraryHost } from '../library/context';
import type { LibraryHostProps } from '../library/types';
import { useLatest } from '../ui/useLatest';
import type { ExplorerView } from '../views';
import type { TeamsHost } from '../data/teams';
import { TeamsProvider, useTeams } from '../teams/context';
import type { AppFilter } from '../words';

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
  panelSectionGroups,
  sectionKey,
  type LibraryTab,
  usePanelSection,
  type PanelSection,
} from './sections';
import { withDriveMarks } from '../drive/DriveMarks';
import { useDriveMarks, type ExplorerDriveHost } from '../drive/useDriveMarks';
import { paneView, sectionOfView } from './panel-view';
import { CurrentItem, LocalCurrentItem } from './CurrentItem';
import { Rail } from './Rail';
import { Pane } from './Pane';

export { NEW_BUTTON_CHIP, NEW_BUTTON_RAIL } from './Rail';
export { landOnPanelHome } from './TeamMembersDialog';

/**
 * How the panel lays out: `side`, the rail beside the pane (a desktop popover); `stacked`, a row of section chips
 * over the pane (a phone, or the narrow corner panel); `sheet`, stacked and filling a phone's sheet, the card
 * scrolling with the pane.
 */
export type PanelLayout = 'side' | 'stacked' | 'sheet';

/**
 * The editors' popover (liveworkspace/docs/specs/004-index/one-explorer.md "The editors' panel: its size and the
 * scrim"): up to 54rem wide, so the 13rem rail has room and the pane's compact preview cards run four across, yet a
 * third of a 1280px window's canvas stays in sight; and up to 45rem tall. Each editor's MovablePanel takes these,
 * so the size lives once. The host keeps it 1rem inside the window.
 */
export const EXPLORER_POPOVER_WIDTH = 'w-[54rem]';
export const EXPLORER_POPOVER_HEIGHT = '45rem';

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
  // The item open in the editor, shown on top and left out of Home's Most Used and Recent.
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
  const { host: localHost, live: thisBrowserLive } = useThisBrowserItems();
  const offlineCount = thisBrowserLive.length;
  // The rail shows This Browser while it holds a live item or a local folder, as the sidebar does.
  const localFolders = useThisBrowserFolders(localHost ? app : null).length;
  // The open item when the index has none for it (kept only in this browser): its card comes from This Browser.
  const localCurrent =
    !current && currentId ? (thisBrowserLive.find((i) => i.id === currentId) ?? null) : null;
  const groups = useMemo(
    () =>
      panelSectionGroups(teams, {
        library,
        thisBrowser: offlineCount > 0 || localFolders > 0,
        inbox: appHasInbox(app),
      }),
    [teams, library, offlineCount, localFolders, app],
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
