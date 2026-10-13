'use client';

// The editor's Explorer pane (docs/specs/013-workspace/explorer-structure.md "The pane"): the picked section's name,
// Open Page to its Explorer page and its own action, over its content. Sections with documents are the tree's rows;
// the others are the Explorer page's own views, each loaded only when its section is first shown.
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { explorerPathFor } from '@/app/explorer/routes';
import { SkeletonRows } from '@/app/explorer/views';
import { OpenIcon, PlusIcon } from '@/components/primitives/explorer-icons';
import { sectionLabel, sectionPage, type PanelSection } from './panel-sections';

const load = () => import('./PanelViews');
const HomeSection = dynamic(() => load().then((m) => m.HomeSection), {
  ssr: false,
  loading: () => <SkeletonRows />,
});
const InboxSection = dynamic(() => load().then((m) => m.InboxSection), {
  ssr: false,
  loading: () => <SkeletonRows />,
});
const TimelineSection = dynamic(() => load().then((m) => m.TimelineSection), {
  ssr: false,
  loading: () => <SkeletonRows />,
});
const TrashSection = dynamic(() => load().then((m) => m.TrashSection), {
  ssr: false,
  loading: () => <SkeletonRows />,
});
const LibrarySection = dynamic(() => load().then((m) => m.LibrarySection), {
  ssr: false,
  loading: () => <SkeletonRows />,
});

const HEADER_BUTTON =
  'flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-500 pointer-coarse:h-11 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800 dark:hover:text-white';

export function ExplorerPanelPane({
  section,
  teamName,
  ownerId,
  tree,
  onPick,
  onNewFolder,
  onLibraryChanged,
  footer,
}: {
  section: PanelSection;
  teamName: (id: string) => string | undefined;
  ownerId: string | null;
  // The rows of a section that holds documents (PanelExplorerTree), rendered by the host which owns their state.
  tree: ReactNode;
  onPick: (s: PanelSection) => void;
  // My documents' or a team's New Folder; absent where the session may not make one.
  onNewFolder?: () => void;
  // The Trash restored or deleted a document.
  onLibraryChanged: () => void;
  // Under the content, inside the scroll (the sign-in notice).
  footer?: ReactNode;
}) {
  const title = sectionLabel(section, teamName);
  const body =
    section.kind === 'home' ? (
      ownerId ? (
        <HomeSection ownerId={ownerId} onSeeTimeline={() => onPick({ kind: 'timeline' })} />
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
      <div className="flex items-center gap-2 px-3 pb-2 pt-2.5">
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
          {title}
        </h3>
        {onNewFolder && (section.kind === 'mine' || section.kind === 'team') ? (
          <button type="button" onClick={onNewFolder} className={HEADER_BUTTON}>
            <PlusIcon size={11} />
            New Folder
          </button>
        ) : null}
        <a href={explorerPathFor(sectionPage(section))} className={HEADER_BUTTON}>
          Open Page
          <OpenIcon size={11} />
        </a>
      </div>
      {/* Every section's own content scrolls here, its views sized to the pane (container queries read its width). */}
      <div
        data-explorer-pane=""
        className="scrollbar-slim min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2 [container-type:inline-size]"
      >
        {body}
        {footer}
      </div>
    </div>
  );
}
