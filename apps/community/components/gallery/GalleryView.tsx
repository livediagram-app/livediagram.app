'use client';

import { useCallback, useState } from 'react';
import { hasActiveFilters } from '@/lib/query-state';
import { signInAvailable, type CommunitySession } from '@/lib/session';
import { communityTelemetry } from '@/lib/telemetry';
import { LazyClerkSession } from '../auth/LazyClerkSession';
import { PostGrid } from '../shared/PostGrid';
import {
  GalleryEmpty,
  GalleryError,
  GalleryMineEmpty,
  GalleryNoMatches,
  GallerySignedOut,
} from './GalleryStates';
import { MineSummary } from './MineSummary';
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
  // Who is signed in, known only once My Shares has loaded Clerk.
  const [session, setSession] = useState<CommunitySession | null>(null);
  const gallery = useGallery(session);
  const { filters, facets, status, posts, setFilters, mine } = gallery;
  const ready = filters !== null;
  // Stable, so a re-render (facets arriving) never restarts the search box's debounce.
  const onSearch = useCallback((q: string) => setFilters({ q }), [setFilters]);
  const onTagChosen = useCallback(() => communityTelemetry.selected('Tag'), []);
  const onSortChosen = useCallback(() => communityTelemetry.selected('Sort'), []);
  const onCategoryChosen = useCallback(() => communityTelemetry.selected('Category'), []);
  const onMineChosen = useCallback(() => communityTelemetry.selected('Mine'), []);

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
            mineAvailable={signInAvailable}
            onMineChosen={onMineChosen}
          />
          {mine && signInAvailable ? <LazyClerkSession onSession={setSession} /> : null}
        </div>
      </div>

      <section aria-label={mine ? 'My Shares' : 'Documents'}>
        {mine && gallery.totals && gallery.totals.posts > 0 ? (
          <MineSummary totals={gallery.totals} />
        ) : null}
        {status === 'signed-out' || (mine && !signInAvailable) ? (
          <GallerySignedOut available={signInAvailable} />
        ) : status === 'error' ? (
          <GalleryError onRetry={gallery.retry} />
        ) : status === 'ready' && posts.length === 0 ? (
          ready && hasActiveFilters(filters) ? (
            <GalleryNoMatches onClear={gallery.clearFilters} />
          ) : mine ? (
            <GalleryMineEmpty />
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
