'use client';

import Link from 'next/link';
import type { CommunityPost } from '@livediagram/api-schema';
import { CommunityPostTile, CopyIcon } from '@livediagram/ui';
import { postImageUrl } from '@/lib/api';
import { formatCount } from '@/lib/format';
import { postHref } from '@/lib/links';
import { useLike } from '@/lib/useLike';
import { LikeButton } from './LikeButton';

// One post in the gallery (docs/specs/025-community/community.md "Gallery"): the shared Community card
// with the live heart, which likes in place, and the copy count in its corner.
export function PostCard({ post }: { post: CommunityPost }) {
  const like = useLike(post);
  return (
    <CommunityPostTile
      post={post}
      href={postHref(post.id)}
      imageUrl={postImageUrl(post.shareCode)}
      LinkComponent={Link}
      stats={
        <>
          <LikeButton like={like} />
          <span
            className="inline-flex items-center gap-1 px-1.5 py-1 tabular-nums text-slate-500 dark:text-slate-400"
            aria-label={`Copied ${post.copyCount} ${post.copyCount === 1 ? 'time' : 'times'}`}
          >
            <CopyIcon size={13} aria-hidden />
            <span aria-hidden>{formatCount(post.copyCount)}</span>
          </span>
        </>
      }
    />
  );
}
