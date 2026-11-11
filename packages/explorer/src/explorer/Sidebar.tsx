'use client';

// The Explorer's sidebar (liveplanner's ExplorerSidebar): Overview (Home, Inbox, Shared With Me), Spaces (My Work
// and its folders, each team and its folders, This Browser and its folders while it holds anything), and More (the
// Library: Recent, Timeline, Favourites, the host's Gallery and Shape Libraries, Archived and the Trash; then the
// host's own rows). Rows carry toned
// tiles and the current row is a raised pill, in the host app's brand colour. The tree reads the folder store, so it
// costs no request of its own. The current view's rows are always open: its space and folders, or the Library.
//
// It is one keyboard tree (sidebar/useTreeNavigation): one tab stop, arrows, Home and End, Left and Right to fold and
// open, type-ahead. Folder rows and My Work carry a menu (⋯, right-click, Shift+F10) and rename in place.
import {
  useId,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { TIMELINE_NEW_CAP, type Folder } from '@liveworkspace/index-client';
import { TRASH_BIN, TRASH_OVER, TRASH_WAITING, useTrashTarget, type DropPlace } from '../drag/drag';
import {
  ClockIcon,
  FolderSolidIcon,
  HomeIcon,
  InboxIcon,
  LibraryIcon,
  MyWorkIcon,
  PlusIcon,
  ShareIcon,
  StarIcon,
  TeamIcon,
  TimelineIcon,
  TrashIcon,
  ArchiveIcon,
} from '../ui/icons';
import { inboxCount } from '../data/useInbox';
import { InlineRenameInput } from '../ui/InlineRenameInput';
import { explorerPath, sameView, SIDEBAR_LABELS, withLens, type ExplorerView } from '../views';
import { useExplorer } from './context';
import { BrowserIcon, useHostExtras } from './host';
import { ThisBrowserSpaceRow } from './this-browser-space/ThisBrowserSpaceRow';
import { DefaultFolderMarker } from '../defaults/DefaultFolderMarker';
import { LIBRARY, MY_WORK, rowsAbove, teamKey, type Expansion } from './sidebar/expansion';
import { useDragHoverOpen } from './sidebar/useDragHoverOpen';
import { useFolderRowMenu, useMyWorkMenu } from './sidebar/rowMenus';
import { useTreeNavigation } from './sidebar/useTreeNavigation';
import { useExtras } from './extras';
import { useTeams } from '../teams/context';
import { NewTeamDialog } from '../teams/NewTeamDialog';
import { SidebarSignInNudge, teamMemberBadge } from './SidebarSignInNudge';
import { ImageIcon, MailIcon, ShapesIcon } from '../ui/library-icons';
import { useLibraryHost } from '../library/context';
import { SIDEBAR_RENAME_FIELD, type SidebarRename, SidebarRow } from './SidebarRow';

export { SIDEBAR_RENAME_FIELD, SidebarRow } from './SidebarRow';

// The Library's pages: opening one unfolds the Library, so the current row is never hidden.
const LIBRARY_VIEWS: ReadonlySet<ExplorerView['kind']> = new Set([
  'recent',
  'timeline',
  'favourites',
  'gallery',
  'shape-libraries',
  'archived',
  'trash',
]);

/** The rows to open so the current view's own row shows: the Library for one of its pages, a space for its page,
 *  and a space and every folder down to it for a folder (rowsAbove). Empty for a view with no row inside a fold. */
export function rowsForView(view: ExplorerView, byId: Parameters<typeof rowsAbove>[1]): string[] {
  if (LIBRARY_VIEWS.has(view.kind)) return [LIBRARY];
  if (view.kind === 'all') return [MY_WORK];
  if (view.kind === 'folder') return rowsAbove(view.id, byId);
  if (view.kind === 'team')
    return view.folderId
      ? [...new Set([teamKey(view.id), ...rowsAbove(view.folderId, byId)])]
      : [teamKey(view.id)];
  return [];
}

/** Opens the current view's rows (rowsForView) as it changes, before paint: only ever adds to what is open, and once
 *  per change of the rows it needs, so a row the person folds stays folded until the view (or its place) changes. */
export function useOpenCurrentRows(
  view: ExplorerView,
  byId: Parameters<typeof rowsAbove>[1],
  expansion: Pick<Expansion, 'expand'>,
): void {
  const rows = rowsForView(view, byId).join('\n');
  // The view's place, its lens left out: typing in the field is no change of view.
  const place = explorerPath(withLens(view, ''));
  useLayoutEffect(() => {
    if (rows) expansion.expand(...rows.split('\n'));
  }, [rows, place, expansion]);
}

const START_FOLDS: ReadonlySet<string> = new Set([MY_WORK]);
const startFolds = () => START_FOLDS;

/** The open rows, from the Explorer's expansion store: read as the sidebar first renders, so it paints open where it
 *  was left. The Library opens before paint when one of its pages is current, so the current row is never hidden. */
function useExpanded(view: ExplorerView) {
  const { expansion, folders } = useExplorer();
  const expanded = useSyncExternalStore(expansion.subscribe, expansion.get, startFolds);
  useOpenCurrentRows(view, folders.byId, expansion);
  return { expanded, toggle: expansion.toggle, expand: expansion.expand };
}

/** A sidebar row's rename field, in place of its name: an account folder's and a local one's. */
function SidebarGroup({
  title,
  first = false,
  children,
  after,
}: {
  title: string;
  first?: boolean;
  children: ReactNode;
  // Below the group's rows, outside its tree: a tree holds only treeitems (and their groups), so a link there is
  // read as a broken tree.
  after?: ReactNode;
}) {
  const id = useId();
  return (
    <section>
      <h2
        id={id}
        className={`box-content h-4 px-2.5 pb-2 text-[11px] font-semibold uppercase leading-4 tracking-[0.1em] text-slate-500 dark:text-slate-400 ${
          first ? '' : 'mt-6 pt-1'
        }`}
      >
        {title}
      </h2>
      <ul role="tree" aria-labelledby={id}>
        {children}
      </ul>
      {after}
    </section>
  );
}

function FolderSubtree({
  folder,
  depth,
  expanded,
  toggle,
  rename,
}: {
  folder: Folder;
  depth: number;
  expanded: ReadonlySet<string>;
  toggle: (key: string) => void;
  rename: SidebarRename;
}) {
  const { folders, view, navigate } = useExplorer();
  const kids = folders.childrenOf(folder.id, folder.teamId);
  const target: ExplorerView = folder.teamId
    ? { kind: 'team', id: folder.teamId, folderId: folder.id }
    : { kind: 'folder', id: folder.id };
  const renaming = rename.renamingId === folder.id;
  const menu = useFolderRowMenu(folder, { renaming, onRename: rename.setRenamingId });
  return (
    <SidebarRow
      icon={<FolderSolidIcon open={expanded.has(folder.id)} />}
      label={folder.name}
      onContextMenu={menu.onContextMenu}
      trailing={menu.trailing}
      renaming={
        renaming ? (
          <InlineRenameInput
            initial={folder.name}
            ariaLabel={`Rename ${folder.name}`}
            onCommit={(name) => {
              rename.setRenamingId(null);
              const next = name.trim();
              if (next && next !== folder.name) void folders.rename(folder.id, next);
            }}
            onCancel={() => rename.setRenamingId(null)}
            className={SIDEBAR_RENAME_FIELD}
          />
        ) : null
      }
      selected={sameView(view, target)}
      onActivate={() => navigate(target)}
      depth={depth}
      dropTo={{ teamId: folder.teamId, folderId: folder.id }}
      dragFolder={folder}
      marker={<DefaultFolderMarker folderId={folder.id} />}
      expandable={kids.length > 0}
      expanded={expanded.has(folder.id)}
      onToggleExpand={() => toggle(folder.id)}
    >
      {kids.map((f) => (
        <FolderSubtree
          key={f.id}
          folder={f}
          depth={depth + 1}
          expanded={expanded}
          toggle={toggle}
          rename={rename}
        />
      ))}
    </SidebarRow>
  );
}

const MY_WORK_ROOT: DropPlace = { teamId: null, folderId: null };

/**
 * The Trash row: it opens the Trash, and while anything drags in the Explorer it wakes as a target (dashed, "Drop to
 * Trash"), fills with the brand colour with its bin's lid tipped while the drag is over it ("Let go to trash it"),
 * and bounces once as it swallows an item. Under reduced motion only the colours and words change.
 */
function TrashRow({ depth = 0 }: { depth?: number }) {
  const { view, navigate } = useExplorer();
  const trash = useTrashTarget();
  return (
    <SidebarRow
      icon={
        <span
          data-trash-bin={trash.state}
          className={`flex transition-transform duration-short ease-out ${TRASH_BIN[trash.state]}`}
        >
          <TrashIcon />
        </span>
      }
      label={SIDEBAR_LABELS.trash}
      shownLabel={
        <>
          <span
            className={
              trash.state === 'over'
                ? 'font-semibold text-white'
                : trash.state === 'waiting'
                  ? 'text-brand-800 dark:text-brand-200'
                  : ''
            }
          >
            {trash.words ?? SIDEBAR_LABELS.trash}
          </span>
          {/* The target's words for assistive technology, as they change; the row keeps its name, Trash. */}
          <span role="status" aria-live="polite" className="sr-only">
            {trash.words ?? ''}
          </span>
        </>
      }
      selected={view.kind === 'trash'}
      onActivate={() => navigate({ kind: 'trash' })}
      depth={depth}
      rowClassName={
        trash.state === 'over' ? TRASH_OVER : trash.state === 'waiting' ? TRASH_WAITING : ''
      }
      rowHandlers={trash.handlers}
    />
  );
}

/** The Timeline row's count: what others did since the person last looked, capped by the index at 99. */
export function timelineBadge(count: number | undefined): {
  badge?: string;
  badgeLabel?: string;
  badgeTone?: 'brand';
} {
  if (!count) return {};
  const shown = count > TIMELINE_NEW_CAP ? `${TIMELINE_NEW_CAP}+` : String(count);
  return { badge: shown, badgeLabel: `${shown} new`, badgeTone: 'brand' };
}

export function Sidebar() {
  const { view, navigate, folders, teams, inbox, viewerId } = useExplorer();
  const { sidebarLinks } = useHostExtras();
  const library = useLibraryHost();
  const { expanded, toggle, expand } = useExpanded(view);
  const libraryOpen = expanded.has(LIBRARY);
  // A drag resting on the folded Library opens it, so the Trash inside is in reach.
  const libraryDrag = useDragHoverOpen(libraryOpen ? null : () => expand(LIBRARY));
  const timeline = timelineBadge(inbox.data?.timelineNew);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const rename: SidebarRename = { renamingId, setRenamingId };
  const myWorkMenu = useMyWorkMenu({ onRename: setRenamingId });
  const navRef = useRef<HTMLElement>(null);
  const tree = useTreeNavigation(navRef);
  const { sharedCount, signedIn, signInHref } = useExtras();
  const { myTeams, canRun } = useTeams();
  const [newTeam, setNewTeam] = useState(false);
  const memberCounts = useMemo(
    () => new Map(myTeams?.teams.map((t) => [t.id, t.memberCount])),
    [myTeams],
  );
  const invites = myTeams?.invitations.length ?? 0;
  const is = (v: ExplorerView) => sameView(view, v);
  const myRoots = folders.childrenOf(null, null);
  return (
    <nav
      ref={navRef}
      aria-label="Sections"
      className="text-sm"
      onKeyDown={tree.onKeyDown}
      onFocus={tree.onFocus}
      onBlur={tree.onBlur}
    >
      <SidebarGroup title="Overview" first>
        <SidebarRow
          icon={<HomeIcon />}
          tone="sky"
          label={SIDEBAR_LABELS.home}
          selected={view.kind === 'home'}
          onActivate={() => navigate({ kind: 'home' })}
          depth={0}
        />
        <SidebarRow
          icon={<InboxIcon />}
          tone="violet"
          label={SIDEBAR_LABELS.inbox}
          selected={view.kind === 'inbox'}
          onActivate={() => navigate({ kind: 'inbox' })}
          depth={0}
          badge={inboxCount(inbox.data, viewerId)}
        />
        <SidebarRow
          icon={<ShareIcon />}
          tone="emerald"
          label={SIDEBAR_LABELS.shared}
          selected={view.kind === 'shared'}
          onActivate={() => navigate({ kind: 'shared' })}
          depth={0}
          badge={sharedCount}
          badgeLabel={sharedCount === undefined ? undefined : `${sharedCount} shared with you`}
        />
      </SidebarGroup>
      <SidebarGroup
        title="Spaces"
        after={!signedIn && signInHref ? <SidebarSignInNudge href={signInHref} /> : null}
      >
        <SidebarRow
          icon={<MyWorkIcon />}
          tone="sky"
          label={SIDEBAR_LABELS.myWork}
          selected={view.kind === 'all'}
          onActivate={() => navigate({ kind: 'all' })}
          depth={0}
          dropTo={MY_WORK_ROOT}
          expandable={myRoots.length > 0}
          expanded={expanded.has(MY_WORK)}
          onToggleExpand={() => toggle(MY_WORK)}
          onContextMenu={myWorkMenu.onContextMenu}
          trailing={myWorkMenu.trailing}
        >
          {myRoots.map((f) => (
            <FolderSubtree
              key={f.id}
              folder={f}
              depth={1}
              expanded={expanded}
              toggle={toggle}
              rename={rename}
            />
          ))}
        </SidebarRow>
        {teams.map((t) => {
          const roots = folders.childrenOf(null, t.id);
          const key = teamKey(t.id);
          return (
            <SidebarRow
              key={t.id}
              icon={<TeamIcon />}
              tone="indigo"
              label={t.name}
              selected={view.kind === 'team' && view.id === t.id && !view.folderId}
              onActivate={() => navigate({ kind: 'team', id: t.id })}
              depth={0}
              dropTo={{ teamId: t.id, folderId: null }}
              expandable={roots.length > 0}
              expanded={expanded.has(key)}
              onToggleExpand={() => toggle(key)}
              {...teamMemberBadge(memberCounts.get(t.id))}
            >
              {roots.map((f) => (
                <FolderSubtree
                  key={f.id}
                  folder={f}
                  depth={1}
                  expanded={expanded}
                  toggle={toggle}
                  rename={rename}
                />
              ))}
            </SidebarRow>
          );
        })}
        {/* While this browser holds anything (one-explorer.md "This Browser, a Space"). */}
        <ThisBrowserSpaceRow expanded={expanded} toggle={toggle} rename={rename} />
        {/* Shown while an invitation waits, or while its view is open, so the highlight never vanishes. */}
        {signedIn && (invites > 0 || view.kind === 'invites') ? (
          <SidebarRow
            icon={<MailIcon />}
            tone="violet"
            label={SIDEBAR_LABELS.invites}
            selected={view.kind === 'invites'}
            onActivate={() => navigate({ kind: 'invites' })}
            depth={0}
            badge={invites || undefined}
            badgeLabel={`${invites} waiting`}
            badgeTone="brand"
          />
        ) : null}
        {!signedIn && signInHref ? null : canRun ? (
          <SidebarRow
            icon={<PlusIcon />}
            label={SIDEBAR_LABELS.newTeam}
            selected={false}
            onActivate={() => setNewTeam(true)}
            depth={0}
          />
        ) : null}
        {newTeam ? (
          <NewTeamDialog
            onClose={() => setNewTeam(false)}
            onMade={(team) => navigate({ kind: 'team', id: team.id })}
          />
        ) : null}
      </SidebarGroup>
      <SidebarGroup title="More">
        <SidebarRow
          icon={<LibraryIcon />}
          label={SIDEBAR_LABELS.library}
          selected={false}
          onActivate={() => toggle(LIBRARY)}
          depth={0}
          expandable
          expanded={libraryOpen}
          onToggleExpand={() => toggle(LIBRARY)}
          rowHandlers={libraryDrag}
          // Folded, the Library carries the Timeline's count, so it is never hidden.
          {...(libraryOpen ? {} : timeline)}
        >
          <SidebarRow
            icon={<ClockIcon />}
            label="Recent"
            selected={is({ kind: 'recent' })}
            onActivate={() => navigate({ kind: 'recent' })}
            depth={1}
          />
          <SidebarRow
            icon={<TimelineIcon />}
            label={SIDEBAR_LABELS.timeline}
            selected={view.kind === 'timeline'}
            onActivate={() => navigate({ kind: 'timeline' })}
            depth={1}
            {...timeline}
          />
          <SidebarRow
            icon={<StarIcon />}
            label="Favourites"
            selected={is({ kind: 'favourites' })}
            onActivate={() => navigate({ kind: 'favourites' })}
            depth={1}
          />
          {/* The host's Library pages (livediagram's), where it has them. */}
          {library.gallery ? (
            <SidebarRow
              icon={<ImageIcon />}
              label={SIDEBAR_LABELS.gallery}
              selected={view.kind === 'gallery'}
              onActivate={() => navigate({ kind: 'gallery' })}
              depth={1}
            />
          ) : null}
          {library.shapeLibraries ? (
            <SidebarRow
              icon={<ShapesIcon />}
              label={SIDEBAR_LABELS.shapeLibraries}
              selected={view.kind === 'shape-libraries'}
              onActivate={() => navigate({ kind: 'shape-libraries' })}
              depth={1}
            />
          ) : null}
          {/* No menu, no rename, no drops: a place of its own, out of every list. */}
          <SidebarRow
            icon={<ArchiveIcon />}
            label={SIDEBAR_LABELS.archived}
            selected={view.kind === 'archived'}
            onActivate={() => navigate({ kind: 'archived' })}
            depth={1}
          />
          <TrashRow depth={1} />
        </SidebarRow>
        {/* The host's own rows (This Browser's hand-off on liveworkspace.app): each leaves for its page. */}
        {sidebarLinks.map((link) => (
          <SidebarRow
            key={link.id}
            icon={link.icon === 'browser' ? <BrowserIcon /> : <LibraryIcon />}
            tone={link.icon === 'browser' ? 'teal' : undefined}
            label={link.label}
            selected={false}
            onActivate={() => window.location.assign(link.href)}
            depth={0}
          />
        ))}
      </SidebarGroup>
    </nav>
  );
}
