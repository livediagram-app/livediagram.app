'use client';

// The editor's Explorer pane (docs/specs/013-workspace/explorer-structure.md "The pane"): the picked section's name,
// Open Page to its Explorer page and its own action, over its content. Sections with documents are the tree's rows;
// the others are the Explorer page's own views, each loaded only when its section is first shown.
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { explorerPathFor } from '@/app/explorer/routes';
import { PaneSkeleton } from './pane-parts';
import { OpenIcon, PlusIcon } from '@/components/primitives/explorer-icons';
import { sectionLabel, sectionPage, type PanelSection } from './panel-sections';

const load = () => import('./PanelViews');
const HomeSection = dynamic(() => load().then((m) => m.HomeSection), {
  ssr: false,
  loading: () => <PaneSkeleton />,
});
const InboxSection = dynamic(() => load().then((m) => m.InboxSection), {
  ssr: false,
  loading: () => <PaneSkeleton />,
});
const TimelineSection = dynamic(() => load().then((m) => m.TimelineSection), {
  ssr: false,
  loading: () => <PaneSkeleton />,
});
const TrashSection = dynamic(() => load().then((m) => m.TrashSection), {
  ssr: false,
  loading: () => <PaneSkeleton />,
});
const LibrarySection = dynamic(() => load().then((m) => m.LibrarySection), {
  ssr: false,
  loading: () => <PaneSkeleton />,
});

// The header's quiet actions: words with a glyph, a wash on hover, no frame.
const HEADER_BUTTON =
  'flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-500 pointer-coarse:h-11 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white';

export function ExplorerPanelPane({
  section,
  teamName,
  ownerId,
  currentDocumentId,
  onOpenDocument,
  tree,
  onPick,
  onNewFolder,
  onLibraryChanged,
  footer,
}: {
  section: PanelSection;
  teamName: (id: string) => string | undefined;
  ownerId: string | null;
  currentDocumentId: string | null;
  onOpenDocument: (id: string, shareCode?: string) => void;
  // The rows of a section that holds documents (PanelExplorerTree), rendered by the host which owns their state.
  tree: ReactNode;
  onPick: (s: PanelSection) => void;
  // My documents' or a team's New Folder; absent where the session may not make one.
  onNewFolder?: () => void;
  // The Trash restored or deleted a document.
  onLibraryChanged: () => void;
  // Pinned under the content, outside its scroll (the sign-in bar).
  footer?: ReactNode;
}) {
  const title = sectionLabel(section, teamName);
  const body =
    section.kind === 'home' ? (
      ownerId ? (
        <HomeSection
          ownerId={ownerId}
          currentDocumentId={currentDocumentId}
          onOpenDocument={onOpenDocument}
          onSeeTimeline={() => onPick({ kind: 'timeline' })}
        />
      ) : null
    ) : section.kind === 'inbox' ? (
      ownerId ? (
        <InboxSection ownerId={ownerId} />
      ) : null
    ) : section.kind === 'timeline' ? (
      ownerId ? (
        <TimelineSection ownerId={ownerId} />
      ) : null
    ) : section.kind === 'trash' ? (
      ownerId ? (
        <TrashSection ownerId={ownerId} onChanged={onLibraryChanged} />
      ) : null
    ) : section.kind === 'library' ? (
      ownerId ? (
        <LibrarySection ownerId={ownerId} />
      ) : null
    ) : (
      tree
    );
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-5 pb-3 pt-4">
        <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-slate-900 dark:text-slate-50">
          {title}
        </h3>
        {onNewFolder && (section.kind === 'mine' || section.kind === 'team') ? (
          <button type="button" onClick={onNewFolder} className={HEADER_BUTTON}>
            <PlusIcon size={12} />
            {/* On a phone the glyph alone (the name stays for assistive technology), so the title keeps its room. */}
            <span className="max-sm:sr-only">New Folder</span>
          </button>
        ) : null}
        <a href={explorerPathFor(sectionPage(section))} className={HEADER_BUTTON}>
          <span className="max-sm:sr-only">Open Page</span>
          <OpenIcon />
        </a>
      </div>
      {/* Every section's content scrolls here, with room round it. */}
      <div
        data-explorer-pane=""
        className="scrollbar-slim min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-5 pt-1"
      >
        {body}
      </div>
      {footer}
    </div>
  );
}
