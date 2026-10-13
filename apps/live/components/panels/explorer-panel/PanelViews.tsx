'use client';

// The editor's Explorer sections that are views of their own (docs/specs/013-workspace/explorer-structure.md "The
// pane"): Home, the Inbox, the Timeline, the Library and the Trash, each the Explorer page's own pane fed by its own
// hook. Loaded only when a section is first shown (ExplorerPanelPane's dynamic imports), and each read starts only
// while its section is mounted, so opening the editor costs nothing more.
import { useState } from 'react';
import { HomePane } from '@/components/panels/home/HomePane';
import { ActivityPane } from '@/components/panels/ActivityPane';
import { TimelineFeedView } from '@/components/panels/TimelinePane';
import { TrashPane } from '@/components/panels/TrashPane';
import { GalleryPane } from '@/components/panels/GalleryPane';
import { ThemesPane } from '@/components/panels/ThemesPane';
import { ShapeLibrariesPane } from '@/components/panels/ShapeLibrariesPane';
import { useActivityFeed } from '@/app/explorer/useActivityFeed';
import { useTimelineFeed } from '@/app/explorer/useTimelineFeed';
import { useTrash } from '@/hooks/persistence/useTrash';
import { useToast } from '@/hooks/ui/useToast';
import { explorerPathFor } from '@/app/explorer/routes';
import { LIBRARY_PAGES } from '@/app/explorer/sidebar/library-pages';
import { trackSidebar } from '@/app/explorer/sidebar/sidebar-telemetry';

const go = (href: string) => window.location.assign(href);

export function HomeSection({
  ownerId,
  onSeeTimeline,
}: {
  ownerId: string;
  // Home's See timeline shows the Timeline in the pane, as the rail would.
  onSeeTimeline: () => void;
}) {
  const recentHref = explorerPathFor({ kind: 'recent' });
  return (
    <HomePane
      ownerId={ownerId}
      onSeen={() => {}}
      timelineHref={explorerPathFor({ kind: 'timeline' })}
      onSeeTimeline={onSeeTimeline}
      recentHref={recentHref}
      onSeeMore={() => go(recentHref)}
    />
  );
}

export function InboxSection({ ownerId }: { ownerId: string }) {
  return <ActivityPane feed={useActivityFeed(ownerId)} />;
}

export function TimelineSection({ ownerId }: { ownerId: string }) {
  return <TimelineFeedView feed={useTimelineFeed(ownerId, true)} ownerId={ownerId} />;
}

export function TrashSection({
  ownerId,
  onChanged,
}: {
  ownerId: string;
  // A restore or a permanent delete: the panel's lists refresh so a restored document shows in its place.
  onChanged: () => void;
}) {
  const toast = useToast();
  return <TrashPane trash={useTrash(ownerId, toast, onChanged)} />;
}

type LibraryKind = (typeof LIBRARY_PAGES)[number]['kind'];

// The Library's three pages as tabs over one view (Image Gallery first).
export function LibrarySection({ ownerId }: { ownerId: string }) {
  const [tab, setTab] = useState<LibraryKind>('gallery');
  return (
    <div className="flex flex-col gap-3">
      <div
        role="tablist"
        aria-label="Library"
        className="flex gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800"
      >
        {LIBRARY_PAGES.map(({ kind, label, Icon, row }) => (
          <button
            key={kind}
            type="button"
            role="tab"
            aria-selected={tab === kind}
            onClick={() => {
              trackSidebar(row, 'panel');
              setTab(kind);
            }}
            className={`flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-medium transition pointer-coarse:h-11 ${
              tab === kind
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            <Icon />
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'gallery' ? (
          <GalleryPane ownerId={ownerId} />
        ) : tab === 'themes' ? (
          <ThemesPane />
        ) : (
          <ShapeLibrariesPane />
        )}
      </div>
    </div>
  );
}
