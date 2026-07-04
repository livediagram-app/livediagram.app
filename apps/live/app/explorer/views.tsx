'use client';

// Presentational primitives for the Explorer page (spec/15). Lifted
// out of page.tsx so the route file can focus on data flow
// (state, effects, api calls) rather than 800 lines of pure render
// markup. Every export here is a stateless or near-stateless React
// component that takes its data and callbacks via props: no module-
// level state, no api calls. The page wires them together.

import Link from 'next/link';
import { type ReactNode } from 'react';
import type { DiagramListItem, Folder, SharedWithItem } from '@/lib/api-client';
import { relativeSince, useRelativeTimeTick } from '@/lib/relative-time';
import { EmptyPane } from './ExplorerEmptyState';
import { DiagramRow } from './explorer-route-diagram-row';
import { FolderRow } from './folder-row';
import { DiagramThumbnail } from '@/components/panels/DiagramThumbnail';
import { CloseIcon, FolderIcon, SparkleIcon } from './icons';

// The pane header lives in its own file now; re-exported so callers keep
// importing it from the views barrel.
export { PaneHeader } from './PaneHeader';
export { FolderMenuItems } from './folder-row';
export { FolderRow };

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
  | { kind: 'generated' }
  | { kind: 'shared' }
  | { kind: 'gallery' }
  | { kind: 'themes' }
  | { kind: 'tokens' }
  | { kind: 'profile' }
  | { kind: 'folder'; id: string }
  | { kind: 'team'; id: string }
  | { kind: 'invites' };

// ---------- Right pane primitives ---------------------------------

export function ListView({
  folders,
  diagrams,
  ownerId,
  showUnsortedRow,
  unsortedCount,
  onOpenUnsorted,
  showGeneratedRow = false,
  generatedCount = 0,
  onOpenGenerated,
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
  // Viewer identity, threaded to each row's thumbnail fetch (spec/67).
  // Null while a guest id is still resolving.
  ownerId: string | null;
  // Adds the desktop Owner column (Recent: "You" vs the team name).
  showOwner?: boolean;
  // True on the "All diagrams" (My Work) view: the synthetic Unsorted
  // row renders at the very top so the root has the same "folder row per
  // child" feel as any non-root folder. Always shown there now (even
  // empty, badge hidden at zero) so My Work isn't bare before anything
  // is filed; Generated renders next to it the same way (spec/15).
  showUnsortedRow: boolean;
  unsortedCount: number;
  onOpenUnsorted: () => void;
  // The Generated synthetic folder row, shown on the My Work (/all) list
  // beside Unsorted (spec/15). Optional: defaults to hidden.
  showGeneratedRow?: boolean;
  generatedCount?: number;
  onOpenGenerated?: () => void;
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
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div
        className={
          'grid grid-cols-[1fr_140px_40px] items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400 ' +
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
      <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
        {showUnsortedRow ? <UnsortedRow count={unsortedCount} onOpen={onOpenUnsorted} /> : null}
        {showGeneratedRow && onOpenGenerated ? (
          <GeneratedRow count={generatedCount} onOpen={onOpenGenerated} />
        ) : null}
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
            ownerId={ownerId}
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

// A synthetic ("dynamic") folder row in the list view — looks like a real
// folder row (glyph + name + count) but has no rename/move/delete actions
// because it isn't backed by a folders table entry: it's a live view
// (Unsorted = no parent; Generated = AI-made). Shared by both so they
// can't drift.
function SyntheticFolderRow({
  icon,
  label,
  count,
  onOpen,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  onOpen: () => void;
}) {
  return (
    <li className="group grid grid-cols-[1fr_140px_40px] sm:grid-cols-[1fr_90px_140px_40px] items-center gap-2 px-4 py-2 transition hover:bg-slate-50 dark:hover:bg-slate-700">
      <button
        type="button"
        onDoubleClick={onOpen}
        onClick={onOpen}
        className="flex min-w-0 items-center gap-2 text-left"
      >
        <span className="shrink-0 text-slate-400 dark:text-slate-500">{icon}</span>
        <span className="truncate text-sm font-medium text-slate-900 group-hover:text-brand-700 dark:text-slate-100 dark:group-hover:text-brand-300">
          {label}
        </span>
        {count > 0 ? (
          <span className="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-slate-200 px-1 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
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

export function UnsortedRow({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <SyntheticFolderRow
      icon={<FolderIcon open={false} />}
      label="Unsorted"
      count={count}
      onOpen={onOpen}
    />
  );
}

function GeneratedRow({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <SyntheticFolderRow icon={<SparkleIcon />} label="Generated" count={count} onOpen={onOpen} />
  );
}

export function SharedList({
  shared,
  ownerId,
  onDismiss,
}: {
  shared: SharedWithItem[];
  // Viewer identity for each row's thumbnail fetch (spec/67); the share
  // code on the item authorises the read.
  ownerId: string | null;
  onDismiss: (id: string) => void;
}) {
  useRelativeTimeTick();
  if (shared.length === 0) {
    return <EmptyPane selected={{ kind: 'shared' }} />;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="grid grid-cols-[1fr_60px_140px_40px] items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400 sm:grid-cols-[1fr_110px_60px_140px_40px]">
        <span>Name</span>
        <span className="hidden sm:block">Owner</span>
        <span>Role</span>
        <span>Updated</span>
        <span aria-hidden></span>
      </div>
      <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
        {shared.map((s) => (
          <li
            key={s.id}
            className="group grid grid-cols-[1fr_60px_140px_40px] items-center gap-2 px-4 py-2 transition hover:bg-slate-50 dark:hover:bg-slate-700 sm:grid-cols-[1fr_110px_60px_140px_40px]"
          >
            <Link
              href={`/diagram/${s.id}?s=${encodeURIComponent(s.shareCode)}`}
              className="flex min-w-0 items-center gap-2 truncate text-sm font-medium text-slate-900 hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-300"
            >
              <DiagramThumbnail
                ownerId={ownerId}
                diagramId={s.id}
                version={s.savedAt}
                shareCode={s.shareCode}
              />
              <span className="truncate">{s.name}</span>
            </Link>
            <span className="hidden truncate text-xs text-slate-500 sm:block dark:text-slate-400">
              {s.ownerName || 'Unknown owner'}
            </span>
            <span className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
              {s.role === 'edit' ? 'Edit' : 'View'}
            </span>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {relativeSince(s.savedAt)}
            </span>
            <button
              type="button"
              onClick={() => onDismiss(s.id)}
              aria-label="Dismiss"
              className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-rose-50 hover:text-rose-700 dark:text-slate-500 dark:hover:bg-rose-500/15 dark:hover:text-rose-300"
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

export function SkeletonRows() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <span className="h-4 w-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <span className="h-4 flex-1 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <span className="h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          </li>
        ))}
      </ul>
    </div>
  );
}
