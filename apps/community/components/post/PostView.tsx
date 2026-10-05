'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { communityPostPath } from '@livediagram/api-schema';
import { BackIcon } from '../shared/icons';
import { EmbedFrame } from './EmbedFrame';
import { PostActions } from './PostActions';
import { PostMeta } from './PostMeta';
import { PostError, PostNotFound, PostSkeleton } from './PostStates';
import { RelatedPosts } from './RelatedPosts';
import { usePost } from './usePost';

// The post page (docs/specs/025-community/community.md "Post"; blueprint §5): the interactive preview
// beside what the post says and what you can do with it, then More Like This. The id comes from the
// query string (`/community/post/?id=`) because the app is a static export.
export function PostView() {
  const id = useSearchParams().get('id');
  const { load, retry } = usePost(id);
  const title = load.status === 'ready' ? load.data.post.title : null;

  // The tab names the document once it is known (the static shell carries a generic title), and the page names its
  // own address as canonical (the shell carries none, since one shell serves every post).
  useEffect(() => {
    if (title) document.title = `${title} | livediagram Community`;
  }, [title]);
  useEffect(() => {
    if (load.status !== 'ready' || !id) return;
    // Leaving the post (Back to Community is a client-side navigation) puts the head back as it was, so the
    // gallery never carries the post's canonical.
    const existing = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const link = existing ?? document.createElement('link');
    const previous = existing?.href ?? null;
    if (!existing) {
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = new URL(communityPostPath(id), window.location.origin).href;
    return () => {
      if (previous === null) link.remove();
      else link.href = previous;
    };
  }, [load.status, id]);

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors duration-micro hover:text-brand-700 dark:text-slate-400 dark:hover:text-brand-300"
      >
        <BackIcon size={15} aria-hidden />
        Back to Community
      </Link>
      {load.status === 'loading' ? (
        <PostSkeleton />
      ) : load.status === 'notFound' ? (
        <PostNotFound />
      ) : load.status === 'error' ? (
        <PostError onRetry={retry} />
      ) : (
        <>
          <article
            key={load.data.post.id}
            className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-10"
          >
            {/* Below lg the side column dissolves into the page's single column, so the title reads first, then
                the document, then what you can do with it; from lg the document sits beside a sticky column. */}
            <div className="max-lg:order-2">
              <EmbedFrame shareCode={load.data.post.shareCode} title={load.data.post.title} />
            </div>
            <div className="flex flex-col gap-8 max-lg:contents lg:sticky lg:top-24">
              <div className="max-lg:order-1">
                <PostMeta post={load.data.post} />
              </div>
              <div className="max-lg:order-3">
                <PostActions post={load.data.post} />
              </div>
            </div>
          </article>
          <div className="mt-8">
            <RelatedPosts posts={load.data.related} />
          </div>
        </>
      )}
    </div>
  );
}
