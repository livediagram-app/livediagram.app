'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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

  // The tab names the board once it is known (the static shell carries a generic title).
  useEffect(() => {
    if (title) document.title = `${title} | livediagram Community`;
  }, [title]);

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
            className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]"
          >
            <EmbedFrame shareCode={load.data.post.shareCode} title={load.data.post.title} />
            <div className="flex flex-col gap-8 lg:sticky lg:top-24">
              <PostMeta post={load.data.post} />
              <PostActions post={load.data.post} />
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
