'use client';

// One client boundary for the whole page (its skeleton reads the app's binding too), so the page loads one client entry.
import { Suspense } from 'react';
import { PostSkeleton } from './post/PostStates';
import { PostView } from './post/PostView';

// One post (`/community/post?id=<postId>`), on its app's address: app/community/post/page.tsx renders it. The page is
// one static shell, its head filled in by the app's router (@liveworkspace/community-site/router); the id is read on
// the client (useSearchParams, inside Suspense as the static export requires) and the post loads from the service.
export function CommunityPostPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-10 md:px-8">
      <Suspense fallback={<PostSkeleton />}>
        <PostView />
      </Suspense>
    </div>
  );
}
