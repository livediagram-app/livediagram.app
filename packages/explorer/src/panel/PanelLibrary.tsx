'use client';

// The editor panel's Library section (livediagram's explorer-panel PanelViews "LibrarySection"): the Library's pages
// as tabs over one view.

import { useExplorer } from '../explorer/context';
import { useLibraryHost } from '../library/context';
import { GalleryPane } from '../library/GalleryPane';
import { ShapeLibrariesPane } from '../library/ShapeLibrariesPane';
import { ImageIcon, ShapesIcon, WalkthroughIcon } from '../ui/library-icons';
import { WalkthroughsContent } from '../library/WalkthroughsPane';
import { SIDEBAR_LABELS } from '../views';
import type { LibraryTab } from './sections';

/** The Library's tabs the host keeps, Image Gallery first. */
export function libraryTabs(host: {
  gallery?: unknown;
  shapeLibraries?: unknown;
  walkthroughs?: unknown;
}): LibraryTab[] {
  return [
    ...(host.gallery ? (['gallery'] as const) : []),
    ...(host.shapeLibraries ? (['shape-libraries'] as const) : []),
    ...(host.walkthroughs ? (['walkthroughs'] as const) : []),
  ];
}

const TAB_ICON = {
  gallery: ImageIcon,
  'shape-libraries': ShapesIcon,
  walkthroughs: WalkthroughIcon,
} as const;
const TAB_LABEL = {
  gallery: SIDEBAR_LABELS.gallery,
  'shape-libraries': SIDEBAR_LABELS.shapeLibraries,
  walkthroughs: SIDEBAR_LABELS.walkthroughs,
} as const;

export function PanelLibrary({
  tab,
  setTab,
}: {
  tab: LibraryTab;
  setTab: (tab: LibraryTab) => void;
}) {
  const host = useLibraryHost();
  const { kind } = useExplorer();
  const tabs = libraryTabs(host);
  const shown = tabs.includes(tab) ? tab : tabs[0];
  return (
    <div className="flex flex-col gap-4">
      {tabs.length > 1 ? (
        <div
          role="tablist"
          aria-label={SIDEBAR_LABELS.library}
          className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
        >
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={shown === t}
              onClick={() => setTab(t)}
              className={`flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-medium transition pointer-coarse:h-11 ${
                shown === t
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              {(() => {
                const Icon = TAB_ICON[t];
                return <Icon />;
              })()}
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
      ) : null}
      <div role={tabs.length > 1 ? 'tabpanel' : undefined}>
        {shown === 'gallery' && host.gallery ? (
          <GalleryPane
            compact
            host={host.gallery}
            kindMany={{ one: kind.lowerOne, many: kind.lowerMany }}
          />
        ) : shown === 'shape-libraries' && host.shapeLibraries ? (
          <ShapeLibrariesPane compact host={host.shapeLibraries} />
        ) : shown === 'walkthroughs' && host.walkthroughs ? (
          <WalkthroughsContent compact host={host.walkthroughs} />
        ) : null}
      </div>
    </div>
  );
}
