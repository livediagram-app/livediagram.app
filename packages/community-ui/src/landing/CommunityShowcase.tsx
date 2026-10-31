'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { isAbortError } from '@liveworkspace/api-schema/http-errors';
import {
  COMMUNITY_FEATURED_COUNT,
  communityServiceUrl,
  type CommunityApp,
  type CommunityFeaturedResponse,
  type CommunityPost,
} from '@liveworkspace/community';
import { BAND_LEAD, BAND_TITLE } from '@liveworkspace/marketing-site/lib/band-classes';
import { EYEBROW } from '@liveworkspace/marketing-site/lib/eyebrow';
import { buttonClassName, ButtonContent, useNearViewport } from '@liveworkspace/ui';
import type { CommunityWords } from '../share/host';
import { CommunityCopyCount, CommunityLikeCount } from '../tile/CommunityCounts';
import { CommunityPostTile } from '../tile/CommunityPostTile';
import { CommunityPostTileSkeleton } from '../tile/CommunityPostTileSkeleton';

// An app's landing page Community section (liveworkspace/docs/specs/007-community/community.md "Every app's Community":
// "The landing page"; each product's 025-community "Featured on the home page"): six documents people are proud of,
// the most liked over the last three months topped up with the best of all time, picked by the liveworkspace
// Community service from the app's posts. The page is a static export, so the six arrive after it loads: placeholder
// cards hold their space meanwhile (no layout shift), and with nothing to show (an empty Community, the service
// unreachable) the section invites the first share. While the Community is switched off the section is not shown.

// The gallery, and a post's page, on the app's own site (every app serves its Community at /community).
const COMMUNITY_HOME_PATH = '/community/';
const postPath = (id: string) => `/community/post/?id=${encodeURIComponent(id)}`;

type State =
  | { status: 'loading' }
  | { status: 'ready'; posts: CommunityPost[] }
  // The service answered 404: the Community is switched off, so the section is not shown at all.
  | { status: 'off' };

function useFeatured(url: string, near: boolean): State {
  const [state, setState] = useState<State>({ status: 'loading' });
  useEffect(() => {
    if (!near) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (res.status === 404) return setState({ status: 'off' });
        const body = (res.ok ? await res.json() : {}) as Partial<CommunityFeaturedResponse>;
        setState({ status: 'ready', posts: body.posts ?? [] });
      })
      .catch((err: unknown) => {
        if (isAbortError(err)) return;
        console.warn('[community] featured load failed', err);
        setState({ status: 'ready', posts: [] });
      });
    return () => controller.abort();
  }, [url, near]);
  return state;
}

export function CommunityShowcase({
  app,
  words,
  imageUrl,
  communityApi,
  helpLink,
}: {
  // Whose posts it features.
  app: CommunityApp;
  // The app's words (COMMUNITY_APP_WORDS from @liveworkspace/community-ui/words).
  words: CommunityWords;
  // A post's live card image: the app's api's, since the document is the app's.
  imageUrl: (shareCode: string) => string;
  // The Community service the build names (NEXT_PUBLIC_COMMUNITY_API); unset means production's.
  communityApi?: string;
  // The app's How the Community Works link, beside Explore the Community.
  helpLink: ReactNode;
}) {
  const url = communityServiceUrl(app, '/featured', { base: communityApi });
  // Below the fold: its one request (the featured posts) waits until the section comes near, so a visit that never
  // scrolls there costs nothing, and it never competes with the page's first paint.
  const sectionRef = useRef<HTMLElement>(null);
  const featured = useFeatured(url, useNearViewport(sectionRef));
  // One clock reading for the six, so their "2 days ago" agree.
  const [now] = useState(Date.now);
  // Switched off, the featured answer is a 404 and the section is not there.
  if (featured.status === 'off') return null;
  const posts = featured.status === 'ready' ? featured.posts : [];
  const empty = featured.status === 'ready' && posts.length === 0;
  const Nouns = words.nouns.charAt(0).toUpperCase() + words.nouns.slice(1);
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
            {Nouns} people are proud of, shared for anyone to open and make their own. Find a
            starting point, or share yours.
          </p>
        </div>

        {empty ? (
          <div className="mx-auto mt-12 max-w-md rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-300">
              The Community is just getting started. Be one of the first to share a {words.noun}.
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
                      href={postPath(post.id)}
                      imageUrl={imageUrl(post.shareCode)}
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
          {helpLink}
        </div>
      </div>
    </section>
  );
}
