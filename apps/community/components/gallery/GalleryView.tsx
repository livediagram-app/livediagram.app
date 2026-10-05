'use client';

import { useCallback } from 'react';
import { hasActiveFilters } from '@/lib/query-state';
import { communityTelemetry } from '@/lib/telemetry';
import { PostGrid } from '../shared/PostGrid';
import { GalleryEmpty, GalleryError, GalleryNoMatches } from './GalleryStates';
import { LoadMore } from './LoadMore';
import { SearchBox } from './SearchBox';
import { useGallery } from './useGallery';

// Placeholder cards that hold the grid's space: two full rows at the widest layout on the first load
// (the fold is covered without reserving a whole page), one row while the next page loads.
const SKELETON_CARDS = 8;
const SKELETON_MORE = 4;

// The gallery below the hero (docs/specs/025-community/community.md "Gallery"; blueprint §5): the
// filters, then the grid in whichever state it is in.
export function GalleryView() {
  const gallery = useGallery();
  const { filters, facets, status, posts, setFilters } = gallery;
  const ready = filters !== null;
  // Stable, so a re-render (facets arriving) never restarts the search box's debounce.
  const onSearch = useCallback((q: string) => setFilters({ q }), [setFilters]);
  const onTagChosen = useCallback(() => communityTelemetry.selected('Tag'), []);
  const onSortChosen = useCallback(() => communityTelemetry.selected('Sort'), []);
  const onCategoryChosen = useCallback(() => communityTelemetry.selected('Category'), []);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <SearchBox
            value={filters?.q ?? ''}
            onSearch={onSearch}
            facets={facets}
            onTagChosen={onTagChosen}
            onSortChosen={onSortChosen}
            onCategoryChosen={onCategoryChosen}
          />
        </div>
      </div>

      <section aria-label="Documents">
        {status === 'error' ? (
          <GalleryError onRetry={gallery.retry} />
        ) : status === 'ready' && posts.length === 0 ? (
          ready && hasActiveFilters(filters) ? (
            <GalleryNoMatches onClear={gallery.clearFilters} />
          ) : (
            <GalleryEmpty />
          )
        ) : (
          <>
            <PostGrid
              posts={posts}
              skeletons={
                status === 'loading' ? SKELETON_CARDS : gallery.loadingMore ? SKELETON_MORE : 0
              }
            />
            {status === 'ready' && gallery.hasMore ? (
              <LoadMore
                loading={gallery.loadingMore}
                failed={gallery.loadMoreFailed}
                onClick={gallery.loadMore}
              />
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
