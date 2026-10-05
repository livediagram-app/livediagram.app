import type { CommunityPost } from '@livediagram/api-schema';
import { PostGrid } from '../shared/PostGrid';

// More Like This (docs/specs/025-community/community.md "Post"): up to six other posts in the same
// category, most loved first. Left out when there are none.
export function RelatedPosts({ posts }: { posts: readonly CommunityPost[] }) {
  if (posts.length === 0) return null;
  return (
    <section aria-labelledby="more-like-this" className="flex flex-col gap-5">
      <h2
        id="more-like-this"
        className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white"
      >
        More Like This
      </h2>
      <PostGrid posts={posts} />
    </section>
  );
}
