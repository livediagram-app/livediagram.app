'use client';

import Link from 'next/link';
import { CommunityCopyCount, CommunityPostTile } from '@livediagram/ui';
import { postImageUrl } from '@/lib/api';
import { isMinePost, type GalleryPost } from '@/lib/gallery-post';
import { editDocumentHref, postHref } from '@/lib/links';
import { useLike } from '@/lib/useLike';
import { HiddenIcon } from './icons';
import { LikeButton } from './LikeButton';

// One post in the gallery (docs/specs/025-community/community.md "Gallery"): the shared Community card
// with the live heart, which likes in place, and the copy count in its corner. In My Shares a hidden post
// says so, and opens the author's document in the editor, since its public page is gone.
export function PostCard({ post, now }: { post: GalleryPost; now: number }) {
  const like = useLike(post);
  const hidden = isMinePost(post) && post.state === 'hidden';
  return (
    <CommunityPostTile
      post={post}
      href={hidden ? editDocumentHref(post.documentId) : postHref(post.id)}
      imageUrl={postImageUrl(post.shareCode)}
      now={now}
      // The editor is outside this app's basePath, so its link is a plain anchor.
      LinkComponent={hidden ? undefined : Link}
      badge={
        hidden ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 shadow-sm ring-1 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/30">
            <HiddenIcon aria-hidden />
            Hidden
          </span>
        ) : undefined
      }
      stats={
        <>
          <LikeButton like={like} />
          <CommunityCopyCount count={post.copyCount} />
        </>
      }
    />
  );
}
