'use client';

import { useEffect, useState } from 'react';
import {
  COMMUNITY_FEATURED_COUNT,
  communityImagePath,
  communityPostPath,
  type CommunityFeaturedResponse,
  type CommunityPost,
} from '@livediagram/api-schema';
import {
  CommunityCopyCount,
  CommunityHelpLink,
  CommunityLikeCount,
  CommunityPostTile,
  CommunityPostTileSkeleton,
  useCommunityEnabled,
} from '@livediagram/ui';
import { BAND_EYEBROW, BAND_LEAD, BAND_TITLE } from '@/components/band-classes';

// The landing page's Community section (docs/specs/025-community/community.md "Featured on the home page";
// docs/specs/019-marketing/marketing-site.md): six documents people are proud of, the most liked over the
// last three months topped up with the best of all time, picked by the api. The page is a static export,
// so the six arrive after it loads: placeholder cards hold their space meanwhile (no layout shift), and
// with nothing to show (an empty Community, the api unreachable) the section invites the first share. While
// the Community is switched off the section is not shown at all.

const API_BASE = '/api';
type State =
  | { status: 'loading' }
  | { status: 'ready'; posts: CommunityPost[] }
  // The api answered 404: the Community is switched off, so the section is not shown at all.
  | { status: 'off' };

function useFeatured(): State {
  const [state, setState] = useState<State>({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/community/featured`, { signal: controller.signal })
      .then(async (res) => {
        if (res.status === 404) return setState({ status: 'off' });
        const body: Partial<CommunityFeaturedResponse> = res.ok ? await res.json() : {};
        setState({ status: 'ready', posts: body.posts ?? [] });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.warn('[community] featured load failed', err);
        setState({ status: 'ready', posts: [] });
      });
    return () => controller.abort();
  }, []);
  return state;
}

export function CommunityShowcase() {
  const featured = useFeatured();
  // One clock reading for the six, so their "2 days ago" agree.
  const [now] = useState(Date.now);
  // Switched off (docs/specs/025-community/community.md "Turning the Community off"), the section is not there.
  const communityOn = useCommunityEnabled(API_BASE);
  if (!communityOn || featured.status === 'off') return null;
  const posts = featured.status === 'ready' ? featured.posts : [];
  const empty = featured.status === 'ready' && posts.length === 0;
  return (
    <section className="border-t border-slate-200/70 bg-white dark:border-slate-800/70 dark:bg-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className={BAND_EYEBROW}>From the Community</p>
          <h2 className={BAND_TITLE}>Made by people like you</h2>
          <p className={BAND_LEAD}>
            Documents people are proud of, shared for anyone to open and make their own. Find a
            starting point, or share yours.
          </p>
        </div>

        {empty ? (
          <div className="mx-auto mt-12 max-w-md rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-300">
              The Community is just getting started. Be one of the first to share a document.
            </p>
          </div>
        ) : (
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.status === 'loading'
              ? Array.from({ length: COMMUNITY_FEATURED_COUNT }, (_, i) => (
                  <li key={i} className="flex">
                    <CommunityPostTileSkeleton />
                  </li>
                ))
              : posts.map((post) => (
                  <li key={post.id} className="flex">
                    <CommunityPostTile
                      post={post}
                      href={communityPostPath(post.id)}
                      imageUrl={`${API_BASE}${communityImagePath(post.shareCode)}`}
                      stats={
                        <>
                          <CommunityLikeCount count={post.likeCount} />
                          <CommunityCopyCount count={post.copyCount} />
                        </>
                      }
                      now={now}
                    />
                  </li>
                ))}
          </ul>
        )}

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <a
            href="/community/"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition hover:border-brand-300 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500/60"
          >
            Explore the Community
          </a>
          <CommunityHelpLink article="finding">How the Community Works</CommunityHelpLink>
        </div>
      </div>
    </section>
  );
}
