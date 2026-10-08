'use client';

// Presentational primitives for the Explorer page (docs/specs/013-workspace/folders.md). Lifted
// out of page.tsx so the route file can focus on data flow
// (state, effects, api calls) rather than 800 lines of pure render
// markup. Every export here is a stateless or near-stateless React
// component that takes its data and callbacks via props: no module-
// level state, no api calls. The page wires them together.

import Link from 'next/link';
import type { ExplorerViewProps } from '@/app/explorer/explorer-view-props';
import type { DocumentListItem, SharedWithItem } from '@/lib/api-client';
import { EmptyPane } from './ExplorerEmptyState';
import { DocumentRow } from './explorer-route-document-row';
import { FolderRow } from './folder-row';
import { DocumentThumbnail } from '@/components/panels/DocumentThumbnail';
import { RelativeTimeChip } from '@/components/primitives/RelativeTimeChip';
import { DISMISS_SHARED, DismissSharedIcon } from '@/components/primitives/dismiss-shared';
import { HoverCard } from '@livediagram/ui';

// The pane header lives in its own file now; re-exported so callers keep
// importing it from the views barrel.
export { PaneHeader } from './PaneHeader';
export { menuHandlers as folderMenuHandlers } from './folder-row';
export { FolderRow };

// Document rows render the api client's DocumentListItem directly
// (same rows the floating Explorer panel uses), so the two explorer
// surfaces can't drift apart on what a list item carries. Recent rows
// (docs/specs/013-workspace/team-shared-documents.md) may additionally carry:
//   - `team`: the team library the document lives in — a "Team"
//     visibility badge + the team as owner, and a team-scoped menu.
//   - `shared`: a document shared WITH the viewer (not theirs) — a
//     "Shared" badge, the sharer as owner, a share-link title, and a
//     "Dismiss" action. Mutually exclusive with `team`.
export type PaneDocument = DocumentListItem & {
  team?: { id: string; name: string };
  shared?: { ownerName: string | null; role: 'edit' | 'view'; shareCode: string };
};

// A document shared WITH the viewer, as a pane row. It lives in the
// sharer's library, not yours, so it carries no folder and an empty
// owner; the share code is what makes it openable. One helper so Recent
// and the Timeline's card menus build the same row.
export function sharedToPaneDocument(s: SharedWithItem): PaneDocument {
  return {
    id: s.id,
    name: s.name,
    folderId: null,
    savedAt: s.savedAt,
    shareCode: s.shareCode,
    ownerId: '',
    shared: { ownerName: s.ownerName, role: s.role, shareCode: s.shareCode },
    empty: s.empty,
  };
}

// What the sidebar tree highlights and what the right pane shows.
// "Special" nodes (`recent`, `all`, `shared`) are virtual buckets
// with no folder row behind them; `folder` is a real owned folder and
// `team` a team the signed-in user belongs to (docs/specs/013-workspace/teams.md).
export type SelectedNode =
  // The landing view (docs/specs/013-workspace/explorer-home.md): Jump back in, What happened and
  // the person's own Timeline.
  | { kind: 'home' }
  // All activity (docs/specs/013-workspace/timeline.md): the day-grouped feed of everything that
  // happened, reached from Home's See all activity.
  | { kind: 'timeline' }
  // What is outstanding for the reader across every document (docs/specs/013-workspace/activity-page.md):
  // open actions assigned to / by them, unresolved threads they're in.
  | { kind: 'activity' }
  | { kind: 'recent' }
  | { kind: 'all' }
  // Every document the reader can open, narrowed by the lens (docs/specs/013-workspace/explorer-filters.md#views).
  | { kind: 'search' }
  // Documents this user starred, personal or team (docs/specs/013-workspace/favourites.md).
  | { kind: 'favourites' }
  | { kind: 'offline' }
  | { kind: 'shared' }
  | { kind: 'gallery' }
  | { kind: 'themes' }
  // Shape libraries (docs/specs/013-workspace/shape-libraries.md).
  | { kind: 'shape-libraries' }
  // The Trash (docs/specs/013-workspace/trash.md): a route with no sidebar row,
  // reached from Settings.
  | { kind: 'trash' }
  | { kind: 'folder'; id: string }
  | { kind: 'team'; id: string }
  | { kind: 'invites' };

// ---------- Right pane primitives ---------------------------------

export function ListView(props: ExplorerViewProps) {
  const {
    folders,
    documents: liveDocs,
    ownerId,
    onOpenFolder,
    onCommitRenameFolder,
    onCancelRenameFolder,
    renamingFolderId,
    renamingDocumentId,
    onCommitRenameDocument,
    onCancelRenameDocument,
    folderActions,
    onStartRenameDocument,
    onDuplicateDocument,
    onDeleteDocument,
    onMoveDocument,
    onDismissShared,
    recentExcludedIds,
    favouriteIds,
    onToggleFavourite,
    folderChipFor,
    onToggleRecentExclusion,
    onShowHistory,
    childrenCount,
    documentsCount,
    showOwner = false,
  } = props;
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
      <ul className="lvd-cascade divide-y divide-slate-100 dark:divide-slate-700/60">
        {folders.map((f) => (
          <FolderRow
            key={f.id}
            folder={f}
            renaming={renamingFolderId === f.id}
            childCount={childrenCount(f.id) + documentsCount(f.id)}
            onOpen={() => onOpenFolder(f.id)}
            onCommitRename={(name) => onCommitRenameFolder(f.id, name)}
            onCancelRename={onCancelRenameFolder}
            getActionsForAnchor={(anchor) => folderActions(f, anchor)}
          />
        ))}
        {liveDocs.map((d) => (
          <DocumentRow
            key={d.id}
            document={d}
            ownerId={ownerId}
            showOwner={showOwner}
            renaming={renamingDocumentId === d.id}
            onStartRename={() => onStartRenameDocument(d.id)}
            onCommitRename={(name) => onCommitRenameDocument(d.id, name)}
            onCancelRename={onCancelRenameDocument}
            onDuplicate={() => onDuplicateDocument(d.id)}
            onDelete={() => onDeleteDocument(d.id)}
            onMove={(anchor) => onMoveDocument(d.id, anchor)}
            onDismiss={d.shared && onDismissShared ? () => onDismissShared(d.id) : undefined}
            folderChip={folderChipFor?.(d) ?? null}
            favourite={favouriteIds?.has(d.id) === true}
            onToggleFavourite={onToggleFavourite ? () => onToggleFavourite(d.id) : undefined}
            recentExcluded={recentExcludedIds?.includes(d.id) === true}
            onShowHistory={onShowHistory ? () => onShowHistory(d.id) : undefined}
            onToggleRecentExclusion={
              onToggleRecentExclusion ? () => onToggleRecentExclusion(d.id) : undefined
            }
          />
        ))}
      </ul>
    </div>
  );
}

export function SharedList({
  shared,
  ownerId,
  onDismiss,
}: {
  shared: SharedWithItem[];
  // Viewer identity for each row's thumbnail fetch (docs/specs/006-document/document-snapshots.md); the share
  // code on the item authorises the read.
  ownerId: string | null;
  onDismiss: (id: string) => void;
}) {
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
              href={`/document/${s.id}?s=${encodeURIComponent(s.shareCode)}`}
              className="flex min-w-0 items-center gap-2 truncate text-sm font-medium text-slate-900 hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-300"
            >
              <DocumentThumbnail
                ownerId={ownerId}
                documentId={s.id}
                version={s.savedAt}
                empty={s.empty}
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
            <RelativeTimeChip at={s.savedAt} />
            <HoverCard title={DISMISS_SHARED.title} description={DISMISS_SHARED.description}>
              <button
                type="button"
                onClick={() => onDismiss(s.id)}
                aria-label={DISMISS_SHARED.ariaLabel(s.name)}
                className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-600 dark:hover:text-slate-200"
              >
                <DismissSharedIcon />
              </button>
            </HoverCard>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- States: empty / loading / unauthenticated -------------

// Loading placeholder rows. Framed by default (the pane's own card);
// `framed={false}` for a host that already draws the card, like the team
// library, which also asks for fewer rows.
export function SkeletonRows({ count = 6, framed = true }: { count?: number; framed?: boolean }) {
  const rows = (
    <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <span className="h-4 w-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <span className="h-4 flex-1 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <span className="h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        </li>
      ))}
    </ul>
  );
  if (!framed) return rows;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      {rows}
    </div>
  );
}
