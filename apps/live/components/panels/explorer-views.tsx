'use client';

import { DocumentThumbnail } from '@/components/panels/DocumentThumbnail';

// Presentational primitives for the floating Explorer panel
// (apps/live/components/panels/Explorer.tsx). Lifted here so the
// Explorer component itself can focus on data flow + the panel
// shell: the synthetic Unsorted / Offline nodes and the Shared row,
// with FolderNode and DocumentRow re-exported beside them (each has
// its own file). Same pattern as the route's
// app/explorer/views.tsx split: stateless or near-stateless
// renderers that take their data + callbacks via props.
//
// Mirror of (not duplicate with) app/explorer/views.tsx: the
// route's full-page list view has its own DocumentRow / FolderRow
// shape (grid layout, dropdown menu, no drag), whereas this file
// owns the floating-panel shape (pill rows, drag source / drop
// target, recursive tree). The two coexist by design.

// Row data shapes come straight from the api client (the same rows
// apiListDocuments / useFolders / apiListSharedWith return) so the
// panel and the /explorer route can't drift apart on what a list
// item carries.
import type { DocumentListItem, SharedWithItem } from '@/lib/api-client';
import { relativeSince, useRelativeNow } from '@/lib/relative-time';
import { DISMISS_SHARED, DismissSharedIcon } from '@/components/primitives/dismiss-shared';
import { SYNTHETIC_FOLDERS, type SyntheticFolderKind } from '@/app/explorer/synthetic-folders';
import { useDocumentDropTarget } from './useDocumentDropTarget';
import { DocumentRow } from './DocumentRow';
import { PanelDocumentRows, type PanelRowActions } from './PanelDocumentRows';
import { TreeNodeHeader } from './TreeNodeHeader';
import { HoverCard } from '@livediagram/ui';

export { FolderNode } from './FolderNode';
export { DocumentRow };

// A synthetic node's header: its glyph and italic name from the shared
// synthetic-folder table, keyed into the panel's expanded record by kind.
function SyntheticNodeHeader({
  kind,
  expanded,
  onToggleExpanded,
  count,
  iconClassName,
  drop,
}: {
  kind: SyntheticFolderKind;
  expanded: Record<string, boolean>;
  onToggleExpanded: (key: string) => void;
  count: number;
  iconClassName?: string;
  drop?: ReturnType<typeof useDocumentDropTarget>;
}) {
  const { Icon, label } = SYNTHETIC_FOLDERS[kind];
  return (
    <TreeNodeHeader
      expanded={expanded[kind] ?? false}
      onToggle={() => onToggleExpanded(kind)}
      noun={label}
      icon={<Icon size={12} />}
      iconClassName={iconClassName}
      label={label}
      labelClassName="italic text-slate-500 dark:text-white"
      count={count}
      drop={drop}
    />
  );
}

// Synthetic root-level "Unsorted" folder. Holds every diagram with
// folder_id IS NULL. Can't be renamed or deleted, but is a drop target:
// a diagram dropped here goes back to the root (a null folder id).
export function UnsortedNode({
  expanded,
  onToggleExpanded,
  documents: liveDocs,
  rows,
}: {
  expanded: Record<string, boolean>;
  onToggleExpanded: (key: string) => void;
  documents: DocumentListItem[];
  rows: PanelRowActions;
}) {
  const drop = useDocumentDropTarget(null, rows.onMoveDocumentToFolder);
  return (
    <li>
      <SyntheticNodeHeader
        kind="unsorted"
        expanded={expanded}
        onToggleExpanded={onToggleExpanded}
        count={liveDocs.length}
        drop={rows.onMoveDocumentToFolder ? drop : undefined}
      />
      {expanded.unsorted ? (
        <ul className="flex flex-col gap-0.5">
          <PanelDocumentRows documents={liveDocs} indent={16} rows={rows} />
        </ul>
      ) : null}
    </li>
  );
}

// Synthetic "Offline" folder (docs/specs/006-document/offline-mode.md): every diagram saved only in this
// browser, mirroring the /explorer route's dynamic Offline folder. Always
// rendered (even empty) so the local-only bucket stays discoverable. Not a
// drop target, and its rows are not drag sources: moving a cloud diagram
// offline is the explicit, confirmed Take Offline action, never a drag.
export function OfflineNode({
  expanded,
  onToggleExpanded,
  documents: liveDocs,
  rows,
}: {
  expanded: Record<string, boolean>;
  onToggleExpanded: (key: string) => void;
  documents: DocumentListItem[];
  rows: PanelRowActions;
}) {
  return (
    <li>
      <SyntheticNodeHeader
        kind="offline"
        expanded={expanded}
        onToggleExpanded={onToggleExpanded}
        count={liveDocs.length}
        iconClassName="text-amber-500"
      />
      {expanded.offline ? (
        liveDocs.length === 0 ? (
          <p className="px-8 py-1.5 text-[10px] text-slate-400 dark:text-slate-400">
            Diagrams saved only in this browser collect here.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            <PanelDocumentRows
              documents={liveDocs}
              indent={16}
              rows={{ ...rows, onMoveDocumentToFolder: undefined }}
            />
          </ul>
        )
      ) : null}
    </li>
  );
}

// One row in the "Shared with you" accordion. Visually similar to
// the recents list but stripped of folder / move / duplicate menu
// affordances: the visitor doesn't own these diagrams, so the
// only meaningful actions are "open" and "dismiss this row from my
// list." A small role pill ("View" / "Edit") communicates what they
// can do once they're in.
export function SharedRow({
  item,
  active,
  ownerId,
  onOpen,
  onDismiss,
}: {
  item: SharedWithItem;
  active: boolean;
  // Viewer identity for the thumbnail fetch (the share code authorises
  // the read; see DocumentThumbnail).
  ownerId: string | null;
  onOpen: () => void;
  onDismiss?: () => void;
}) {
  const now = useRelativeNow();
  const relative = relativeSince(item.savedAt, now);
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition ${
          active
            ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200'
            : 'hover:bg-slate-50 text-slate-700 dark:text-white dark:hover:bg-slate-800'
        }`}
      >
        {/* The real preview, like every owned row — the share code
            authorises the snapshot read, so shared rows are no longer a
            generic glyph while the full-page Shared list shows previews. */}
        <DocumentThumbnail
          ownerId={ownerId}
          documentId={item.id}
          version={item.savedAt}
          shareCode={item.shareCode}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{item.name}</span>
          {/* Tight meta line: just the role + relative-time.
              Owner attribution + "Updated" lived here before but
              read too dense in a narrow column; role is the load-
              bearing affordance and the timestamp grounds it. */}
          <span className="block truncate text-[10px] text-slate-500 dark:text-white">
            {item.role === 'edit' ? 'Edit' : 'View'} · {relative}
          </span>
        </span>
      </button>
      {onDismiss ? (
        <div className="absolute right-1.5 top-1.5 block sm:hidden sm:group-hover:block sm:group-focus-within:block">
          <HoverCard title={DISMISS_SHARED.title} description={DISMISS_SHARED.description}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              aria-label={DISMISS_SHARED.ariaLabel(item.name)}
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1 text-slate-500 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-rose-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
            >
              <DismissSharedIcon />
            </button>
          </HoverCard>
        </div>
      ) : null}
    </li>
  );
}
