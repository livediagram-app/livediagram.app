import type { GalleryPost } from '@/lib/gallery-post';
import { useState } from 'react';
import { PostCard } from './PostCard';
import { PostCardSkeleton } from './PostCardSkeleton';

// The responsive card grid (blueprint §9): 1 / 2 / 3 / 4 columns at <640 / 640 / 1024 / 1280 px.
export const POST_GRID = 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

export function PostGrid({
  posts,
  skeletons = 0,
  label,
}: {
  posts: readonly GalleryPost[];
  // Placeholder cards after the posts (the first load, or the next page loading).
  skeletons?: number;
  label?: string;
}) {
  // One clock reading for the whole grid, so every card's "2 days ago" agrees.
  const [now] = useState(Date.now);
  return (
    // `lvd-cascade` (the shared theme's entrance, docs/specs/004-interface-design/motion.md): each card rises and
    // fades in one beat after the last when it mounts, so a new set of results settles in rather than snapping.
    // A card that re-renders (a like) keeps still; only new results and Load More's page animate.
    <ul
      className={`${POST_GRID} lvd-cascade`}
      aria-label={label}
      aria-busy={skeletons > 0 || undefined}
    >
      {posts.map((post) => (
        <li key={post.id} className="flex flex-col">
          <PostCard post={post} now={now} />
        </li>
      ))}
      {Array.from({ length: skeletons }, (_, i) => (
        <li key={`skeleton-${i}`} className="flex flex-col">
          <PostCardSkeleton />
        </li>
      ))}
    </ul>
  );
}
