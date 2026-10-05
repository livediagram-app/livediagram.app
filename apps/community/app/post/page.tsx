import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PostView } from '@/components/post/PostView';
import { PostSkeleton } from '@/components/post/PostStates';

// One post (docs/specs/025-community/community.md "Post"): `/community/post/?id=<postId>`. The page is
// one static shell; the id is read on the client (useSearchParams, inside Suspense as the static
// export requires) and the post loads from the api.
// No canonical in the shell: one shell serves every post, so a fixed one would fold them all into one page for
// search engines (and leaving it out would inherit the gallery's). PostView sets the post's own once it loads.
export const metadata: Metadata = {
  title: 'Community Document',
  alternates: {},
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
