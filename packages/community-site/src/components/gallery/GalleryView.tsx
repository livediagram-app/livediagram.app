'use client';

import { useCallback, useEffect, useState } from 'react';
import { useCommunitySite } from '../../client';
import { capitalise } from '../../lib/format';
import { hasActiveFilters } from '../../lib/query-state';
import { SESSION_LOAD_TIMEOUT_MS, type CommunitySession } from '../../lib/session';
import { AccountSession } from '../auth/AccountSession';
import { PostGrid } from '../shared/PostGrid';
import {
  GalleryEmpty,
  GalleryMineEmpty,
  GalleryNoMatches,
  GallerySignedOut,
} from './GalleryStates';
import { MineSummary } from './MineSummary';
import { LoadMore } from './LoadMore';
import { LoadError } from '../shared/LoadError';
import { SearchBox } from './SearchBox';
import { useGallery } from './useGallery';

// Placeholder cards that hold the grid's space: two full rows at the widest layout on the first load
// (the fold is covered without reserving a whole page), one row while the next page loads.
const SKELETON_CARDS = 8;
const SKELETON_MORE = 4;

// The gallery below the hero (livediagram/docs/specs/025-community/community.md "Gallery"): the
// filters, then the grid in whichever state it is in.
// The gallery's top row at its widest (4 columns), whose images load at once: the first thing seen.
const GALLERY_PRIORITY_CARDS = 4;

export function GalleryView() {
  const { words, telemetry } = useCommunitySite();
  const heading = capitalise(words.nouns);
  // Who is signed in, known only once My Shares has asked.
  const [session, setSession] = useState<CommunitySession | null>(null);
  const gallery = useGallery(session);
  const { filters, facets, status, posts, setFilters, mine } = gallery;
  // My Shares waiting on a session that never answers (a network failure) says so rather than showing
  // placeholders forever; Try Again reloads the page, which asks afresh.
  const waitingForSession = mine && session?.loaded !== true;
  const [sessionTimedOut, setSessionTimedOut] = useState(false);
  // Each wait gets its own 10 seconds: once My Shares stops waiting (sign-in arrived, or My Shares was turned off),
  // an earlier time-out is forgotten, so turning it back on waits afresh.
  const [wasWaiting, setWasWaiting] = useState(waitingForSession);
  if (wasWaiting !== waitingForSession) {
    setWasWaiting(waitingForSession);
    if (!waitingForSession) setSessionTimedOut(false);
  }
  useEffect(() => {
    if (!waitingForSession) return;
    const timer = window.setTimeout(() => {
      console.warn('[community] sign-in did not load; My Shares gives up');
      setSessionTimedOut(true);
    }, SESSION_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [waitingForSession]);
  const ready = filters !== null;
  // Stable, so a re-render (facets arriving) never restarts the search box's debounce.
  const onSearch = useCallback((q: string) => setFilters({ q }), [setFilters]);
  const onTagChosen = useCallback(() => telemetry.selected('Tag'), [telemetry]);
  const onSortChosen = useCallback(() => telemetry.selected('Sort'), [telemetry]);
  const onCategoryChosen = useCallback(() => telemetry.selected('Category'), [telemetry]);
  const onMineChosen = useCallback(() => telemetry.selected('Mine'), [telemetry]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <SearchBox
          value={filters?.q ?? ''}
          onSearch={onSearch}
          facets={facets}
          onTagChosen={onTagChosen}
          onSortChosen={onSortChosen}
          onCategoryChosen={onCategoryChosen}
          onMineChosen={onMineChosen}
        />
        {mine ? <AccountSession onSession={setSession} /> : null}
      </div>

      <section aria-label={mine ? 'My Shares' : heading}>
        {/* The cards are h3s under the page's h1: this names their level for screen readers. */}
        <h2 className="sr-only">{mine ? 'My Shares' : heading}</h2>
        {mine && gallery.totals && gallery.totals.posts > 0 ? (
          <MineSummary totals={gallery.totals} />
        ) : null}
        {waitingForSession && sessionTimedOut ? (
          <LoadError
            title="We couldn't load the Community."
            onRetry={() => window.location.reload()}
          />
        ) : status === 'signed-out' ? (
          <GallerySignedOut />
        ) : status === 'error' ? (
          <LoadError title="We couldn't load the Community." onRetry={gallery.retry} />
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
              priorityCount={GALLERY_PRIORITY_CARDS}
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
