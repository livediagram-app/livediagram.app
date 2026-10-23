'use client';

// The Explorer's sidebar (liveplanner's ExplorerSidebar): Overview (Home, Inbox, Timeline, Shared With Me), Spaces
// (My Work and its folders, each team and its folders), and More (the Library's Recent, Favourites and
// Unsorted, then the Trash). Rows carry toned tiles and the current row is a raised pill, in the
// host app's brand colour. The tree reads the folder store, so it costs no request of its own.

import { useCallback, useEffect, useId, useState, type DragEvent, type ReactNode } from 'react';
import { TIMELINE_NEW_CAP, type Folder } from '@liveworkspace/index-client';
import {
  TRASH_BIN,
  TRASH_OVER,
  TRASH_WAITING,
  useDropTarget,
  useFolderDrag,
  useTrashTarget,
  type DropPlace,
} from '../drag/drag';
import { CountBadge } from '../ui/CountBadge';
import { DROP_TARGET_RING } from '../ui/classes';
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
  TreeChevronIcon,
  UnsortedIcon,
} from '../ui/icons';
import { inboxCount } from '../data/useInbox';
import { sameView, SIDEBAR_LABELS, type ExplorerView } from '../views';
import { useExplorer } from './context';
import { DefaultFolderMarker } from '../defaults/DefaultFolderMarker';

type Tone = 'sky' | 'violet' | 'amber' | 'emerald' | 'indigo' | 'rose';

const TONES: Record<Tone, string> = {
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300',
};
// liveplanner's current row and tile are violet, its brand; here they are each app's brand.
const TILE_CURRENT = 'bg-brand-600 text-white dark:bg-brand-500';
const TILE = 'grid size-6 shrink-0 place-items-center rounded-lg [&>svg]:block [&>svg]:size-3.5';
const CURRENT =
  'border-brand-200 bg-white shadow-[0_6px_18px_-8px_color-mix(in_srgb,var(--color-brand-600)_35%,transparent)] dark:border-transparent dark:bg-transparent dark:bg-gradient-to-r dark:from-brand-400/[0.18] dark:to-brand-400/[0.04] dark:shadow-none dark:ring-1 dark:ring-inset dark:ring-brand-400/35';
const RESTING = 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800';
const INDENT_STEP = 16;

const EXPANDED_KEY = 'liveworkspace:explorer-expanded';
const MY_WORK = 'my-work';
const LIBRARY = 'library';

// The Library's pages: opening one unfolds the Library, so the current row is never hidden.
const LIBRARY_VIEWS: ReadonlySet<ExplorerView['kind']> = new Set([
  'recent',
  'favourites',
  'unsorted',
]);

function useExpanded(view: ExplorerView) {
  // As livediagram's tree starts: My Work unfolded, the Library folded unless one of its pages is open.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([MY_WORK]));
  useEffect(() => {
    try {
      const saved = localStorage.getItem(EXPANDED_KEY);
      if (saved) setExpanded(new Set(JSON.parse(saved) as string[]));
    } catch {
      // Private mode or no storage: the starting folds.
    }
  }, []);
  const inLibrary = LIBRARY_VIEWS.has(view.kind);
  useEffect(() => {
    if (inLibrary) setExpanded((prev) => (prev.has(LIBRARY) ? prev : new Set([...prev, LIBRARY])));
  }, [inLibrary]);
  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem(EXPANDED_KEY, JSON.stringify([...next]));
      } catch {
        // Ignored: expansion is a convenience.
      }
      return next;
    });
  }, []);
  return { expanded, toggle };
}

export function SidebarRow({
  icon,
  tone,
  label,
  selected,
  onActivate,
  depth,
  badge,
  badgeLabel,
  badgeTone = 'neutral',
  expandable = false,
  expanded = false,
  onToggleExpand,
  dropTo = null,
  dragFolder = null,
  shownLabel,
  marker,
  rowClassName = '',
  rowHandlers,
  children,
}: {
  icon: ReactNode;
  tone?: Tone;
  label: string;
  selected: boolean;
  onActivate: () => void;
  depth: number;
  // A count, or its capped words ("99+").
  badge?: number | string;
  // What the count means, for a screen reader ("3 new"); the count alone when unset.
  badgeLabel?: string;
  badgeTone?: 'neutral' | 'brand';
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  // The place a dragged item dropped here lands in (a folder, My Work, a team); a closed row opens under a resting
  // drag.
  dropTo?: DropPlace | null;
  // The folder this row is, which drags to the Trash.
  dragFolder?: Folder | null;
  // What the row says, when it says more than its name (the Trash mid-drag); the name stays its accessible name.
  shownLabel?: ReactNode;
  // Drawn after the name (a default folder's marker).
  marker?: ReactNode;
  rowClassName?: string;
  rowHandlers?: Partial<
    Record<'onDragEnter' | 'onDragOver' | 'onDragLeave' | 'onDrop', (e: DragEvent) => void>
  >;
  children?: ReactNode;
}) {
  const drop = useDropTarget(dropTo, {
    onLongHover: expandable && !expanded ? onToggleExpand : undefined,
  });
  const drag = useFolderDrag(dragFolder);
  return (
    <li
      role="treeitem"
      aria-label={badge !== undefined ? `${label} (${badgeLabel ?? badge})` : label}
      aria-level={depth + 1}
      aria-selected={selected}
      aria-expanded={expandable ? expanded : undefined}
    >
      <div
        data-drop-over={drop.over || undefined}
        className={`group flex items-center gap-1 rounded-xl border px-1 transition ${selected ? CURRENT : RESTING} ${
          drop.over ? DROP_TARGET_RING : ''
        } ${rowClassName}`}
        style={{ paddingLeft: depth * INDENT_STEP + 4 }}
        {...drop.handlers}
        {...rowHandlers}
        {...drag}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={() => expandable && onToggleExpand?.()}
          // On a touch screen the chevron is a 44 px disclosure at the row's end, the row's full height.
          className={`flex h-5 w-5 shrink-0 items-center justify-center text-slate-400 transition pointer-coarse:order-last pointer-coarse:-mr-1 pointer-coarse:h-auto pointer-coarse:w-11 pointer-coarse:self-stretch ${
            expandable
              ? 'cursor-pointer hover:text-slate-700 dark:hover:text-slate-200'
              : 'pointer-events-none pointer-coarse:hidden'
          }`}
        >
          {expandable ? <TreeChevronIcon open={expanded} /> : null}
        </button>
        <button
          type="button"
          onClick={onActivate}
          aria-current={selected ? 'page' : undefined}
          className={`flex min-w-0 flex-1 items-center gap-2.5 rounded text-left text-sm leading-5 outline-none focus-visible:ring-2 focus-visible:ring-brand-500 pointer-coarse:text-[15px] ${
            tone ? 'py-1.5 pointer-coarse:py-2.5' : 'py-2 pointer-coarse:py-3'
          } ${
            selected
              ? 'font-semibold text-brand-900 dark:text-white'
              : 'font-medium text-slate-700 dark:text-slate-200'
          }`}
        >
          {tone ? (
            <span className={`${TILE} ${selected ? TILE_CURRENT : TONES[tone]}`}>{icon}</span>
          ) : (
            <span
              className={`shrink-0 pointer-coarse:[&_svg]:size-[17px] ${selected ? 'text-brand-600 dark:text-brand-300' : 'text-slate-400'}`}
            >
              {icon}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate">{shownLabel ?? label}</span>
          {marker}
          {badge !== undefined ? (
            <CountBadge count={badge} tone={badgeTone} className="ml-1" />
          ) : null}
        </button>
      </div>
      {expandable && expanded && children ? <ul role="group">{children}</ul> : null}
    </li>
  );
}

function SidebarGroup({
  title,
  first = false,
  children,
}: {
  title: string;
  first?: boolean;
  children: ReactNode;
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
    </section>
  );
}

function FolderSubtree({
  folder,
  depth,
  expanded,
  toggle,
}: {
  folder: Folder;
  depth: number;
  expanded: Set<string>;
  toggle: (key: string) => void;
}) {
  const { folders, view, navigate } = useExplorer();
  const kids = folders.childrenOf(folder.id, folder.teamId);
  const target: ExplorerView = folder.teamId
    ? { kind: 'team', id: folder.teamId, folderId: folder.id }
    : { kind: 'folder', id: folder.id };
  return (
    <SidebarRow
      icon={<FolderSolidIcon open={expanded.has(folder.id)} />}
      label={folder.name}
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
function TrashRow() {
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
      depth={0}
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
  const { view, navigate, folders, teams, inbox, viewerId, manageTeamsUrl } = useExplorer();
  const { expanded, toggle } = useExpanded(view);
  const is = (v: ExplorerView) => sameView(view, v);
  const myRoots = folders.childrenOf(null, null);
  return (
    <nav aria-label="Sections" className="text-sm">
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
          icon={<TimelineIcon />}
          tone="amber"
          label={SIDEBAR_LABELS.timeline}
          selected={view.kind === 'timeline'}
          onActivate={() => navigate({ kind: 'timeline' })}
          depth={0}
          {...timelineBadge(inbox.data?.timelineNew)}
        />
        <SidebarRow
          icon={<ShareIcon />}
          tone="emerald"
          label={SIDEBAR_LABELS.shared}
          selected={view.kind === 'shared'}
          onActivate={() => navigate({ kind: 'shared' })}
          depth={0}
        />
      </SidebarGroup>
      <SidebarGroup title="Spaces">
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
        >
          {myRoots.map((f) => (
            <FolderSubtree key={f.id} folder={f} depth={1} expanded={expanded} toggle={toggle} />
          ))}
        </SidebarRow>
        {teams.map((t) => {
          const roots = folders.childrenOf(null, t.id);
          const key = `team:${t.id}`;
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
            >
              {roots.map((f) => (
                <FolderSubtree
                  key={f.id}
                  folder={f}
                  depth={1}
                  expanded={expanded}
                  toggle={toggle}
                />
              ))}
            </SidebarRow>
          );
        })}
        {manageTeamsUrl ? (
          <SidebarRow
            icon={<PlusIcon />}
            label={SIDEBAR_LABELS.manageTeams}
            selected={false}
            onActivate={() => window.location.assign(manageTeamsUrl)}
            depth={0}
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
          expanded={expanded.has(LIBRARY)}
          onToggleExpand={() => toggle(LIBRARY)}
        >
          <SidebarRow
            icon={<ClockIcon />}
            label="Recent"
            selected={is({ kind: 'recent' })}
            onActivate={() => navigate({ kind: 'recent' })}
            depth={1}
          />
          <SidebarRow
            icon={<StarIcon />}
            label="Favourites"
            selected={is({ kind: 'favourites' })}
            onActivate={() => navigate({ kind: 'favourites' })}
            depth={1}
          />
          <SidebarRow
            icon={<UnsortedIcon />}
            label={SIDEBAR_LABELS.unsorted}
            selected={is({ kind: 'unsorted' })}
            onActivate={() => navigate({ kind: 'unsorted' })}
            depth={1}
          />
        </SidebarRow>
        <TrashRow />
      </SidebarGroup>
    </nav>
  );
}
