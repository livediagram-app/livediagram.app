import type { CommunityPost } from '@livediagram/api-schema';
import { PostCard } from './PostCard';
import { PostCardSkeleton } from './PostCardSkeleton';

// The responsive card grid (blueprint §9): 1 / 2 / 3 / 4 columns at <640 / 640 / 1024 / 1280 px.
export const POST_GRID = 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

export function PostGrid({
  posts,
  skeletons = 0,
  label,
}: {
  posts: readonly CommunityPost[];
  // Placeholder cards after the posts (the first load, or the next page loading).
  skeletons?: number;
  label?: string;
}) {
  return (
    <ul className={POST_GRID} aria-label={label} aria-busy={skeletons > 0 || undefined}>
      {posts.map((post) => (
        <li key={post.id} className="flex flex-col">
          <PostCard post={post} />
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
