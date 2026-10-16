'use client';

import { useEffect, useState, useRef } from 'react';
import {
  COMMUNITY_FEATURED_COUNT,
  communityImagePath,
  communityPostPath,
  type CommunityFeaturedResponse,
  type CommunityPost,
  COMMUNITY_HOME_PATH,
  isAbortError,
} from '@livediagram/api-schema';
import {
  buttonClassName,
  ButtonContent,
  CommunityCopyCount,
  CommunityHelpLink,
  CommunityLikeCount,
  CommunityPostTile,
  CommunityPostTileSkeleton,
  useNearViewport,
} from '@livediagram/ui';
import { BAND_LEAD, BAND_TITLE } from '@/components/band-classes';
import { EYEBROW } from '@/components/eyebrow';

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

function useFeatured(near: boolean): State {
  const [state, setState] = useState<State>({ status: 'loading' });
  useEffect(() => {
    if (!near) return;
    const controller = new AbortController();
    fetch(`${API_BASE}/community/featured`, { signal: controller.signal })
      .then(async (res) => {
        if (res.status === 404) return setState({ status: 'off' });
        const body: Partial<CommunityFeaturedResponse> = res.ok ? await res.json() : {};
        setState({ status: 'ready', posts: body.posts ?? [] });
      })
      .catch((err: unknown) => {
        if (isAbortError(err)) return;
        console.warn('[community] featured load failed', err);
        setState({ status: 'ready', posts: [] });
      });
    return () => controller.abort();
  }, [near]);
  return state;
}

export function CommunityShowcase() {
  // Below the fold: its one request (the featured posts) waits until the section comes near, so a visit that never
  // scrolls there costs nothing, and it never competes with the page's first paint.
  const sectionRef = useRef<HTMLElement>(null);
  const featured = useFeatured(useNearViewport(sectionRef));
  // One clock reading for the six, so their "2 days ago" agree.
  const [now] = useState(Date.now);
  // Switched off (docs/specs/025-community/community.md "Turning the Community off"), the featured answer is a 404
  // and the section is not there.
  if (featured.status === 'off') return null;
  const posts = featured.status === 'ready' ? featured.posts : [];
  const empty = featured.status === 'ready' && posts.length === 0;
  return (
    <section
      ref={sectionRef}
      className="border-t border-slate-200/70 bg-white dark:border-slate-800/70 dark:bg-slate-900"
    >
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className={EYEBROW}>From the Community</p>
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
            href={COMMUNITY_HOME_PATH}
            className={buttonClassName({ variant: 'secondary', size: 'cta-sm' })}
          >
            <ButtonContent>Explore the Community</ButtonContent>
          </a>
          <CommunityHelpLink article="finding">How the Community Works</CommunityHelpLink>
        </div>
      </div>
    </section>
  );
}
