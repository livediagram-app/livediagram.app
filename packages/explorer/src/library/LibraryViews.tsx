'use client';

// The Library's pages on the Explorer page: the Image Gallery and Shape Libraries, each under the pane header, drawn
// from the host's source. A host without one (an app with no gallery) says so rather than showing an empty page. The
// Gallery's header holds its Show switch (All or Unused) just left of Help, over the same state the grid draws.

import { useMemo, useState } from 'react';
import { EmptyState, SegmentedToggle } from '@liveworkspace/ui';
import { ImageIcon, ShapesIcon } from '../ui/library-icons';
import { SIDEBAR_LABELS } from '../views';
import { useExplorer } from '../explorer/context';
import { PaneHeader } from '../explorer/PaneHeader';
import { useLibraryHost } from './context';
import { GalleryContent, unusedCount, useGallery } from './GalleryPane';
import type { GalleryFilter } from './gallery-filter';
import { ShapeLibrariesPane } from './ShapeLibrariesPane';
import { HelpButton } from '../explorer/HomeHero';
import { ImportToolbar } from './ImportToolbar';

export function GalleryView() {
  const { kind } = useExplorer();
  const { gallery } = useLibraryHost();
  const state = useGallery(gallery);
  const [filter, setFilter] = useState<GalleryFilter>('all');
  // Counted once per read or delete, not on every switch.
  const { loaded } = state;
  const unused = useMemo(() => (gallery ? unusedCount(gallery, loaded) : null), [gallery, loaded]);
  return (
    <div data-explorer-view="gallery">
      <PaneHeader
        title={SIDEBAR_LABELS.gallery}
        showFilter={false}
        actions={
          <>
            {unused !== null ? (
              <GalleryFilterToggle value={filter} onChange={setFilter} unused={unused} />
            ) : null}
            {gallery?.helpHref ? <HelpButton href={gallery.helpHref} /> : null}
          </>
        }
      />
      {gallery ? (
        <GalleryContent
          host={gallery}
          gallery={state}
          kindMany={{ one: kind.lowerOne, many: kind.lowerMany }}
          filter={filter}
          onShowAll={() => setFilter('all')}
        />
      ) : (
        <EmptyState
          icon={<ImageIcon size={28} />}
          title="No Image Gallery here"
          description={`${kind.many} keep no images of their own.`}
        />
      )}
    </div>
  );
}

// The Gallery's Show switch: All, or Unused (the images nothing places), its hover card counting them.
function GalleryFilterToggle({
  value,
  onChange,
  unused,
}: {
  value: GalleryFilter;
  onChange: (next: GalleryFilter) => void;
  unused: number;
}) {
  return (
    <SegmentedToggle
      label="Show"
      value={value}
      onChange={onChange}
      options={[
        { value: 'all', label: 'All', description: 'Every image in your gallery.' },
        {
          value: 'unused',
          label: 'Unused',
          description:
            unused === 0
              ? 'Nothing to clear: every image is placed somewhere.'
              : `${unused} ${unused === 1 ? 'image' : 'images'} nothing places, usually safe to delete.`,
        },
      ]}
    />
  );
}

const ROOT = { folderId: null, teamId: null };

export function ShapeLibrariesView() {
  const { kind } = useExplorer();
  const { shapeLibraries } = useLibraryHost();
  return (
    <div data-explorer-view="shape-libraries">
      <PaneHeader
        title={SIDEBAR_LABELS.shapeLibraries}
        showFilter={false}
        actions={
          <>
            {shapeLibraries ? <ImportToolbar placement={ROOT} what="libraries" /> : null}
            {shapeLibraries?.helpHref ? <HelpButton href={shapeLibraries.helpHref} /> : null}
          </>
        }
      />
      {shapeLibraries ? (
        <ShapeLibrariesPane
          host={shapeLibraries}
          emptyAction={<ImportToolbar placement={ROOT} what="libraries" />}
        />
      ) : (
        <EmptyState
          icon={<ShapesIcon size={28} />}
          title="No Shape Libraries here"
          description={`${kind.many} keep no shape libraries.`}
        />
      )}
    </div>
  );
}
