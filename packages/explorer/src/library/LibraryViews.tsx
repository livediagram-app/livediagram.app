'use client';

// The Library's pages on the Explorer page: the Image Gallery and Shape Libraries, each under the pane header, drawn
// from the host's source. A host without one (an app with no gallery) says so rather than showing an empty page. Over
// the Gallery's grid, a toolbar: Find an image (by name) and the Show chips, All, Unused and one per app whose items
// place an image (Work Tracker 1491), each with its count, over the same state the grid draws.

import { useMemo, useState } from 'react';
import { EmptyState, HoverCard } from '@liveworkspace/ui';
import { ImageIcon, ShapesIcon } from '../ui/library-icons';
import { SIDEBAR_LABELS } from '../views';
import { useExplorer } from '../explorer/context';
import { PaneHeader } from '../explorer/PaneHeader';
import { AppMark } from '../explorer/badges';
import { FilterChip, FilterChipRow } from '../explorer/FilterChips';
import { FindField } from '../ui/FindField';
import { siteOf } from '../words';
import { useLibraryHost } from './context';
import { GalleryContent, useGallery } from './GalleryPane';
import { galleryCounts, type GalleryFilter } from './gallery-filter';
import { ShapeLibrariesPane } from './ShapeLibrariesPane';
import { HelpButton } from '../explorer/HomeHero';
import { ImportToolbar } from './ImportToolbar';

export function GalleryView() {
  const { kind, app } = useExplorer();
  const { gallery } = useLibraryHost();
  const state = useGallery(gallery);
  const [filter, setFilter] = useState<GalleryFilter>('all');
  const [query, setQuery] = useState('');
  const { loaded } = state;
  const images = loaded.status === 'ready' ? loaded.images.length : 0;
  // Counted once per read or delete, never per keystroke or chip.
  const counts = useMemo(
    () =>
      gallery?.usage && loaded.status === 'ready' && loaded.images.length > 0
        ? galleryCounts(loaded.images, loaded.usage, app)
        : null,
    [gallery, loaded, app],
  );
  return (
    <div data-explorer-view="gallery">
      <PaneHeader
        title={SIDEBAR_LABELS.gallery}
        showFilter={false}
        actions={gallery?.helpHref ? <HelpButton href={gallery.helpHref} /> : null}
      />
      {gallery && images > 0 ? (
        <div
          data-gallery-toolbar=""
          className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3"
        >
          <FindField
            label="Find an image"
            value={query}
            onChange={setQuery}
            className="sm:w-64 sm:shrink-0"
          />
          {counts ? (
            <GalleryChips value={filter} onChange={setFilter} total={images} counts={counts} />
          ) : null}
        </div>
      ) : null}
      {gallery ? (
        <GalleryContent
          host={gallery}
          gallery={state}
          kindMany={{ one: kind.lowerOne, many: kind.lowerMany }}
          filter={filter}
          query={query}
          app={app}
          onShowAll={() => setFilter('all')}
          onClearQuery={() => setQuery('')}
        />
      ) : (
        <EmptyState
          icon={<ImageIcon size={28} />}
          title="No image gallery here"
          description={`${kind.many} keep no images of their own.`}
        />
      )}
    </div>
  );
}

// The Gallery's Show chips: All, Unused (the images nothing places, usually safe to delete) and one per app whose
// items place any, with its logo. Pressing the chip that is on goes back to All.
function GalleryChips({
  value,
  onChange,
  total,
  counts,
}: {
  value: GalleryFilter;
  onChange: (next: GalleryFilter) => void;
  total: number;
  counts: ReturnType<typeof galleryCounts>;
}) {
  const pick = (next: GalleryFilter) => onChange(value === next ? 'all' : next);
  return (
    <FilterChipRow label="Show" size={counts.apps.length + 2} data-gallery-chips="">
      <FilterChip on={value === 'all'} onClick={() => onChange('all')} label="All" count={total} />
      <HoverCard
        title="Unused"
        description={
          counts.unused === 0
            ? 'Nothing to clear: every image is placed somewhere.'
            : `${counts.unused} ${counts.unused === 1 ? 'image' : 'images'} nothing places, usually safe to delete.`
        }
      >
        <FilterChip
          on={value === 'unused'}
          onClick={() => pick('unused')}
          label="Unused"
          count={counts.unused}
          data-gallery-chip="unused"
        />
      </HoverCard>
      {counts.apps.map(({ app, count }) => (
        <HoverCard
          key={app}
          title={`Used in ${siteOf(app).name}`}
          description={`The images ${siteOf(app).name} items place, the Trash’s too.`}
        >
          <FilterChip
            on={value === app}
            onClick={() => pick(app)}
            logo={<AppMark app={app} size={16} />}
            label={siteOf(app).name}
            count={count}
            data-gallery-chip={app}
          />
        </HoverCard>
      ))}
    </FilterChipRow>
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
          title="No shape libraries here"
          description={`${kind.many} keep no shape libraries.`}
        />
      )}
    </div>
  );
}
