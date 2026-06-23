'use client';

// Presentational primitives for the Explorer page (spec/15). Lifted
// out of page.tsx so the route file can focus on data flow
// (state, effects, api calls) rather than 800 lines of pure render
// markup. Every export here is a stateless or near-stateless React
// component that takes its data and callbacks via props: no module-
// level state, no api calls. The page wires them together.

import Link from 'next/link';
import { useRef, useState } from 'react';
import type { DiagramListItem, Folder, SharedWithItem } from '@/lib/api-client';
import { relativeSince, useRelativeTimeTick } from '@/lib/relative-time';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import type { HelpArticleKey } from '@/lib/help-articles';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import { MenuItem, PortalMenu } from '@/components/primitives/PortalMenu';
import {
  CloseIcon,
  DiagramIcon,
  EllipsisIcon,
  FolderIcon,
  MenuDuplicateIcon,
  MenuFolderIcon,
  MenuPencilIcon,
  MenuTrashIcon,
  PlusIcon,
  TeamIcon,
} from './icons';

// Diagram rows render the api client's DiagramListItem directly
// (same rows the floating Explorer panel uses), so the two explorer
// surfaces can't drift apart on what a list item carries. Recent rows
// (spec/35) may additionally carry:
//   - `team`: the team library the diagram lives in — a "Team"
//     visibility badge + the team as owner, and a team-scoped menu.
//   - `shared`: a diagram shared WITH the viewer (not theirs) — a
//     "Shared" badge, the sharer as owner, a share-link title, and a
//     "Dismiss" action. Mutually exclusive with `team`.
export type PaneDiagram = DiagramListItem & {
  team?: { id: string; name: string };
  shared?: { ownerName: string | null; role: 'edit' | 'view'; shareCode: string };
};

// What the sidebar tree highlights and what the right pane shows.
// "Special" nodes (`recent`, `all`, `shared`) are virtual buckets
// with no folder row behind them; `folder` is a real owned folder and
// `team` a team the signed-in user belongs to (spec/32).
export type SelectedNode =
  | { kind: 'recent' }
  | { kind: 'all' }
  | { kind: 'unsorted' }
  | { kind: 'shared' }
  | { kind: 'gallery' }
  | { kind: 'themes' }
  | { kind: 'folder'; id: string }
  | { kind: 'team'; id: string }
  | { kind: 'invites' };

// ---------- Right pane primitives ---------------------------------

function HamburgerIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M3 5h12M3 9h12M3 13h12" />
    </svg>
  );
}

function CaretDownIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="-mr-0.5"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

export function PaneHeader({
  title,
  crumbs,
  onCreateDiagram,
  onCreateFolder,
  folderLabel,
  onOpenNav,
  helpArticle,
  helpTitle,
  helpDescription,
}: {
  title: string;
  crumbs: { name: string; onClick?: () => void }[];
  // Section-scoped "?" help button, rendered to the left of Create (or
  // alone when the section has no Create action). Deep-links the matching
  // help-centre article (spec/56) for this Explorer section.
  helpArticle?: HelpArticleKey;
  helpTitle?: string;
  helpDescription?: string;
  // Mobile only: opens the section drawer (the sidebar is hidden below
  // `sm`). Renders a hamburger to the left of the title. Omitted on
  // desktop where the sidebar is always visible.
  onOpenNav?: () => void;
  // Optional CTAs rendered in the title row's right edge. Replaces
  // the standalone floating "+" FAB so the actions sit in their
  // current context rather than as a global affordance. New diagram
  // renders first, then New folder / New subfolder (the label
  // varies by selection, so the caller passes it). Both are
  // optional: the Shared / Gallery views pass neither because the
  // verbs don't apply.
  onCreateDiagram?: () => void;
  onCreateFolder?: () => void;
  // "New folder" at the root level, "New subfolder" inside an
  // existing folder. Caller resolves the wording.
  folderLabel?: string;
}) {
  // A single-item breadcrumb is just the page title in a second
  // place: visually noisy and provides no navigation. Show only
  // when there are actual parents to click back to.
  const showCrumbs = crumbs.length >= 2;
  const hasCreate = Boolean(onCreateDiagram || onCreateFolder);
  const hasActions = hasCreate || Boolean(helpArticle);
  // A single "+ Create" dropdown (both desktop and mobile) replaces the
  // standalone New-diagram / New-folder buttons: two shrink-0 buttons
  // squeezed the folder-name title to nothing on a narrow phone, and
  // one compact button keeps the title roomy on every screen.
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {onOpenNav ? (
            <button
              type="button"
              onClick={onOpenNav}
              aria-label="Browse sections"
              className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 sm:hidden"
            >
              <HamburgerIcon />
            </button>
          ) : null}
          {title ? (
            <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight text-slate-900">
              {title}
            </h1>
          ) : null}
        </div>
        {hasActions ? (
          <div className="flex shrink-0 items-center gap-2">
            {helpArticle ? (
              <HelpArticleLink
                article={helpArticle}
                title={helpTitle ?? 'Learn more'}
                description={helpDescription}
              />
            ) : null}
            {hasCreate ? (
              <button
                ref={createRef}
                type="button"
                onClick={() => setCreateOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={createOpen}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-brand-600"
              >
                <PlusIcon />
                Create
                <CaretDownIcon />
              </button>
            ) : null}
            {createOpen ? (
              <PortalMenu
                anchor={createRef.current}
                placement="below"
                onClose={() => setCreateOpen(false)}
              >
                {onCreateDiagram ? (
                  <MenuItem
                    icon={<DiagramIcon />}
                    label="New diagram"
                    onClick={() => {
                      onCreateDiagram();
                      setCreateOpen(false);
                    }}
                  />
                ) : null}
                {onCreateFolder ? (
                  <MenuItem
                    icon={<MenuFolderIcon />}
                    label={folderLabel ?? 'New folder'}
                    onClick={() => {
                      onCreateFolder();
                      setCreateOpen(false);
                    }}
                  />
                ) : null}
              </PortalMenu>
            ) : null}
          </div>
        ) : null}
      </div>
      {showCrumbs ? (
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 shadow-sm"
        >
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={`${c.name}-${i}`} className="flex items-center">
                {i > 0 ? (
                  <span aria-hidden className="px-1 text-slate-300">
                    ›
                  </span>
                ) : null}
                {c.onClick && !isLast ? (
                  <button
                    type="button"
                    onClick={c.onClick}
                    className="rounded px-1.5 py-0.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    {c.name}
                  </button>
                ) : (
                  <span className="rounded px-1.5 py-0.5 font-medium text-slate-900">{c.name}</span>
                )}
              </span>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}

export function ListView({
  folders,
  diagrams,
  showUnsortedRow,
  unsortedCount,
  onOpenUnsorted,
  onOpenFolder,
  onCommitRenameFolder,
  onCancelRenameFolder,
  renamingFolderId,
  renamingDiagramId,
  onCommitRenameDiagram,
  onCancelRenameDiagram,
  folderActions,
  onStartRenameDiagram,
  onDuplicateDiagram,
  onDeleteDiagram,
  onMoveDiagram,
  onDismissShared,
  childrenCount,
  diagramsCount,
  showOwner = false,
}: {
  folders: Folder[];
  diagrams: PaneDiagram[];
  // Adds the desktop Owner column (Recent: "You" vs the team name).
  showOwner?: boolean;
  // True on the "All diagrams" view: the synthetic Unsorted row
  // renders at the very top so the root has the same "folder row
  // per child" feel as any non-root folder. The row is only
  // surfaced when there's something to put in it (unsortedCount > 0)
  // to avoid showing an empty folder by default.
  showUnsortedRow: boolean;
  unsortedCount: number;
  onOpenUnsorted: () => void;
  onOpenFolder: (id: string) => void;
  onCommitRenameFolder: (id: string, name: string) => void;
  onCancelRenameFolder: () => void;
  renamingFolderId: string | null;
  renamingDiagramId: string | null;
  onCommitRenameDiagram: (id: string, name: string) => void;
  onCancelRenameDiagram: () => void;
  folderActions: (
    f: Folder,
    anchor: HTMLElement | null,
  ) => {
    rename: () => void;
    newSubfolder: () => void;
    move: () => void;
    delete: () => void;
  };
  onStartRenameDiagram: (id: string) => void;
  onDuplicateDiagram: (id: string) => void;
  onDeleteDiagram: (id: string) => void;
  onMoveDiagram: (id: string, anchor: HTMLElement | null) => void;
  // Shared-row action (spec/35), used by Recent's "shared with me" rows.
  onDismissShared?: (id: string) => void;
  childrenCount: (id: string) => number;
  diagramsCount: (id: string) => number;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div
        className={
          'grid grid-cols-[1fr_140px_40px] items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 ' +
          (showOwner
            ? 'sm:grid-cols-[1fr_110px_90px_140px_40px]'
            : 'sm:grid-cols-[1fr_90px_140px_40px]')
        }
      >
        <span>Name</span>
        {showOwner ? <span className="hidden sm:block">Owner</span> : null}
        <span className="hidden sm:block">Visibility</span>
        <span>Updated</span>
        <span aria-hidden></span>
      </div>
      <ul className="divide-y divide-slate-100">
        {showUnsortedRow ? <UnsortedRow count={unsortedCount} onOpen={onOpenUnsorted} /> : null}
        {folders.map((f) => (
          <FolderRow
            key={f.id}
            folder={f}
            renaming={renamingFolderId === f.id}
            childCount={childrenCount(f.id) + diagramsCount(f.id)}
            onOpen={() => onOpenFolder(f.id)}
            onCommitRename={(name) => onCommitRenameFolder(f.id, name)}
            onCancelRename={onCancelRenameFolder}
            getActionsForAnchor={(anchor) => folderActions(f, anchor)}
          />
        ))}
        {diagrams.map((d) => (
          <DiagramRow
            key={d.id}
            diagram={d}
            showOwner={showOwner}
            renaming={renamingDiagramId === d.id}
            onStartRename={() => onStartRenameDiagram(d.id)}
            onCommitRename={(name) => onCommitRenameDiagram(d.id, name)}
            onCancelRename={onCancelRenameDiagram}
            onDuplicate={() => onDuplicateDiagram(d.id)}
            onDelete={() => onDeleteDiagram(d.id)}
            onMove={(anchor) => onMoveDiagram(d.id, anchor)}
            onDismiss={d.shared && onDismissShared ? () => onDismissShared(d.id) : undefined}
          />
        ))}
      </ul>
    </div>
  );
}

// Synthetic "Unsorted" folder row for the All-diagrams list view.
// Looks like a regular folder row (folder glyph + name + child
// count) but has no rename / move / new-subfolder / delete actions
// because the row isn't backed by a folders table entry: Unsorted
// is the absence of a parent. Clicking drills into the Unsorted
// pseudo-folder which lists every diagram with folder_id IS NULL.
export function UnsortedRow({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <li className="group grid grid-cols-[1fr_140px_40px] sm:grid-cols-[1fr_90px_140px_40px] items-center gap-2 px-4 py-2 transition hover:bg-slate-50">
      <button
        type="button"
        onDoubleClick={onOpen}
        onClick={onOpen}
        className="flex min-w-0 items-center gap-2 text-left"
      >
        <span className="shrink-0 text-slate-400">
          <FolderIcon open={false} />
        </span>
        <span className="truncate text-sm font-medium text-slate-900 group-hover:text-brand-700">
          Unsorted
        </span>
        {count > 0 ? (
          <span className="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-slate-200 px-1 text-[10px] font-medium text-slate-600">
            {count}
          </span>
        ) : null}
      </button>
      <span className="hidden sm:block" />
      {/* A folder has no visibility/owner of its own — leave the cell
          blank rather than a bare dash that reads as a mystery value. */}
      <span aria-hidden />
      <span aria-hidden />
    </li>
  );
}

export function FolderRow({
  folder,
  renaming,
  childCount,
  onOpen,
  onCommitRename,
  onCancelRename,
  getActionsForAnchor,
}: {
  folder: Folder;
  renaming: boolean;
  childCount: number;
  onOpen: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  getActionsForAnchor: (anchor: HTMLElement | null) => {
    rename: () => void;
    newSubfolder: () => void;
    move: () => void;
    delete: () => void;
  };
}) {
  useRelativeTimeTick();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);

  // When renaming, the label area is a plain div so the <input>
  // inside it isn't nested in a <button> (which steals focus).
  const labelInner = (
    <>
      <span className="shrink-0 text-amber-500">
        <FolderIcon open={false} />
      </span>
      {renaming ? (
        <InlineRenameInput
          initial={folder.name}
          onCommit={onCommitRename}
          onCancel={onCancelRename}
          className="rounded border border-brand-300 bg-white px-1 py-0 text-sm font-medium text-slate-900"
        />
      ) : (
        <span className="truncate text-sm font-medium text-slate-900 group-hover:text-brand-700">
          {folder.name}
        </span>
      )}
      {childCount > 0 ? (
        <span className="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-slate-200 px-1 text-[10px] font-medium text-slate-600">
          {childCount}
        </span>
      ) : null}
    </>
  );
  return (
    <li
      className="group grid grid-cols-[1fr_140px_40px] sm:grid-cols-[1fr_90px_140px_40px] items-center gap-2 px-4 py-2 transition hover:bg-slate-50"
      // Right-click anywhere on the row opens the same actions menu as the
      // ellipsis button (anchored to it).
      onContextMenu={
        renaming
          ? undefined
          : (e) => {
              e.preventDefault();
              setMenuOpen(true);
            }
      }
    >
      {renaming ? (
        <div className="flex min-w-0 items-center gap-2">{labelInner}</div>
      ) : (
        <button
          type="button"
          onDoubleClick={onOpen}
          onClick={onOpen}
          className="flex min-w-0 items-center gap-2 text-left"
        >
          {labelInner}
        </button>
      )}
      <span className="hidden sm:block" />
      <span className="text-[11px] uppercase tracking-wider text-slate-400">
        {relativeSince(folder.updatedAt)}
      </span>
      {renaming ? (
        <span />
      ) : (
        <button
          ref={menuRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
          aria-label={`Menu for ${folder.name}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
        >
          <EllipsisIcon />
        </button>
      )}
      {menuOpen ? (
        <PortalMenu anchor={menuRef.current} placement="below" onClose={() => setMenuOpen(false)}>
          <FolderMenuItems
            actions={getActionsForAnchor(menuRef.current)}
            close={() => setMenuOpen(false)}
          />
        </PortalMenu>
      ) : null}
    </li>
  );
}

function DiagramRow({
  diagram,
  renaming,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDuplicate,
  onDelete,
  onMove,
  onDismiss,
  showOwner = false,
}: {
  diagram: PaneDiagram;
  renaming: boolean;
  onStartRename: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (anchor: HTMLElement | null) => void;
  // Shared-row menu action (spec/35): drop it from "Shared with me".
  onDismiss?: () => void;
  // Adds the desktop Owner cell ("You", the team name, or the sharer).
  showOwner?: boolean;
}) {
  useRelativeTimeTick();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  // Team rows expose member-valid actions (move within the team /
  // remove); shared rows are read-only bar "Dismiss" (spec/35).
  const isTeamRow = !!diagram.team;
  const isSharedRow = !!diagram.shared;
  // Shared diagrams open on the visitor URL (the owner-only path 404s
  // for a non-owner); everything else opens on the owned path.
  const href = diagram.shared
    ? `/diagram/${diagram.id}?s=${encodeURIComponent(diagram.shared.shareCode)}`
    : `/diagram/${diagram.id}`;

  const titleNode = renaming ? (
    <InlineRenameInput
      initial={diagram.name}
      onCommit={onCommitRename}
      onCancel={onCancelRename}
      className="rounded border border-brand-300 bg-white px-1 py-0 text-sm font-medium text-slate-900"
    />
  ) : (
    <Link
      href={href}
      className="truncate text-sm font-medium text-slate-900 transition hover:text-brand-700"
    >
      {diagram.name}
    </Link>
  );

  return (
    <li
      className={
        'group grid grid-cols-[1fr_140px_40px] items-center gap-2 px-4 py-2 transition hover:bg-slate-50 ' +
        (showOwner
          ? 'sm:grid-cols-[1fr_110px_90px_140px_40px]'
          : 'sm:grid-cols-[1fr_90px_140px_40px]')
      }
      // Right-click anywhere on the row opens the same actions menu as the
      // ellipsis button (anchored to it).
      onContextMenu={
        renaming
          ? undefined
          : (e) => {
              e.preventDefault();
              setMenuOpen(true);
            }
      }
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-slate-400">
          <DiagramIcon />
        </span>
        {titleNode}
      </span>
      {showOwner ? (
        <span className="hidden truncate text-xs text-slate-500 sm:block">
          {diagram.team?.name ??
            diagram.shared?.ownerName ??
            (isSharedRow ? 'Unknown owner' : 'You')}
        </span>
      ) : null}
      <span className="hidden sm:block">
        {isSharedRow ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
            <svg
              width="9"
              height="9"
              viewBox="0 0 9 9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="2" cy="4.5" r="1.4" />
              <circle cx="7" cy="2" r="1.2" />
              <circle cx="7" cy="7" r="1.2" />
              <path d="M3.2 3.8L5.9 2.5M3.2 5.2L5.9 6.5" />
            </svg>
            Shared
          </span>
        ) : isTeamRow ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30">
            <svg
              width="9"
              height="9"
              viewBox="0 0 9 9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              aria-hidden
            >
              <circle cx="3.2" cy="3.2" r="1.4" />
              <path d="M1.2 7.8c.3-1.4 1-2.1 2-2.1s1.7.7 2 2.1" />
              <circle cx="6.6" cy="3.6" r="1.1" />
              <path d="M6.3 5.7c.9.1 1.5.7 1.7 1.8" />
            </svg>
            Team
          </span>
        ) : diagram.shareCode ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
            <svg
              width="9"
              height="9"
              viewBox="0 0 9 9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="2" cy="4.5" r="1.4" />
              <circle cx="7" cy="2" r="1.2" />
              <circle cx="7" cy="7" r="1.2" />
              <path d="M3.2 3.8L5.9 2.5M3.2 5.2L5.9 6.5" />
            </svg>
            Shared
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">
            <svg
              width="9"
              height="9"
              viewBox="0 0 9 9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="1.6" y="4" width="5.8" height="3.6" rx="0.9" />
              <path d="M3 4V2.9a1.5 1.5 0 0 1 3 0V4" />
            </svg>
            Private
          </span>
        )}
      </span>
      <span className="text-[11px] uppercase tracking-wider text-slate-400">
        {relativeSince(diagram.savedAt)}
      </span>
      {renaming ? (
        <span />
      ) : (
        <button
          ref={menuRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
          aria-label={`Menu for ${diagram.name}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
        >
          <EllipsisIcon />
        </button>
      )}
      {menuOpen && isSharedRow ? (
        // Shared-with-me rows: open on the share link or dismiss from
        // the list (spec/35). The diagram isn't the viewer's to rename
        // / move / delete.
        <PortalMenu anchor={menuRef.current} placement="below" onClose={() => setMenuOpen(false)}>
          <MenuItem
            icon={<DiagramIcon />}
            label="Open"
            onClick={() => {
              window.location.assign(href);
            }}
          />
          <MenuItem
            icon={<CloseIcon />}
            label="Dismiss"
            onClick={() => {
              onDismiss?.();
              setMenuOpen(false);
            }}
          />
        </PortalMenu>
      ) : null}
      {menuOpen && !isSharedRow ? (
        // One menu for owned + team rows (spec/35): a team diagram is
        // managed by every joined member, so the full set applies.
        // Team rows additionally get "Open Team" to jump to the
        // library page at this diagram's folder.
        <PortalMenu anchor={menuRef.current} placement="below" onClose={() => setMenuOpen(false)}>
          <MenuItem
            icon={<MenuPencilIcon />}
            label="Rename"
            onClick={() => {
              onStartRename();
              setMenuOpen(false);
            }}
          />
          <MenuItem
            icon={<MenuDuplicateIcon />}
            label="Duplicate"
            onClick={() => {
              onDuplicate();
              setMenuOpen(false);
            }}
          />
          <MenuItem
            icon={<MenuFolderIcon />}
            label="Change Folder"
            onClick={() => {
              onMove(menuRef.current);
              setMenuOpen(false);
            }}
          />
          {isTeamRow ? (
            <MenuItem
              icon={<TeamIcon />}
              label="Open Team"
              onClick={() => {
                window.location.assign(
                  `/explorer/team?id=${encodeURIComponent(diagram.team!.id)}${
                    diagram.folderId ? `&folder=${encodeURIComponent(diagram.folderId)}` : ''
                  }`,
                );
              }}
            />
          ) : null}
          <MenuItem
            icon={<MenuTrashIcon />}
            label="Delete"
            danger
            onClick={() => {
              onDelete();
              setMenuOpen(false);
            }}
          />
        </PortalMenu>
      ) : null}
    </li>
  );
}

export function FolderMenuItems({
  actions,
  close,
}: {
  actions: {
    rename: () => void;
    newSubfolder: () => void;
    move: () => void;
    delete: () => void;
  };
  close: () => void;
}) {
  return (
    <>
      <MenuItem
        icon={<MenuPencilIcon />}
        label="Rename"
        onClick={() => {
          actions.rename();
          close();
        }}
      />
      <MenuItem
        icon={<PlusIcon />}
        label="New subfolder"
        onClick={() => {
          actions.newSubfolder();
          close();
        }}
      />
      <MenuItem
        icon={<MenuFolderIcon />}
        label="Change Folder"
        onClick={() => {
          actions.move();
          close();
        }}
      />
      <MenuItem
        icon={<MenuTrashIcon />}
        label="Delete"
        danger
        onClick={() => {
          actions.delete();
          close();
        }}
      />
    </>
  );
}

export function SharedList({
  shared,
  onDismiss,
}: {
  shared: SharedWithItem[];
  onDismiss: (id: string) => void;
}) {
  useRelativeTimeTick();
  if (shared.length === 0) {
    return <EmptyPane selected={{ kind: 'shared' }} />;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-[1fr_60px_140px_40px] items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:grid-cols-[1fr_110px_60px_140px_40px]">
        <span>Name</span>
        <span className="hidden sm:block">Owner</span>
        <span>Role</span>
        <span>Updated</span>
        <span aria-hidden></span>
      </div>
      <ul className="divide-y divide-slate-100">
        {shared.map((s) => (
          <li
            key={s.id}
            className="group grid grid-cols-[1fr_60px_140px_40px] items-center gap-2 px-4 py-2 transition hover:bg-slate-50 sm:grid-cols-[1fr_110px_60px_140px_40px]"
          >
            <Link
              href={`/diagram/${s.id}?s=${encodeURIComponent(s.shareCode)}`}
              className="flex min-w-0 items-center gap-2 truncate text-sm font-medium text-slate-900 hover:text-brand-700"
            >
              <span className="shrink-0 text-slate-400">
                <DiagramIcon />
              </span>
              <span className="truncate">{s.name}</span>
            </Link>
            <span className="hidden truncate text-xs text-slate-500 sm:block">
              {s.ownerName || 'Unknown owner'}
            </span>
            <span className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
              {s.role === 'edit' ? 'Edit' : 'View'}
            </span>
            <span className="text-[11px] uppercase tracking-wider text-slate-400">
              {relativeSince(s.savedAt)}
            </span>
            <button
              type="button"
              onClick={() => onDismiss(s.id)}
              aria-label="Dismiss"
              className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-rose-50 hover:text-rose-700"
            >
              <CloseIcon />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- States: empty / loading / unauthenticated -------------

export function EmptyPane({ selected }: { selected: SelectedNode }) {
  const inFolder = selected.kind === 'folder';
  const isRecent = selected.kind === 'recent';
  const isShared = selected.kind === 'shared';
  // CTAs now live in the PaneHeader's right edge ("New diagram" /
  // "New folder"), so this empty state is just the explainer copy.
  // Adding buttons here would be a second copy of the same actions.
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <p className="max-w-md text-sm text-slate-500">
        {isRecent
          ? "Nothing here yet. Diagrams you've opened will show up here."
          : isShared
            ? 'Nothing shared with you yet. Open a share link someone sent you, and the diagram will land here.'
            : inFolder
              ? 'This folder is empty.'
              : 'No diagrams yet.'}
      </p>
    </div>
  );
}

export function SkeletonRows() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <ul className="divide-y divide-slate-100">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <span className="h-4 w-4 animate-pulse rounded bg-slate-200" />
            <span className="h-4 flex-1 animate-pulse rounded bg-slate-200" />
            <span className="h-4 w-24 animate-pulse rounded bg-slate-200" />
          </li>
        ))}
      </ul>
    </div>
  );
}
