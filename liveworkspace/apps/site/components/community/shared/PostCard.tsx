'use client';

import Link from 'next/link';
import { CommunityCopyCount, CommunityPostTile } from '@liveworkspace/community-ui';
import { useCommunitySite } from '../client';
import { isMinePost, type GalleryPost } from '../lib/gallery-post';
import { useLike } from '../lib/useLike';
import { HiddenIcon } from './icons';
import { LikeButton } from './LikeButton';

// One post in the gallery (liveworkspace/docs/specs/007-community/community.md "The gallery"): the shared Community card
// with the live heart, which likes in place, and the copy count in its corner. In My Shares a hidden post
// says so, and opens the author's document in the editor, since its public page is gone.
export function PostCard({
  post,
  now,
  priority = false,
}: {
  post: GalleryPost;
  now: number;
  // In the first row on screen (see CommunityPostTile's `priority`).
  priority?: boolean;
}) {
  const { links } = useCommunitySite();
  const like = useLike(post);
  const hidden = isMinePost(post) && post.state === 'hidden';
  const page = links.post(post);
  return (
    <CommunityPostTile
      post={post}
      href={hidden ? links.editDocument(post) : page.href}
      imageUrl={links.image(post)}
      now={now}
      priority={priority}
      // A post of this address's app opens in place; the editor, and another app's post (All Apps), are other
      // pages, so their links are plain anchors.
      LinkComponent={hidden || page.external ? undefined : Link}
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
