'use client';

// One client boundary for the whole page (its skeleton reads the app's binding too), so the page loads one client entry.
import { Suspense } from 'react';
import { PostSkeleton } from './components/post/PostStates';
import { PostView } from './components/post/PostView';

// One post (`/community/post/?id=<postId>`), the same in every app: an app's `app/post/page.tsx` renders it under its own
// metadata. Its own entry (`./post`), so the gallery and the layout never load it. The page is one static shell; the id
// is read on the client (useSearchParams, inside Suspense as the static export requires) and the post loads from the
// service.
export function CommunityPostPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-10 md:px-8">
      <Suspense fallback={<PostSkeleton />}>
        <PostView />
      </Suspense>
    </div>
  );
}
