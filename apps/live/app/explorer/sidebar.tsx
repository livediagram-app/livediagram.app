'use client';

// Sidebar tree primitives for the Explorer page (spec/15). Lifted out
// of views.tsx (was 848 lines, split roughly half-and-half between
// the left sidebar tree and the right content pane) so each file is
// scoped to one pane's render surface. The shared cross-file
// reference (SidebarFolderSubtree opens a folder menu via
// FolderMenuItems, which lives with the right-pane components since
// FolderRow uses it too) goes back into views.tsx; the type imports
// from there cost nothing at runtime.

import { useRef, useState } from 'react';
import type { Folder } from '@/lib/api-client';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import { PortalMenu } from '@/components/primitives/PortalMenu';
import { ChevronIcon, EllipsisIcon, FolderIcon } from './icons';
import { FolderMenuItems, type SelectedNode } from './views';

// Indent step per tree level. Matches the Windows Explorer visual
// of a chevron + folder glyph + name with each child nudged in.
const INDENT_STEP = 16;

export function SearchSidebarIcon() {
  return (
    <svg
      width="14"
      height="14"
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

export function SidebarSectionLabel({
  children,
  first,
  action,
}: {
  children: React.ReactNode;
  // `first` skips the inter-section gap on the topmost label so the
  // sidebar box has matching breathing room above the first label and
  // below the last row. Without this the top reads as too padded.
  first?: boolean;
  // Optional right-aligned control on the label row (e.g. the Teams
  // section's new-team plus, spec/32) so section-level actions don't
  // need their own row.
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center justify-between px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 ${
        first ? '' : 'mt-5 pt-1'
      }`}
    >
      <span>{children}</span>
      {action ?? null}
    </div>
  );
}

// One sidebar row. Re-used for the "Recent", "All diagrams", and
// "Shared with me" special entries. Folder rows wrap this via
// SidebarFolderSubtree so they get chevron + recursive rendering.
export function SidebarRow({
  icon,
  label,
  selected,
  onClick,
  depth,
  badge,
  hasChildren,
  expanded,
  onToggleExpand,
  trailing,
  renaming,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  depth: number;
  badge?: number;
  hasChildren?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  trailing?: React.ReactNode;
  // When true, the label area renders as a plain div instead of a
  // <button>, so a child <input> (e.g. inline rename) can take focus
  // without the parent button intercepting it. An input nested inside
  // a button is invalid HTML and browsers steal the input's focus.
  renaming?: boolean;
}) {
  const labelClass = `flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left text-xs ${
    selected
      ? 'font-semibold text-brand-700 dark:text-brand-300'
      : 'text-slate-700 dark:text-slate-200'
  }`;
  const labelInner = (
    <>
      <span className="shrink-0 text-slate-400 dark:text-slate-500">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge !== undefined ? (
        <span className="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-slate-200 px-1 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
          {badge}
        </span>
      ) : null}
    </>
  );
  return (
    <div
      className={`group flex items-center gap-1 rounded-md px-1 ${selected ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}
      style={{ paddingLeft: depth * INDENT_STEP + 4 }}
    >
      <button
        type="button"
        onClick={onToggleExpand}
        aria-label={expanded ? 'Collapse' : 'Expand'}
        className={`flex h-5 w-5 shrink-0 items-center justify-center text-slate-400 transition dark:text-slate-500 ${
          hasChildren ? 'hover:text-slate-700 dark:hover:text-slate-200' : 'invisible'
        }`}
        disabled={!hasChildren || !onToggleExpand}
      >
        {hasChildren ? <ChevronIcon open={!!expanded} /> : null}
      </button>
      {renaming ? (
        <div className={labelClass}>{labelInner}</div>
      ) : (
        <button type="button" onClick={onClick} className={labelClass}>
          {labelInner}
        </button>
      )}
      {trailing}
    </div>
  );
}

// A team library's folder subtree in the sidebar (spec/35). Reuses
// the SidebarRow primitive for visual parity with the personal tree,
// but is navigation-only: a click opens the team page at that folder
// (rename / move / delete live on the team page, not here), so there's
// no ellipsis menu and nothing in the personal SelectedNode model to
// highlight. Folder ids are globally unique, so it shares the one
// `expanded` Set with the personal tree.
export type TeamFolderNode = { id: string; name: string; parentId: string | null };

export function TeamFolderSubtree({
  folder,
  depth,
  childrenByParent,
  expanded,
  onToggleExpand,
  onOpenFolder,
}: {
  folder: TeamFolderNode;
  depth: number;
  childrenByParent: Map<string | null, TeamFolderNode[]>;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onOpenFolder: (folderId: string) => void;
}) {
  const kids = childrenByParent.get(folder.id) ?? [];
  const hasKids = kids.length > 0;
  const isOpen = expanded.has(folder.id);
  return (
    <>
      <SidebarRow
        icon={<FolderIcon open={isOpen} />}
        label={folder.name}
        selected={false}
        onClick={() => onOpenFolder(folder.id)}
        depth={depth}
        hasChildren={hasKids}
        expanded={isOpen}
        onToggleExpand={hasKids ? () => onToggleExpand(folder.id) : undefined}
      />
      {isOpen
        ? kids.map((k) => (
            <TeamFolderSubtree
              key={k.id}
              folder={k}
              depth={depth + 1}
              childrenByParent={childrenByParent}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              onOpenFolder={onOpenFolder}
            />
          ))
        : null}
    </>
  );
}

// Recursive folder subtree in the sidebar. Each row is a SidebarRow
// with the chevron / folder icon, and children render at +1 depth
// when expanded.
export function SidebarFolderSubtree({
  folder,
  depth,
  expanded,
  onToggleExpand,
  selected,
  onSelect,
  childrenByParent,
  renamingFolderId,
  onCommitRenameFolder,
  onCancelRenameFolder,
  folderActions,
}: {
  folder: Folder;
  depth: number;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  selected: SelectedNode;
  onSelect: (id: string) => void;
  childrenByParent: Map<string | null, Folder[]>;
  renamingFolderId: string | null;
  onCommitRenameFolder: (id: string, name: string) => void;
  onCancelRenameFolder: () => void;
  folderActions: (
    f: Folder,
    anchor: HTMLElement | null,
  ) => {
    rename: () => void;
    newSubfolder: () => void;
    move: () => void;
    delete: () => void;
  };
}) {
  const kids = childrenByParent.get(folder.id) ?? [];
  const hasKids = kids.length > 0;
  const isOpen = expanded.has(folder.id);
  const isSelected = selected.kind === 'folder' && selected.id === folder.id;
  const renaming = renamingFolderId === folder.id;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);

  const labelNode = renaming ? (
    <InlineRenameInput
      initial={folder.name}
      onCommit={(name) => onCommitRenameFolder(folder.id, name)}
      onCancel={onCancelRenameFolder}
      className="rounded border border-brand-300 bg-white px-1 py-0 text-xs dark:border-brand-500/50 dark:bg-slate-900 dark:text-slate-100"
    />
  ) : (
    folder.name
  );

  return (
    <>
      <SidebarRow
        icon={<FolderIcon open={isOpen} />}
        label={labelNode}
        selected={isSelected}
        onClick={() => onSelect(folder.id)}
        depth={depth}
        hasChildren={hasKids}
        expanded={isOpen}
        onToggleExpand={() => onToggleExpand(folder.id)}
        renaming={renaming}
        trailing={
          renaming ? null : (
            <button
              ref={menuRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((o) => !o);
              }}
              aria-label={`Menu for ${folder.name}`}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
              <EllipsisIcon />
            </button>
          )
        }
      />
      {menuOpen ? (
        <PortalMenu anchor={menuRef.current} placement="below" onClose={() => setMenuOpen(false)}>
          <FolderMenuItems
            actions={folderActions(folder, menuRef.current)}
            close={() => setMenuOpen(false)}
          />
        </PortalMenu>
      ) : null}
      {isOpen
        ? kids.map((k) => (
            <SidebarFolderSubtree
              key={k.id}
              folder={k}
              depth={depth + 1}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              selected={selected}
              onSelect={onSelect}
              childrenByParent={childrenByParent}
              renamingFolderId={renamingFolderId}
              onCommitRenameFolder={onCommitRenameFolder}
              onCancelRenameFolder={onCancelRenameFolder}
              folderActions={folderActions}
            />
          ))
        : null}
    </>
  );
}
