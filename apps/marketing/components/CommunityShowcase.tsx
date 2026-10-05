'use client';

import { useEffect, useState } from 'react';
import {
  COMMUNITY_FEATURED_COUNT,
  communityImagePath,
  type CommunityFeaturedResponse,
  type CommunityPost,
} from '@livediagram/api-schema';
import { CommunityPostTile, CopyIcon } from '@livediagram/ui';
import { BAND_EYEBROW, BAND_LEAD, BAND_TITLE } from '@/components/band-classes';

// The landing page's Community section (docs/specs/025-community/community.md "Featured on the home page";
// docs/specs/019-marketing/marketing-site.md): six documents people are proud of, the most liked over the
// last three months topped up with the best of all time, picked by the api. The page is a static export,
// so the six arrive after it loads: placeholder cards hold their space meanwhile (no layout shift), and
// with nothing to show (an empty Community, the api unreachable) the section invites the first share.

const API_BASE = '/api';
type State = { status: 'loading' } | { status: 'ready'; posts: CommunityPost[] };

function useFeatured(): State {
  const [state, setState] = useState<State>({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/community/featured`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<CommunityFeaturedResponse>) : { posts: [] }))
      .then((body) => setState({ status: 'ready', posts: body.posts ?? [] }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.warn('[community] featured load failed', err);
        setState({ status: 'ready', posts: [] });
      });
    return () => controller.abort();
  }, []);
  return state;
}

function Counts({ post }: { post: CommunityPost }) {
  return (
    <span className="inline-flex items-center gap-3 tabular-nums text-slate-500 dark:text-slate-400">
      <span aria-label={`${post.likeCount} likes`} className="inline-flex items-center gap-1">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>
        {post.likeCount}
      </span>
      <span
        aria-label={`Copied ${post.copyCount} times`}
        className="inline-flex items-center gap-1"
      >
        <CopyIcon size={13} aria-hidden />
        {post.copyCount}
      </span>
    </span>
  );
}

function Placeholder() {
  return (
    <div
      aria-hidden
      className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="aspect-[4/3] animate-pulse bg-slate-100 motion-reduce:animate-none dark:bg-slate-800/60" />
      <div className="flex flex-col gap-2 p-4">
        <div className="h-4 w-2/3 rounded bg-slate-100 dark:bg-slate-800" />
        <div className="h-3 w-1/3 rounded bg-slate-100 dark:bg-slate-800" />
        <div className="mt-3 h-5 w-1/2 rounded bg-slate-100 dark:bg-slate-800" />
      </div>
    </div>
  );
}

export function CommunityShowcase() {
  const featured = useFeatured();
  const posts = featured.status === 'ready' ? featured.posts : [];
  const empty = featured.status === 'ready' && posts.length === 0;
  return (
    <section className="border-t border-slate-200/70 bg-white dark:border-slate-800/70 dark:bg-slate-900/40">
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
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.status === 'loading'
              ? Array.from({ length: COMMUNITY_FEATURED_COUNT }, (_, i) => (
                  <li key={i} className="flex">
                    <Placeholder />
                  </li>
                ))
              : posts.map((post) => (
                  <li key={post.id} className="flex">
                    <CommunityPostTile
                      post={post}
                      href={`/community/post/?id=${encodeURIComponent(post.id)}`}
                      imageUrl={`${API_BASE}${communityImagePath(post.shareCode)}`}
                      stats={<Counts post={post} />}
                    />
                  </li>
                ))}
          </ul>
        )}

        <div className="mt-10 flex justify-center">
          <a
            href="/community/"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition hover:border-brand-300 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500/60"
          >
            Explore the Community
          </a>
        </div>
      </div>
    </section>
  );
}
