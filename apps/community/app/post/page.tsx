import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PostView } from '@/components/post/PostView';
import { PostSkeleton } from '@/components/post/PostStates';

// One post (docs/specs/025-community/community.md "Post"): `/community/post/?id=<postId>`. The page is
// one static shell; the id is read on the client (useSearchParams, inside Suspense as the static
// export requires) and the post loads from the api.
export const metadata: Metadata = {
  title: 'Community Document',
  alternates: { canonical: '/community/post/' },
};

export default function PostPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-10 md:px-8">
      <Suspense fallback={<PostSkeleton />}>
        <PostView />
      </Suspense>
    </div>
  );
}
